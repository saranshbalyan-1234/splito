/**
 * Who may raise and answer a dispute or hold (ARCHITECTURE 26.20, owner 119; F-1210). Pure, so the app and (F-2208)
 * the server run the same checks. A check says `ok`, or the code of the first rule it broke; the caller turns the
 * code into a `DomainError` or a sentence.
 */

/** The reasons a dispute can give (one chip each); a hold has its own free-text reason. */
export const DISPUTE_REASONS = [
  'not_part',
  'left_out',
  'wrong_amount',
  'wrong_share',
  'wrong_payer',
  'duplicate',
  'wrong_currency_date',
  'not_received',
  'other',
] as const
export type DisputeReason = (typeof DISPUTE_REASONS)[number]

export type DisputeKind = 'dispute' | 'hold'

/** Where a dispute stands. `released` is a hold let go; `gone` is a record that was deleted. */
export type DisputeStatus = 'open' | 'accepted' | 'rejected' | 'withdrawn' | 'released' | 'gone'

export type PermissionResult = {ok: true} | {ok: false; code: string}

const OK: PermissionResult = {ok: true}
const no = (code: string): PermissionResult => ({ok: false, code})

/** The record a dispute hangs on, as the checks need it. */
export interface DisputeRecord {
  /** Who added it (the first history version's actor). */
  addedBy: string
  /** Everyone named on it: payers and sharers of an expense, sender and receiver of a payment. */
  participants: readonly string[]
  /** Who paid (an expense's payers; a payment's sender). */
  payers: readonly string[]
  /** The group's current members (empty outside groups). */
  groupMembers: readonly string[]
  /** The group's admins who have not left (empty outside groups). */
  groupAdmins: readonly string[]
}

export interface DisputeSubject {
  /** Who the dispute is raised as: me, or (before the backend) a participant I record it for. */
  raisedBy: string
  kind: DisputeKind
  reason: DisputeReason
}

/**
 * May `raisedBy` raise this on the record? A participant may dispute or hold; a group member who is not on the
 * record may only say "I was left out". One open dispute per person per record (`hasOpen`).
 */
export function canDispute(record: DisputeRecord, who: DisputeSubject, hasOpen: boolean): PermissionResult {
  if (hasOpen) return no('ALREADY_OPEN')
  if (record.participants.includes(who.raisedBy)) return who.reason === 'left_out' && who.kind === 'dispute' ? no('ALREADY_PARTICIPANT') : OK
  if (who.kind === 'dispute' && who.reason === 'left_out' && record.groupMembers.includes(who.raisedBy)) return OK
  return no('NOT_A_PARTICIPANT')
}

export type DisputeAction = 'accept' | 'reject' | 'withdraw' | 'release' | 'reopen'

export interface DisputeState {
  raisedBy: string
  /** Who recorded it on this device (equals `raisedBy` except before the backend, when one person records for another). */
  recordedBy: string
  kind: DisputeKind
  status: DisputeStatus
  /** How many times it was reopened after a rejection. */
  reopenCount: number
}

/**
 * May `actor` do `action`? Rules (26.20):
 * - accept / reject: the person who added the record, its payer or a group admin, never the raiser themselves, and
 *   only while open; a hold is released, not answered.
 * - withdraw: only the raiser (or the person who recorded it for them), while open.
 * - release: any participant, the adder or an admin, while a hold is open.
 * - reopen: after a rejection, the raiser once; after that only a group admin.
 */
export function canResolveDispute(record: DisputeRecord, d: DisputeState, actor: string, action: DisputeAction): PermissionResult {
  const isRaiser = actor === d.raisedBy || actor === d.recordedBy
  const isAdmin = record.groupAdmins.includes(actor)
  const isResolver = actor === record.addedBy || record.payers.includes(actor) || isAdmin
  switch (action) {
    case 'withdraw':
      if (d.status !== 'open' || d.kind !== 'dispute') return no('NOT_OPEN')
      return isRaiser ? OK : no('NOT_RAISER')
    case 'release':
      if (d.status !== 'open' || d.kind !== 'hold') return no('NOT_OPEN')
      return record.participants.includes(actor) || actor === record.addedBy || isAdmin || isRaiser ? OK : no('NOT_A_PARTICIPANT')
    case 'accept':
    case 'reject':
      if (d.status !== 'open' || d.kind !== 'dispute') return no('NOT_OPEN')
      // Nobody answers their own dispute, even one recorded on someone's behalf.
      if (actor === d.raisedBy) return no('OWN_DISPUTE')
      return isResolver ? OK : no('NOT_RESOLVER')
    case 'reopen':
      if (d.status !== 'rejected' || d.kind !== 'dispute') return no('NOT_REJECTED')
      if (d.reopenCount === 0) return isRaiser ? OK : isAdmin ? OK : no('NOT_RAISER')
      return isAdmin ? OK : no('ADMIN_ONLY')
  }
}

/** Open or held: the record still counts, but is marked and left out of the Settle plan by default. */
export const isDisputeOpen = (d: Pick<DisputeState, 'status'>) => d.status === 'open'
