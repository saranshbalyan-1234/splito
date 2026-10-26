import {
  createExpense,
  createGroup,
  createInviteLink,
  createPerson,
  deleteExpense,
  type ExpenseDraft,
  type Group,
  type MutationCtx,
  receiveFriendRequest,
  recordInviteUse,
  restoreExpense,
  sendFriendRequest,
  type Store,
  updateExpense,
} from '@splito/sync'

import {device} from '#/storage'
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
import {IS_DEV, IS_E2E} from '#/env'

/** True when this load asked for demo data: `?demo=1` on web, `EXPO_PUBLIC_DEMO=1` for native dev builds. */
function isDemoRequested() {
  if (process.env.EXPO_PUBLIC_DEMO === '1') return true
  if (typeof window === 'undefined' || !window.location?.search) return false
  return new URLSearchParams(window.location.search).get('demo') === '1'
}

/**
 * Demo mode: a dev or e2e build opened with `?demo=1` (now or earlier on this
 * install). It seeds the demo data and swaps in the demo directory; production
 * builds are never in demo mode (the env check is first).
 */
export const IS_DEMO =
  (IS_DEV || IS_E2E) && (isDemoRequested() || device.get(['demoMode']) === true)
if (IS_DEMO) device.set(['demoMode'], true)

/**
 * Dev and E2E builds only: with `?demo=1`, seeds the demo friends, groups and
 * expenses through the real mutations, once per local store. Production builds
 * never seed (the env check is first, so the URL is never read there).
 */
export function seedDemoIfRequested(store: Store, ctx: MutationCtx) {
  if (!(IS_DEV || IS_E2E) || !isDemoRequested()) return Promise.resolve()
  // One run per page load, even if the store opens twice (dev remounts).
  seeding ??= seed(store, ctx)
  return seeding
}

let seeding: Promise<void> | undefined

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
async function seed(store: Store, ctx: MutationCtx) {
  const groups = await store.getAll<Group>('group')
  if (groups.some(g => g.data.name === DEMO_GROUPS.goa.name)) return

  const now = Date.now()
  let clock = now - 14 * DAY
  /** The mutation context for a write at `time` by `actor`. */
  const at = (time: number, actor = ctx.actor): MutationCtx => {
    clock = time
    return {...ctx, actor, now: () => clock}
  }

  const ids = {me: ctx.actor} as Record<DemoPersonKey, string>
  for (const [key, name] of Object.entries(DEMO_FRIENDS)) {
    const person = await createPerson(store, at(clock + 7 * MINUTE), {name})
    ids[key as DemoPersonKey] = person.id
  }

  const groupIds = {} as Record<DemoGroupKey, string>
  for (const [key, g] of Object.entries(DEMO_GROUPS)) {
    const group = await createGroup(store, at(clock + 5 * HOUR), {
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
      notes: '',
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
            total: 1_000_000n,
            payers: {[ids.riya]: 500_000n, [ids.priya]: 500_000n},
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

  await seedFriendInvites(store, ctx, groupIds.goa, at, now)
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
