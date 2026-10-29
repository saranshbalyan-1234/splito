import {useEffect, useState} from 'react'

import {clearRemindRequest, type RemindRequest, useRemindRequest} from '#/lib/remind/bus'
import {useDialogControl} from '#/components/Dialog'
import {RemindMeSheet} from './RemindMeSheet'
import {RemindSheet} from './RemindSheet'
import {useReminderEngine} from './useReminderEngine'

type Remind = Extract<RemindRequest, {kind: 'remind'}>
type RemindMe = Extract<RemindRequest, {kind: 'remindMe'}>

/**
 * Mounted once at the app root. Holds the Remind and Remind me sheets (menus that open them are gone by
 * the time they are pressed) and runs the reminder engine (scheduling, due checks, notification taps).
 */
export function RemindHost() {
  useReminderEngine()
  const request = useRemindRequest()
  const remindControl = useDialogControl()
  const remindMeControl = useDialogControl()
  const [remind, setRemind] = useState<Remind | null>(null)
  const [remindMe, setRemindMe] = useState<RemindMe | null>(null)

  // The sheet mounts with its request; it opens once it has.
  useEffect(() => {
    if (!request) return
    if (request.kind === 'remind') setRemind(request)
    else setRemindMe(request)
    clearRemindRequest()
  }, [request])
  useEffect(() => {
    if (remind) remindControl.open()
  }, [remind, remindControl])
  useEffect(() => {
    if (remindMe) remindMeControl.open()
  }, [remindMe, remindMeControl])

  return (
    <>
      {remind && <RemindSheet control={remindControl} request={remind} />}
      {remindMe && <RemindMeSheet control={remindMeControl} request={remindMe} />}
    </>
  )
}
