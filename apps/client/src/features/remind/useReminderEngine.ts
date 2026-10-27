import {useEffect, useRef} from 'react'
import {AppState} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type Group, type Person} from '@splito/sync'

import {canFireWhenClosed, listenForArrivals, listenForTaps, showNow} from '#/lib/notifications'
import {dueBetween, type LiveReminder} from '#/lib/notifications/plan'
import {remindDevice} from '#/lib/notifications/storage'
import {resyncNotifications, syncNotifications} from '#/lib/notifications/sync'
import {type NotificationTarget} from '#/lib/notifications/types'
import {useNotificationPermission} from '#/lib/notifications/usePermission'
import {useEntities, usePref} from '#/data/hooks'
import {useSelfReminders} from '#/data/remind'
import {navigationRef} from '#/navigation/DevTour'
import * as Toast from '#/components/Toast'

/** How often an open page looks for a reminder that has come due (web). */
const TICK_MS = 15_000

/** Opens the friend or group a reminder is about, waiting for the navigator on a cold start from a tap. */
function openTarget(target: NotificationTarget, tries = 0) {
  if (navigationRef.isReady()) {
    if (target.groupId) navigationRef.navigate('Group', {groupId: target.groupId})
    else if (target.personId) navigationRef.navigate('Person', {personId: target.personId})
  } else if (tries < 40) setTimeout(() => openTarget(target, tries + 1), 250)
}

/**
 * Everything that makes a scheduled reminder happen (F-1907, F-1119), mounted once by `RemindHost`:
 * - native: keeps the OS holding exactly the live reminders (re-planned on edits, language changes and
 *   returning to the app), and opens the person or group when a notification is tapped;
 * - web: a page cannot schedule for later, so while it is open this checks for due reminders and shows them
 *   (a browser notification when the tab is hidden and allowed, a toast otherwise), and on the next open
 *   shows what came due while it was closed.
 * Reminders (and so notifications) stay off while `notify.reminders` is off or the permission is not granted.
 */
export function useReminderEngine() {
  const {t: l, i18n} = useLingui()
  const reminders = useSelfReminders()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const [isOn = true] = usePref('notify.reminders')
  const {state: permission} = useNotificationPermission()

  const ready = !!reminders && !!people && !!groups
  const live: LiveReminder[] = !ready
    ? []
    : reminders.map(r => {
        const person = people.find(p => p.id === r.data.personId)?.data.name
        const group = r.data.groupId ? groups.find(g => g.id === r.data.groupId)?.data.name : undefined
        return {
          id: r.id,
          dueAt: r.data.dueAt ?? 0,
          repeat: r.data.repeat,
          personId: r.data.personId,
          groupId: r.data.groupId,
          title: l`Splito reminder`,
          body: person && group ? l`Settle up with ${person} in ${group}` : person ? l`Settle up with ${person}` : group ? l`Check the balances in ${group}` : l`Time to settle up`,
        }
      })
  const liveRef = useRef(live)
  liveRef.current = live
  const armKey = JSON.stringify(live) + String(isOn) + String(permission) + i18n.locale

  // Native: the OS holds the notifications.
  useEffect(() => {
    if (!ready || permission === undefined || !canFireWhenClosed) return
    void syncNotifications(isOn && permission === 'granted' ? liveRef.current : [])
    // armKey covers the reminders, the switch, the permission and the language.
  }, [armKey, ready, isOn, permission])

  useEffect(() => {
    if (!canFireWhenClosed) return
    const sub = AppState.addEventListener('change', s => s === 'active' && void resyncNotifications())
    const offTaps = listenForTaps(openTarget)
    const offArrivals = listenForArrivals(() => void resyncNotifications())
    return () => {
      sub.remove()
      offTaps()
      offArrivals()
    }
  }, [])

  // Web: fire while open, and catch up on what came due while closed.
  useEffect(() => {
    if (canFireWhenClosed || !ready || !isOn) return
    const nameOf = (r: LiveReminder) => r.body
    const check = (isCatchUp: boolean) => {
      const now = Date.now()
      const from = remindDevice.get(['checkedAt']) ?? now
      remindDevice.set(['checkedAt'], now)
      const due = dueBetween(liveRef.current, from, now)
      if (due.length === 0) return
      const byId = new Map(liveRef.current.map(r => [r.id, r]))
      if (isCatchUp) {
        const first = byId.get(due[0]!.id)!
        const firstBody = nameOf(first)
        const count = due.length
        Toast.show(
          count === 1
            ? l`While Splito was closed: ${firstBody}`
            : l`${count} reminders came due while Splito was closed. First: ${firstBody}`,
          {type: 'info', duration: 15_000, onPress: () => openTarget({personId: first.personId, groupId: first.groupId})},
        )
        return
      }
      for (const { id } of due) {
        const r = byId.get(id)!
        const target = {personId: r.personId, groupId: r.groupId}
        const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
        if (!(isHidden && permission === 'granted' && showNow({id: r.id, title: r.title, body: r.body, target}, openTarget))) {
          Toast.show(nameOf(r), {type: 'info', duration: 15_000, onPress: () => openTarget(target)})
        }
      }
    }
    check(true)
    const timer = setInterval(() => check(false), TICK_MS)
    return () => clearInterval(timer)
  }, [armKey, ready, isOn, permission, l])
}
