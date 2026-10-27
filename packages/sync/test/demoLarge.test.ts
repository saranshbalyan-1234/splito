import {describe, expect, test} from 'bun:test'
import {balanceRows, balanceTotals, computeShares, groupNet, type LedgerRecord, personSummary, validateExpense} from '@splito/domain'

import {DEMO_LARGE_PREFIX, type DemoOp, generateLargeDemo, planRecords} from '../src/demoLarge'

const ME = 'me-0001'
const TODAY = '2026-10-27'
const NOW = Date.parse('2026-10-27T14:30:00Z')
const plan = generateLargeDemo({me: ME, today: TODAY, now: NOW})
const of = <K extends DemoOp['kind']>(kind: K) => plan.ops.filter((o): o is DemoOp & {kind: K} => o.kind === kind)
/** The plan's final ledger: live expenses plus payments and write-offs not taken back. */
const ledger: LedgerRecord[] = [
  ...planRecords(plan),
  ...[...of('repayment'), ...of('writeoff')]
    .filter(o => !plan.ops.some(d => (d.kind === 'repayment.delete' || d.kind === 'writeoff.delete') && d.id === o.id))
    .map(o => ({...o.input, kind: o.kind, id: o.id, deleted: false}) as LedgerRecord),
]

describe('large demo generator', () => {
  test('is deterministic for the same seed and day', () => {
    const again = generateLargeDemo({me: ME, today: TODAY, now: NOW})
    expect(again).toEqual(plan)
    expect(generateLargeDemo({me: ME, today: TODAY, now: NOW, seed: 7}).ops).not.toEqual(plan.ops)
  })

  test('has the promised size and mix', () => {
    const {counts} = plan
    expect(counts.people).toBe(30)
    expect(counts.groups).toBe(12)
    expect(counts.expenses).toBeGreaterThanOrEqual(1400)
    expect(counts.expenses).toBeLessThanOrEqual(1650)
    expect(counts.repayments).toBeGreaterThan(50)
    expect(counts.writeOffs).toBeGreaterThan(3)
    expect(counts.deleted).toBeGreaterThanOrEqual(18)
    expect(counts.edits).toBeGreaterThan(3)
    const expenses = of('expense')
    expect(new Set(expenses.map(e => e.draft.currency))).toEqual(new Set(['INR', 'EUR', 'USD', 'GBP', 'THB', 'JPY', 'BHD']))
    const modes = new Set(expenses.map(e => e.draft.split.mode))
    expect(modes).toEqual(new Set(['equal', 'exact', 'percent', 'shares', 'adjusted', 'items']))
    expect(expenses.some(e => Object.keys(e.draft.payers).length > 1)).toBe(true)
    expect(expenses.some(e => e.draft.split.mode === 'items' && e.draft.split.items.some(i => i.participants.some(p => typeof p !== 'string')))).toBe(true)
    expect(expenses.some(e => e.draft.groupId === null)).toBe(true)
    expect(expenses.filter(e => e.draft.title.startsWith('Rent, ')).length).toBe(12)
    expect(expenses.filter(e => e.draft.title === 'Netflix Premium').length).toBe(12)
    expect(expenses.filter(e => e.draft.notes).length).toBeGreaterThan(100)
  })

  test('every expense is valid and every balance conserves', () => {
    for (const e of [...of('expense'), ...of('expense.update')]) {
      const shares = computeShares(e.draft.total, e.draft.split)
      expect(() => validateExpense({total: e.draft.total, payers: e.draft.payers, shares})).not.toThrow()
    }
    for (const g of of('group'))
      for (const net of Object.values(groupNet(ledger, g.id))) expect(Object.values(net).reduce((s, v) => s + v, 0n)).toBe(0n)
    // Older trips were settled in full: nobody still owes anything in Goa, in either currency.
    for (const net of Object.values(groupNet(ledger, `${DEMO_LARGE_PREFIX}g-goa`)))
      expect(Object.values(net).every(v => v === 0n)).toBe(true)
  })

  test('many currencies everywhere, never mixed (ARCHITECTURE 26.13)', () => {
    const expenses = of('expense')
    const currenciesIn = (groupId: string) => new Set(expenses.filter(e => e.draft.groupId === groupId).map(e => e.draft.currency))
    for (const g of of('group')) {
      if (g.input.kind === 'trip' || g.id.endsWith('-flat') || g.id.endsWith('-office'))
        expect(currenciesIn(g.id).size, g.input.name).toBeGreaterThanOrEqual(2)
    }
    // INR is the home currency of the everyday groups: almost everything there is in rupees.
    const flat = expenses.filter(e => e.draft.groupId === `${DEMO_LARGE_PREFIX}g-flat`)
    expect(flat.filter(e => e.draft.currency === 'INR').length / flat.length).toBeGreaterThan(0.9)
    const all = new Set(expenses.map(e => e.draft.currency))
    for (const c of ['INR', 'EUR', 'USD', 'GBP', 'THB', 'JPY', 'BHD']) expect(all.has(c)).toBe(true)
    expect(new Set(of('repayment').map(r => r.input.currency)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(of('writeoff').map(r => r.input.currency)).size).toBeGreaterThanOrEqual(2)

    // Open balances, as People shows them: one line per currency, direct and groups together.
    const people = personSummary(balanceRows(ledger, ME), {includeGroups: true})
    const open = (p: (typeof people)[number]) => Object.entries(p.byCurrency).filter(([, c]) => c.total !== 0n).map(([k]) => k)
    expect(people.filter(p => open(p).length >= 2).length).toBeGreaterThanOrEqual(10)
    // Maya settled her dollars in full and still owes (or is owed) rupees.
    const maya = people.find(p => p.person === `${DEMO_LARGE_PREFIX}p-maya`)!
    expect(maya.byCurrency.USD?.total ?? 0n).toBe(0n)
    expect(maya.byCurrency.INR!.total).not.toBe(0n)
    expect(of('expense').some(e => e.draft.currency === 'USD' && `${DEMO_LARGE_PREFIX}p-maya` in e.draft.payers)).toBe(true)

    // Totals are per currency: each currency's total is exactly that currency's rows, nothing from another.
    const totals = balanceTotals(people)
    expect(new Set(totals.map(t => t.currency)).size).toBe(totals.length)
    for (const t of totals) {
      const net = people.reduce((s, p) => s + (p.byCurrency[t.currency]?.total ?? 0n), 0n)
      expect(t.net).toBe(net)
    }
    expect(totals.length).toBeGreaterThanOrEqual(4)
  })

  test('ids are tagged, unique per entity, writes are in time order and never in the future', () => {
    const creates = plan.ops.filter(o => ['person', 'group', 'expense', 'repayment', 'writeoff'].includes(o.kind))
    expect(new Set(creates.map(o => o.id)).size).toBe(creates.length)
    expect(creates.every(o => o.id.startsWith(DEMO_LARGE_PREFIX))).toBe(true)
    for (let i = 1; i < plan.ops.length; i++) expect(plan.ops[i]!.at).toBeGreaterThanOrEqual(plan.ops[i - 1]!.at)
    expect(plan.ops.every(o => o.at <= NOW)).toBe(true)
    expect(of('expense').every(e => e.draft.date <= TODAY)).toBe(true)
    // Deletes land inside the 30-day bin window.
    expect(plan.ops.filter(o => o.kind.endsWith('.delete')).every(o => o.at > NOW - 30 * 86_400_000)).toBe(true)
  })
})

