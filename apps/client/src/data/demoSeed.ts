/**
 * The data side of demo mode (ARCHITECTURE 26.1, F-228a), free of any platform
 * module so it runs under test on both store engines: the one preference row the
 * REAL database keeps (`demo.mode`), the demo database's seeding (the one dataset
 * from `@splito/sync` `generateLargeDemo`, through the real mutations) and its wipe.
 *
 * Dev and e2e builds only; see `demoMode.ts` for how it is reached.
 */
import {
  applyFriendRequestAccepted,
  cancelFriendRequest,
  createInviteLink,
  createPerson,
  declineFriendRequest,
  type demoDirectory,
  type Entity,
  type EntityType,
  insideTransaction,
  type Key,
  type MutationCtx,
  type Page,
  receiveFriendRequest,
  recordInviteUse,
  revokeInviteLink,
  saveFeedback,
  sendFriendRequest,
  type Store,
} from '@splito/sync'
import {applyDemoOp, DEMO_LARGE_PREFIX, generateLargeDemo, localToday} from '@splito/sync/demoLarge'

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
  },
}

/** Someone not on Splito, already invited in the demo. */
const INVITED = {name: 'Neha Joshi', contact: {kind: 'phone', value: '+919988776655'}} as const

const email = (value: string) => ({kind: 'email', value}) as const

/*
 * 26.18 in the demo, every state the flow can be in, through the real mutations.
 * Requests I received: waiting (x2), declined. Invites I sent: Sent (waiting, link
 * unopened), Opened (the person opened the personal link but has not answered), Joined
 * (accepted; their private "only for you" entry was linked to the account, F-616),
 * Expired (30 days passed), Cancelled. Private friends with no account. Invite links of
 * both kinds: active, limited and partly used, unlimited, used up, expired, revoked; a
 * group link that needs my approval has been opened by people (the join requests). These
 * read the store first, so they cannot run inside the ledger's one transaction.
 */
