import {describe, expect, test} from 'bun:test'
import {computeShares} from '@splito/domain'
import {type Expense} from '@splito/sync'

import {
  emptyForm,
  evaluateForm,
  type ExpenseForm,
  formFromExpense,
  formPayers,
  knownCurrency,
  pruneDraft,
  pruneForm,
  withPeople,
} from './form'
import {suggestCategory} from './suggestCategory'

const base = (over: Partial<ExpenseForm> = {}): ExpenseForm => ({
  ...emptyForm({
    me: 'me',
    currency: 'INR',
    date: '2026-10-26',
    people: ['me', 'riya', 'sam'],
    groupId: null,
    mode: 'equal',
  }),
  title: 'Dinner',
  amount: '300',
  ...over,
})

describe('evaluateForm', () => {
  test('equal split, single payer: a valid draft', () => {
    const r = evaluateForm(base(), 'Asia/Kolkata')
    expect(r.error).toBeUndefined()
    expect(r.shares).toEqual({me: 10000n, riya: 10000n, sam: 10000n})
    expect(r.draft?.payers).toEqual({me: 30000n})
    expect(r.draft?.total).toBe(30000n)
  })
  test('title and amount are required', () => {
    expect(evaluateForm(base({title: '  '}), 'UTC').error).toBe(
      'TITLE_REQUIRED',
    )
    expect(evaluateForm(base({amount: ''}), 'UTC').error).toBe(
      'AMOUNT_REQUIRED',
    )
    expect(evaluateForm(base({amount: '0'}), 'UTC').error).toBe(
      'AMOUNT_NOT_POSITIVE',
    )
  })
  test('a comma decimal mark (de-DE) reads 12,50 as 12.50, not 1250', () =>
    expect(evaluateForm(base({amount: '12,50'}), 'UTC', ',').total).toBe(1250n))
  test('negative payer, exact and item rows are refused', () => {
    const paid = evaluateForm(
      base({payerMode: 'multiple', paid: {me: '400', riya: '-100'}}),
      'UTC',
    )
    expect(paid.rowErrors['paid:riya']).toBe('NEGATIVE_AMOUNT')
    expect(paid.draft).toBeUndefined()
    const exact = evaluateForm(
      base({mode: 'exact', exact: {me: '0-50', riya: '350'}}),
      'UTC',
    )
    expect(exact.rowErrors.me).toBe('NEGATIVE_AMOUNT')
    expect(exact.draft).toBeUndefined()
  })
  test('an adjustment that pushes a share below zero is refused', () => {
    const r = evaluateForm(
      base({mode: 'adjusted', adjust: {me: '-400'}, people: ['me', 'riya']}),
      'UTC',
    )
    expect(r.error).toBe('SIGN_MISMATCH')
    expect(r.draft).toBeUndefined()
    expect(
      evaluateForm(base({mode: 'adjusted', adjust: {me: '-50'}}), 'UTC').draft,
    ).toBeDefined()
  })
  test('calculator amount', () =>
    expect(evaluateForm(base({amount: '250+50'}), 'UTC').total).toBe(30000n))
  test('excluded people leave the equal split', () =>
    expect(evaluateForm(base({excluded: ['sam']}), 'UTC').shares).toEqual({
      me: 15000n,
      riya: 15000n,
    }))
  test('exact: remaining readout until it adds up', () => {
    const r = evaluateForm(
      base({mode: 'exact', exact: {me: '100', riya: '50'}}),
      'UTC',
    )
    expect(r.remaining).toEqual({kind: 'money', value: 15000n})
    expect(r.error).toBe('TOTAL_MISMATCH')
    const ok = evaluateForm(
      base({mode: 'exact', exact: {me: '100', riya: '50', sam: '150'}}),
      'UTC',
    )
    expect(ok.error).toBeUndefined()
  })
  test('percent: remaining in percent', () => {
    const r = evaluateForm(
      base({mode: 'percent', percent: {me: '50', riya: '25'}}),
      'UTC',
    )
    expect(r.remaining).toEqual({kind: 'percent', value: 2500})
    expect(
      evaluateForm(
        base({mode: 'percent', percent: {me: '50', riya: '25', sam: '25'}}),
        'UTC',
      ).shares,
    ).toEqual({me: 15000n, riya: 7500n, sam: 7500n})
  })
  test('shares default to 1 each, 0 leaves someone out', () =>
    expect(
      evaluateForm(base({mode: 'shares', shares: {me: 2, sam: 0}}), 'UTC')
        .shares,
    ).toEqual({me: 20000n, riya: 10000n}))
  test('equal with adjustments', () =>
    expect(
      evaluateForm(base({mode: 'adjusted', adjust: {sam: '60'}}), 'UTC').shares,
    ).toEqual({me: 8000n, riya: 8000n, sam: 14000n}))
  test('items with tax', () => {
    const items = [
      {key: 'a', name: 'Pizza', amount: '200', people: ['me', 'riya']},
      {key: 'b', name: 'Juice', amount: '70', people: ['sam']},
    ]
    const r = evaluateForm(base({mode: 'items', items, tax: '30'}), 'UTC')
    expect(r.error).toBeUndefined()
    expect(r.itemsTotal).toBe(30000n)
    const short = evaluateForm(base({mode: 'items', items}), 'UTC')
    expect(short.remaining).toEqual({kind: 'money', value: 3000n})
  })
  test('item portions: 2 of 3 beers, and they survive a round trip', () => {
    const items = [
      {
        key: 'a',
        name: 'Beers',
        amount: '300',
        people: ['me', 'riya'],
        portions: {riya: 2},
      },
    ]
    const r = evaluateForm(base({mode: 'items', items}), 'UTC')
    expect(r.error).toBeUndefined()
    expect(r.shares).toEqual({me: 10000n, riya: 20000n})
    expect(r.itemParts).toEqual({a: {me: 10000n, riya: 20000n}})
    const split = r.draft!.split
    expect(split.mode === 'items' && split.items[0]!.participants).toEqual([
      'me',
      {id: 'riya', weight: 2},
    ])
    const back = formFromExpense(
      {...r.draft!, shares: r.shares!} as unknown as Expense,
      'me',
    )
    expect(back.items[0]!.people).toEqual(['me', 'riya'])
    expect(back.items[0]!.portions).toEqual({riya: 2})
  })
  test('service charge joins tax and tip, and survives a round trip', () => {
    const items = [
      {key: 'a', name: 'Pizza', amount: '200', people: ['me', 'riya']},
      {key: 'b', name: 'Juice', amount: '100', people: ['sam']},
    ]
    const r = evaluateForm(
      base({mode: 'items', items, amount: '330', service: '30'}),
      'UTC',
    )
    expect(r.error).toBeUndefined()
    expect(r.itemsTotal).toBe(33000n)
    expect(r.shares).toEqual({me: 11000n, riya: 11000n, sam: 11000n})
    const split = r.draft!.split
    expect(split.mode === 'items' && split.service).toBe(3000n)
    const back = formFromExpense(
      {...r.draft!, shares: r.shares!} as unknown as Expense,
      'me',
    )
    expect(back.service).toBe('30.00')
  })
  test('charges as percentages: discount first, then tax on the rest; rates survive a round trip', () => {
    const items = [
      {key: 'a', name: 'Thali', amount: '600', people: ['me', 'riya']},
      {key: 'b', name: 'Biryani', amount: '400', people: ['sam']},
    ]
    // 1,000.00 of items; 15% off = 150.00; 18% GST on 850.00 = 153.00; total 1,003.00.
    const r = evaluateForm(
      base({
        mode: 'items',
        items,
        amount: '1003',
        discount: '15',
        tax: '18',
        adjustModes: {discount: 'percent', tax: 'percent'},
      }),
      'UTC',
    )
    expect(r.error).toBeUndefined()
    expect(r.itemsTotal).toBe(100300n)
    expect(r.adjustments).toEqual({
      discount: 15000n,
      tax: 15300n,
      tip: 0n,
      service: 0n,
    })
    const split = r.draft!.split
    expect(split.mode === 'items' && [split.tax, split.discount]).toEqual([
      15300n,
      15000n,
    ])
    expect(split.mode === 'items' && split.rates).toEqual({
      discount: 1500,
      tax: 1800,
    })
    const back = formFromExpense(
      {...r.draft!, shares: r.shares!} as unknown as Expense,
      'me',
    )
    expect([back.tax, back.discount]).toEqual(['18', '15'])
    expect(back.adjustModes).toEqual({
      tax: 'percent',
      tip: 'amount',
      service: 'amount',
      discount: 'percent',
    })
  })
  test('a percentage with three decimals is refused on its own field', () => {
    const items = [{key: 'a', name: 'Tea', amount: '100', people: ['me']}]
    const r = evaluateForm(
      base({
        mode: 'items',
        items,
        amount: '100',
        tip: '12.555',
        adjustModes: {tip: 'percent'},
      }),
      'UTC',
    )
    expect(r.rowErrors.tip).toBe('INVALID_PERCENT')
    expect(r.draft).toBeUndefined()
  })
  test('multiple payers must add up', () => {
    const r = evaluateForm(
      base({payerMode: 'multiple', paid: {me: '100', riya: '100'}}),
      'UTC',
    )
    expect(r.payersRemaining).toBe(10000n)
    expect(r.error).toBe('PAYERS_MISMATCH')
    expect(
      evaluateForm(
        base({payerMode: 'multiple', paid: {me: '100', riya: '200'}}),
        'UTC',
      ).draft?.payers,
    ).toEqual({me: 10000n, riya: 20000n})
  })
  test('bad row amounts are reported per person', () => {
    const r = evaluateForm(base({mode: 'exact', exact: {me: '1.2345'}}), 'UTC')
    expect(r.rowErrors.me).toBe('TOO_MANY_DECIMALS')
    // Rows read the locale's mark as decimals (F-111 M3): three are too many in INR.
    const r2 = evaluateForm(base({mode: 'exact', exact: {me: '1.234'}}), 'UTC')
    expect(r2.rowErrors.me).toBe('TOO_MANY_DECIMALS')
  })
})

