import {nextOccurrence, type ReminderRepeat} from '@splito/sync'

import {type Armed} from './types'

/** A scheduled reminder as the planner sees it. */
export type LiveReminder = {id: string; dueAt: number; repeat: ReminderRepeat; personId: string; groupId: string | null; title: string; body: string}

/** What identifies a reminder as armed: a change to any of it (the time, or the words after a rename or a language switch) re-arms. */
export const reminderKey = (r: LiveReminder) => [r.dueAt, r.repeat, r.personId, r.groupId ?? '', r.title, r.body].join('|')

const DAY = 86_400_000
/** How far ahead, and how many, one-time alerts stand in for a repeat. Well under iOS's 64 pending notifications per app. */
const WINDOW_DAYS = 60
const WINDOW_MAX = 8

/**
 * The one-time alerts to arm for a reminder: a once-only one is its own time; a repeat is its next
 * occurrences, up to 8 and within 60 days (at least the next one). An OS repeating trigger cannot start
 * later than the next match or skip to the last day of a short month, so every repeat is armed this way and
 * topped up each time Splito comes to the foreground or an alert arrives (`rearmTime` is the backstop).
 */
export function alertWindow(dueAt: number, repeat: ReminderRepeat, now: number): number[] {
  const first = nextOccurrence(dueAt, repeat, now)
  if (first === null) return []
  if (repeat === 'none') return [first]
  const out = [first]
  while (out.length < WINDOW_MAX) {
    const next = nextOccurrence(dueAt, repeat, out[out.length - 1]! + 1)
    if (next === null || next > now + WINDOW_DAYS * DAY) break
    out.push(next)
  }
  return out
}

/** When to plan a repeat's window again: a day before its last alert (never in the past); null for a once-only reminder. */
export function rearmTime(window: number[], now: number): number | null {
  return window.length > 1 || window.length === 1 ? Math.max(window[window.length - 1]! - DAY, now + 60_000) : null
}

/**
 * What to do so the OS holds exactly the live reminders: cancel what is armed but gone, edited or due for
 * re-planning (`refresh`: every repeat, when Splito returns to the foreground or an alert arrives); arm what
 * is live and not armed, with a time still ahead. Pure (the caller does the arming).
 */
export function planSync(live: LiveReminder[], armed: Record<string, Armed>, now: number, {refresh = false}: {refresh?: boolean} = {}) {
  const byId = new Map(live.map(r => [r.id, r]))
  const cancel: string[] = []
  const stale = (id: string) => {
    const was = armed[id]!
    const r = byId.get(id)
    return !r || was.key !== reminderKey(r) || (was.rearmAt !== null && was.rearmAt <= now) || (refresh && r.repeat !== 'none')
  }
  for (const id of Object.keys(armed)) if (stale(id)) cancel.push(id)
  const gone = new Set(cancel)
  const arm = live.filter(r => (!armed[r.id] || gone.has(r.id)) && nextOccurrence(r.dueAt, r.repeat, now) !== null)
  return {cancel, arm}
}

/**
 * The reminders with an occurrence in `(from, to]`: what fired while Splito was closed or since the last
 * look. One per reminder (its first occurrence in the window).
 */
export function dueBetween(live: LiveReminder[], from: number, to: number): Array<{id: string; at: number}> {
  const out: Array<{id: string; at: number}> = []
  for (const r of live) {
    const at = nextOccurrence(r.dueAt, r.repeat, from + 1)
    if (at !== null && at <= to) out.push({id: r.id, at})
  }
  return out.sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1))
}
