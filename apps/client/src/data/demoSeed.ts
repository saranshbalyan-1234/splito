import {parseMinor as minor, todayIn} from '@splito/domain'
import {
  createExpense,
  createGroup,
  createInviteLink,
  createPerson,
  createRepayment,
  createWriteOffs,
  deleteExpense,
  deleteRepayment,
  deleteWriteOff,
  type ExpenseDraft,
  type Group,
  insideTransaction,
  type MutationCtx,
  receiveFriendRequest,
  recordInviteUse,
  restoreExpense,
  sendFriendRequest,
  type Store,
  updateExpense,
} from '@splito/sync'

import {
  DEMO_DIRECTORY,
  DEMO_EXPENSES,
  DEMO_FRIENDS,
  DEMO_GROUPS,
  DEMO_INVITED,
  demoSplit,
  type DemoGroupKey,
  type DemoPersonKey,
} from '#/data/demoData'

/*
 * The small demo set (`?demo=1`), written through the real mutations. The gates that decide whether it
 * runs (dev and e2e builds, the URL flag) live in `demo.ts`; this file has no platform imports so tests can run it.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/*
 * The demo history reads like two weeks of use rather than one burst, so
 * Activity has days to group: friends and groups first, then an expense every
 * few hours, and a fix-up or two in the last hour. Each expense is added by
 * whoever paid the most, as if synced in from their phone. The final data is
 * exactly the dataset, so every balance is unchanged.
 */
export async function seedDemoData(outer: Store, ctx: MutationCtx) {
  // Each stage guards itself, so a run repeated or cut short never doubles what is there (audit m18).
  const groups = await outer.getAll<Group>('group')
  if (groups.some(g => g.data.name === DEMO_GROUPS.goa.name)) return seedFriendInvitesOnce(outer, ctx, groups)

  const now = Date.now()
  let clock = now - 14 * DAY
  /** The mutation context for a write at `time` by `actor`. */
  const at = (time: number, actor = ctx.actor): MutationCtx => {
    clock = time
    return {...ctx, actor, now: () => clock}
  }

  // The people, groups and ledger go in as one transaction: all of it or none, in a few milliseconds,
  // so there is no half-seeded state to leave a page in. (The friend requests below read the store
  // first, so they cannot run inside it.)
  const groupIds = await outer.transaction(tx =>
    seedLedger(insideTransaction(outer, tx), ctx, now, at, () => clock),
  )
  await seedFriendInvites(outer, ctx, groupIds.goa, at, now)
}

/** The ledger is in but the requests may not be (the page was left between): finish them, once. */
async function seedFriendInvitesOnce(
  store: Store,
  ctx: MutationCtx,
  groups: Array<{id: string; data: Group}>,
) {
  const [requests, links] = await Promise.all([
    store.count('friendRequest'),
    store.count('inviteLink'),
  ])
  if (requests + links > 0) return
  const now = Date.now()
  const goa = groups.find(g => g.data.name === DEMO_GROUPS.goa.name)!
  const at = (time: number, actor = ctx.actor): MutationCtx => ({
    ...ctx,
    actor,
    now: () => time,
  })
  await seedFriendInvites(store, ctx, goa.id, at, now)
}