describe('formFromExpense', () => {
  test('round-trips an equal split with someone who only paid', () => {
    const e: Expense = {
      title: 'Cab',
      groupId: null,
      currency: 'INR',
      total: 30000n,
      payers: {riya: 30000n},
      split: {mode: 'equal', participants: ['me', 'sam']},
      shares: {me: 15000n, sam: 15000n},
      date: '2026-01-02',
      tz: 'Asia/Kolkata',
      category: 'transport',
      notes: '',
    }
    const f = formFromExpense(e, 'me')
    expect(f.amount).toBe('300.00')
    expect(f.people).toEqual(['me', 'riya', 'sam'])
    expect(f.excluded).toEqual(['riya'])
    expect(f.payer).toBe('riya')
    const r = evaluateForm(f, 'Asia/Kolkata')
    expect(r.draft?.split).toEqual(e.split)
    expect(r.shares).toEqual(e.shares)
  })
})

describe('suggestCategory', () => {
  const ids = [
    'food',
    'transport',
    'stay',
    'shopping',
    'entertainment',
    'bills',
    'groceries',
    'other',
  ].map(id => ({id, name: id[0]!.toUpperCase() + id.slice(1)}))
  test('keywords', () => {
    expect(suggestCategory('Dinner at Thalassa', ids)).toBe('food')
    expect(suggestCategory('Cab to airport', ids)).toBe('transport')
    expect(suggestCategory('Rent, January', ids)).toBe('bills')
    expect(suggestCategory('Villa, 4 nights', ids)).toBe('stay')
    expect(suggestCategory('BigBasket order', ids)).toBe('groceries')
  })
  test('custom category names match too', () =>
    expect(suggestCategory('Gym fees', [...ids, {id: 'x', name: 'Gym'}])).toBe(
      'x',
    ))
  test('nothing to suggest', () =>
    expect(suggestCategory('Misc', ids)).toBeUndefined())
})

