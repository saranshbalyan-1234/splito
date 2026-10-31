import {useEffect, useState} from 'react'
import {getPref, setPref} from '@splito/sync'

import {IS_E2E, IS_WEB} from '#/env'
import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {useMutationCtx, useStore} from '#/data/hooks'
import {endTourRequest, measureTargets, usePeopleState, useIsTourRequested} from '#/lib/tour/registry'
import {planTour, type TourStep} from '#/lib/tour/steps'
import {useDemoMode} from '#/state/demo'
import {useDialogStateContext} from '#/state/dialogs'
import {logger} from '#/logger'
import {TourStepView} from './TourStepView'

/** How long the friend row may take to mount after People has loaded before the account counts as having no friends. */
const ROW_WAIT_MS = 800
const POLL_MS = 120
/* While a sheet or prompt is open the tour only keeps an eye on it. */
const BLOCKED_POLL_MS = 500

/**
 * E2E builds never start the tour by themselves (every spec signs in a fresh account, which would otherwise be toured):
 * a spec arms it with `window.__splitoTest = {tourAuto: true}` before the page loads, as the other hooks are installed.
 */
function isAutoTourAllowed(): boolean {
  if (!IS_E2E) return true
  if (!IS_WEB || typeof window === 'undefined') return false
  return (window as unknown as {__splitoTest?: {tourAuto?: boolean}}).__splitoTest?.tourAuto === true
}

/**
 * The guided tour after the first sign-in (F-253, owners 142/143/213), mounted once like `LogOutHost`. For an account
 * that has not seen it (`onboarding.tourSeen`) it reads that one preference once and, only if the tour is due, mounts the
 * runner; "Take the tour" in Settings > Support > Help asks for it again. Never in demo mode. An account that has seen
 * it pays one preference read at launch and renders nothing.
 */
export function TourHost() {
  const store = useStore()
  const ctx = useMutationCtx()
  const {demo} = useDemoMode()
  const isReplayed = useIsTourRequested()
  const [isAutoDue, setAutoDue] = useState(false)

  useEffect(() => {
    setAutoDue(false)
    if (demo || !isAutoTourAllowed()) return
    let cancelled = false
    void getPref(store, 'onboarding.tourSeen').then(
      seen => {
        if (!cancelled && !seen) setAutoDue(true)
      },
      e => logger.error(e, {where: 'TourHost.read'}),
    )
    return () => {
      cancelled = true
    }
  }, [store, demo])

  if (demo || !(isAutoDue || isReplayed)) return null
  return (
    <TourRunner
      onEnded={() => {
        setAutoDue(false)
        endTourRequest()
        /* Skip and Done both count as seen; a replay has nothing to write. */
        if (isAutoDue) void setPref(store, ctx, 'onboarding.tourSeen', true).catch(e => logger.error(e, {where: 'TourHost.write'}))
      }}
    />
  )
}

/**
 * Waits for People to be the page showing and loaded (no sheet open), plans the steps from the controls that are
 * actually on screen, then shows them one at a time. Mounted only while a tour is due or running.
 */
function TourRunner({onEnded: onEndedProp}: {onEnded: () => void}) {
  /* The host's closure changes every render; the effects below must not restart for that. */
  const onEnded = useNonReactiveCallback(onEndedProp)
  const people = usePeopleState()
  const dialogs = useDialogStateContext()
  const [steps, setSteps] = useState<TourStep[] | null>(null)
  const [index, setIndex] = useState(0)

  /* Planning: People loaded and focused, no sheet open, the friend row mounted if there are friends. */
  const isPeopleReady = people !== null && people !== 'loading'
  useEffect(() => {
    if (steps || !isPeopleReady) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()
    const attempt = async () => {
      if (dialogs.openDialogs?.current.size) {
        timer = setTimeout(attempt, BLOCKED_POLL_MS)
        return
      }
      const visible = await measureTargets()
      if (cancelled) return
      if (people === 'friends' && !visible.has('friend-row') && Date.now() - startedAt < ROW_WAIT_MS) {
        timer = setTimeout(attempt, POLL_MS)
        return
      }
      const plan = planTour(id => visible.has(id))
      if (plan.length === 0) onEnded()
      else setSteps(plan)
    }
    void attempt()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [steps, isPeopleReady, people, dialogs, onEnded])

  /* People stopped being the page showing (browser Back, a link): the tour is over. */
  useEffect(() => {
    if (steps && people === null) onEnded()
  }, [steps, people, onEnded])

  const step = steps?.[index]
  if (!steps || !step) return null
  const next = () => (index + 1 < steps.length ? setIndex(index + 1) : onEnded())
  return <TourStepView key={index} step={step} position={index + 1} count={steps.length} onNext={next} onSkip={onEnded} onUnavailable={next} />
}
