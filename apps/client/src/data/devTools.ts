import {balanceRows, parseMinor, type SettlementRules} from '@splito/domain'
import {
  applyFriendRequestAccepted,
  type FriendRequest,
  outgoingRequests,
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  deleteExpense,
  type EntityType,
  type ExpenseDraft,
  insideTransaction,
  loadLedger,
  type MutationCtx,
  type PrefKey,
  type PrefValue,
  type RepaymentInput,
  restoreExpense,
  setPref,
  type Store,
  updateGroupRules,
  createComment,
} from '@splito/sync'

import {IS_DEV, IS_E2E} from '#/env'
import {setPwa} from '#/lib/pwa/state'

const MONEY_KEYS = new Set(['total', 'amount', 'tax', 'tip', 'service', 'discount'])
const MONEY_MAPS = new Set(['payers', 'amounts'])

/** E2E passes amounts as decimal-integer strings (minor units); convert them to bigint. */
function toBig(v: unknown, key = ''): unknown {
  if (Array.isArray(v)) return v.map(x => toBig(x))
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) =>
        MONEY_MAPS.has(k) && x && typeof x === 'object'
          ? [k, Object.fromEntries(Object.entries(x).map(([p, n]) => [p, parseMinor(n as string)]))]
          : [k, toBig(x, k)],
      ),
    )
  return MONEY_KEYS.has(key) && typeof v === 'string' ? parseMinor(v) : v
}

/** Dev and E2E builds only: `window.splito` seeds data through the real mutations. */
export function installDevTools(store: Store, ctx: MutationCtx) {
  if (!(IS_DEV || IS_E2E) || typeof window === 'undefined') return
  ;(window as unknown as {splito: unknown}).splito = {
    me: ctx.actor,
    createPerson: (name: string) => createPerson(store, ctx, {name}).then(e => e.id),
    createGroup: (input: Parameters<typeof createGroup>[2]) => createGroup(store, ctx, input).then(e => e.id),
    createExpense: (draft: unknown) => createExpense(store, ctx, toBig(draft) as ExpenseDraft).then(e => e.id),
    /** Every row of one entity type, bigint as decimal strings (read-only, for assertions). */
    list: async (type: EntityType) => JSON.parse(JSON.stringify(await store.getAll(type), (_k, v) => (typeof v === 'bigint' ? v.toString() : v))),
    deleteExpense: (id: string) => deleteExpense(store, ctx, id),
    restoreExpense: (id: string) => restoreExpense(store, ctx, id),
    createRepayment: (input: unknown) => createRepayment(store, ctx, toBig(input) as RepaymentInput).then(e => e.id),
    updateGroupRules: (groupId: string, rules: SettlementRules) => updateGroupRules(store, ctx, groupId, rules).then(e => e.id),
    /** Plays a PWA state change (e.g. `{updateReady: true}`) that a real worker would cause. */
    setPwa,
    /** Moves an entity's queued op through the sync states, as the sync engine will (e2e of the row markers). */
    setOpState: async (entityId: string, status: 'sending' | 'acked' | 'failed', error?: string) => {
      const op = (await store.outbox()).filter(o => o.entityId === entityId).at(-1)
      if (!op) throw new Error('no op for ' + entityId)
      await store.setOpStatus(op.opId, status, {error})
    },
    setPref: <K extends PrefKey>(key: K, value: PrefValue<K>) => setPref(store, ctx, key, value),
    /** What Home did before schema v2, for the perf spec's baseline: read the whole ledger, then work every balance out of it. */
    legacyHomeMs: async () => {
      const t0 = performance.now()
      const ledger = await loadLedger(store)
      balanceRows(ledger, ctx.actor, {})
      return performance.now() - t0
    },
    /** A comment written as another person (what sync will bring in, F-2208), so e2e can see the menu of someone else's comment. */
    commentAs: (authorId: string, input: Parameters<typeof createComment>[2]) => createComment(store, {...ctx, actor: authorId}, input).then(e => e.id),
    /** How many expenses (live and deleted) the store holds: an index count. */
    countExpenses: () => store.count('expense'),
    /**
     * A big ledger for the perf spec (F-117): `friends` people, `groups` groups and
     * `expenses` expenses in four currencies, written through the real mutations in
     * batched transactions. Deterministic.
     */
    seedBulk: async ({friends, groups, expenses}: {friends: number; groups: number; expenses: number}) => {
      const t0 = Date.now()
      let n = 0
      const at = (i: number): MutationCtx => ({...ctx, now: () => 1_760_000_000_000 + i * 60_000, newId: () => `bulk-${i}-${n++}`})
      const people: string[] = []
      for (let i = 0; i < friends; i++) people.push((await createPerson(store, at(i), {name: `Bulk Friend ${i}`})).id)
      const groupIds: Array<{id: string; members: string[]}> = []
      for (let g = 0; g < groups; g++) {
        const members = people.filter((_, i) => i % groups === g || i % (groups + 3) === g)
        const created = await createGroup(store, at(friends + g), {
          name: `Bulk group ${g}`,
          kind: 'trip',
          currency: 'INR',
          memberIds: members,
          startDate: null,
          endDate: null,
        })
        groupIds.push({id: created.id, members: [ctx.actor, ...members]})
      }
      const currencies = ['INR', 'EUR', 'USD', 'GBP']
      for (let from = 0; from < expenses; from += 250) {
        await store.transaction(async tx => {
          const batched = insideTransaction(store, tx)
          for (let i = from; i < Math.min(expenses, from + 250); i++) {
            const group = i % 3 === 0 ? groupIds[i % groupIds.length] : undefined
            const pool = group ? group.members : [ctx.actor, ...people.slice(0, 12)]
            const others = [pool[1 + (i % (pool.length - 1))]!, pool[1 + ((i * 7) % (pool.length - 1))]!]
            const parties = [...new Set([ctx.actor, ...others])]
            const total = parseMinor(String(1000 + ((i * 37) % 9000)))
            const payer = parties[i % parties.length]!
            const day = (i % 28) + 1
            const month = (i % 12) + 1
            await createExpense(batched, at(friends + groups + i), {
              title: `Bulk expense ${i}`,
              groupId: group?.id ?? null,
              currency: currencies[i % 4]!,
              total,
              payers: {[payer]: total},
              split: {mode: 'equal', participants: parties},
              date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
              tz: 'Asia/Kolkata',
              category: 'food',
              notes: '',
            })
          }
        })
      }
      return Date.now() - t0
    },
    /** The other side accepts your pending request to `contactValue` (stands in for the pull). */
    acceptOutgoing: async (contactValue: string, name = 'Friend') => {
      const requests = await store.getAll<FriendRequest>('friendRequest')
      const r = outgoingRequests(requests, Date.now()).find(x => x.data.contact?.value === contactValue)
      if (!r) throw new Error('no pending request to ' + contactValue)
      const accountId = 'acc-' + contactValue.replace(/[^a-z0-9]/gi, '')
      const {person} = await applyFriendRequestAccepted(store, {...ctx, actor: accountId}, r.id, {accountId, name})
      return person.id
    },
  }
}
