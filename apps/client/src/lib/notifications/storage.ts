import {Storage} from '#/storage'
import {type Armed} from './types'

/**
 * Device-only reminder bookkeeping (F-1119): the OS notification ids of the reminders armed on THIS device,
 * and when the open page last looked for due reminders. Never synced or backed up: the ids mean nothing
 * on another device. Kept per mode (demo mode has its own, erased when it is turned off, owner 136): demo reminders are
 * never scheduled as OS notifications, so the real armed ids are never touched while demo is on.
 */
type RemindDevice = {
  armed: Record<string, Armed>
  /** Epoch ms the page last checked for due reminders (web). */
  checkedAt: number
}

export const remindDevice = new Storage<[], RemindDevice>({id: 'splito_reminders', scoped: 'all'})
