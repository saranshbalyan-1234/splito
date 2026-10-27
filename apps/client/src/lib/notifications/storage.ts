import {Storage} from '#/storage'
import {type Armed} from './types'

/**
 * Device-only reminder bookkeeping (F-1119): the OS notification ids of the reminders armed on THIS device,
 * and when the open page last looked for due reminders. Never synced or backed up: the ids mean nothing
 * on another device.
 */
type RemindDevice = {
  armed: Record<string, Armed>
  /** Epoch ms the page last checked for due reminders (web). */
  checkedAt: number
}

export const remindDevice = new Storage<[], RemindDevice>({id: 'splito_reminders'})
