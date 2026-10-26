import {
  createExpense,
  createGroup,
  createPerson,
  type Group,
  type MutationCtx,
  type Store,
} from '@splito/sync'

import {
  DEMO_EXPENSES,
  DEMO_FRIENDS,
  DEMO_GROUPS,
  type DemoGroupKey,
  type DemoPersonKey,
} from '#/data/demoData'
import {IS_DEV, IS_E2E} from '#/env'

/** True when this page load asked for demo data (`?demo=1`). */
function isDemoRequested() {
  if (typeof window === 'undefined' || !window.location) return false
  return new URLSearchParams(window.location.search).get('demo') === '1'
}

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

async function seed(store: Store, ctx: MutationCtx) {
  const groups = await store.getAll<Group>('group')
  if (groups.some(g => g.data.name === DEMO_GROUPS.goa.name)) return

  const ids = {me: ctx.actor} as Record<DemoPersonKey, string>
  for (const [key, name] of Object.entries(DEMO_FRIENDS)) {
    ids[key as DemoPersonKey] = (await createPerson(store, ctx, {name})).id
  }

  const groupIds = {} as Record<DemoGroupKey, string>
  for (const [key, g] of Object.entries(DEMO_GROUPS)) {
    const group = await createGroup(store, ctx, {
      name: g.name,
      kind: g.kind,
      currency: g.currency,
      startDate: g.startDate,
      endDate: g.endDate,
      memberIds: g.members.map(m => ids[m]),
    })
    groupIds[key as DemoGroupKey] = group.id
  }

  for (const e of DEMO_EXPENSES) {
    /*
     * Whoever paid first added the expense, so Notifications shows changes
     * from others (as sync will) next to your own.
     */
    const addedBy = ids[Object.keys(e.payers)[0] as DemoPersonKey]
    await createExpense(store, {...ctx, actor: addedBy}, {
      title: e.title,
      groupId: e.group ? groupIds[e.group] : null,
      currency: e.currency,
      total: e.total,
      payers: Object.fromEntries(
        Object.entries(e.payers).map(([k, v]) => [ids[k as DemoPersonKey], v]),
      ),
      split: {mode: 'equal', participants: e.participants.map(p => ids[p])},
      date: e.date,
      tz: e.group ? DEMO_GROUPS[e.group].tz : 'Asia/Kolkata',
      category: e.category,
      notes: '',
    })
  }
}
