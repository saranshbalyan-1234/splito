import {describe, expect, test} from 'bun:test'
import {computeShares, itemBreakdown} from '@splito/domain'
import {DEFAULT_CHARGE_PRESETS, type Expense} from '@splito/sync'

import {emptyForm, evaluateForm, type ExpenseForm, formFromExpense} from '../form'
import {
  bpText,
  chargesFromSimple,
  chargesFromTemplates,
  templatesFromCharges,
} from './chargeForm'

let n = 0
const key = () => `c${n++}`

/** The owner's bill (The Supper Factory): food 1,611.00 in 8 lines, alcohol 400.00 in 2. */
const FOOD = ['200', '250', '180', '210', '190', '220', '171', '190']
const bill = (over: Partial<ExpenseForm> = {}): ExpenseForm => ({
  ...emptyForm({
    me: 'me',
    currency: 'INR',
    date: '2007-06-02',
    people: ['me', 'raj', 'meera'],
    groupId: null,
    mode: 'items',
  }),
  title: 'The Supper Factory',
  amount: '2522',
  items: [
    ...FOOD.map((amount, i) => ({
      key: `f${i}`,
      name: `Dish ${i + 1}`,
      amount,
      // Raj has only food; Meera has food and the drinks; I share everything.
      people: i < 3 ? ['me', 'raj'] : ['me', 'meera'],
      taxClass: 'food',
    })),
    {key: 'a0', name: 'Whisky', amount: '250', people: ['me', 'meera'], taxClass: 'alcohol'},
    {key: 'a1', name: 'Beer', amount: '150', people: ['me', 'meera'], taxClass: 'alcohol'},
  ],
  charges: chargesFromTemplates(
    [
      {name: 'Service', kind: 'service', mode: 'percent', basisPoints: 1000, stacksOn: 'items'},
      {name: 'VAT 12.5%', kind: 'tax', mode: 'percent', basisPoints: 1250, classes: ['food'], stacksOn: 'earlier'},
      {name: 'VAT 20%', kind: 'tax', mode: 'percent', basisPoints: 2000, classes: ['alcohol'], stacksOn: 'earlier'},
    ],
    key,
  ),
  ...over,
})

