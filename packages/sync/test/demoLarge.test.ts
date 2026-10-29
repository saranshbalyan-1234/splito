import {describe, expect, test} from 'bun:test'
import {balanceRows, balanceTotals, computeShares, groupNet, type LedgerRecord, personSummary, validateExpense} from '@splito/domain'

import {DEMO_LARGE_PREFIX, type DemoOp, generateLargeDemo, planLedger} from '../src/demoLarge'

const ME = 'me-0001'
const TODAY = '2026-10-27'
const NOW = Date.parse('2026-10-27T14:30:00Z')
const plan = generateLargeDemo({me: ME, today: TODAY, now: NOW})
const of = <K extends DemoOp['kind']>(kind: K) => plan.ops.filter((o): o is DemoOp & {kind: K} => o.kind === kind)
const ledger: LedgerRecord[] = planLedger(plan)

describe('large demo generator', () => {
  test('is deterministic for the same seed and day', () => {
    const again = generateLargeDemo({me: ME, today: TODAY, now: NOW})
    expect(again).toEqual(plan)
    expect(generateLargeDemo({me: ME, today: TODAY, now: NOW, seed: 7}).ops).not.toEqual(plan.ops)
  })

  test('has the promised size and mix', () => {
    const {counts} = plan
    expect(counts.people).toBe(44)
    expect(counts.groups).toBe(21)
    expect(counts.expenses).toBeGreaterThanOrEqual(1400)
    expect(counts.expenses).toBeLessThanOrEqual(1650)
    expect(counts.repayments).toBeGreaterThan(50)
    expect(counts.writeOffs).toBeGreaterThan(3)
    expect(counts.deleted).toBeGreaterThanOrEqual(18)
    expect(counts.edits).toBeGreaterThan(3)
    const expenses = of('expense')
    expect(new Set(expenses.map(e => e.draft.currency))).toEqual(new Set(['INR', 'EUR', 'USD', 'GBP', 'THB', 'JPY', 'BHD', 'KWD']))
    const modes = new Set(expenses.map(e => e.draft.split.mode))
    expect(modes).toEqual(new Set(['equal', 'exact', 'percent', 'shares', 'adjusted', 'items']))
    expect(expenses.some(e => Object.keys(e.draft.payers).length > 1)).toBe(true)
    expect(expenses.some(e => e.draft.split.mode === 'items' && e.draft.split.items.some(i => i.participants.some(p => typeof p !== 'string')))).toBe(true)
    expect(expenses.some(e => e.draft.groupId === null)).toBe(true)
    expect(expenses.filter(e => e.draft.title.startsWith('Rent, ') && e.draft.groupId === `${DEMO_LARGE_PREFIX}g-flat`).length).toBe(12)
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
    for (const g of of('group').filter(g => !g.id.includes('-story-'))) {
      if (g.input.kind === 'trip' || g.id.endsWith('-flat') || g.id.endsWith('-office'))
        expect(currenciesIn(g.id).size, g.input.name).toBeGreaterThanOrEqual(2)
    }
    // INR is the home currency of the everyday groups: almost everything there is in rupees.
    const flat = expenses.filter(e => e.draft.groupId === `${DEMO_LARGE_PREFIX}g-flat`)
    expect(flat.filter(e => e.draft.currency === 'INR').length / flat.length).toBeGreaterThan(0.9)
    const all = new Set(expenses.map(e => e.draft.currency))
    for (const c of ['INR', 'EUR', 'USD', 'GBP', 'THB', 'JPY', 'BHD', 'KWD']) expect(all.has(c)).toBe(true)
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
    expect(plan.ops.filter(o => !creates.includes(o)).every(o => 'id' in o && o.id.startsWith(DEMO_LARGE_PREFIX))).toBe(true)
    for (let i = 1; i < plan.ops.length; i++) expect(plan.ops[i]!.at).toBeGreaterThanOrEqual(plan.ops[i - 1]!.at)
    expect(plan.ops.every(o => o.at <= NOW)).toBe(true)
    expect(of('expense').every(e => e.draft.date <= TODAY)).toBe(true)
    // Deletes land inside the 30-day bin window.
    expect(plan.ops.filter(o => o.kind.endsWith('.delete')).every(o => o.at > NOW - 30 * 86_400_000)).toBe(true)
  })

  test('the curated story keeps its fixed numbers, apart from the generated year (the e2e specs lean on it)', () => {
    const story = (id: string) => id.includes('-story-')
    const groups = of('group').filter(g => story(g.id))
    expect(groups.map(g => g.input.name)).toEqual(['Goa trip', 'Flat 4B', 'Lisbon'])
    const people = personSummary(balanceRows(ledger, ME), {includeGroups: true})
    const owed = (key: string, currency: string) => people.find(p => p.person === `${DEMO_LARGE_PREFIX}p-${key}`)?.byCurrency[currency]?.total
    // The six friends share no group with the generated cast: their numbers are the story's alone.
    expect(owed('riya', 'INR')).toBeDefined()
    expect(owed('arjun', 'INR')).toBeDefined()
    expect(owed('sam', 'EUR')).toBeDefined()
    const live = ledger.filter(r => r.kind === 'expense' && r.groupId !== null && story(r.groupId))
    expect(live.length).toBe(21)
    // The mistaken-then-restored groceries are live, the cruise and the pizza are in the bin, the dinner shows its fix.
    expect(ledger.some(r => r.kind === 'expense' && r.id === of('expense').find(e => e.draft.title === 'Groceries' && story(e.draft.groupId ?? ''))!.id)).toBe(true)
    expect(of('expense.restore').length).toBe(1)
    expect(of('expense').find(e => e.draft.title === 'Sunset cruise')).toBeDefined()
    expect(ledger.some(r => r.kind === 'expense' && r.id === of('expense').find(e => e.draft.title === 'Sunset cruise')!.id)).toBe(false)
    expect(of('expense.update').some(e => e.draft.title === 'Dinner at Thalassa' && e.draft.total === 1_250_000n)).toBe(true)
    // Nothing of the story is settled by the generated payments.
    expect(of('repayment').filter(r => story(r.input.groupId ?? '')).length).toBe(0)
  })

  test('the Wave B story (owner decision 109) is in the plan and its ledger stays exact', () => {
    const kinds = new Set(plan.ops.map(o => o.kind))
    for (const k of ['person.delete', 'person.remove', 'group.inactive', 'group.hide', 'group.delete', 'member.exit', 'item.hide', 'comment', 'comment.edit', 'comment.delete', 'reminder.self', 'reminder.nudge', 'merchant.setup'] as const)
      expect(kinds.has(k), k).toBe(true)
    // The Supper Factory: printed total 2,522.00, charges worked out, round-off +0.39.
    const supper = of('expense').find(e => e.draft.title === 'The Supper Factory')!
    expect(supper.draft.total).toBe(252_200n)
    expect(supper.draft.split.mode === 'items' && supper.draft.split.roundOff?.minor).toBe(39n)
    // Paris and its friend are squared up in both currencies; the deleted gym group is out of the ledger.
    for (const net of Object.values(groupNet(ledger, `${DEMO_LARGE_PREFIX}g-b-paris`))) expect(Object.values(net).every(v => v === 0n)).toBe(true)
    expect(ledger.some(r => r.groupId === `${DEMO_LARGE_PREFIX}g-b-gym`)).toBe(false)
  })
})
