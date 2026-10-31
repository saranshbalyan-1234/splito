import {useEffect, useState} from 'react'

import {ILLUSTRATIONS, type IllustrationName, type LottieJson} from '#/motion/illustrations'

const loaded = new Map<string, LottieJson>()

/**
 * The Lottie JSON of an illustration for the light or dark file, fetched as its
 * own chunk the first time it is needed and kept after that (a second empty
 * state of the same art draws at once). `undefined` while it loads: callers
 * draw their fixed-size box and nothing else.
 */
export function useIllustrationSource(name: IllustrationName, isDark: boolean) {
  const key = `${name}${isDark ? '-dark' : ''}`
  /* State holds what arrived, so the hook re-reads after the fetch (the React Compiler would cache a bare read of `loaded`). */
  const [arrived, setArrived] = useState<{key: string; json: LottieJson}>()
  useEffect(() => {
    // Filled by another instance between this render and this effect: take it, or this one stays blank (review F-260).
    if (loaded.has(key)) {
      const json = loaded.get(key)!
      setArrived(prev => (prev?.key === key ? prev : {key, json}))
      return
    }
    let isCurrent = true
    const art = ILLUSTRATIONS[name]
    void (isDark ? art.loadDark() : art.load()).then(m => {
      const json = ((m as {default?: unknown}).default ?? m) as LottieJson
      loaded.set(key, json)
      if (isCurrent) setArrived({key, json})
    })
    return () => {
      isCurrent = false
    }
  }, [key, name, isDark])
  return arrived?.key === key ? arrived.json : loaded.get(key)
}
