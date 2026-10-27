import {expect} from 'bun:test'
import {groupNet, type LedgerRecord, pairwiseBalances} from '@splito/domain'

import type {Expense, Repayment} from '../src/mutations'
import {toExpenseRecord, toRepaymentRecord, toWriteOffRecord} from '../src/selectors'
import type {Store} from '../src/store'
import type {Entity} from '../src/types'

const DIRECT = '__direct__'

/** The whole ledger from the entity rows (tombstones flagged), exactly as the store holds it. */
export async function ledgerOf(s: Store): Promise<LedgerRecord[]> {
  const { entities } = await s.dump()
  return entities.flatMap((e): LedgerRecord[] =>
    e.type === 'expense'
      ? [toExpenseRecord(e as Entity<Expense>)]
      : e.type === 'repayment'
        ? [toRepaymentRecord(e as Entity<Repayment>)]
        : e.type === 'writeoff'
          ? [toWriteOffRecord(e as Entity<Repayment>)]
          : [],
  )
}

/**
 * The reference the property test checks the projections against: balances
 * recomputed from the ledger with the domain's own `groupNet` and
 * `pairwiseBalances` (not the code that maintains the tables), compared with
 * what `balances` and `pair_balances` hold.
 */
export async function expectProjectionsMatchLedger(s: Store) {
  const records = await ledgerOf(s)
  const keyed = records.map(r => ({...r, groupId: r.groupId ?? DIRECT}))
  const groups = [...new Set(keyed.filter(r => !r.deleted).map(r => r.groupId))].sort()

  const expectedNets: Record<string, bigint> = {}
  for (const groupId of groups)
    for (const [currency, net] of Object.entries(groupNet(keyed, groupId)))
      for (const [person, amount] of Object.entries(net)) expectedNets[JSON.stringify([person, groupId === DIRECT ? '' : groupId, currency])] = amount
  const storedNets: Record<string, bigint> = {}
  for (const b of await s.balances()) storedNets[JSON.stringify([b.personId, b.groupId ?? '', b.currency])] = b.amount
  expect(storedNets).toEqual(expectedNets)

  const people = [...new Set(records.flatMap(r => (r.kind === 'expense' ? [...Object.keys(r.payers), ...Object.keys(r.shares)] : [r.from, r.to])))]
  const direct = records.filter(r => r.groupId === null)
  for (const me of people) {
    const expected = pairwiseBalances(direct, me).map(r => [r.person, r.currency, r.amount] as const)
    const stored = (await s.pairBalances(me)).map(r => [r.otherId, r.currency, r.amount] as const)
    const sort = (rows: ReadonlyArray<readonly [string, string, bigint]>) => [...rows].sort((x, y) => (x[0] + x[1] < y[0] + y[1] ? -1 : 1))
    expect(sort(stored)).toEqual(sort(expected))
  }
}
