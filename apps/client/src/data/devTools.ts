import {type SettlementRules} from '@splito/domain'
import {
  applyFriendRequestAccepted,
  type FriendRequest,
  outgoingRequests,
  createExpense,
  createGroup,
  createPerson,
  createRepayment,
  deleteExpense,
  type ExpenseDraft,
  type MutationCtx,
  type PrefKey,
  type PrefValue,
  type RepaymentInput,
  restoreExpense,
  setPref,
  type Store,
  updateGroupRules,
} from '@splito/sync'

import {IS_DEV, IS_E2E} from '#/env'

const MONEY_KEYS = new Set(['total', 'amount', 'tax', 'tip', 'service', 'discount'])
const MONEY_MAPS = new Set(['payers', 'amounts'])

/** E2E passes amounts as decimal-integer strings (minor units); convert them to bigint. */
function toBig(v: unknown, key = ''): unknown {
  if (Array.isArray(v)) return v.map(x => toBig(x))
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) =>
        MONEY_MAPS.has(k) && x && typeof x === 'object'
          ? [k, Object.fromEntries(Object.entries(x).map(([p, n]) => [p, BigInt(n as string)]))]
          : [k, toBig(x, k)],
      ),
    )
  return MONEY_KEYS.has(key) && typeof v === 'string' ? BigInt(v) : v
}

/** Dev and E2E builds only: `window.splito` seeds data through the real mutations. */
export function installDevTools(store: Store, ctx: MutationCtx) {
  if (!(IS_DEV || IS_E2E) || typeof window === 'undefined') return
  ;(window as unknown as {splito: unknown}).splito = {
    me: ctx.actor,
    createPerson: (name: string) => createPerson(store, ctx, {name}).then(e => e.id),
    createGroup: (input: Parameters<typeof createGroup>[2]) => createGroup(store, ctx, input).then(e => e.id),
    createExpense: (draft: unknown) => createExpense(store, ctx, toBig(draft) as ExpenseDraft).then(e => e.id),
    deleteExpense: (id: string) => deleteExpense(store, ctx, id),
    restoreExpense: (id: string) => restoreExpense(store, ctx, id),
    createRepayment: (input: unknown) => createRepayment(store, ctx, toBig(input) as RepaymentInput).then(e => e.id),
    updateGroupRules: (groupId: string, rules: SettlementRules) => updateGroupRules(store, ctx, groupId, rules).then(e => e.id),
    setPref: <K extends PrefKey>(key: K, value: PrefValue<K>) => setPref(store, ctx, key, value),
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
