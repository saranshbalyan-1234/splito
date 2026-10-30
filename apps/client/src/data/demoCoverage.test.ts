import {Database} from 'bun:sqlite'
import {beforeAll, describe, expect, test} from 'bun:test'
import {
  ACTIVITY_TYPE_IDS,
  type ActivityEvent,
  type ActivityTypeId,
  activityFromHistory,
  ensureMe,
  type BackupFile,
  type Comment,
  type Dispute,
  type DisputedBalance,
  createBackup,
  type Entity,
  type Expense,
  type FriendRequest,
  type Group,
  type InviteLink,
  inviteLinkState,
  type NetBalance,
  openSqlStore,
  parseBackup,
  type Person,
  previewBackup,
  type Reminder,
  type Repayment,
  requestState,
  serializeBackup,
  type Store,
  type StoreDump,
  type WriteOff,
} from '@splito/sync'

import {activityTypeOf} from '#/components/activity/feed'
import {DEMO_ME, seedDemo} from '#/data/demoSeed'


/*
 * DEMO COVERAGE (owner decision 109): the demo dataset grows with every feature.
 *
 * Each line of FEATURES names one user-facing feature and a predicate over the
 * SEEDED demo database that must find at least one record. Ship a feature, add
 * one line here (and the records that satisfy it to `packages/sync/src/demoLarge.ts`,
 * or `data/demoSeed.ts` for what is not a ledger write: requests, links, feedback).
 *
 *   ['Comments on an expense', d => d.entities.some(e => e.type === 'comment' && !e.deleted)],
 *
 * `d` is the whole demo database read once (`store.dump()` and its parsed rows), so a
 * predicate is one expression. The test fails naming every feature the dataset misses.
 */
type Demo = {
  dump: StoreDump
  expenses: Entity<Expense>[]
  live: Entity<Expense>[]
  groups: Entity<Group>[]
  people: Entity<Person>[]
  repayments: Entity<Repayment>[]
  writeOffs: Entity<WriteOff>[]
  requests: Entity<FriendRequest>[]
  links: Entity<InviteLink>[]
  feedback: Entity[]
  /** Every group, deleted ones too (`groups` holds only the live ones). */
  allGroups: Entity<Group>[]
  allPeople: Entity<Person>[]
  comments: Entity<Comment>[]
  reminders: Entity<Reminder>[]
  disputes: Entity<Dispute>[]
  /** The disputed or held part of the balances (`store.disputedBalances()`). */
  disputed: DisputedBalance[]
  /** Account preferences by key (value only). */
  prefs: Record<string, unknown>
  /** The demo database exported as a backup file and read back: what Export centre and Backup would hand over. */
  backup: BackupFile
  /** Net per person and currency (`store.balances()`), the figures Ask answers from. */
  balances: NetBalance[]
  activity: ActivityEvent[]
  /** The moment the dataset was read; request and link states are judged at this time. */
  now: number
}

const kinds = (d: Demo) => new Set(d.live.map(e => e.data.split.mode))
const currenciesIn = (d: Demo, groupId: string) => new Set(d.live.filter(e => e.data.groupId === groupId).map(e => e.data.currency))
/** How many times a request's personal link was used; -1 when it has none. */
const usesOf = (d: Demo, code: string | null) => d.links.find(l => l.id === code)?.data.uses ?? -1
const linkStates = (d: Demo, kind: InviteLink['kind']) => new Set(d.links.filter(l => l.data.kind === kind).map(l => inviteLinkState(l.data, d.now)))
const pref = <T,>(d: Demo, key: string): T | undefined => d.prefs[key] as T | undefined
const titleCount = (d: Demo, title: string) => d.live.filter(e => e.data.title === title).length

