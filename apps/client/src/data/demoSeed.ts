/**
 * The data side of demo mode (ARCHITECTURE 26.1, F-228a), free of any platform
 * module so it runs under test on both store engines: the one preference row the
 * REAL database keeps (`demo.mode`), the demo database's seeding (the one dataset
 * from `@splito/sync` `generateLargeDemo`, through the real mutations) and its wipe.
 *
 * Dev and e2e builds only; see `demoMode.ts` for how it is reached.
 */
import {
  addGroupMembers,
  applyFriendRequestAccepted,
  cancelFriendRequest,
  createInviteLink,
  createPerson,
  approveJoinRequest,
  declineFriendRequest,
  declineGroupRequest,
  type demoDirectory,
  type Entity,
  type EntityType,
  type Group,
  type Person,
  insideTransaction,
  markNeverSync,
  type Key,
  type MutationCtx,
  type Page,
  receiveFriendRequest,
  receiveGroupInvite,
  receiveJoinRequest,
  recordInviteUse,
  requestToJoin,
  revokeInviteLink,
  saveFeedback,
  sendFriendRequest,
  setJoinPolicy,
  type Store,
} from '@splito/sync'
import {applyDemoOp, DEMO_LARGE_PREFIX, generateLargeDemo, isDeferredOp, localToday} from '@splito/sync/demoLarge'

/** The preference row in the REAL database that says the demo database is showing. Not in the registry: no Settings page, never reset by "Reset all settings", never queued. */
const MODE_ID = 'demo.mode'

export async function readDemoMode(real: Store): Promise<boolean> {
  const row = await real.get<{value: unknown}>('preference', MODE_ID)
  return !!row && !row.deleted && row.data.value === true
}

export async function writeDemoMode(real: Store, ctx: MutationCtx, on: boolean): Promise<void> {
  await real.transaction(async tx => {
    const prev = await tx.get('preference', MODE_ID)
    // A device-only row: written without an outbox op, so it never reaches a sync queue.
    await tx.put({type: 'preference', id: MODE_ID, data: {value: on}, version: (prev?.version ?? 0) + 1, deleted: false, updatedAt: ctx.now()})
  })
}

/** Demo mode is a person of its own, so nothing of the real "me" (or its id) is in the demo database. */
export const DEMO_ME = `${DEMO_LARGE_PREFIX}me`

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/* -------------------------------------------------------------------------- */
/* The demo account directory (26.18)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Who is "on Splito" in demo mode, and an invite code that opens someone
 * else's invite. Invented people, example.com addresses and fictional numbers only.
 */
export const DEMO_DIRECTORY: Parameters<typeof demoDirectory>[0] = {
  accounts: [
    {accountId: 'demo-ananya', name: 'Ananya Gupta', contact: {kind: 'email', value: 'ananya@example.com'}},
    {accountId: 'demo-kabir', name: 'Kabir Khan', contact: {kind: 'phone', value: '+919812345678'}},
    {accountId: 'demo-maya', name: 'Maya Chen', contact: {kind: 'email', value: 'maya@example.com'}},
    {accountId: 'demo-ishaan', name: 'Ishaan Verma', contact: {kind: 'email', value: 'ishaan@example.com'}},
    {accountId: 'demo-sara', name: 'Sara Ali', contact: {kind: 'phone', value: '+14155550134'}},
    {accountId: 'demo-leo', name: 'Leo Fischer', contact: {kind: 'email', value: 'leo@example.com'}},
    {accountId: 'demo-tanvi', name: 'Tanvi Rao', contact: {kind: 'email', value: 'tanvi@example.com'}},
  ],
  invites: {
    ananya2026demo: {kind: 'friend', inviter: 'demo-ananya', groupName: null},
    // Someone else's group links, one per rule (owner 196): in at once, ask to join, and invite only (no working link).
    beachlink2026: {kind: 'group', inviter: 'demo-sara', groupName: 'Beach cleanup crew', group: {id: `${DEMO_LARGE_PREFIX}r-beach`, kind: 'trip', currency: 'INR', joinPolicy: 'link'}},
    gamesask2026: {kind: 'group', inviter: 'demo-ishaan', groupName: 'Board games night', group: {id: `${DEMO_LARGE_PREFIX}r-games`, kind: 'trip', currency: 'INR', joinPolicy: 'approve'}},
    runonly2026: {kind: 'group', inviter: 'demo-leo', groupName: 'Run club', group: {id: `${DEMO_LARGE_PREFIX}r-run`, kind: 'other', currency: 'INR', joinPolicy: 'invite'}},
  },
}

