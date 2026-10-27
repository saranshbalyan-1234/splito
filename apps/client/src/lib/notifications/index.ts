// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/notifications/notifications.ts (expo-notifications setup, permission calls)
import {Linking, Platform} from 'react-native'
import * as Notifications from 'expo-notifications'
import {nextOccurrence} from '@splito/sync'

import {type LocalNotification, type NotificationTarget, type PermissionState} from './types'

/*
 * Native local notifications on expo-notifications (F-1907). The OS holds and fires them, so they arrive
 * in airplane mode and with Splito closed. Nothing here talks to a server.
 */

/** True: the OS fires these with Splito closed. */
export const canFireWhenClosed = true

const CHANNEL = 'reminders'
const DAY = 86_400_000
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
 * Arms one notification and returns the OS ids and when to plan it again. A repeat uses the OS's own
 * daily / weekly / monthly trigger when its first time is within one period (so the first fire is right);
 * otherwise a one-shot stands in until `planSync` swaps it. ponytail: a monthly reminder on the 29th to 31st
 * is a one-shot per month, re-armed whenever Splito opens; use a calendar trigger per month if that proves too lazy.
 */
export async function schedule(n: LocalNotification): Promise<{osIds: string[]; rearmAt: number | null}> {
  const first = nextOccurrence(n.at, n.repeat, Date.now())
  if (first === null) return {osIds: [], rearmAt: null}
  await ensureChannel()
  const when = new Date(first)
  const content = {title: n.title, body: n.body, data: n.target as unknown as Record<string, unknown>}
  const hour = when.getHours()
  const minute = when.getMinutes()
  const channelId = CHANNEL
  const wait = first - Date.now()
  const repeating =
    n.repeat === 'daily' && wait <= DAY
      ? {type: SCHEDULE_TYPES.DAILY, hour, minute, channelId}
      : n.repeat === 'weekly' && wait <= 7 * DAY
        ? {type: SCHEDULE_TYPES.WEEKLY, weekday: when.getDay() + 1, hour, minute, channelId}
        : n.repeat === 'monthly' && wait <= 28 * DAY && when.getDate() <= 28
          ? {type: SCHEDULE_TYPES.MONTHLY, day: when.getDate(), hour, minute, channelId}
          : null
  const trigger = repeating ?? {type: SCHEDULE_TYPES.DATE, date: when, channelId}
  const id = await Notifications.scheduleNotificationAsync({content, trigger})
  // A one-shot standing in for a repeat is swapped once it has passed.
  return {osIds: [id], rearmAt: repeating || n.repeat === 'none' ? null : first + 60_000}
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
    if (data?.personId !== undefined) onOpen({personId: data.personId, groupId: data.groupId ?? null})
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
