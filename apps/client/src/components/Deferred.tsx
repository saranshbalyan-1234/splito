import {type ReactNode, useState} from 'react'

import {useDeferredReady} from '#/lib/hooks/useAfterTransition'

/**
 * What a `Deferred` shows. The body once `ready`. Otherwise the same-size
 * skeleton while the data is missing (`when` false), or the slot is empty for
 * the two frames before a hot body mounts so a tab switch never flashes a
 * skeleton; `sameSize` shows the skeleton in that wait too, for a block below a
 * header that must not shift when it fills in (a chart under the summary).
 * Pure, so the rule is unit-tested.
 */
export function deferredSlot({
  ready,
  when,
  wasReadyAtMount,
  sameSize,
}: {
  ready: boolean
  when: boolean
  wasReadyAtMount: boolean
  sameSize: boolean
}): 'body' | 'fallback' | 'empty' {
  if (ready) return 'body'
  return when && wasReadyAtMount && !sameSize ? 'empty' : 'fallback'
}

/**
 * The one way a screen, tab or sheet defers its heavy body (ARCHITECTURE
 * 26.9, owners 151/152): the shell paints first, the children mount right
 * after as a transition. `when` holds the body back until data is there (and
 * takes it away in the same render when the data goes). A function child runs
 * only when the body mounts, so it may read what `when` guards.
 */
export function Deferred({
  when = true,
  fallback = null,
  sameSize = false,
  opened,
  children,
}: {
  when?: boolean
  /** The end of the motion this sits in, when the caller has it; sheets, popups and the drawer provide it through `OpenedContext`. */
  opened?: boolean
  fallback?: ReactNode
  sameSize?: boolean
  children: ReactNode | (() => ReactNode)
}) {
  const [wasReadyAtMount] = useState(when)
  const ready = useDeferredReady(when, opened)
  const slot = deferredSlot({ready, when, wasReadyAtMount, sameSize})
  if (slot === 'body') return typeof children === 'function' ? children() : children
  return slot === 'fallback' ? fallback : null
}
