/**
 * Writes and removes the large demo set (`@splito/sync` `generateLargeDemo`,
 * ARCHITECTURE 26.1, F-227) in dev and e2e builds: through the real
 * mutations, many per store transaction, yielding to the UI between batches.
 * Every row it writes carries `DEMO_LARGE_PREFIX` in its id, which is how
 * "Remove demo data" finds exactly them.
 */
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayments,
  createWriteOffs,
  DEMO_LARGE_PREFIX,
  type DemoCounts,
  type DemoOp,
  deleteExpense,
  deleteRepayment,
  deleteWriteOff,
  type EntityType,
  generateLargeDemo,
  localToday,
  type MutationCtx,
  type Store,
  updateExpense,
} from '@splito/sync'

const BATCH = 150
const DEMO_TYPES: EntityType[] = [
  'person',
  'group',
  'expense',
  'repayment',
  'writeoff',
]

/** True when the large demo set (or part of it) is in the store. */
export async function hasLargeDemo(store: Store): Promise<boolean> {
  return (
    (await store.getAll('group')).some(g =>
      g.id.startsWith(DEMO_LARGE_PREFIX),
    ) ||
    (await store.getAll('person')).some(p => p.id.startsWith(DEMO_LARGE_PREFIX))
  )
}

let running: Promise<unknown> | undefined

/** One add or remove at a time, whoever asks (URL, Settings, a double tap). */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = (running ?? Promise.resolve()).then(fn, fn)
  running = next.catch(() => undefined)
  return next
}

/** A store whose transactions run inside `tx`: the real mutations then batch into one commit. */
function inside(
  store: Store,
  tx: Parameters<Parameters<Store['transaction']>[0]>[0],
): Store {
  return {...store, transaction: fn => fn(tx)}
}

async function apply(store: Store, base: MutationCtx, op: DemoOp) {
  // A create that mints its id asks for it first; every other id asked for is an outbox op id.
  let pending: string | undefined =
    op.kind === 'person' || op.kind === 'group' || op.kind === 'expense'
      ? op.id
      : undefined
  const ctx: MutationCtx = {
    ...base,
    actor: op.actor,
    now: () => op.at,
    newId: () => {
      const id = pending ?? base.newId()
      pending = undefined
      return id
    },
  }
  const check = (e: {id: string}) => {
    if (e.id !== op.id) throw new Error(`demo id mismatch: ${e.id} != ${op.id}`)
  }
  switch (op.kind) {
    case 'person':
      return check(
        await createPerson(store, ctx, {name: op.name, upiId: op.upiId}),
      )
    case 'group':
      return check(await createGroup(store, ctx, op.input))
    case 'expense':
      return check(await createExpense(store, ctx, op.draft))
    case 'expense.update':
      return void (await updateExpense(store, ctx, op.id, op.draft))
    case 'expense.delete':
      return deleteExpense(store, ctx, op.id)
    case 'repayment':
      return void (await createRepayments(store, ctx, [op.input]))
    case 'writeoff':
      return void (await createWriteOffs(store, ctx, [op.input]))
    case 'repayment.delete':
      return deleteRepayment(store, ctx, op.id)
    case 'writeoff.delete':
      return deleteWriteOff(store, ctx, op.id)
  }
}

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0))

/**
 * Writes the large demo set through the real mutations, `BATCH` writes per
 * transaction, yielding between batches so the UI keeps painting. Returns
 * the counts, or null when the set is already there (adding twice is a no-op).
 */
export function addLargeDemo(
  store: Store,
  ctx: MutationCtx,
  onProgress?: (done: number) => void,
): Promise<DemoCounts | null> {
  return exclusive(async () => {
    if (await hasLargeDemo(store)) return null
    const now = Date.now()
    const {ops, counts} = generateLargeDemo({
      me: ctx.actor,
      today: localToday(now),
      now,
    })
    for (let i = 0; i < ops.length; i += BATCH) {
      await store.transaction(async tx => {
        const batched = inside(store, tx)
        for (const op of ops.slice(i, i + BATCH)) await apply(batched, ctx, op)
      })
      onProgress?.(Math.min(1, (i + BATCH) / ops.length))
      await yieldToUi()
    }
    return counts
  })
}

/** Erases every row the large demo set wrote (entities, history, outbox), nothing else. */
export function removeLargeDemo(store: Store): Promise<number> {
  return exclusive(async () => {
    const refs = (await Promise.all(DEMO_TYPES.map(type => store.getAll(type))))
      .flat()
      .filter(e => e.id.startsWith(DEMO_LARGE_PREFIX))
      .map(e => ({type: e.type, id: e.id}))
    if (refs.length) await store.erase(refs)
    return refs.length
  })
}
