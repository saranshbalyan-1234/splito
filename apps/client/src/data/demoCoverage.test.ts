import {Database} from 'bun:sqlite'
import {beforeAll, describe, expect, test} from 'bun:test'
import {
  type ActivityEvent,
  activityFromHistory,
  ensureMe,
  type Entity,
  type Expense,
  type FriendRequest,
  type Group,
  type InviteLink,
  inviteLinkState,
  openSqlStore,
  type Person,
  type Repayment,
  requestState,
  type Store,
  type StoreDump,
  type WriteOff,
} from '@splito/sync'

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
  activity: ActivityEvent[]
  /** The moment the dataset was read; request and link states are judged at this time. */
  now: number
}

const kinds = (d: Demo) => new Set(d.live.map(e => e.data.split.mode))
const currenciesIn = (d: Demo, groupId: string) => new Set(d.live.filter(e => e.data.groupId === groupId).map(e => e.data.currency))
/** How many times a request's personal link was used; -1 when it has none. */
const usesOf = (d: Demo, code: string | null) => d.links.find(l => l.id === code)?.data.uses ?? -1
const linkStates = (d: Demo, kind: InviteLink['kind']) => new Set(d.links.filter(l => l.data.kind === kind).map(l => inviteLinkState(l.data, d.now)))
const titleCount = (d: Demo, title: string) => d.live.filter(e => e.data.title === title).length

const FEATURES: Array<[feature: string, found: (d: Demo) => boolean]> = [
  // Groups
  ['a trip group with dates', d => d.groups.some(g => g.data.kind === 'trip' && g.data.startDate && g.data.endDate)],
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
  ['friends (private, no account)', d => d.people.filter(p => !p.data.isMe).length >= 30],
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
  // Feedback
  ['feedback saved on this device', d => d.feedback.some(f => !f.deleted)],
  ['feedback with a reply address', d => d.feedback.some(f => !f.deleted && (f.data as {replyEmail: string | null}).replyEmail)],
  // Activity
  ['changes made by other people (unread in Activity)', d => d.dump.history.some(h => h.actor !== DEMO_ME && h.entityType === 'expense')],
  ['my own changes in Activity', d => d.dump.history.some(h => h.actor === DEMO_ME)],
]

let demo: Demo
let store: Store

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
  let n = 0
  const ctx = {deviceId: 'd', actor: DEMO_ME, now: () => Date.now(), newId: () => `op-${++n}`}
  await ensureMe(store, ctx, 'Me')
  await seedDemo(store, ctx)
  const dump = await store.dump()
  const of = <T>(type: string) => dump.entities.filter(e => e.type === type) as Entity<T>[]
  const expenses = of<Expense>('expense')
  demo = {
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
    now: Date.now(),
  }
}, 120_000)

describe('the demo dataset covers every feature the app has', () => {
  test('every feature below finds at least one record in the seeded demo database', () => {
    const missing = FEATURES.filter(([, found]) => !found(demo)).map(([feature]) => feature)
    expect(missing).toEqual([])
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
