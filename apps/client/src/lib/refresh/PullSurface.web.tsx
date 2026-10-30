import {memo, useEffect, useRef} from 'react'
import {useLingui} from '@lingui/react/macro'

import {Loader_Stroke2_Corner0_Rounded as Loader} from '#/components/icons/Loader'
import {useRefreshHandler} from '#/state/refresh/useRefreshHandler'
import {registerSurface, type Surface} from '#/lib/refresh/pullController'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {useTheme} from '#/alf'

/**
 * Wraps a list's or scroll view's content on phone web and gives it pull to refresh (owners 167, 169, 170). The
 * content moves down under the header while the spinner shows in the room that opens above it; the header, which sits
 * above the list in the screen, never moves. All the movement is written straight to these nodes by
 * `pullController`, so a pull renders nothing. `enabled` is false in dialogs and in a contained scroller, where the
 * window is not the one scrolling. Needs a `Layout.Screen` around it (the touch must start inside one).
 */
export function PullSurface({
  enabled = true,
  onRefresh,
  children,
}: {
  enabled?: boolean
  onRefresh?: () => void | Promise<unknown>
  children: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const reduced = useShouldReduceMotion()
  const refresh = useRefreshHandler(onRefresh)
  const root = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
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
    const screen = root.current?.closest<HTMLElement>('[data-screen]')
    if (!enabled || !screen) return
    return registerSurface({
      screen,
      content: content.current!,
      indicator: indicator.current!,
      spinner: spinner.current!,
      label: label.current!,
      reduced: () => live.current.reduced,
      texts: () => live.current.texts,
      refresh,
    } satisfies Surface)
  }, [enabled, refresh])

  if (!enabled) return <>{children}</>
  return (
    <div ref={root} style={{position: 'relative'}}>
      <PullIndicator
        indicator={indicator}
        spinner={spinner}
        label={label}
        color={t.palette.primary_500}
        pillBackground={t.palette.contrast_50}
        pillColor={t.palette.contrast_700}
      />
      <div ref={content} data-testid="pull-content">
        {children}
      </div>
    </div>
  )
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
