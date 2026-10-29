import {type ReminderRepeat} from '@splito/sync'

/** The OS permission as the app sees it. `unsupported`: this browser has no Notification API. */
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported'

/** Each kind of local notification has its own `notify.*` preference (F-1907). */
export type NotifyKind = 'reminders' | 'recurring' | 'digest'

/** Where a tapped notification goes: the group when there is one, else the friend. */
export type NotificationTarget = {personId: string; groupId: string | null}

/** One local notification to arm: fires at `at`, then on `repeat`. */
export type LocalNotification = {
  /** The reminder's id. */
  id: string
  title: string
  body: string
  at: number
  repeat: ReminderRepeat
  target: NotificationTarget
}

/** What arming a notification left on the device: the OS ids (to cancel it later) and when to look again. */
export type Armed = {
  osIds: string[]
  /** The reminder as armed, to notice an edit. */
  key: string
  /** Epoch ms after which it should be re-planned (a one-shot standing in for a repeat), or null. */
  rearmAt: number | null
}
