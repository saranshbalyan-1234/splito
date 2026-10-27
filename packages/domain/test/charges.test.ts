import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {
  billBreakdown,
  type BillItem,
  billShares,
  type Charge,
  type ChargeKind,
  chargesOf,
  roundOffByPerson,
  roundOffLimit,
} from '../src/charges'
import {allocate} from '../src/allocate'
import {itemBreakdown, computeShares, splitItem, type SplitInput} from '../src/split'

const sum = (xs: Iterable<bigint>) => [...xs].reduce((a, b) => a + b, 0n)
const pct = (basisPoints: number) => ({mode: 'percent' as const, basisPoints})
const fixed = (minor: bigint) => ({mode: 'amount' as const, minor})
const charge = (c: Partial<Charge> & Pick<Charge, 'id' | 'value'>): Charge => ({
  name: c.id,
  kind: 'other',
  appliesTo: {type: 'all'},
  stacksOn: 'items',
  ...c,
})

/** The owner's bill: The Supper Factory, 02/06/2007. Food 1,611.00 in 8 lines, alcohol 400.00 in 2. */
const FOOD = [20000n, 25000n, 18000n, 21000n, 19000n, 22000n, 17100n, 19000n] // = 161,100
const ALCOHOL = [25000n, 15000n] // = 40,000
const supperFactory = (): {items: BillItem[]; charges: Charge[]} => {
  // Raj had only food; Meera had food and both drinks; Dev shared everything.
  const items: BillItem[] = [
    ...FOOD.map((amount, n) => ({
      id: `f${n}`,
      taxClass: 'food',
      parts: splitItem(amount, n < 3 ? ['raj', 'dev'] : n < 6 ? ['meera', 'dev'] : ['raj', 'meera', 'dev']),
    })),
    ...ALCOHOL.map((amount, n) => ({id: `a${n}`, taxClass: 'alcohol', parts: splitItem(amount, ['meera', 'dev'])})),
  ]
  const charges: Charge[] = [
    charge({id: 'service', name: 'Service', kind: 'service', value: pct(1000)}),
    charge({id: 'vat-food', name: 'VAT 12.5%', kind: 'tax', value: pct(1250), appliesTo: {type: 'classes', classes: ['food']}, stacksOn: 'earlier'}),
    charge({id: 'vat-alc', name: 'VAT 20%', kind: 'tax', value: pct(2000), appliesTo: {type: 'classes', classes: ['alcohol']}, stacksOn: 'earlier'}),
  ]
  return {items, charges}
}

describe('the Supper Factory bill (owner sample)', () => {
  const {items, charges} = supperFactory()
  const bill = billBreakdown(items, charges)

  test('items 2,011.00; service 201.10; VAT 221.51 and 88.00; total 2,521.61', () => {
    expect(bill.itemsTotal).toBe(201100n)
    expect(bill.lines.map(l => l.amount)).toEqual([20110n, 22151n, 8800n])
    expect(bill.computedTotal).toBe(252161n)
  })

  test('round-off +0.39 reaches the printed 2,522.00; each person pays items + charges + round-off', () => {
    const roundOff = {minor: 39n}
    const shares = billShares(bill, roundOff)
    expect(sum(Object.values(shares))).toBe(252200n)
    const off = roundOffByPerson(bill, roundOff)
    expect(sum(Object.values(off))).toBe(39n)
    for (const id of ['raj', 'meera', 'dev'])
      expect(shares[id]).toBe(bill.subtotals[id]! + sum(bill.lines.map(l => l.byPerson[id] ?? 0n)) + (off[id] ?? 0n))
  })

  test('the 88.00 VAT and the 40.00 service on alcohol never reach the person who had only food', () => {
    expect(bill.lines[2]!.byPerson.raj).toBeUndefined()
    expect(sum(Object.values(bill.lines[2]!.byPerson))).toBe(8800n)
    // Raj's service is 10% of his own food (items f0..f2 with Dev, and f6, f7 with both).
    const rajFood = sum(items.filter(i => i.parts.raj !== undefined).map(i => i.parts.raj!))
    expect(bill.lines[0]!.byPerson.raj).toBeGreaterThanOrEqual(rajFood / 10n - 1n)
    expect(bill.lines[0]!.byPerson.raj).toBeLessThanOrEqual(rajFood / 10n + 1n)
  })

  test('a diner who had only food is charged nothing on alcohol', () => {
    const only = billBreakdown(
      [
        {id: 'food', taxClass: 'food', parts: {raj: 100000n}},
        {id: 'drink', taxClass: 'alcohol', parts: {meera: 40000n}},
      ],
      charges,
    )
    // Service 10% on 1,400.00 = 140.00: Raj 100.00 on his food, Meera 40.00 on her drink; the alcohol VAT is hers alone.
    expect(only.lines[0]!.byPerson).toEqual({raj: 10000n, meera: 4000n})
    expect(only.lines[2]!.byPerson).toEqual({meera: 8800n})
    // Raj: service 100.00 + 12.5% VAT on (1,000.00 + 100.00) = 137.50.
    expect(only.extras.raj).toBe(10000n + 13750n)
  })

  test('the reconciliation gap and the currency limit', () => {
    expect(roundOffLimit('INR')).toBe(100n)
    expect(roundOffLimit('JPY')).toBe(1n)
    expect(roundOffLimit('BHD')).toBe(1000n)
  })
})