describe('F-310 smart amount in the form', () => {
  test('shorthand and pasted symbols', () => {
    expect(evaluateForm(base({amount: '1.5L'}), 'UTC').total).toBe(15000000n)
    expect(evaluateForm(base({amount: '₹1,20,000.50'}), 'UTC').total).toBe(
      12000050n,
    )
    expect(
      evaluateForm(base({amount: '2k'}), 'UTC', '.', {shorthand: false})
        .amountError,
    ).toBe('INVALID_AMOUNT')
  })
  test('an ambiguous amount offers its readings and blocks Save until one is picked', () => {
    const r = evaluateForm(base({amount: '1,234', currency: 'EUR'}), 'UTC', ',')
    expect(r.amountError).toBe('AMBIGUOUS_AMOUNT')
    expect(r.amountReadings).toEqual({grouped: 123400n})
    expect(r.draft).toBeUndefined()
    const picked = evaluateForm(
      base({amount: '1,234', currency: 'EUR', amountReading: 'grouped'}),
      'UTC',
      ',',
    )
    expect(picked.total).toBe(123400n)
    expect(picked.draft).toBeDefined()
  })
})

describe('F-402 cash rounding in the form', () => {
  test('1000 over 3 rounded to 1 gives 334/333/333 and the draft carries the unit', () => {
    const r = evaluateForm(base({amount: '1000', roundTo: 1}), 'UTC')
    expect(r.shares).toEqual({me: 33400n, riya: 33300n, sam: 33300n})
    expect(r.draft?.split).toEqual({
      mode: 'equal',
      participants: ['me', 'riya', 'sam'],
      roundTo: 100n,
    })
    expect(r.cash?.remainder).toBe(0n)
  })
  test('a remainder is shown with who carries it', () => {
    const r = evaluateForm(base({amount: '1000.50', roundTo: 1}), 'UTC')
    expect(r.cash).toEqual({
      shares: r.shares!,
      remainder: 50n,
      remainderTo: 'riya',
    })
  })
  test('rounding off leaves the split as before; exact mode never rounds', () => {
    expect(evaluateForm(base({amount: '1000'}), 'UTC').draft?.split).toEqual({
      mode: 'equal',
      participants: ['me', 'riya', 'sam'],
    })
    const exact = evaluateForm(
      base({mode: 'exact', roundTo: 5, exact: {me: '1000'}, amount: '1000'}),
      'UTC',
    )
    expect(exact.cash).toBeUndefined()
    expect(exact.draft?.split).toEqual({mode: 'exact', amounts: {me: 100000n}})
  })
  test('editing a rounded expense keeps the unit', () => {
    const r = evaluateForm(
      base({amount: '1000', roundTo: 10, mode: 'shares'}),
      'UTC',
    )
    const form = formFromExpense(
      {
        ...r.draft!,
        id: 'e',
        shares: r.shares!,
        deleted: false,
        createdBy: 'me',
      } as unknown as Expense,
      'me',
    )
    expect(form.roundTo).toBe(10)
  })
})