/** Someone not on Splito, already invited in the demo. */
const INVITED = {name: 'Neha Joshi', contact: {kind: 'phone', value: '+919988776655'}} as const

/** The private friends of the invites block have fixed ids (a partial block is erased by them and redone). */
const PRIVATE_PREFIX = `${DEMO_LARGE_PREFIX}p-inv-`
const PRIVATE_IDS = ['pooja', 'rohan', 'tanvi'].map(k => PRIVATE_PREFIX + k)

/** The same context, whose first new id is `id` (a mutation mints the entity id first). */
function withFirstId(ctx: MutationCtx, id: string): MutationCtx {
  let used = false
  return {...ctx, newId: () => (used ? ctx.newId() : ((used = true), id))}
}

const email = (value: string) => ({kind: 'email', value}) as const

/*
 * 26.18 in the demo, every state the flow can be in, through the real mutations.
 * Requests I received: waiting (x2), declined. Invites I sent: Sent (waiting, link
 * unopened), Opened (the person opened the personal link but has not answered), Joined
 * (accepted; their private "only for you" entry was linked to the account, F-616),
 * Expired (30 days passed), Cancelled. Private friends with no account. Invite links of
 * both kinds: active, limited and partly used, unlimited, used up, expired, revoked; a
 * group link that needs my approval has been opened by people (the join requests). Groups (F-269): every
 * "Who can join" rule (Goa approve, Lisbon anyone with the link, the flat invite only), join requests waiting
 * on Goa, group requests to me, an invited member on Goa, and my own join request. These
 * read the store first, so they cannot run inside the ledger's one transaction.
 */