describe('the owner bill through the form (F-403 acc 1, 4)', () => {
  test('201.10 / 221.51 / 88.00, total 2,521.61; the printed 2,522.00 is a 0.39 gap that Save will not hide', () => {
    const r = evaluateForm(bill(), 'Asia/Kolkata')
    expect(r.bill?.lines.map(l => l.amount)).toEqual([20110n, 22151n, 8800n])
    expect(r.itemsTotal).toBe(252161n)
    expect(r.gap).toBe(39n)
    expect(r.canRoundOff).toBe(true)
    expect(r.error).toBe('BILL_GAP')
    expect(r.draft).toBeUndefined()
  })

  test('add the gap as round-off: a valid draft whose shares add up to 2,522.00', () => {
    const r = evaluateForm(bill({roundOff: 'shares'}), 'Asia/Kolkata')
    expect(r.error).toBeUndefined()
    expect(r.roundOff).toEqual({minor: 39n})
    const split = r.draft!.split
    expect(split.mode === 'items' && split.roundOff).toEqual({minor: 39n})
    expect(Object.values(r.shares!).reduce((a, b) => a + b, 0n)).toBe(252200n)
    expect(r.shares).toEqual(computeShares(252200n, split))
  })

  test('a gap beyond the round-off limit is not offered as round-off', () => {
    const r = evaluateForm(bill({amount: '2600', roundOff: 'shares'}), 'UTC')
    expect(r.gap).toBe(7839n)
    expect(r.canRoundOff).toBe(false)
    expect(r.error).toBe('BILL_GAP')
  })

  test('round-off to the payer lands on the payer alone', () => {
    const r = evaluateForm(bill({roundOff: 'payer', payer: 'raj'}), 'UTC')
    expect(r.draft?.split.mode === 'items' && r.draft.split.roundOff).toEqual({minor: 39n, to: 'raj'})
  })

  test('no printed total yet: the bill takes the computed total as its own (F-275)', () => {
    const r = evaluateForm(bill({amount: ''}), 'UTC')
    expect(r.itemsTotal).toBe(252161n)
    expect(r.isTotalFromItems).toBe(true)
    expect(r.total).toBe(252161n)
    expect(r.gap).toBe(0n)
    expect(r.error).toBeUndefined()
  })

  test('a bad rate is reported against its charge and an unknown scope item is dropped', () => {
    const f = bill()
    f.charges![0]!.value = '12.345'
    const r = evaluateForm(f, 'UTC')
    expect(r.rowErrors[`charge:${f.charges![0]!.key}`]).toBe('INVALID_PERCENT')
    expect(r.error).toBe('INVALID_PERCENT')
  })

  test('a fixed charge on items that are not on the bill is an error on that row', () => {
    const f = bill()
    f.charges!.push({
      key: 'pk',
      name: 'Packing',
      kind: 'packing',
      mode: 'amount',
      value: '20',
      scope: {type: 'classes', classes: ['soft']},
      stacksOn: 'items',
      inclusive: false,
    })
    const r = evaluateForm(f, 'UTC')
    expect(r.rowErrors['charge:pk']).toBe('CHARGE_NO_ITEMS')
    expect(r.error).toBe('CHARGE_NO_ITEMS')
  })

  test('the saved expense opens in the editor as it was (acc 3 round trip)', () => {
    const r = evaluateForm(bill({roundOff: 'shares'}), 'Asia/Kolkata')
    const draft = r.draft!
    const e = {
      id: 'e1',
      ...draft,
      shares: r.shares!,
    } as unknown as Expense
    const back = formFromExpense(e, 'me')
    expect(back.charges?.map(c => [c.name, c.value, c.kind, c.scope.type, c.stacksOn])).toEqual([
      ['Service', '10', 'service', 'all', 'items'],
      ['VAT 12.5%', '12.5', 'tax', 'classes', 'earlier'],
      ['VAT 20%', '20', 'tax', 'classes', 'earlier'],
    ])
    expect(back.roundOff).toBe('shares')
    expect(back.items[8]!.taxClass).toBe('alcohol')
    expect(evaluateForm(back, 'Asia/Kolkata').draft?.split).toEqual(draft.split)
  })
})

describe('Simple stays the default and old expenses load unchanged (acc 7)', () => {
  test('a form without charges still takes the four plain rows', () => {
    const f = bill({charges: undefined, amount: '1280', tax: '18', service: '10'})
    f.adjustModes = {tax: 'percent', service: 'percent'}
    f.items = [{key: 'i', name: 'Pizza', amount: '1000', people: ['me', 'raj']}]
    const r = evaluateForm(f, 'UTC')
    expect(r.error).toBeUndefined()
    expect(r.draft?.split.mode === 'items' && r.draft.split.charges).toBeUndefined()
    expect(r.draft?.split.mode === 'items' && r.draft.split.tax).toBe(100000n * 18n / 100n)
  })

  test('an old expense opens in Simple, with no charge list, and re-saves the same split', () => {
    const old = {
      id: 'e0',
      title: 'Old',
      groupId: null,
      currency: 'INR',
      total: 122752n,
      payers: {me: 122752n},
      split: {
        mode: 'items' as const,
        items: [{id: 'i1', name: 'Pizza', amount: 100000n, participants: ['me', 'raj']}],
        tax: 17262n,
        tip: 0n,
        service: 9590n,
        discount: 4100n,
        rates: {tax: 1800, service: 1000},
      },
      shares: computeShares(122752n, {
        mode: 'items',
        items: [{id: 'i1', amount: 100000n, participants: ['me', 'raj']}],
        tax: 17262n,
        tip: 0n,
        service: 9590n,
        discount: 4100n,
      }),
      date: '2026-10-26',
      tz: 'UTC',
      category: 'food',
      notes: '',
    } as unknown as Expense
    const form = formFromExpense(old, 'me')
    expect(form.charges).toBeUndefined()
    const again = evaluateForm(form, 'UTC')
    expect(again.draft?.split).toEqual(old.split)
    expect(itemBreakdown(old.split as never).extras).toEqual(itemBreakdown(again.draft!.split as never).extras)
  })
})