/* F-111: logic-audit regressions (docs/audit/AUDIT-2026-10-27.md). */
describe('F-111 C2: editing an expense never changes its money, in any locale', () => {
  const stored = (currency: string, over: Partial<Expense>): Expense => {
    const e: Expense = {
      title: 'Dinner',
      groupId: null,
      currency,
      total: 0n,
      payers: {},
      split: {mode: 'equal', participants: ['me', 'riya']},
      shares: {},
      date: '2026-10-26',
      tz: 'UTC',
      category: 'food',
      notes: '',
      ...over,
    }
    return {...e, shares: computeShares(e.total, e.split)}
  }
  /* One expense per mode, with amounts that have every decimal place. */
  const expenses = (currency: string, unit: bigint): Expense[] => [
    stored(currency, {
      total: 12345n * unit,
      payers: {me: 12345n * unit},
      split: {mode: 'equal', participants: ['me', 'riya']},
    }),
    stored(currency, {
      total: 10001n * unit,
      payers: {me: 5001n * unit, riya: 5000n * unit},
      split: {mode: 'exact', amounts: {me: 5001n * unit, riya: 5000n * unit}},
    }),
    stored(currency, {
      total: 3003n * unit,
      payers: {riya: 3003n * unit},
      split: {
        mode: 'adjusted',
        participants: ['me', 'riya'],
        adjustments: {me: 1003n * unit},
      },
    }),
    stored(currency, {
      total: 1234n * unit + 1000n * unit,
      payers: {me: 2234n * unit},
      split: {
        mode: 'items',
        items: [
          {id: 'a', name: 'Fish', amount: 1234n * unit, participants: ['me']},
        ],
        tax: 1000n * unit,
        tip: 0n,
        service: 0n,
        discount: 0n,
      },
    }),
    stored(currency, {
      total: 9000n * unit,
      payers: {me: 9000n * unit},
      split: {mode: 'percent', basisPoints: {me: 3333, riya: 6667}},
    }),
  ]
  const cases: Array<[string, bigint]> = [
    ['JPY', 1n],
    ['INR', 1n],
    ['BHD', 1n],
  ]
  for (const mark of ['.', ','] as const)
    for (const [code, unit] of cases)
      test(`${code} under "${mark}": every mode reads back as stored`, () => {
        for (const e of expenses(code, unit)) {
          const r = evaluateForm(formFromExpense(e, 'me', mark), 'UTC', mark)
          expect(r.error).toBeUndefined()
          expect(r.total).toBe(e.total)
          expect(r.draft?.payers).toEqual(e.payers)
          expect(r.draft?.split).toEqual(e.split)
          expect(r.shares).toEqual(e.shares)
        }
      })
  test('written in the locale mark', () => {
    const [equal] = expenses('BHD', 1n)
    expect(formFromExpense(equal!, 'me', ',').amount).toBe('12,345')
    expect(formFromExpense(equal!, 'me', '.').amount).toBe('12.345')
  })
})