async function seedFriendInvites(store: Store, ctx: MutationCtx, goaId: string, lisbonId: string, flatId: string, now: number) {
  const at = (time: number, actor = ctx.actor): MutationCtx => ({...ctx, actor, now: () => time})
  const account = (id: string) => DEMO_DIRECTORY.accounts.find(a => a.accountId === id)!
  const personalLink = (time: number, maxUses: number, expiresInMs = 60 * DAY) =>
    createInviteLink(store, at(time), {kind: 'friend', groupId: null, maxUses, expiresInMs, approveJoins: false})

  // Requests for me: two waiting, one I declined.
  for (const [id, ago] of [
    ['demo-sara', 26 * HOUR],
    ['demo-ishaan', 25 * MINUTE],
    ['demo-leo', 9 * DAY],
  ] as const) {
    const a = account(id)
    const r = await receiveFriendRequest(store, at(now - ago, a.accountId), {id: ctx.newId(), accountId: a.accountId, name: a.name, contact: a.contact})
    if (id === 'demo-leo') await declineFriendRequest(store, at(now - 8 * DAY), r.id)
  }

  // Private "only for you" friends: a name only, a contact, and one who will join below. Fixed ids, so a partial block can be erased and redone.
  const tanvi = account('demo-tanvi')
  const priv = (key: string, input: Parameters<typeof createPerson>[2], time: number) => createPerson(store, withFirstId(at(time), PRIVATE_PREFIX + key), input)
  await priv('pooja', {name: 'Pooja (flatmate)'}, now - 60 * DAY)
  await priv('rohan', {name: 'Rohan Das', contact: email('rohan@example.com')}, now - 45 * DAY)
  await priv('tanvi', {name: tanvi.name, contact: tanvi.contact}, now - 30 * DAY)

  // Sent: on Splito, waiting; and by SMS, the personal link not opened yet.
  await sendFriendRequest(store, at(now - 2 * DAY), {contact: account('demo-kabir').contact!, name: 'Kabir', reach: 'on-splito'})
  const sent = await personalLink(now - 5 * DAY, 1)
  await sendFriendRequest(store, at(now - 5 * DAY), {contact: INVITED.contact, name: INVITED.name, reach: 'invited', inviteCode: sent.id})

  // Opened: the person opened the link (a use) but has not answered.
  // Three uses, so a link that was opened does not read "Used up" (the stand-in for Opened until F-2105).
  const opened = await personalLink(now - 3 * DAY, 3)
  await sendFriendRequest(store, at(now - 3 * DAY), {contact: email('aarav@example.com'), name: 'Aarav Mehta', reach: 'invited', inviteCode: opened.id})
  await recordInviteUse(store, at(now - 2 * DAY), opened.id)

  // Joined: opened the link and accepted; the private "Tanvi Rao" above is now linked to the account.
  const joined = await personalLink(now - 4 * DAY, 1)
  const joinedReq = await sendFriendRequest(store, at(now - 4 * DAY), {contact: tanvi.contact!, name: tanvi.name, reach: 'invited', inviteCode: joined.id})
  await recordInviteUse(store, at(now - 2 * HOUR), joined.id)
  await applyFriendRequestAccepted(store, at(now - 90 * MINUTE, tanvi.accountId), joinedReq.id, {accountId: tanvi.accountId, name: tanvi.name})

  // Expired: sent 40 days ago, never answered, and its link has lapsed too.
  const lapsed = await personalLink(now - 40 * DAY, 1, 7 * DAY) // lapsed on purpose
  await sendFriendRequest(store, at(now - 40 * DAY), {contact: email('meera@example.com'), name: 'Meera Nair', reach: 'invited', inviteCode: lapsed.id})

  // Cancelled: sent, then withdrawn.
  const withdrawn = await sendFriendRequest(store, at(now - 6 * DAY), {contact: email('zoya@example.com'), name: 'Zoya Khan', reach: 'on-splito'})
  await cancelFriendRequest(store, at(now - 5 * DAY), withdrawn.id)

  // Who can join (owner 196): Goa keeps the default (approve each join), Lisbon is open to anyone with the link, the flat is invite only (no link).
  await setJoinPolicy(store, at(now - 10 * DAY), lisbonId, 'link')
  await setJoinPolicy(store, at(now - 10 * DAY), flatId, 'invite')

  // Links: friend (active and partly used, unlimited, revoked) and group (needs approval, open).
  await createInviteLink(store, at(now - 3 * HOUR), {kind: 'friend', groupId: null, maxUses: 5, expiresInMs: 30 * DAY, approveJoins: false})
  await createInviteLink(store, at(now - 20 * DAY), {kind: 'friend', groupId: null, maxUses: null, expiresInMs: null, approveJoins: false})
  const old = await personalLink(now - 15 * DAY, 3, 30 * DAY)
  await revokeInviteLink(store, at(now - 14 * DAY), old.id)
  const goa = await createInviteLink(store, at(now - 4 * DAY), {kind: 'group', groupId: goaId, maxUses: 25, expiresInMs: 30 * DAY, approveJoins: true})
  // Three people opened Goa's link: Maya and Ananya wait for my approval (join requests), Sara was approved a day later.
  for (const id of ['demo-maya', 'demo-ananya', 'demo-sara']) {
    await recordInviteUse(store, at(now - 3 * DAY, id), goa.id)
    const a = account(id)
    const joinId = ctx.newId()
    await receiveJoinRequest(store, at(now - 3 * DAY, id), {id: joinId, groupId: goaId, joiner: a})
    if (id === 'demo-sara') await approveJoinRequest(store, at(now - 2 * DAY), joinId)
  }
  const lisbon = await createInviteLink(store, at(now - 2 * DAY), {kind: 'group', groupId: lisbonId, maxUses: null, expiresInMs: 30 * DAY, approveJoins: true})
  await recordInviteUse(store, at(now - 1 * DAY, 'demo-kabir'), lisbon.id)

  // Group requests (F-269): to me (Join / Decline), one I declined, an invited member waiting on Goa, and my own join request.
  const remote = (id: string, name: string, kind: Group['kind']) => ({groupId: DEMO_LARGE_PREFIX + id, groupName: name, groupKind: kind, groupCurrency: 'INR'})
  const sara = account('demo-sara')
  const ishaan = account('demo-ishaan')
  const leo = account('demo-leo')
  await receiveGroupInvite(store, at(now - 5 * HOUR, sara.accountId), {id: ctx.newId(), ...remote('r-pune', 'Pune cabin weekend', 'trip'), inviter: sara})
  await receiveGroupInvite(store, at(now - 40 * MINUTE, ishaan.accountId), {id: ctx.newId(), ...remote('r-lunch', 'Office lunch club', 'other'), inviter: ishaan})
  const turned = await receiveGroupInvite(store, at(now - 6 * DAY, leo.accountId), {id: ctx.newId(), ...remote('r-hike', 'Sunday hikes', 'other'), inviter: leo})
  await declineGroupRequest(store, at(now - 5 * DAY), turned.id)
  await addGroupMembers(store, at(now - 2 * HOUR), goaId, [PRIVATE_PREFIX + 'tanvi'])
  await requestToJoin(store, at(now - 4 * HOUR), remote('r-ski', 'Ski trip crew', 'trip'))
}