describe('presets and merchant setups', () => {
  test('percent text keeps the decimal mark', () => {
    expect(bpText(1250)).toBe('12.5')
    expect(bpText(1250, ',')).toBe('12,5')
    expect(bpText(500)).toBe('5')
    expect(bpText(825)).toBe('8.25')
  })

  test('a preset becomes rows and a setup comes back out of rows (items-scoped charges stay with the bill)', () => {
    const india = DEFAULT_CHARGE_PRESETS.find(p => p.id === 'restaurant-india')!
    const rows = chargesFromTemplates(india.charges, key)
    expect(rows.map(r => [r.name, r.value, r.scope.type, r.stacksOn])).toEqual([
      ['Service charge', '10', 'all', 'items'],
      ['GST', '5', 'classes', 'earlier'],
      ['Liquor VAT', '20', 'classes', 'earlier'],
    ])
    expect(templatesFromCharges(rows)).toEqual(india.charges)
    rows.push({...rows[0]!, key: 'x', name: 'Cake', scope: {type: 'items', items: ['i']}})
    expect(templatesFromCharges(rows)).toEqual(india.charges)
  })

  test('a fixed packing amount is kept as an empty row to fill in', () => {
    const rows = chargesFromTemplates([{name: 'Packing', kind: 'packing', mode: 'amount', stacksOn: 'items'}], key)
    expect(rows[0]!.value).toBe('')
    expect(templatesFromCharges(rows)).toEqual([{name: 'Packing', kind: 'packing', mode: 'amount', stacksOn: 'items'}])
  })

  test('every shipped preset prices a bill without error', () => {
    for (const p of DEFAULT_CHARGE_PRESETS.filter(x => x.charges.length > 0)) {
      const f = bill({amount: '', charges: chargesFromTemplates(p.charges, key)})
      expect(evaluateForm(f, 'UTC').bill).toBeDefined()
    }
  })
})

describe('Simple to Custom keeps what was typed', () => {
  const simple = (): ExpenseForm => {
    const f = bill({charges: undefined, amount: '1330', tax: '18', service: '10', tip: '50', discount: ''})
    f.adjustModes = {tax: 'percent', service: 'percent'}
    f.items = [{key: 'i', name: 'Pizza', amount: '1000', people: ['me', 'raj']}]
    return f
  }

  test('percent rows keep their rate, an amount row its money, empty rows are left out', () => {
    const rows = chargesFromSimple(simple(), {mark: '.', shorthand: true})
    expect(rows.map(r => [r.kind, r.mode, r.value])).toEqual([
      ['service', 'percent', '10'],
      ['tax', 'percent', '18'],
      ['other', 'amount', '50.00'],
    ])
  })

  test('the seeded list prices the bill exactly as the Simple rows did', () => {
    const f = simple()
    const before = evaluateForm(f, 'UTC')
    const after = evaluateForm({...f, charges: chargesFromSimple(f, {mark: '.', shorthand: true})}, 'UTC')
    expect(before.error).toBeUndefined()
    expect(after.error).toBeUndefined()
    expect(after.bill?.computedTotal).toBe(before.itemsTotal)
    expect(computeShares(after.draft!.total, after.draft!.split)).toEqual(computeShares(before.draft!.total, before.draft!.split))
  })

  test('nothing typed seeds an empty list', () => {
    expect(chargesFromSimple(bill({charges: undefined, tax: '', tip: '', service: '', discount: ''}), {mark: '.', shorthand: true})).toEqual([])
  })
})
