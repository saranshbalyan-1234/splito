/**
 * The data side of demo mode (ARCHITECTURE 26.1, F-228a), free of any platform
 * module so it runs under test on both store engines: the one preference row the
 * REAL database keeps (`demo.mode`), the demo database's seeding (the one dataset
 * from `@splito/sync` `generateLargeDemo`, through the real mutations) and its wipe.
 *
 * Dev and e2e builds only; see `demoMode.ts` for how it is reached.
 */
import {
  createInviteLink,
  type demoDirectory,
  type Entity,
  type EntityType,
  insideTransaction,
  type Key,
  type MutationCtx,
  type Page,
  receiveFriendRequest,
  recordInviteUse,
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
  ],
  invites: {
    ananya2026demo: {kind: 'friend', inviter: 'demo-ananya', groupName: null},
  },
}

/** Someone not on Splito, already invited in the demo. */
const INVITED = {name: 'Neha Joshi', contact: {kind: 'phone', value: '+919988776655'}} as const

/*
 * 26.18 in the demo: two requests waiting for you (from people on Splito),
 * two of yours waiting for them (one on Splito, one invited by SMS), and
 * invite links with limits, one of them already partly used. These read the
 * store first, so they cannot run inside the ledger's one transaction.
 */
async function seedFriendInvites(store: Store, ctx: MutationCtx, goaId: string, now: number) {
  const at = (time: number, actor = ctx.actor): MutationCtx => ({...ctx, actor, now: () => time})
  const account = (id: string) => DEMO_DIRECTORY.accounts.find(a => a.accountId === id)!
  for (const [id, ago] of [
    ['demo-sara', 26 * HOUR],
    ['demo-ishaan', 25 * MINUTE],
  ] as const) {
    const a = account(id)
    await receiveFriendRequest(store, at(now - ago, a.accountId), {id: ctx.newId(), accountId: a.accountId, name: a.name, contact: a.contact})
  }
  const kabir = account('demo-kabir')
  await sendFriendRequest(store, at(now - 2 * DAY), {contact: kabir.contact!, name: 'Kabir', reach: 'on-splito'})
  const personal = await createInviteLink(store, at(now - 5 * DAY), {kind: 'friend', groupId: null, maxUses: 1, expiresInMs: 7 * DAY, approveJoins: false})
  await sendFriendRequest(store, at(now - 5 * DAY), {contact: INVITED.contact, name: INVITED.name, reach: 'invited', inviteCode: personal.id})
  await createInviteLink(store, at(now - 3 * HOUR), {kind: 'friend', groupId: null, maxUses: 5, expiresInMs: 30 * DAY, approveJoins: false})
  const goa = await createInviteLink(store, at(now - 4 * DAY), {kind: 'group', groupId: goaId, maxUses: 25, expiresInMs: 30 * DAY, approveJoins: true})
  for (const id of ['demo-maya', 'demo-ananya', 'demo-sara']) await recordInviteUse(store, at(now - 3 * DAY, id), goa.id)
}

/* -------------------------------------------------------------------------- */
/* Seeding                                                                    */
/* -------------------------------------------------------------------------- */

/** The first person the plan writes after "me" that every plan has: its presence says the ledger transaction committed. */
const SEEDED_MARK = `${DEMO_LARGE_PREFIX}p-riya`
const STORY_GOA = `${DEMO_LARGE_PREFIX}g-story-goa`

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
    await seedFriendInvites(store, ctx, STORY_GOA, now)
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