describe('charges: kinds, scopes, stacking', () => {
  const two: BillItem[] = [
    {id: 'a', taxClass: 'food', parts: {x: 60000n}},
    {id: 'b', parts: {x: 20000n, y: 20000n}},
  ]

  test('a discount comes off and spreads like a charge', () => {
    const b = billBreakdown(two, [charge({id: 'd', kind: 'discount', value: pct(1000)})])
    expect(b.lines[0]!.amount).toBe(-10000n)
    expect(b.computedTotal).toBe(90000n)
    expect(sum(Object.values(billShares(b)))).toBe(90000n)
  })

  test('a fixed charge on chosen items lands only on the people who had them', () => {
    const b = billBreakdown(two, [charge({id: 'p', kind: 'packing', value: fixed(3000n), appliesTo: {type: 'items', items: ['b']}})])
    expect(b.lines[0]!.byPerson).toEqual({x: 1500n, y: 1500n})
  })

  test('stacking on earlier charges counts only the ones on the same items', () => {
    const b = billBreakdown(two, [
      charge({id: 's', kind: 'service', value: pct(1000), appliesTo: {type: 'classes', classes: ['food']}}),
      charge({id: 't', kind: 'tax', value: pct(1000), stacksOn: 'earlier'}),
    ])
    // Service 10% of 600.00 = 60.00 (food only). Tax: 10% of (1,000.00 + 60.00) = 106.00.
    expect(b.lines.map(l => l.amount)).toEqual([6000n, 10600n])
    // Not stacking: 10% of 1,000.00.
    const plain = billBreakdown(two, [
      charge({id: 's', kind: 'service', value: pct(1000), appliesTo: {type: 'classes', classes: ['food']}}),
      charge({id: 't', kind: 'tax', value: pct(1000)}),
    ])
    expect(plain.lines.map(l => l.amount)).toEqual([6000n, 10000n])
  })

  test('an inclusive tax shows its portion and adds nothing', () => {
    const b = billBreakdown(two, [charge({id: 'v', kind: 'tax', value: pct(2000), inclusive: true})])
    // 1,000.00 includes 20%: the tax portion is 1,000 * 20 / 120 = 166.67.
    expect(b.lines[0]!.amount).toBe(16667n)
    expect(b.lines[0]!.isInclusive).toBe(true)
    expect(b.computedTotal).toBe(100000n)
    expect(sum(Object.values(billShares(b)))).toBe(100000n)
  })

  test('a fixed charge with nothing in scope is refused; a percentage of nothing is zero', () => {
    const none = {type: 'classes' as const, classes: ['alcohol']}
    expect(() => billBreakdown(two, [charge({id: 'f', value: fixed(100n), appliesTo: none})])).toThrow()
    expect(billBreakdown(two, [charge({id: 'f', value: pct(500), appliesTo: none})]).lines[0]!.amount).toBe(0n)
  })

  test('round-off goes to the payer when asked, else pro rata', () => {
    const b = billBreakdown(two, [])
    expect(billShares(b, {minor: -40n, to: 'y'}).y).toBe(20000n - 40n)
    const spread = billShares(b, {minor: 100n})
    expect(sum(Object.values(spread))).toBe(100100n)
    expect(spread).toEqual({x: 80080n, y: 20020n})
  })
})

