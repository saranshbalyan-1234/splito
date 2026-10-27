import {DomainError} from '@splito/domain'

import {requireLive, write} from './mutations'
import {type Key} from './schema'
import {type Store, type Tx} from './store'
import {type Entity, type MutationCtx} from './types'

/*
 * Remind (F-1118) and Remind me (F-1119). Two kinds of row in the `reminders` store:
 * - 'nudge': a friendly reminder I shared with someone through the share sheet. A log of what was
 *   offered, never proof it was sent (opening a share sheet says nothing about delivery).
 * - 'self': a notification I scheduled for myself. The OS notification id is device state and is kept
 *   in device storage by the client, never here.
 * Cancelling is a tombstone like every delete.
 */

export type ReminderKind = 'nudge' | 'self'
export const REPEATS = ['none', 'daily', 'weekly', 'monthly'] as const
export type ReminderRepeat = (typeof REPEATS)[number]
/** How a nudge was handed over: the system share sheet, WhatsApp opened with the friend's number, or copied to paste. */
export type NudgeVia = 'share' | 'whatsapp' | 'copy'

export interface Reminder {
  kind: ReminderKind
  /** The friend it is about; '' when it is about a group only. */
  personId: string
  /** The group it is about; null when it is about the friend across everything. */
  groupId: string | null
  /** Self: the first (or only) time it fires, epoch ms. Nudge: null. */
  dueAt: number | null
  repeat: ReminderRepeat
  /** Nudge: what was owed when it was shared, per currency (never summed). Self: empty. */
  amounts: Record<string, bigint>
  /** Nudge: how it was handed over. Self: null. */
  via: NudgeVia | null
}

const ABOUT_PAGE = 200

async function requireAbout(tx: Tx, personId: string, groupId: string | null) {
  if (personId) await requireLive(tx, 'person', personId)
  if (groupId) await requireLive(tx, 'group', groupId)
  if (!personId && !groupId) throw new DomainError('NOT_FOUND')
}

function checkWhen(dueAt: number, repeat: ReminderRepeat) {
  if (!Number.isFinite(dueAt)) throw new DomainError('INVALID_DATE')
  if (!REPEATS.includes(repeat)) throw new DomainError('INVALID_REPEAT')
}

/** Logs a friendly reminder shared with `personId`. Amounts are per currency; at least one must be positive. */
export async function recordNudge(
  store: Store,
  ctx: MutationCtx,
  input: {personId: string; groupId: string | null; amounts: Record<string, bigint>; via: NudgeVia},
): Promise<Entity<Reminder>> {
  const amounts = Object.fromEntries(Object.entries(input.amounts).filter(([, v]) => v > 0n))
  if (Object.keys(amounts).length === 0) throw new DomainError('INVALID_AMOUNT')
  if (!input.personId) throw new DomainError('NOT_FOUND')
  const data: Reminder = {kind: 'nudge', personId: input.personId, groupId: input.groupId, dueAt: null, repeat: 'none', amounts, via: input.via}
  return store.transaction(async tx => {
    await requireAbout(tx, input.personId, input.groupId)
    return write(tx, ctx, 'reminder', ctx.newId(), data, false, 'reminder.nudge')
  })
}

/** Schedules a notification for myself about a friend and/or a group. */
export async function scheduleReminder(
  store: Store,
  ctx: MutationCtx,
  input: {personId: string; groupId: string | null; dueAt: number; repeat: ReminderRepeat},
): Promise<Entity<Reminder>> {
  checkWhen(input.dueAt, input.repeat)
  const data: Reminder = {kind: 'self', personId: input.personId, groupId: input.groupId, dueAt: input.dueAt, repeat: input.repeat, amounts: {}, via: null}
  return store.transaction(async tx => {
    await requireAbout(tx, input.personId, input.groupId)
    return write(tx, ctx, 'reminder', ctx.newId(), data, false, 'reminder.schedule')
  })
}

/** Moves a scheduled reminder to another time or repeat. */
export async function updateReminder(store: Store, ctx: MutationCtx, id: string, input: {dueAt: number; repeat: ReminderRepeat}): Promise<Entity<Reminder>> {
  checkWhen(input.dueAt, input.repeat)
  return store.transaction(async tx => {
    const r = await requireLive<Reminder>(tx, 'reminder', id)
    if (r.data.kind !== 'self') throw new DomainError('NOT_FOUND')
    return write(tx, ctx, 'reminder', id, {...r.data, dueAt: input.dueAt, repeat: input.repeat}, false, 'reminder.update')
  })
}

/** Cancels a scheduled reminder (a tombstone; the history keeps it). */
export async function cancelReminder(store: Store, ctx: MutationCtx, id: string): Promise<Entity<Reminder>> {
  return store.transaction(async tx => {
    const r = await requireLive<Reminder>(tx, 'reminder', id)
    return write(tx, ctx, 'reminder', id, r.data, true, 'reminder.cancel')
  })
}

async function pageAll(store: Store, q: {index: string; eq: Key}): Promise<Entity<Reminder>[]> {
  const out: Entity<Reminder>[] = []
  let after: Key | null | undefined
  do {
    const page = await store.page<Reminder>('reminder', {...q, after, limit: ABOUT_PAGE})
    out.push(...page.items)
    after = page.next
  } while (after)
  return out
}

/** Every live scheduled reminder, soonest first (an index read of `byDue`). */
export async function selfReminders(store: Store): Promise<Entity<Reminder>[]> {
  return (await pageAll(store, {index: 'byDue', eq: ['self']})).filter(r => !r.deleted)
}

/** The live scheduled reminders about one friend (`''`: about a group only), oldest first (`byPerson`). */
export async function remindersAbout(store: Store, personId: string): Promise<Entity<Reminder>[]> {
  return (await pageAll(store, {index: 'byPerson', eq: [personId]})).filter(r => !r.deleted && r.data.kind === 'self')
}

/** When I last shared a reminder with this friend (epoch ms), or null: the newest `nudge` on the friend's `byPerson` index. */
export async function lastNudgeAt(store: Store, personId: string): Promise<number | null> {
  let after: Key | null | undefined
  do {
    const page = await store.page<Reminder>('reminder', {index: 'byPerson', eq: [personId], dir: 'prev', after, limit: 20})
    const hit = page.items.find(r => !r.deleted && r.data.kind === 'nudge')
    if (hit) return hit.createdAt
    after = page.next
  } while (after)
  return null
}

/**
 * The first time a reminder fires at or after `after`: `dueAt` itself while ahead, then every day / week
 * / month at the same local time (a 31st lands on the last day of a shorter month and comes back).
 * A one-off whose time has passed has none (null).
 */
export function nextOccurrence(dueAt: number, repeat: ReminderRepeat, after: number): number | null {
  if (dueAt >= after) return dueAt
  if (repeat === 'none') return null
  const start = new Date(dueAt)
  const at = (k: number) => {
    const d = new Date(dueAt)
    if (repeat === 'monthly') {
      const first = new Date(start.getFullYear(), start.getMonth() + k, 1, start.getHours(), start.getMinutes(), start.getSeconds())
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
      first.setDate(Math.min(start.getDate(), last))
      return first.getTime()
    }
    d.setDate(d.getDate() + k * (repeat === 'weekly' ? 7 : 1))
    return d.getTime()
  }
  const unit = repeat === 'daily' ? 86_400_000 : repeat === 'weekly' ? 7 * 86_400_000 : 30 * 86_400_000
  // The estimate is within a step of the answer; walk forward from just before it.
  let k = Math.max(1, Math.floor((after - dueAt) / unit) - 1)
  while (at(k) < after) k++
  return at(k)
}