describe('F-111 M3: split rows with three decimals can be typed', () => {
  test('BHD exact rows 5.001 and 5.000 under "."', () => {
    const r = evaluateForm(
      base({
        currency: 'BHD',
        amount: '10.001',
        amountReading: 'decimal',
        mode: 'exact',
        exact: {me: '5.001', riya: '5.000'},
      }),
      'UTC',
    )
    expect(r.rowErrors).toEqual({})
    expect(r.draft?.split).toEqual({
      mode: 'exact',
      amounts: {me: 5001n, riya: 5000n},
    })
  })
  test('paid rows too, under ","', () => {
    const r = evaluateForm(
      base({
        currency: 'KWD',
        amount: '2,500',
        amountReading: 'decimal',
        payerMode: 'multiple',
        paid: {me: '1,250', riya: '1,250'},
      }),
      'UTC',
      ',',
    )
    expect(r.draft?.payers).toEqual({me: 1250n, riya: 1250n})
  })
})

describe('F-111 M7: percent rows take the comma decimal mark', () => {
  test('33,33 / 33,33 / 33,34 is 100 %', () => {
    const r = evaluateForm(
      base({
        mode: 'percent',
        percent: {me: '33,33', riya: '33,33', sam: '33,34'},
      }),
      'UTC',
      ',',
    )
    expect(r.rowErrors).toEqual({})
    expect(r.draft?.split).toEqual({
      mode: 'percent',
      basisPoints: {me: 3333, riya: 3333, sam: 3334},
    })
  })
  test('12,5 % service in itemize', () => {
    const r = evaluateForm(
      base({
        mode: 'items',
        amount: '112,50',
        items: [{key: 'a', name: 'Tea', amount: '100', people: ['me']}],
        service: '12,5',
        adjustModes: {service: 'percent'},
      }),
      'UTC',
      ',',
    )
    expect(r.rowErrors).toEqual({})
    expect(r.adjustments?.service).toBe(1250n)
  })
})

/* F-113 M6: unticking yourself in "Split with" never makes someone else the payer. */
describe('withPeople', () => {
  const candidates = ['me', 'riya', 'sam']
  test('the single payer stays on the expense and stays the payer', () => {
    const f = withPeople(base({amount: '900'}), ['riya', 'sam'], candidates)
    expect(f.payer).toBe('me')
    expect(f.people).toEqual(['me', 'riya', 'sam'])
    expect(evaluateForm(f, 'UTC').draft?.payers).toEqual({me: 90000n})
  })
  test('with several payers, everyone with a paid amount stays', () => {
    const f = base({
      payerMode: 'multiple',
      paid: {me: '100', riya: '200', sam: ''},
    })
    expect(formPayers(f)).toEqual(['me', 'riya'])
    expect(withPeople(f, ['sam'], candidates).people).toEqual([
      'me',
      'riya',
      'sam',
    ])
  })
  test('anyone else can be unticked; their exclusions and item picks go too', () => {
    const f = withPeople(
      base({
        excluded: ['sam'],
        items: [{key: 'i', name: 'Beer', amount: '9', people: ['riya', 'sam']}],
      }),
      ['me', 'riya'],
      candidates,
    )
    expect(f.people).toEqual(['me', 'riya'])
    expect(f.excluded).toEqual([])
    expect(f.items[0]!.people).toEqual(['riya'])
  })
})