/**
 * The ops that read the store first (deleting or removing a friend, a group going, a member leaving): applied one by one after the
 * ledger's transaction, each only if its effect is not there yet, so a run cut off half-way finishes without doubling.
 */
async function seedLate(store: Store, ctx: MutationCtx, now: number) {
  const {ops} = generateLargeDemo({me: ctx.actor, today: localToday(now), now})
  for (const op of ops.filter(isDeferredOp)) {
    if (op.kind === 'person.delete') {
      const p = await store.get<Person>('person', op.id)
      if (!p || p.deleted) continue
    } else if (op.kind === 'person.remove') {
      const p = await store.get<Person>('person', op.id)
      if (!p || p.deleted || (p.data as {removedAt?: number | null}).removedAt) continue
    } else if (op.kind === 'group.delete') {
      const g = await store.get<Group>('group', op.id)
      if (!g || g.deleted) continue
    } else if (op.kind === 'member.exit') {
      const g = await store.get<Group>('group', op.id)
      if (!g || g.deleted || g.data.members.find(m => m.personId === op.input.personId)?.leftAt !== null) continue
    }
    await applyDemoOp(store, ctx, op)
  }
}

/** "Your feedback" (Settings > Send feedback): three records saved on this device, one with a reply address. */
async function seedFeedback(store: Store, ctx: MutationCtx, now: number) {
  const at = (time: number): MutationCtx => ({...ctx, now: () => time})
  const info = {version: '1.0.0', platform: 'web', os: 'Demo', language: 'en', screen: '/'}
  await saveFeedback(store, at(now - 6 * DAY), {type: 'idea', message: 'Let me split a bill by dragging items onto people.', attachment: null, appInfo: info, replyEmail: null})
  await saveFeedback(store, at(now - 3 * DAY), {type: 'bug', message: 'The total on the Goa trip flickers when I scroll the balances.', attachment: null, appInfo: info, replyEmail: 'riya@example.com'})
  await saveFeedback(store, at(now - 40 * HOUR), {type: 'question', message: 'Can I settle in a currency the group did not use?', attachment: null, appInfo: null, replyEmail: null})
}