async function seedFriendInvites(store: Store, ctx: MutationCtx, goaId: string, lisbonId: string, now: number) {
  const at = (time: number, actor = ctx.actor): MutationCtx => ({...ctx, actor, now: () => time})
  const account = (id: string) => DEMO_DIRECTORY.accounts.find(a => a.accountId === id)!
  const personalLink = (time: number, maxUses: number, expiresInMs: number) =>
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

  // Private "only for you" friends: a name only, a contact, and one who will join below.
  await createPerson(store, at(now - 60 * DAY), {name: 'Pooja (flatmate)'})
  await createPerson(store, at(now - 45 * DAY), {name: 'Rohan Das', contact: email('rohan@example.com')})
  const tanvi = account('demo-tanvi')
  await createPerson(store, at(now - 30 * DAY), {name: tanvi.name, contact: tanvi.contact})

  // Sent: on Splito, waiting; and by SMS, the personal link not opened yet.
  await sendFriendRequest(store, at(now - 2 * DAY), {contact: account('demo-kabir').contact!, name: 'Kabir', reach: 'on-splito'})
  const sent = await personalLink(now - 5 * DAY, 1, 7 * DAY)
  await sendFriendRequest(store, at(now - 5 * DAY), {contact: INVITED.contact, name: INVITED.name, reach: 'invited', inviteCode: sent.id})

  // Opened: the person opened the link (a use) but has not answered.
  const opened = await personalLink(now - 3 * DAY, 1, 7 * DAY)
  await sendFriendRequest(store, at(now - 3 * DAY), {contact: email('aarav@example.com'), name: 'Aarav Mehta', reach: 'invited', inviteCode: opened.id})
  await recordInviteUse(store, at(now - 2 * DAY), opened.id)

  // Joined: opened the link and accepted; the private "Tanvi Rao" above is now linked to the account.
  const joined = await personalLink(now - 4 * DAY, 1, 7 * DAY)
  const joinedReq = await sendFriendRequest(store, at(now - 4 * DAY), {contact: tanvi.contact!, name: tanvi.name, reach: 'invited', inviteCode: joined.id})
  await recordInviteUse(store, at(now - 2 * HOUR), joined.id)
  await applyFriendRequestAccepted(store, at(now - 90 * MINUTE, tanvi.accountId), joinedReq.id, {accountId: tanvi.accountId, name: tanvi.name})

  // Expired: sent 40 days ago, never answered, and its link has lapsed too.
  const lapsed = await personalLink(now - 40 * DAY, 1, 7 * DAY)
  await sendFriendRequest(store, at(now - 40 * DAY), {contact: email('meera@example.com'), name: 'Meera Nair', reach: 'invited', inviteCode: lapsed.id})

  // Cancelled: sent, then withdrawn.
  const withdrawn = await sendFriendRequest(store, at(now - 6 * DAY), {contact: email('zoya@example.com'), name: 'Zoya Khan', reach: 'on-splito'})
  await cancelFriendRequest(store, at(now - 5 * DAY), withdrawn.id)

  // Links: friend (active and partly used, unlimited, revoked) and group (needs approval, open).
  await createInviteLink(store, at(now - 3 * HOUR), {kind: 'friend', groupId: null, maxUses: 5, expiresInMs: 30 * DAY, approveJoins: false})
  await createInviteLink(store, at(now - 20 * DAY), {kind: 'friend', groupId: null, maxUses: null, expiresInMs: null, approveJoins: false})
  const old = await personalLink(now - 15 * DAY, 3, 30 * DAY)
  await revokeInviteLink(store, at(now - 14 * DAY), old.id)
  const goa = await createInviteLink(store, at(now - 4 * DAY), {kind: 'group', groupId: goaId, maxUses: 25, expiresInMs: 30 * DAY, approveJoins: true})
  for (const id of ['demo-maya', 'demo-ananya', 'demo-sara']) await recordInviteUse(store, at(now - 3 * DAY, id), goa.id)
  const lisbon = await createInviteLink(store, at(now - 2 * DAY), {kind: 'group', groupId: lisbonId, maxUses: null, expiresInMs: 14 * DAY, approveJoins: true})
  await recordInviteUse(store, at(now - 1 * DAY, 'demo-kabir'), lisbon.id)
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

/**
 * Writes the one demo dataset into an empty demo store through the real
 * mutations. The people, groups and ledger go in as ONE transaction (all of
 * it or none, so a page left half-way leaves nothing half-seeded), then the
 * friend requests and invite links, each only when still missing, so a
 * seeding that was cut off is finished by the next open. Returns false when
 * everything was already there.
 */
export async function seedDemo(store: Store, ctx: MutationCtx, onProgress?: (done: number) => void): Promise<boolean> {
  let wrote = false
  const now = Date.now()
  if (!(await store.get('person', SEEDED_MARK))) {
    wrote = true
    const {ops} = generateLargeDemo({me: ctx.actor, today: localToday(now), now})
    await store.transaction(async tx => {
      const batched = insideTransaction(store, tx)
      for (const [i, op] of ops.entries()) {
        await applyDemoOp(batched, ctx, op)
        if (onProgress && i % 100 === 0) onProgress(i / ops.length)
      }
    })
  }
  if ((await store.count('friendRequest')) === 0) {
    wrote = true
    await seedFriendInvites(store, ctx, STORY_GOA, STORY_LISBON, now)
  }
  if ((await store.count('feedback')) === 0) {
    wrote = true
    await seedFeedback(store, ctx, now)
  }
  onProgress?.(1)
  return wrote
}

const ALL_TYPES: EntityType[] = ['person', 'group', 'expense', 'repayment', 'writeoff', 'preference', 'friendRequest', 'inviteLink', 'comment', 'feedback']

/** Erases everything in a demo store (rows, their history and outbox ops), in bounded pages. */
export async function wipeDemo(store: Store): Promise<void> {
  for (const type of ALL_TYPES) {
    let after: Key | null = null
    do {
      // full-read-ok: the demo database is disposable and this erases it, a page at a time.
      const page: Page<Entity> = await store.page(type, {after, limit: 500})
      if (page.items.length) await store.erase(page.items.map(e => ({type: e.type, id: e.id})))
      after = page.next
    } while (after)
  }
  await store.rebuildProjections()
}