/* F-116 m30(c): removing a person drops their item portions; they do not come back when re-added. */
describe('withPeople portions', () => {
  test('a removed person keeps no portions on an item', () => {
    const f = withPeople(
      base({items: [{key: 'i', name: 'Beer', amount: '9', people: ['riya', 'sam'], portions: {riya: 2, sam: 3}}]}),
      ['me', 'riya'],
      ['me', 'riya', 'sam'],
    )
    expect(f.items[0]!.portions).toEqual({riya: 2})
    const back = withPeople({...f, items: [{...f.items[0]!, people: ['riya', 'sam']}]}, ['me', 'riya', 'sam'], ['me', 'riya', 'sam'])
    expect(back.items[0]!.portions).toEqual({riya: 2})
  })
})

/* F-116 m30(b): a restored draft drops every reference to a person who no longer exists. */
describe('pruneForm', () => {
  test('payer, paid, exact, percent, shares, adjust, excluded and items lose the deleted person', () => {
    const f = pruneForm(
      base({
        payer: 'sam',
        payerMode: 'multiple',
        paid: {me: '10', sam: '20'},
        exact: {riya: '1', sam: '2'},
        percent: {sam: '50'},
        shares: {sam: 2},
        adjust: {sam: '3'},
        excluded: ['sam'],
        items: [{key: 'i', name: 'Beer', amount: '9', people: ['riya', 'sam'], portions: {sam: 2}}],
      }),
      new Set(['me', 'riya']),
    )
    expect(f.people).toEqual(['me', 'riya'])
    expect(f.payer).toBe('me')
    expect(f.paid).toEqual({me: '10'})
    expect(f.exact).toEqual({riya: '1'})
    expect(f.percent).toEqual({})
    expect(f.shares).toEqual({})
    expect(f.adjust).toEqual({})
    expect(f.excluded).toEqual([])
    expect(f.items[0]).toMatchObject({people: ['riya'], portions: {}})
  })
  test('a form with nobody removed is unchanged', () => {
    const f = base()
    expect(pruneForm(f, new Set(f.people))).toEqual(f)
  })
})

describe('pruneDraft', () => {
  const inGroup = base({groupId: 'g1', title: 'Cab'})
  const alive = new Set(['me', 'riya', 'sam'])
  test('a live group keeps the draft as it was', () => {
    const r = pruneDraft(inGroup, alive, {isFound: true, isInactive: false})
    expect(r.draft?.groupId).toBe('g1')
    expect(r.isGroupDropped).toBe(false)
  })
  test('a group made inactive since: the draft stays, outside the group, and says so', () => {
    const r = pruneDraft(inGroup, alive, {isFound: true, isInactive: true})
    expect(r.draft).toMatchObject({title: 'Cab', amount: '300', groupId: null})
    expect(r.isGroupDropped).toBe(true)
  })
  test('a group that is gone drops the draft; no group keeps it', () => {
    expect(pruneDraft(inGroup, alive, {isFound: false, isInactive: false}).draft).toBeUndefined()
    expect(pruneDraft(base(), alive, undefined).draft?.title).toBe('Dinner')
  })
})

test('a currency in a route parameter is used only when this build knows it', () => {
  expect(knownCurrency('INR')).toBe('INR')
  expect(knownCurrency('XYZ')).toBeUndefined()
  expect(knownCurrency('')).toBeUndefined()
  expect(knownCurrency(undefined)).toBeUndefined()
})

describe('F-273 a new expense starts with me as the payer (owner 207)', () => {
  const fresh = (people: string[], groupId: string | null = null) =>
    emptyForm({me: 'me', currency: 'INR', date: '2026-10-26', people, groupId, mode: 'equal'})

  test('no people, a person page pre-selecting a friend, a group: the payer is me, single mode', () => {
    for (const people of [[], ['riya'], ['riya', 'sam', 'me']]) {
      const f = fresh(people, people.length > 1 ? 'g1' : null)
      expect(f.payer).toBe('me')
      expect(f.payerMode).toBe('single')
      expect(f.paid).toEqual({})
      expect(f.people[0]).toBe('me')
      expect(formPayers(f)).toEqual(['me'])
    }
  })
  test('the friend on a person page is on the split but never the payer', () => {
    const f = fresh(['riya'])
    expect(f.people).toEqual(['me', 'riya'])
    expect(f.payer).not.toBe('riya')
  })
  test('a restored draft whose payer has left falls back to me, not to a friend', () => {
    const f = pruneForm(base({payer: 'riya'}), new Set(['me', 'sam']))
    expect(f.payer).toBe('me')
  })
})
