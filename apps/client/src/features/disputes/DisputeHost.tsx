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
 */
export function DisputeHost() {
  const request = useDisputeRequest()
  const raiseControl = useDialogControl()
  const answerControl = useDialogControl()
  const [raise, setRaise] = useState<Raise | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)

  // The sheet mounts with its request; it opens once it has.
  useEffect(() => {
    if (!request) return
    if ('targetType' in request) setRaise(request)
    else setAnswer(request)
    clearDisputeRequest()
  }, [request])
  useEffect(() => {
    if (raise) raiseControl.open()
  }, [raise, raiseControl])
  useEffect(() => {
    if (answer) answerControl.open()
  }, [answer, answerControl])

  return (
    <>
      {raise && <RaiseSheet control={raiseControl} request={raise} />}
      {answer && <AnswerSheet control={answerControl} request={answer} />}
    </>
  )
}
