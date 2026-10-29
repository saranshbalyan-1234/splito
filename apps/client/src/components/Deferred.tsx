import {type ReactNode, useState} from 'react'

import {useDeferredReady} from '#/lib/hooks/useAfterTransition'

/**
 * The one way a screen, tab or sheet defers its heavy body (ARCHITECTURE
 * 26.9, owners 151/152): the shell paints first, the children mount right
 * after as a transition. `when` holds the body back until data is there.
 * `fallback` (a same-size skeleton) shows only when the data was missing at
 * mount; with the data already there the body slot is empty for two frames
 * instead, so a hot tab switch never flashes a skeleton. `sameSize` shows the
 * fallback anyway, for a block below a header that must not shift when it
 * fills in (a chart under the summary). A function child
 * runs only when the body mounts, so it may read what `when` guards.
 */
export function Deferred({
  when = true,
  fallback = null,
  sameSize = false,
  children,
}: {
  when?: boolean
  sameSize?: boolean
  fallback?: ReactNode
  children: ReactNode | (() => ReactNode)
}) {
  const [wasReadyAtMount] = useState(when)
  if (!useDeferredReady(when)) return wasReadyAtMount && !sameSize ? null : fallback
  return typeof children === 'function' ? children() : children
}
