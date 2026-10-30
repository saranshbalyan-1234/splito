import {useEffect, useLayoutEffect, useState} from 'react'

import {OPENED_FALLBACK_MS, OpenedContext} from '#/lib/hooks/useAfterTransition'

/**
 * Owns `opened` for one open sheet, popup or composer (it mounts and unmounts with it), so the flip when the
 * motion ends re-renders only what reads `OpenedContext`, not the shell that animates (owner 168). The owner
 * calls `setterRef.current(true)` on the real end of the motion; a timer opens it if that never comes.
 */
export function OpenedProvider({
  setterRef,
  children,
}: {
  setterRef: React.RefObject<((opened: boolean) => void) | null>
  children: React.ReactNode
}) {
  const [opened, setOpened] = useState(false)
  useLayoutEffect(() => {
    setterRef.current = setOpened
    return () => {
      setterRef.current = null
    }
  }, [setterRef])
  useEffect(() => {
    const id = setTimeout(() => setOpened(true), OPENED_FALLBACK_MS)
    return () => clearTimeout(id)
  }, [])
  return <OpenedContext.Provider value={opened}>{children}</OpenedContext.Provider>
}
