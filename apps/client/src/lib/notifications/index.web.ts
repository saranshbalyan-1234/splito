import {type LocalNotification, type NotificationTarget, type PermissionState} from './types'

/*
 * Web: a browser cannot schedule a notification for a closed page. Reminders fire only while Splito is
 * open (`RemindHost` checks them every few seconds), and a reminder missed while it was closed is shown
 * as a banner on the next open. The UI says so plainly (ARCHITECTURE 26.1, honest UI).
 */

/** False: nothing fires with Splito closed. */
export const canFireWhenClosed = false

export async function getPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission === 'default' ? 'undetermined' : Notification.permission
}

/** Shows the browser prompt (call it only after Splito's own primer, F-216). */
export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  const result = await Notification.requestPermission()
  return result === 'default' ? 'undetermined' : result
}

/** Browsers have no link to their notification settings; the UI explains where to find them. */
export function openSystemSettings() {
  return Promise.resolve()
}

/** Nothing to arm: the open page fires its own reminders. */
export async function schedule(_n: LocalNotification): Promise<{osIds: string[]; rearmAt: number | null}> {
  return {osIds: [], rearmAt: null}
}

export async function cancel(_osIds: string[]): Promise<void> {}

/** Shows a browser notification now (only when permission is granted); a click opens `onOpen`. */
export function showNow(n: Pick<LocalNotification, 'id' | 'title' | 'body' | 'target'>, onOpen: (target: NotificationTarget) => void) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  const shown = new Notification(n.title, {body: n.body, tag: n.id})
  shown.onclick = () => {
    window.focus()
    onOpen(n.target)
    shown.close()
  }
  return true
}

/** No taps to hear: a browser notification's click is wired in `showNow`. */
export function listenForTaps(_onOpen: (target: NotificationTarget) => void): () => void {
  return () => {}
}

export function listenForArrivals(_onArrive: () => void): () => void {
  return () => {}
}