const FEATURES: Array<[feature: string, found: (d: Demo) => boolean]> = [
  // Groups
  ['a trip group with dates', d => d.groups.some(g => g.data.kind === 'trip' && g.data.startDate && g.data.endDate)],
  ['every trip group says where it is (owner 182)', d => d.groups.some(g => g.data.kind === 'trip') && d.groups.filter(g => g.data.kind === 'trip').every(g => !!g.data.location)],
  ['a home (flat) group', d => d.groups.some(g => g.data.kind === 'home')],
  ['an other-kind group', d => d.groups.some(g => g.data.kind === 'other')],
  ['a multi-currency group (several currencies in one group, never mixed)', d => d.groups.some(g => currenciesIn(d, g.id).size >= 2)],
  ['a single-currency group', d => d.groups.some(g => currenciesIn(d, g.id).size === 1)],
  ['a group with many members', d => d.groups.some(g => g.data.members.length >= 8)],
  // Expenses: split modes
  ['equal split', d => kinds(d).has('equal')],
  ['exact amounts', d => kinds(d).has('exact')],
  ['percent split', d => kinds(d).has('percent')],
  ['shares split', d => kinds(d).has('shares')],
  ['adjusted split (equal plus extras)', d => kinds(d).has('adjusted')],
  ['itemised bill', d => kinds(d).has('items')],
  ['itemised with portions (2 of 3 beers)', d => d.live.some(e => e.data.split.mode === 'items' && e.data.split.items.some(i => i.participants.some(p => typeof p !== 'string')))],
  ['itemised with tax, tip, service or a discount', d => d.live.some(e => e.data.split.mode === 'items' && ((e.data.split.tax ?? 0n) > 0n || (e.data.split.tip ?? 0n) > 0n || (e.data.split.service ?? 0n) > 0n || (e.data.split.discount ?? 0n) > 0n))],
  // Expenses: other shapes
  ['multiple payers', d => d.live.some(e => Object.keys(e.data.payers).length > 1)],
  ['an expense with notes (Search finds them)', d => d.live.some(e => e.data.notes.length > 0)],
  ['an expense outside any group (direct)', d => d.live.some(e => e.data.groupId === null)],
  ['recurring expenses (rent, a subscription)', d => titleCount(d, 'Netflix Premium') >= 6 && d.live.filter(e => e.data.title.startsWith('Rent, ')).length >= 6],
  ['a typo fixed later (an edited expense)', d => d.dump.history.some(h => h.entityType === 'expense' && h.version > 1 && !h.deleted)],
  ['a deleted expense (tombstone)', d => d.expenses.some(e => e.deleted)],
  ['an expense deleted and restored', d => d.dump.history.some(h => h.entityType === 'expense' && h.deleted) && d.live.some(e => e.version >= 3 && d.dump.history.some(h => h.entityId === e.id && h.deleted))],
  ['expenses spread over a year (Analytics months)', d => new Set(d.live.map(e => e.data.date.slice(0, 7))).size >= 11],
  ['every category', d => ['food', 'transport', 'stay', 'shopping', 'entertainment', 'bills', 'groceries', 'other'].every(c => d.live.some(e => e.data.category === c))],
  // Currencies
  ['six or more currencies', d => new Set(d.live.map(e => e.data.currency)).size >= 6],
  ['a zero-decimal currency (JPY)', d => d.live.some(e => e.data.currency === 'JPY')],
  ['a three-decimal currency (BHD, KWD)', d => d.live.some(e => e.data.currency === 'BHD') && d.live.some(e => e.data.currency === 'KWD')],
  ['direct expenses with friends in several currencies', d => new Set(d.live.filter(e => e.data.groupId === null).map(e => e.data.currency)).size >= 3],
  // Payments
  ['a payment', d => d.repayments.some(r => !r.deleted)],
  ['a write-off', d => d.writeOffs.some(w => !w.deleted)],
  ['a payment in a group and one outside groups', d => d.repayments.some(r => r.data.groupId !== null) && d.repayments.some(r => r.data.groupId === null)],
  ['a deleted payment', d => d.repayments.some(r => r.deleted)],
  ['a deleted write-off', d => d.writeOffs.some(w => w.deleted)],
  ['payments in several currencies', d => new Set(d.repayments.map(r => r.data.currency)).size >= 4],
  // People
  ['friends (private, no account)', d => d.people.filter(p => !p.data.isMe && !p.data.accountId).length >= 30],
  ['a friend with a UPI id', d => d.people.some(p => p.data.upiId)],
  // Friends and invites (26.18)
  ['a private "only for you" friend (no account) with a contact', d => d.people.some(p => !p.data.accountId && p.data.contact)],
  ['a private "only for you" friend with a name only', d => d.people.some(p => !p.data.isMe && !p.data.accountId && !p.data.contact && p.data.name.includes('flatmate'))],
  ['a private friend that was linked to an account when they joined', d => d.people.some(p => p.data.accountId && d.dump.history.some(h => h.entityId === p.id && h.version === 1 && !(h.data as Person).accountId))],
  ['a friend request waiting for me (incoming)', d => d.requests.some(r => r.data.direction === 'incoming' && requestState(r.data, d.now) === 'pending')],
  ['an incoming request I declined', d => d.requests.some(r => r.data.direction === 'incoming' && r.data.status === 'declined')],
  ['an invite sent to someone on Splito (Sent)', d => d.requests.some(r => r.data.direction === 'outgoing' && r.data.reach === 'on-splito' && requestState(r.data, d.now) === 'pending')],
  ['an invite sent by SMS, link not opened (Sent)', d => d.requests.some(r => r.data.reach === 'invited' && requestState(r.data, d.now) === 'pending' && usesOf(d, r.data.inviteCode) === 0)],
  ['an invite whose link was opened, not answered (Opened)', d => d.requests.some(r => r.data.reach === 'invited' && requestState(r.data, d.now) === 'pending' && usesOf(d, r.data.inviteCode) > 0)],
  ['an invite that was accepted (Joined)', d => d.requests.some(r => r.data.direction === 'outgoing' && r.data.status === 'accepted' && r.data.personId)],
  ['an invite that expired (Expired)', d => d.requests.some(r => r.data.direction === 'outgoing' && requestState(r.data, d.now) === 'expired')],
  ['an invite I withdrew (Cancelled)', d => d.requests.some(r => r.data.direction === 'outgoing' && r.data.status === 'cancelled')],
  ['a friend invite link, active', d => linkStates(d, 'friend').has('active')],
  ['a friend invite link, used up', d => linkStates(d, 'friend').has('used-up')],
  ['a friend invite link, expired', d => linkStates(d, 'friend').has('expired')],
  ['a friend invite link, revoked', d => linkStates(d, 'friend').has('revoked')],
  ['a friend invite link with no limits', d => d.links.some(l => l.data.kind === 'friend' && l.data.maxUses === null && l.data.expiresAt === null)],
  ['a group invite link, active', d => linkStates(d, 'group').has('active')],
  ['a group invite link with a use limit', d => d.links.some(l => l.data.kind === 'group' && l.data.maxUses !== null)],
  // ponytail: a "join request" is a use of a group link that needs approval; there is no pending-approval record until the server exists (F-2105).
  ['a group join request (someone opened a link that needs my approval)', d => d.links.some(l => l.data.kind === 'group' && l.data.approveJoins && !l.data.revoked && l.data.uses > 0)],
  ['a friend request in Activity: received', d => d.activity.some(e => e.kind === 'friendRequest.received')],
  ['a friend request in Activity: sent', d => d.activity.some(e => e.kind === 'friendRequest.sent')],
  ['a friend request in Activity: accepted (Joined)', d => d.activity.some(e => e.kind === 'friendRequest.accepted')],
  // Deleted items stay in place (F-1203, owners 98 to 106)
  ['a deleted group, shown read only in the list', d => d.allGroups.some(g => g.deleted && d.expenses.some(e => e.deleted && e.data.groupId === g.id))],
  ['a deleted friend', d => d.allPeople.some(p => p.deleted)],
  ['a removed friend who was squared up first (F-621)', d => d.allPeople.some(p => !p.deleted && (p.data as {removedAt?: number | null}).removedAt)],
  ['one deleted item hidden by hand (lists.hiddenItems)', d => (pref<string[]>(d, 'lists.hiddenItems') ?? []).some(id => d.expenses.some(e => e.id === id && e.deleted))],
  // Groups: inactive, hidden, left members, admin handover (F-604, F-615)
  ['an inactive group that still holds money', d => d.groups.some(g => g.data.inactive && d.live.some(e => e.data.groupId === g.id))],
  ['a hidden group', d => (pref<string[]>(d, 'groups.hidden') ?? []).some(id => d.groups.some(g => g.id === id))],
  ['a member who left a group with their balance kept open', d => d.groups.some(g => g.data.members.some(m => m.leftAt !== null && m.exit === 'kept'))],
  ['an admin handed over to me before leaving', d => d.groups.some(g => g.data.members.some(m => m.role === 'admin' && m.personId === DEMO_ME) && g.data.members.some(m => m.leftAt !== null && m.role === 'member') && d.dump.history.some(h => h.entityId === g.id && (h.data as Group).members?.some(m => m.personId !== DEMO_ME && m.role === 'admin' && m.leftAt === null)))],
  ['a settled group (every currency at zero)', d => d.groups.some(g => d.live.some(e => e.data.groupId === g.id) && !d.balances.some(b => b.groupId === g.id && b.amount !== 0n))],
  ['a settled friend', d => d.people.some(p => !p.data.isMe && d.balances.filter(b => b.personId === p.id).every(b => b.amount === 0n) && d.live.some(e => p.id in e.data.payers))],
  // Many currencies (F-1113, F-1114)
  ['yen, dinar and a euro group side by side with rupees in one group', d => d.groups.some(g => currenciesIn(d, g.id).has('INR') && currenciesIn(d, g.id).size >= 2)],
  // The bill (F-403)
  ['the Supper Factory bill: tax classes, stacked charges and round-off to 2,522.00', d => d.live.some(e => e.data.title === 'The Supper Factory' && e.data.total === 252_200n && e.data.split.mode === 'items' && (e.data.split.charges?.length ?? 0) >= 3 && e.data.split.roundOff?.minor === 39n && e.data.split.items.some(i => i.taxClass === 'alcohol') && e.data.split.items.some(i => i.taxClass === 'food') && e.data.split.charges!.some(c => c.stacksOn === 'earlier'))],
  ['a saved merchant setup for that bill', d => (pref<Array<{key: string}>>(d, 'bill.merchantSetups') ?? []).some(m => m.key === 'the supper factory')],
  // Comments (F-1204)
  ['a comment thread on an expense', d => d.comments.filter(c => !c.deleted && c.data.targetType === 'expense').length >= 3],
  ['an edited comment', d => d.comments.some(c => !c.deleted && c.data.editedAt !== null)],
  ['a deleted comment', d => d.comments.some(c => c.deleted)],
  ['a comment with an @mention', d => d.comments.some(c => !c.deleted && c.data.mentions.length > 0)],
  ['a comment on a payment', d => d.comments.some(c => !c.deleted && c.data.targetType === 'repayment')],
  // Reminders (F-1118, F-1119)
  ['a reminder I shared with a friend (Remind)', d => d.reminders.some(r => !r.deleted && r.data.kind === 'nudge')],
  ['a nudge with an amount in a second currency', d => d.reminders.some(r => r.data.kind === 'nudge' && 'EUR' in r.data.amounts)],
  ['a reminder I scheduled for myself about a friend, repeating (Remind me)', d => d.reminders.some(r => !r.deleted && r.data.kind === 'self' && r.data.personId !== '' && r.data.repeat !== 'none')],
  ['a reminder I scheduled for myself about a group', d => d.reminders.some(r => !r.deleted && r.data.kind === 'self' && r.data.groupId !== null)],
  // Disputes and holds (F-1210, owner 119): every state, in more than one currency
  ['an open dispute with a proposed fix, waiting for me', d => d.disputes.some(x => x.data.kind === 'dispute' && x.data.status === 'open' && x.data.proposedFix !== null && x.data.raisedBy !== DEMO_ME)],
  ['an open dispute I raised myself', d => d.disputes.some(x => x.data.kind === 'dispute' && x.data.status === 'open' && x.data.raisedBy === DEMO_ME && x.data.itemId === null)],
  ['a disputed item of an itemised bill (my portion)', d => d.disputes.some(x => x.data.status === 'open' && x.data.itemId !== null)],
  ['an accepted dispute (the record was fixed)', d => d.disputes.some(x => x.data.status === 'accepted')],
  ['a rejected dispute, with the reason', d => d.disputes.some(x => x.data.status === 'rejected' && x.data.resolution !== '')],
  ['a withdrawn dispute', d => d.disputes.some(x => x.data.status === 'withdrawn')],
  ['a reopened dispute (rejected once, open again)', d => d.disputes.some(x => x.data.status === 'open' && x.data.reopenCount > 0)],
  ['a dispute closed as Gone (the record was deleted)', d => d.disputes.some(x => x.data.status === 'gone')],
  ['a record on hold, with its reason', d => d.disputes.some(x => x.data.kind === 'hold' && x.data.status === 'open' && x.data.note !== '')],
  ['a hold that was released', d => d.disputes.some(x => x.data.kind === 'hold' && x.data.status === 'released')],
  ['a payment disputed as not received', d => d.disputes.some(x => x.data.targetType === 'repayment' && x.data.reason === 'not_received' && x.data.status === 'open')],
  ['disputes and holds in rupees, euros, dollars and pounds', d => ['INR', 'EUR', 'USD', 'GBP'].every(c => d.disputes.some(x => d.dump.entities.some(r => r.id === x.data.targetId && (r.data as {currency?: string}).currency === c)))],
  ['"of which disputed" figures in several currencies (a disputed balance projection)', d => new Set(d.disputed.filter(b => b.amount !== 0n).map(b => b.currency)).size >= 3],
  // Exports and backups (F-2001, F-2007)
  ['a backup of the demo reads back and restores as a preview (comments, reminders, groups, setups included)', d => (d.backup.entities.comment?.length ?? 0) > 0 && (d.backup.entities.reminder?.length ?? 0) > 0 && (d.backup.entities.dispute?.length ?? 0) > 0 && (d.backup.entities.group?.length ?? 0) >= 20 && (d.backup.entities.expense?.length ?? 0) > 1400 && d.backup.entities.preference!.some(p => p.id === 'bill.merchantSetups')],
  // Ask Splito (F-2301)
  ['Ask-ready balances: people owe me and I owe people, in rupees and two other currencies', d => ['INR', 'EUR', 'USD'].every(c => d.balances.some(b => b.currency === c && b.amount > 0n) && d.balances.some(b => b.currency === c && b.amount < 0n))],
  // Feedback
  ['feedback saved on this device', d => d.feedback.some(f => !f.deleted)],
  ['feedback with a reply address', d => d.feedback.some(f => !f.deleted && (f.data as {replyEmail: string | null}).replyEmail)],
  // Activity
  ['changes made by other people (unread in Activity)', d => d.dump.history.some(h => h.actor !== DEMO_ME && h.entityType === 'expense')],
  ['my own changes in Activity', d => d.dump.history.some(h => h.actor === DEMO_ME)],
  // The Activity type filter (owner 173, F-259): one row of every type it offers.
  ...(ACTIVITY_TYPE_IDS as readonly ActivityTypeId[]).map((type): [string, (d: Demo) => boolean] => [`Activity lists ${type} (the Type filter)`, d => d.activity.some(e => activityTypeOf(e.kind) === type)]),
  ['a comment in Activity written by someone else (Others tab) and one by me (Me tab)', d => d.activity.some(e => e.kind === 'comment.added' && e.actor !== DEMO_ME) && d.activity.some(e => e.kind === 'comment.added' && e.actor === DEMO_ME)],
]

