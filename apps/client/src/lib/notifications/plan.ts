import {nextOccurrence, type ReminderRepeat} from '@splito/sync'

import {type Armed} from './types'

/** A scheduled reminder as the planner sees it. */
export type LiveReminder = {id: string; dueAt: number; repeat: ReminderRepeat; personId: string; groupId: string | null; title: string; body: string}

/** What identifies a reminder as armed: a change to any of it (the time, or the words after a rename or a language switch) re-arms. */
export const reminderKey = (r: LiveReminder) => [r.dueAt, r.repeat, r.personId, r.groupId ?? '', r.title, r.body].join('|')

/**
 * What to do so the OS holds exactly the live reminders: cancel what is armed but gone, edited or due for
 * re-planning; arm what is live and not armed, with a time still ahead. Pure (the caller does the arming).
 */
export function planSync(live: LiveReminder[], armed: Record<string, Armed>, now: number) {
  const byId = new Map(live.map(r => [r.id, r]))
  const cancel: string[] = []
  const stale = (id: string) => {
    const was = armed[id]!
    const r = byId.get(id)
    return !r || was.key !== reminderKey(r) || (was.rearmAt !== null && was.rearmAt <= now)
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
