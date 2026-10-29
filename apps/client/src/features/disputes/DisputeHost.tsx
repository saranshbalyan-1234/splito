import {useEffect, useRef, useState} from 'react'

import {clearDisputeRequest, type DisputeRequest, useDisputeRequest} from '#/lib/disputes/bus'
import {useDialogControl} from '#/components/Dialog'
import {AnswerSheet} from './AnswerSheet'
import {RaiseSheet} from './RaiseSheet'

type Active = DisputeRequest & {seq: number}

/** How long a request waits for the sheet in front of it to finish closing before it opens anyway. */
const WAIT_FOR_CLOSE_MS = 700

/**
 * Mounted once at the app root. Holds the raise / hold sheet and the reject / reopen note sheet (the menus and rows
 * that open them are gone by the time they are pressed), as `RemindHost` does for Remind.
 *
 * One sheet at a time, and each request gets a sheet of its own with a dialog control of its own, opened as it mounts
 * and let go once it has closed: a native sheet keeps its form state after closing and a control that is still closing
 * ignores `open()`, so a reused sheet opened late or with the last note in it. A request that comes while a sheet is
 * still closing (Reject, then at once Reopen) waits for it, because a sheet that mounts under a closing one is rebuilt
 * when the old one goes and loses what was typed.
 */
export function DisputeHost() {
  const request = useDisputeRequest()
  const [active, setActive] = useState<Active | null>(null)
  const activeRef = useRef<Active | null>(null)
  const queued = useRef<DisputeRequest | null>(null)
  const seq = useRef(0)

  const show = (next: DisputeRequest | null) => {
    const value = next && {...next, seq: ++seq.current}
    activeRef.current = value
    setActive(value)
  }

  useEffect(() => {
    if (!request) return
    clearDisputeRequest()
    if (!activeRef.current) return show(request)
    queued.current = request
    const timer = setTimeout(() => {
      if (queued.current !== request) return
      queued.current = null
      show(request)
    }, WAIT_FOR_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [request]) // eslint-disable-line react-hooks/exhaustive-deps

  /* The sheet with this `seq` has closed: the next request, if one waits, takes its place. */
  const closed = (closedSeq: number) => {
    if (activeRef.current?.seq !== closedSeq) return
    const next = queued.current
    queued.current = null
    show(next)
  }

  if (!active) return null
  return (
    <Opened
      key={active.seq}
      render={control =>
        'targetType' in active ? (
          <RaiseSheet control={control} request={active} onClosed={() => closed(active.seq)} />
        ) : (
          <AnswerSheet control={control} request={active} onClosed={() => closed(active.seq)} />
        )
      }
    />
  )
}

/** A sheet with its own dialog control, opened once it has mounted. */
function Opened({render}: {render: (control: ReturnType<typeof useDialogControl>) => React.ReactNode}) {
  const control = useDialogControl()
  useEffect(() => {
    control.open()
  }, [control])
  return render(control)
}