describe('Simple preset and old expenses', () => {
  const legacy: Extract<SplitInput, {mode: 'items'}> = {
    mode: 'items',
    items: [
      {id: 'i1', name: 'Pizza', amount: 120000n, participants: ['a', 'b']},
      {id: 'i2', name: 'Beer', amount: 45050n, participants: ['a', {id: 'c', weight: 2}]},
    ],
    tax: 29709n,
    tip: 1000n,
    service: 16505n,
    discount: 5000n,
    rates: {tax: 1800, service: 1000},
  }

  test('an expense with one overall tax/tip/service/discount loads unchanged', () => {
    const total = 120000n + 45050n + 29709n + 1000n + 16505n - 5000n
    const before = computeShares(total, legacy)
    expect(sum(Object.values(before))).toBe(total)
    expect(itemBreakdown(legacy).extras).toEqual(itemBreakdown({...legacy, charges: undefined}).extras)
    // Read as the Simple preset: every charge on all items, the stored money kept as typed.
    const simple = chargesOf(legacy)
    expect(simple.map(c => [c.kind, c.appliesTo.type, c.stacksOn])).toEqual([
      ['discount', 'all', 'items'],
      ['service', 'all', 'items'],
      ['tax', 'all', 'items'],
      ['other', 'all', 'items'],
    ])
    expect(simple.map(c => c.value)).toEqual([fixed(5000n), pct(1000), pct(1800), fixed(1000n)])
  })
})

/* Random bills ------------------------------------------------------------ */

const PEOPLE = ['a', 'b', 'c', 'd']
const CLASSES = ['standard', 'food', 'soft', 'alcohol']
const KINDS: ChargeKind[] = ['service', 'tax', 'packing', 'delivery', 'other', 'discount']

const arbItems = fc.array(
  fc.record({
    amount: fc.bigInt({min: 1n, max: 10n ** 7n}),
    people: fc.uniqueArray(fc.constantFrom(...PEOPLE), {minLength: 1, maxLength: 4}),
    weights: fc.array(fc.integer({min: 1, max: 3}), {minLength: 4, maxLength: 4}),
    taxClass: fc.constantFrom(...CLASSES),
  }),
  {minLength: 1, maxLength: 6},
)
type RawItem = {amount: bigint; people: string[]; weights: number[]; taxClass: string}
const mkItems = (raw: RawItem[]): BillItem[] =>
  raw.map((r, n) => ({
    id: `i${n}`,
    taxClass: r.taxClass,
    parts: splitItem(r.amount, r.people.map((id, k) => (r.weights[k]! > 1 ? {id, weight: r.weights[k]!} : id))),
  }))

const arbCharge = (ids: string[], stacks: boolean) =>
  fc
    .record({
      kind: fc.constantFrom(...KINDS),
      isPercent: fc.boolean(),
      bp: fc.integer({min: 0, max: 3000}),
      minor: fc.bigInt({min: 0n, max: 10n ** 5n}),
      scope: fc.constantFrom('all', 'classes', 'items'),
      classes: fc.uniqueArray(fc.constantFrom(...CLASSES), {minLength: 1, maxLength: 3}),
      pick: fc.uniqueArray(fc.constantFrom(...ids), {minLength: 1, maxLength: 3}),
      stacks: fc.boolean(),
      inclusive: fc.boolean(),
    })
    .map(
      (r): Charge => ({
        id: 'c',
        name: 'c',
        kind: r.kind,
        value: r.isPercent ? pct(r.kind === 'discount' ? Math.min(r.bp, 1000) : r.bp) : fixed(r.minor),
        appliesTo: r.scope === 'all' ? {type: 'all'} : r.scope === 'classes' ? {type: 'classes', classes: r.classes} : {type: 'items', items: r.pick},
        stacksOn: stacks && r.stacks ? 'earlier' : 'items',
        inclusive: r.inclusive && r.kind !== 'discount',
      }),
    )

const tryBill = (items: BillItem[], charges: Charge[]) => {
  try {
    return billBreakdown(items, charges)
  } catch {
    return undefined // a fixed charge with nothing in scope is refused
  }
}

