import {useEffect} from 'react'
import {ReducedMotionConfig, ReduceMotion} from 'react-native-reanimated'
import {type PrefValue} from '@splito/sync'

import {getFontScale, useAlf} from '#/alf'
import {usePref} from '#/data/hooks'
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
 * (theme, accent, text size, density, money colours, home tab, haptics, the sync dot) from the registry into
 * synchronous device storage whenever one changes. The registry stays
 * the source of truth; the copy only exists so the next launch paints right
 * before the local store opens.
 */
export function PrefsMirror() {
  const {setFontScale} = useAlf().fonts
  // One shared read of the preference rows serves all eight (data/projections).
  const [theme] = usePref('theme')
  const [darkTheme] = usePref('darkTheme')
  const [accent] = usePref('accent')
  const [textScale] = usePref('textScale')
  const [haptics] = usePref('haptics')
  const [density] = usePref('density')
  const [homeTab] = usePref('homeTab')
  const [moneyPalette] = usePref('moneyPalette')
  const [showSyncStatus] = usePref('showSyncStatus')

  useEffect(() => {
    // All eight come from the same rows, so they arrive together.
    if (
      theme === undefined ||
      darkTheme === undefined ||
      accent === undefined ||
      textScale === undefined ||
      haptics === undefined ||
      density === undefined ||
      homeTab === undefined ||
      moneyPalette === undefined ||
      showSyncStatus === undefined
    )
      return
    put('colorMode', theme)
    put('darkTheme', darkTheme)
    put('accent', accent)
    put('hapticsEnabled', haptics)
    put('density', density)
    put('moneyPalette', moneyPalette)
    put('showSyncStatus', showSyncStatus)
    put('homeTab', homeTab)
    const scale = fontScaleFor(textScale)
    if (scale !== getFontScale()) setFontScale(scale)
  }, [theme, darkTheme, accent, textScale, haptics, density, homeTab, moneyPalette, showSyncStatus, setFontScale])

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