/* -------------------------------------------------------------------------- */
/* Seeding                                                                    */
/* -------------------------------------------------------------------------- */

/** The first person the plan writes after "me" that every plan has: its presence says the ledger transaction committed. */
const SEEDED_MARK = `${DEMO_LARGE_PREFIX}p-riya`
const STORY_GOA = `${DEMO_LARGE_PREFIX}g-story-goa`
const STORY_LISBON = `${DEMO_LARGE_PREFIX}g-story-lisbon`
const STORY_FLAT = `${DEMO_LARGE_PREFIX}g-story-flat`

/**
 * Completion markers of the two blocks that read the store first (so they cannot join the ledger's one
 * transaction). A device-only preference row in the demo database, written LAST with the seeding time: no
 * marker means the block never finished, and it is erased and written again.
 */
const MARK_INVITES = 'demo.seed.invites.2'
const MARK_FEEDBACK = 'demo.seed.feedback'
const MARK_LATE = 'demo.seed.late'

/**
 * The invites block holds states that age (a request lapses after 30 days, a link expires): when its marker is
 * older than this it is redone, so "Sent", "Opened" and the links never go stale. Well inside the 30 days.
 */
export const INVITES_MAX_AGE_MS = 14 * DAY

async function readMark(store: Store, id: string): Promise<number | null> {
  const row = await store.get<{value: unknown}>('preference', id)
  return row && !row.deleted && typeof row.data.value === 'number' ? row.data.value : null
}

async function writeMark(store: Store, id: string, at: number) {
  await store.transaction(async tx => {
    const prev = await tx.get('preference', id)
    await tx.put({type: 'preference', id, data: {value: at}, version: (prev?.version ?? 0) + 1, deleted: false, updatedAt: at})
  })
}

/** Erases every row of these types (a page at a time) plus the given people. */
async function eraseBlock(store: Store, types: EntityType[], personIds: string[] = []) {
  for (const type of types) {
    let after: Key | null = null
    do {
      // full-read-ok: a block of the disposable demo database, erased a page at a time.
      const page: Page<Entity> = await store.page(type, {after, limit: 500})
      if (page.items.length) await store.erase(page.items.map(e => ({type: e.type, id: e.id})))
      after = page.next
    } while (after)
  }
  const people = await store.getMany('person', personIds)
  if (people.length) {
    await store.erase(people.map(e => ({type: 'person' as const, id: e.id})))
    await store.rebuildProjections()
  }
}

/**
 * Writes the one demo dataset into an empty demo store through the real
 * mutations. The people, groups and ledger go in as ONE transaction (all of
 * it or none, so a page left half-way leaves nothing half-seeded). The invites
 * and feedback blocks then go in one after the other, each ending with its
 * marker: a block with no marker (cut off) is erased and written again, and the
 * invites block is also redone once it is old (`INVITES_MAX_AGE_MS`). Marks the
 * store as never-syncing. Returns false when everything was already there.
 */
export async function seedDemo(store: Store, ctx: MutationCtx, onProgress?: (done: number) => void): Promise<boolean> {
  markNeverSync(store)
  let wrote = false
  const now = ctx.now()
  if (!(await store.get('person', SEEDED_MARK))) {
    wrote = true
    const {ops} = generateLargeDemo({me: ctx.actor, today: localToday(now), now})
    await store.transaction(async tx => {
      const batched = insideTransaction(store, tx)
      for (const [i, op] of ops.entries()) {
        if (!isDeferredOp(op)) await applyDemoOp(batched, ctx, op)
        if (onProgress && i % 100 === 0) onProgress(i / ops.length)
      }
    })
  }
  if ((await readMark(store, MARK_LATE)) === null) {
    wrote = true
    await seedLate(store, ctx, now)
    await writeMark(store, MARK_LATE, now)
  }
  const invitesAt = await readMark(store, MARK_INVITES)
  if (invitesAt === null || now - invitesAt > INVITES_MAX_AGE_MS || now < invitesAt) {
    wrote = true
    await eraseBlock(store, ['friendRequest', 'groupRequest', 'inviteLink'], PRIVATE_IDS)
    await seedFriendInvites(store, ctx, STORY_GOA, STORY_LISBON, STORY_FLAT, now)
    await writeMark(store, MARK_INVITES, now)
  }
  if ((await readMark(store, MARK_FEEDBACK)) === null) {
    wrote = true
    await eraseBlock(store, ['feedback'])
    await seedFeedback(store, ctx, now)
    await writeMark(store, MARK_FEEDBACK, now)
  }
  onProgress?.(1)
  return wrote
}

