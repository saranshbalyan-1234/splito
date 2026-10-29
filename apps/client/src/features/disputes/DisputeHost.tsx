import {useEffect, useState} from 'react'

import {clearDisputeRequest, type DisputeRequest, useDisputeRequest} from '#/lib/disputes/bus'
import {useDialogControl} from '#/components/Dialog'
import {AnswerSheet} from './AnswerSheet'
import {RaiseSheet} from './RaiseSheet'

type Raise = Extract<DisputeRequest, {kind: 'raise' | 'hold'}>
type Answer = Extract<DisputeRequest, {kind: 'reject' | 'reopen'}>

/**
 * Mounted once at the app root. Holds the raise / hold sheet and the reject / reopen note sheet (the menus and rows
 * that open them are gone by the time they are pressed), as `RemindHost` does for Remind.
 *
 * Each request mounts a sheet of its own with a dialog control of its own, opened as it mounts: a native sheet keeps
 * its form state after closing and a control that is still closing ignores `open()`, so a reused sheet opened late
 * or with the last note in it.
 */
export function DisputeHost() {
  const request = useDisputeRequest()
  const [raise, setRaise] = useState<(Raise & {seq: number}) | null>(null)
  const [answer, setAnswer] = useState<(Answer & {seq: number}) | null>(null)
  const [seq, setSeq] = useState(0)

  useEffect(() => {
    if (!request) return
    setSeq(n => n + 1)
    if ('targetType' in request) setRaise({...request, seq: seq + 1})
    else setAnswer({...request, seq: seq + 1})
    clearDisputeRequest()
  }, [request]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {raise && <Opened key={`raise-${raise.seq}`} render={control => <RaiseSheet control={control} request={raise} />} />}
      {answer && <Opened key={`answer-${answer.seq}`} render={control => <AnswerSheet control={control} request={answer} />} />}
    </>
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