let demo: Demo
let store: Store
let ids = 0
const ctxAt = (now: () => number) => ({deviceId: 'd', actor: DEMO_ME, now, newId: () => `op-${++ids}`})

/** The whole database read once, its states judged at `now`. */
async function readDemo(now: number): Promise<Demo> {
  const dump = await store.dump()
  const of = <T>(type: string) => dump.entities.filter(e => e.type === type) as Entity<T>[]
  const expenses = of<Expense>('expense')
  const prefs = Object.fromEntries(of<{value: unknown}>('preference').filter(p => !p.deleted).map(p => [p.id, p.data.value]))
  const backup = parseBackup(serializeBackup(await createBackup(store, ctxAt(() => now))))
  await previewBackup(store, ctxAt(() => now), backup, 'merge')
  return {
    allGroups: of<Group>('group'),
    allPeople: of<Person>('person'),
    comments: of<Comment>('comment'),
    reminders: of<Reminder>('reminder'),
    disputes: of<Dispute>('dispute'),
    disputed: await store.disputedBalances(),
    prefs,
    backup,
    balances: await store.balances(),
    dump,
    expenses,
    live: expenses.filter(e => !e.deleted),
    groups: of<Group>('group').filter(g => !g.deleted),
    people: of<Person>('person').filter(p => !p.deleted),
    repayments: of<Repayment>('repayment'),
    writeOffs: of<WriteOff>('writeoff'),
    requests: of<FriendRequest>('friendRequest'),
    links: of<InviteLink>('inviteLink'),
    feedback: of('feedback'),
    activity: activityFromHistory(dump.history),
    now,
  }
}

