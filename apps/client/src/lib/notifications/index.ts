// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/notifications/notifications.ts (expo-notifications setup, permission calls)
import {Linking, Platform} from 'react-native'
import * as Notifications from 'expo-notifications'

import {alertWindow, rearmTime} from './plan'
import {type LocalNotification, type NotificationTarget, type PermissionState} from './types'

/*
 * Native local notifications on expo-notifications (F-1907). The OS holds and fires them, so they arrive
 * in airplane mode and with Splito closed. Nothing here talks to a server.
 */

/** True: the OS fires these with Splito closed. */
export const canFireWhenClosed = true

const CHANNEL = 'reminders'
const SCHEDULE_TYPES = Notifications.SchedulableTriggerInputTypes

Notifications.setNotificationHandler({
  handleNotification: async () => ({shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false}),
})

async function ensureChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL, {name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT})
}

function toState(r: Notifications.NotificationPermissionsStatus): PermissionState {
  return r.granted ? 'granted' : r.canAskAgain ? 'undetermined' : 'denied'
}

export async function getPermission(): Promise<PermissionState> {
  return toState(await Notifications.getPermissionsAsync())
}

/** Shows the OS prompt (call it only after Splito's own primer, F-216). */
export async function requestPermission(): Promise<PermissionState> {
  await ensureChannel()
  return toState(await Notifications.requestPermissionsAsync())
}

/** Opens Splito's page in system Settings, for a permission the person denied. */
export function openSystemSettings() {
  return Linking.openSettings()
}

/**
 * Arms one reminder as a window of one-time alerts (`alertWindow`: the next occurrences, up to 8 within 60
 * days) and returns the OS ids and when to plan it again. A repeat is never an OS repeating trigger: those
 * cannot start later than their next match or land on the last day of a short month. The window is topped up
 * whenever Splito comes to the foreground or an alert arrives (`resyncNotifications`).
 */
export async function schedule(n: LocalNotification): Promise<{osIds: string[]; rearmAt: number | null}> {
  const now = Date.now()
  const alerts = alertWindow(n.at, n.repeat, now)
  if (alerts.length === 0) return {osIds: [], rearmAt: null}
  await ensureChannel()
  const content = {title: n.title, body: n.body, data: n.target as unknown as Record<string, unknown>}
  const osIds: string[] = []
  for (const at of alerts) {
    osIds.push(await Notifications.scheduleNotificationAsync({content, trigger: {type: SCHEDULE_TYPES.DATE, date: new Date(at), channelId: CHANNEL}}))
  }
  return {osIds, rearmAt: n.repeat === 'none' ? null : rearmTime(alerts, now)}
}

export async function cancel(osIds: string[]): Promise<void> {
  await Promise.all(osIds.map(id => Notifications.cancelScheduledNotificationAsync(id)))
}

/** Web shows its own notifications while the page is open; on a phone the OS fires them. */
export function showNow(_n: unknown, _onOpen: (target: NotificationTarget) => void) {
  return false
}

/** Calls `onOpen` when a notification is tapped, also for the one that launched the app. Returns the unsubscribe. */
export function listenForTaps(onOpen: (target: NotificationTarget) => void): () => void {
  const read = (r: Notifications.NotificationResponse | null) => {
    const data = r?.notification.request.content.data as Partial<NotificationTarget> | undefined
    if (data?.personId === undefined) return
    onOpen({personId: data.personId, groupId: data.groupId ?? null})
    // Handled: the launching tap must not reopen the page on the next listener (a remount, a resumed app).
    void Notifications.clearLastNotificationResponseAsync()
  }
  void Notifications.getLastNotificationResponseAsync().then(read)
  const sub = Notifications.addNotificationResponseReceivedListener(read)
  return () => sub.remove()
}

/** Fires when a notification arrives while Splito is open, so a repeat standing in can be swapped. */
export function listenForArrivals(onArrive: () => void): () => void {
  const sub = Notifications.addNotificationReceivedListener(onArrive)
  return () => sub.remove()
}