const ALL_TYPES: EntityType[] = ['person', 'group', 'expense', 'repayment', 'writeoff', 'preference', 'friendRequest', 'groupRequest', 'inviteLink', 'comment', 'feedback', 'reminder', 'dispute']

/**
 * A start with `demo.mode` on: opens the demo database through `open`. When that
 * fails the app must not be locked in a mode it cannot open: the failure is passed
 * to `onFail` (logged by the caller), the REAL database is told the mode is off,
 * and null comes back (the caller shows the real store and a notice).
 */
export async function resumeDemo<T>(real: {store: Store; ctx: MutationCtx}, open: () => Promise<T>, onFail?: (e: unknown) => void): Promise<T | null> {
  try {
    return await open()
  } catch (e) {
    onFail?.(e)
    await writeDemoMode(real.store, real.ctx, false)
    return null
  }
}

/** Whether `value` names a `demo-large-` id anywhere inside it (a field, a map key or a list). */
function mentionsDemo(value: unknown): boolean {
  if (typeof value === 'string') return value.startsWith(DEMO_LARGE_PREFIX)
  if (Array.isArray(value)) return value.some(mentionsDemo)
  if (value && typeof value === 'object') return Object.entries(value).some(([k, v]) => k.startsWith(DEMO_LARGE_PREFIX) || mentionsDemo(v))
  return false
}

/** One real expense, payment or write-off outside the demo id range that refers to a demo person or group. */
async function realRowPointsAtDemo(real: Store): Promise<boolean> {
  for (const type of ['expense', 'repayment', 'writeoff'] as const) {
    let after: Key | null = null
    do {
      // full-read-ok: a one-time check (once per device, flagged) that the purge leaves no real record dangling.
      const page: Page<Entity> = await real.page(type, {after, limit: 500})
      if (page.items.some(e => !e.id.startsWith(DEMO_LARGE_PREFIX) && mentionsDemo(e.data))) return true
      after = page.next
    } while (after)
  }
  return false
}

/**
 * Demo rows that older builds (the large-set URL switch, "Add demo data") wrote into the REAL
 * database can no longer be removed from the app. Once per device (`flag`), erases
 * every row in the old `demo-large-` id range, with its history and outbox ops.
 * The old small set used random ids and cannot be told apart: those devices use
 * Settings > Data > Erase this device's data (RESUME.md). Returns how many rows went.
 */
export async function purgeLegacyDemo(real: Store, flag: {isDone(): boolean; markDone(): void}): Promise<number> {
  if (flag.isDone()) return 0
  // Real records that point at the old demo people or groups would be left dangling: skip the purge then (still once per device).
  if (await realRowPointsAtDemo(real)) {
    flag.markDone()
    return 0
  }
  let erased = 0
  for (const type of ALL_TYPES) {
    for (;;) {
      // full-read-ok: a one-time range read of the old demo ids, erased a page at a time.
      const page: Page<Entity> = await real.page(type, {min: DEMO_LARGE_PREFIX, max: `${DEMO_LARGE_PREFIX}\uffff`, limit: 500})
      if (page.items.length === 0) break
      await real.erase(page.items.map(e => ({type: e.type, id: e.id})))
      erased += page.items.length
    }
  }
  if (erased > 0) await real.rebuildProjections()
  flag.markDone()
  return erased
}