const T0 = Date.now()
let clock = T0

beforeAll(async () => {
  const db = new Database(':memory:')
  store = await openSqlStore({
    exec: async sql => void db.run(sql),
    run: async (sql, params) => void db.query(sql).run(...(params as never[])),
    all: async (sql, params) => db.query(sql).all(...(params as never[])) as never,
    withTransaction: async fn => {
      db.run('BEGIN IMMEDIATE')
      try {
        const r = await fn()
        db.run('COMMIT')
        return r
      } catch (e) {
        db.run('ROLLBACK')
        throw e
      }
    },
    close: async () => db.close(),
  })
  const ctx = ctxAt(() => clock)
  await ensureMe(store, ctx, 'Me')
  await seedDemo(store, ctx)
  demo = await readDemo(clock)
}, 120_000)

describe('the demo dataset covers every feature the app has', () => {
  test('every feature below finds at least one record in the seeded demo database', () => {
    const missing = FEATURES.filter(([, found]) => !found(demo)).map(([feature]) => feature)
    expect(missing).toEqual([])
  })

  test('the time-sensitive states hold 30 days later: the next open redoes what aged (M3)', async () => {
    // The ledger stays; requests lapse after 30 days and links expire, so the invites block is redone once it is old.
    clock = T0 + 30 * 86_400_000
    await seedDemo(store, ctxAt(() => clock))
    const later = await readDemo(clock)
    const missing = FEATURES.filter(([, found]) => !found(later)).map(([feature]) => feature)
    expect(missing).toEqual([])
    expect(later.requests.length).toBe(9)
    expect(later.links.length).toBe(9)
    // The 'Sent' and 'Opened' invites are still waiting, not lapsed.
    const waiting = later.requests.filter(r => r.data.direction === 'outgoing' && requestState(r.data, later.now) === 'pending')
    expect(waiting.length).toBe(3)
    clock = T0
  })

  test('the list names each feature once', () => {
    const names = FEATURES.map(([feature]) => feature)
    expect(new Set(names).size).toBe(names.length)
  })

  test('a friend whose balance with me is settled up in every currency', async () => {
    const open = new Set((await store.balances()).filter(b => b.amount !== 0n).map(b => b.personId))
    const friends = demo.people.filter(p => !p.data.isMe)
    expect(friends.some(p => !open.has(p.id))).toBe(true)
  })
})