describe('property: random bills', () => {
  const ids = ['i0', 'i1', 'i2', 'i3', 'i4', 'i5']
  const arbBill = (stacks: boolean) =>
    fc.tuple(arbItems, fc.array(arbCharge(ids, stacks), {maxLength: 5})).map(([raw, cs]) => {
      const items = mkItems(raw)
      const have = new Set(items.map(i => i.id))
      return {
        items,
        // Items scopes name only items on the bill; classes may match nothing.
        charges: cs.map((c, n) => ({
          ...c,
          id: `c${n}`,
          appliesTo: c.appliesTo.type === 'items' ? {type: 'items' as const, items: c.appliesTo.items.filter(i => have.has(i))} : c.appliesTo,
        })),
      }
    })

  test('per-person shares sum exactly to the computed total (and to the printed total with round-off)', () =>
    fc.assert(
      fc.property(arbBill(true), fc.bigInt({min: -99n, max: 99n}), ({items, charges}, off) => {
        const b = tryBill(items, charges)
        if (!b) return
        const shares = billShares(b)
        expect(sum(Object.values(shares))).toBe(b.computedTotal)
        const withOff = billShares(b, {minor: off})
        expect(sum(Object.values(withOff))).toBe(b.computedTotal + off)
        for (const l of b.lines) expect(sum(Object.values(l.byPerson))).toBe(l.amount)
      }),
    ))

  test('each charge lands only on people who had items in its scope', () =>
    fc.assert(
      fc.property(arbBill(true), ({items, charges}) => {
        const b = tryBill(items, charges)
        if (!b) return
        b.lines.forEach((line, n) => {
          const c = charges[n]!
          const inScope = items.filter(i =>
            c.appliesTo.type === 'all' ? true : c.appliesTo.type === 'classes' ? c.appliesTo.classes.includes(i.taxClass ?? 'standard') : c.appliesTo.items.includes(i.id),
          )
          const had = new Set(inScope.flatMap(i => Object.keys(i.parts)))
          for (const p of Object.keys(line.byPerson)) expect(had.has(p)).toBe(true)
        })
      }),
    ))

  test('reordering charges that do not stack never changes the result', () =>
    fc.assert(
      fc.property(arbBill(false), fc.integer({min: 1, max: 10_000}), ({items, charges}, seed) => {
        const a = tryBill(items, charges)
        const order = [...charges]
        let s = seed
        for (let i = order.length - 1; i > 0; i--) {
          s = (s * 16807) % 2147483647
          const j = s % (i + 1)
          ;[order[i], order[j]] = [order[j]!, order[i]!]
        }
        const b = tryBill(items, order)
        expect(!!a).toBe(!!b)
        if (!a || !b) return
        expect(billShares(b)).toEqual(billShares(a))
        expect(b.computedTotal).toBe(a.computedTotal)
      }),
    ))

  test('JPY, INR and BHD: the same maths at scale 0, 2 and 3 (round-off limit follows the scale)', () => {
    for (const [code, scale] of [['JPY', 0], ['INR', 2], ['BHD', 3]] as const) {
      expect(roundOffLimit(code)).toBe(10n ** BigInt(scale))
      const items: BillItem[] = [{id: 'i', taxClass: 'food', parts: allocate(12345n, [{id: 'a', weight: 2n}, {id: 'b', weight: 1n}])}]
      const b = billBreakdown(items, [charge({id: 's', kind: 'service', value: pct(1250)}), charge({id: 't', kind: 'tax', value: pct(1800), stacksOn: 'earlier'})])
      expect(sum(Object.values(billShares(b)))).toBe(b.computedTotal)
    }
  })
})

describe('items splits with charges', () => {
  const {items, charges} = supperFactory()
  const split: Extract<SplitInput, {mode: 'items'}> = {
    mode: 'items',
    items: [
      ...FOOD.map((amount, n) => ({id: `f${n}`, amount, taxClass: 'food', participants: n < 3 ? ['raj', 'dev'] : n < 6 ? ['meera', 'dev'] : ['raj', 'meera', 'dev']})),
      ...ALCOHOL.map((amount, n) => ({id: `a${n}`, amount, taxClass: 'alcohol', participants: ['meera', 'dev']})),
    ],
    tax: 0n,
    tip: 0n,
    discount: 0n,
    charges,
    roundOff: {minor: 39n},
  }

  test('computeShares prices the bill: 2,522.00 with the 0.39 round-off, same as billShares', () => {
    const shares = computeShares(252200n, split)
    expect(shares).toEqual(billShares(billBreakdown(items, charges), {minor: 39n}))
    expect(sum(Object.values(shares))).toBe(252200n)
  })

  test('a total that is not items + charges + round-off is refused', () => {
    expect(() => computeShares(252161n, split)).toThrow()
    expect(sum(Object.values(computeShares(252161n, {...split, roundOff: undefined})))).toBe(252161n)
  })

  test('itemBreakdown gives the same extras (charges + round-off) for the detail page', () => {
    const {subtotals, extras} = itemBreakdown(split)
    const shares = computeShares(252200n, split)
    for (const id of Object.keys(shares)) expect(subtotals[id]! + (extras[id] ?? 0n)).toBe(shares[id]!)
  })
})