async function seedLedger(
  store: Store,
  ctx: MutationCtx,
  now: number,
  at: (time: number, actor?: string) => MutationCtx,
  readClock: () => number,
) {
  const ids = {me: ctx.actor} as Record<DemoPersonKey, string>
  for (const [key, name] of Object.entries(DEMO_FRIENDS)) {
    const person = await createPerson(store, at(readClock() + 7 * MINUTE), {name})
    ids[key as DemoPersonKey] = person.id
  }

  const groupIds = {} as Record<DemoGroupKey, string>
  for (const [key, g] of Object.entries(DEMO_GROUPS)) {
    const group = await createGroup(store, at(readClock() + 5 * HOUR), {
      name: g.name,
      kind: g.kind,
      currency: g.currency,
      startDate: g.startDate,
      endDate: g.endDate,
      memberIds: g.members.map(m => ids[m]),
    })
    groupIds[key as DemoGroupKey] = group.id
  }

  const expenseIds: Record<string, string> = {}
  const start = now - 12 * DAY
  const step = (12 * DAY - 2 * HOUR) / DEMO_EXPENSES.length
  for (const [i, e] of DEMO_EXPENSES.entries()) {
    const draft: ExpenseDraft = {
      title: e.title,
      groupId: e.group ? groupIds[e.group] : null,
      currency: e.currency,
      total: e.total,
      payers: Object.fromEntries(
        Object.entries(e.payers).map(([k, v]) => [ids[k as DemoPersonKey], v]),
      ),
      split: demoSplit(e, p => ids[p]),
      date: e.date,
      tz: e.group ? DEMO_GROUPS[e.group].tz : 'Asia/Kolkata',
      category: e.category,
      notes: e.notes ?? '',
    }
    const topPayer = Object.entries(e.payers).sort(([, x], [, y]) =>
      x! > y! ? -1 : 1,
    )[0]![0] as DemoPersonKey
    const by = at(start + i * step + (i % 3) * 40 * MINUTE, ids[topPayer])
    // Dinner first went in with the wrong total, and is fixed below.
    const isDinner = e.title === 'Dinner at Thalassa'
    const created = await createExpense(
      store,
      by,
      isDinner
        ? {
            ...draft,
            total: minor('1000000'),
            payers: {[ids.riya]: minor('500000'), [ids.priya]: minor('500000')},
          }
        : draft,
    )
    expenseIds[e.title] = created.id
    if (isDinner) {
      await updateExpense(
        store,
        at(now - 70 * MINUTE, ids[topPayer]),
        created.id,
        draft,
      )
    }
  }

  // Groceries deleted by mistake and put back: both show in Activity.
  await deleteExpense(store, at(now - 40 * MINUTE), expenseIds.Groceries!)
  await restoreExpense(store, at(now - 38 * MINUTE), expenseIds.Groceries!)

  /*
   * Recently deleted: records added and then deleted, so balances are
   * unchanged and the bin has one of each kind to show.
   */
  const binned = async (
    title: string,
    group: DemoGroupKey,
    total: bigint,
    payer: DemoPersonKey,
    added: number,
    deleted: number,
    category: string,
  ) => {
    const members = DEMO_GROUPS[group].members.map(m => ids[m])
    const e = await createExpense(store, at(added, ids[payer]), {
      title,
      groupId: groupIds[group],
      currency: 'INR',
      total,
      payers: {[ids[payer]]: total},
      split: {mode: 'equal', participants: [ctx.actor, ...members]},
      date: todayIn(DEMO_GROUPS[group].tz, added),
      tz: DEMO_GROUPS[group].tz,
      category,
      notes: '',
    })
    await deleteExpense(store, at(deleted, ids[payer]), e.id)
  }
  await binned(
    'Sunset cruise',
    'goa',
    minor('300000'),
    'arjun',
    now - 3 * DAY,
    now - 2 * DAY,
    'entertainment',
  )
  await binned(
    'Takeout pizza',
    'flat',
    minor('135000'),
    'me',
    now - 26 * HOUR,
    now - 20 * HOUR,
    'food',
  )
  const paid = await createRepayment(store, at(now - 2 * DAY, ids.priya), {
    groupId: null,
    currency: 'INR',
    from: ids.priya,
    to: ctx.actor,
    amount: minor('250000'),
    date: todayIn('Asia/Kolkata', now - 2 * DAY),
    tz: 'Asia/Kolkata',
    note: 'UPI',
  })
  await deleteRepayment(store, at(now - 5 * HOUR), paid.id)
  const [forgiven] = await createWriteOffs(store, at(now - 4 * DAY), [
    {
      groupId: null,
      currency: 'EUR',
      from: ids.sam,
      to: ctx.actor,
      amount: minor('900'),
      date: todayIn('Europe/Lisbon', now - 4 * DAY),
      tz: 'Europe/Lisbon',
      note: 'Coffee on me',
    },
  ])
  await deleteWriteOff(store, at(now - 3 * DAY), forgiven!.id)

  return groupIds
}

/*
 * 26.18 in the demo: two requests waiting for you (from people on Splito),
 * two of yours waiting for them (one on Splito, one invited by SMS), and
 * invite links with limits, one of them already partly used.
 */
async function seedFriendInvites(
  store: Store,
  ctx: MutationCtx,
  goaId: string,
  at: (time: number, actor?: string) => MutationCtx,
  now: number,
) {
  const account = (id: string) =>
    DEMO_DIRECTORY.accounts.find(a => a.accountId === id)!
  for (const [id, ago] of [
    ['demo-sara', 26 * HOUR],
    ['demo-ishaan', 25 * MINUTE],
  ] as const) {
    const a = account(id)
    await receiveFriendRequest(store, at(now - ago, a.accountId), {
      id: ctx.newId(),
      accountId: a.accountId,
      name: a.name,
      contact: a.contact,
    })
  }
  const kabir = account('demo-kabir')
  await sendFriendRequest(store, at(now - 2 * DAY), {
    contact: kabir.contact!,
    name: 'Kabir',
    reach: 'on-splito',
  })
  const personal = await createInviteLink(store, at(now - 5 * DAY), {
    kind: 'friend',
    groupId: null,
    maxUses: 1,
    expiresInMs: 7 * DAY,
    approveJoins: false,
  })
  await sendFriendRequest(store, at(now - 5 * DAY), {
    contact: DEMO_INVITED.contact,
    name: DEMO_INVITED.name,
    reach: 'invited',
    inviteCode: personal.id,
  })
  await createInviteLink(store, at(now - 3 * HOUR), {
    kind: 'friend',
    groupId: null,
    maxUses: 5,
    expiresInMs: 30 * DAY,
    approveJoins: false,
  })
  const goa = await createInviteLink(store, at(now - 4 * DAY), {
    kind: 'group',
    groupId: goaId,
    maxUses: 25,
    expiresInMs: 30 * DAY,
    approveJoins: true,
  })
  for (const id of ['demo-maya', 'demo-ananya', 'demo-sara'])
    await recordInviteUse(store, at(now - 3 * DAY, id), goa.id)
}
