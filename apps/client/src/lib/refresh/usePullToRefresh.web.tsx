import {memo, useEffect, useRef} from 'react'
import {useLingui} from '@lingui/react/macro'

import {Loader_Stroke2_Corner0_Rounded as Loader} from '#/components/icons/Loader'
import {useRefreshHandler} from '#/state/refresh/useRefreshHandler'
import {registerSurface, type Surface} from '#/lib/refresh/pullController'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {useTheme} from '#/alf'

/**
 * Pull to refresh for a list or scroll view on phone web (owners 167, 169, 170). The caller puts `contentRef` on the
 * element that holds its content and draws `indicator` just above it, inside a positioned parent; the content moves
 * down under the header while the spinner shows in the room that opens above it, and the header, which sits above the
 * list in the screen, never moves. All the movement is written straight to these nodes by `pullController`, so a pull
 * renders nothing, and there is no wrapper element to redraw with the list (owner 166). `enabled` is false in dialogs
 * and in a contained scroller, where the window is not the one scrolling. Needs a `Layout.Screen` around it (the touch
 * must start inside one).
 */
export function usePullToRefresh({enabled = true, onRefresh}: {enabled?: boolean; onRefresh?: () => void | Promise<unknown>}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const reduced = useShouldReduceMotion()
  const refresh = useRefreshHandler(onRefresh)
  const content = useRef<HTMLElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  const spinner = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLDivElement>(null)
  // What the controller reads live, so a change of motion setting or language needs no re-registering.
  const live = useRef({reduced, texts: {pull: '', release: '', refreshing: ''}})
  live.current = {
    reduced,
    texts: {pull: l`Pull to refresh`, release: l`Release to refresh`, refreshing: l`Refreshing…`},
  }

  useEffect(() => {
    const node = content.current
    const screen = node?.closest<HTMLElement>('[data-screen]')
    if (!enabled || !node || !screen) return
    return registerSurface({
      screen,
      content: node,
      indicator: indicator.current!,
      spinner: spinner.current!,
      label: label.current!,
      reduced: () => live.current.reduced,
      texts: () => live.current.texts,
      refresh,
    } satisfies Surface)
  }, [enabled, refresh])

  return {
    contentRef: content as React.RefObject<never>,
    indicator: enabled ? (
      <PullIndicator
        indicator={indicator}
        spinner={spinner}
        label={label}
        color={t.palette.primary_500}
        pillBackground={t.palette.contrast_50}
        pillColor={t.palette.contrast_700}
      />
    ) : null,
  }
}

type NodeRef = React.RefObject<HTMLDivElement | null>

/** Static markup the controller writes to; memoised so a list that redraws does not redraw its spinner (owner 166). */
const PullIndicator = memo(function PullIndicator({
  indicator,
  spinner,
  label,
  color,
  pillBackground,
  pillColor,
}: {
  indicator: NodeRef
  spinner: NodeRef
  label: NodeRef
  color: string
  pillBackground: string
  pillColor: string
}) {
  return (
    <div
      ref={indicator}
      role="status"
      aria-hidden="true"
      data-testid="pull-indicator"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 0,
        opacity: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
      <div ref={spinner} style={{display: 'flex', color}}>
        <Loader size="lg" />
      </div>
      <div
        ref={label}
        style={{display: 'none', padding: '6px 14px', borderRadius: 999, fontSize: 14, background: pillBackground, color: pillColor}}
      />
    </div>
  )
})
