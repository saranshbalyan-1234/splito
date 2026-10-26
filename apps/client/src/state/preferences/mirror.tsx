import {useEffect} from 'react'
import {ReducedMotionConfig, ReduceMotion} from 'react-native-reanimated'
import {getPref, type PrefValue} from '@splito/sync'

import {getFontScale, useAlf} from '#/alf'
import {useStore} from '#/data/hooks'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {type Device, device} from '#/storage'

/** The Text size choices, as ALF font scale steps (Bluesky's 1/16 increments). */
export const TEXT_SCALE_STEPS: [Device['fontScale'], number][] = [
  ['-1', 0.9375],
  ['0', 1],
  ['1', 1.0625],
  ['2', 1.125],
]

/** The ALF font scale step closest to a `textScale` preference value. */
export function fontScaleFor(
  textScale: PrefValue<'textScale'>,
): Device['fontScale'] {
  let best = TEXT_SCALE_STEPS[1]!
  for (const step of TEXT_SCALE_STEPS) {
    if (Math.abs(step[1] - textScale) < Math.abs(best[1] - textScale))
      best = step
  }
  return best[0]
}

function put<K extends keyof Device>(key: K, value: Device[K]) {
  if (device.get([key]) !== value) device.set([key], value)
}

/**
 * Applies app-wide preferences. Copies the ones that shape the first frame
 * (theme, accent, text size, density, home tab, haptics) from the registry into
 * synchronous device storage after every store commit. The registry stays
 * the source of truth; the copy only exists so the next launch paints right
 * before the local store opens.
 */
export function PrefsMirror() {
  const store = useStore()
  const {setFontScale} = useAlf().fonts

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      const [theme, darkTheme, accent, textScale, haptics, density, homeTab] =
        await Promise.all([
          getPref(store, 'theme'),
          getPref(store, 'darkTheme'),
          getPref(store, 'accent'),
          getPref(store, 'textScale'),
          getPref(store, 'haptics'),
          getPref(store, 'density'),
          getPref(store, 'homeTab'),
        ])
      if (cancelled) return
      put('colorMode', theme)
      put('darkTheme', darkTheme)
      put('accent', accent)
      put('hapticsEnabled', haptics)
      put('density', density)
      put('homeTab', homeTab)
      const scale = fontScaleFor(textScale)
      if (scale !== getFontScale()) setFontScale(scale)
    }
    void sync()
    const off = store.subscribe(() => void sync())
    return () => {
      cancelled = true
      off()
    }
  }, [store, setFontScale])

  /*
   * The Animations preference (or the OS setting) also reaches every
   * Reanimated animation, Bluesky's included: reduced and off land them on
   * their final frame.
   */
  const shouldReduceMotion = useShouldReduceMotion()
  return (
    <ReducedMotionConfig
      mode={shouldReduceMotion ? ReduceMotion.Always : ReduceMotion.System}
    />
  )
}
