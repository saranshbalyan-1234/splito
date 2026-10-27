import {cancel, schedule} from '#/lib/notifications'
import {logger} from '#/logger'
import {type LiveReminder, planSync, reminderKey} from './plan'
import {remindDevice} from './storage'

/*
 * Keeps the OS holding exactly the live reminders (native). One run at a time, so two quick edits never
 * race on the stored ids; `resync` repeats the last run (the app returned to the foreground: a one-shot
 * standing in for a repeat may be due to be swapped).
 */
let queue: Promise<void> = Promise.resolve()
let last: LiveReminder[] = []

async function run(live: LiveReminder[]) {
  const armed = remindDevice.get(['armed']) ?? {}
  const {cancel: stale, arm} = planSync(live, armed, Date.now())
  for (const id of stale) {
    await cancel(armed[id]!.osIds)
    delete armed[id]
    remindDevice.set(['armed'], armed)
  }
  for (const r of arm) {
    const {osIds, rearmAt} = await schedule({id: r.id, title: r.title, body: r.body, at: r.dueAt, repeat: r.repeat, target: {personId: r.personId, groupId: r.groupId}})
    armed[r.id] = {osIds, key: reminderKey(r), rearmAt}
    remindDevice.set(['armed'], armed)
  }
}

export function syncNotifications(live: LiveReminder[]): Promise<void> {
  last = live
  queue = queue.then(() => run(live)).catch(e => logger.warn('syncing local notifications failed', {safeMessage: String(e)}))
  return queue
}

export const resyncNotifications = () => syncNotifications(last)
