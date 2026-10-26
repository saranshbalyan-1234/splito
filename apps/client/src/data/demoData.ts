/**
 * Demo dataset for `?demo=1` in dev/E2E builds (see `demo.ts`). Pure data so
 * E2E can recompute the expected balances with `@splito/domain`.
 *
 * People are referenced by key ('me' is the local user). Amounts are minor
 * units. Every split divides exactly, so balances don't depend on the
 * id-ordered tie-break that real (random) ids would get for remainders.
 */
import {type ItemParticipant, parseMinor as minor, type SplitInput} from '@splito/domain'

/** An itemised bill: who had each item, with portions as `[person, n]`. */
export type DemoBill = {
  items: Array<{name: string; amount: bigint; people: Array<DemoPersonKey | [DemoPersonKey, number]>}>
  tax: bigint
  tip: bigint
  service: bigint
  discount: bigint
}

export type DemoExpense = {
  title: string
  group: DemoGroupKey | null
  currency: 'INR' | 'EUR'
  total: bigint
  payers: Partial<Record<DemoPersonKey, bigint>>
  participants: DemoPersonKey[]
  /** Itemised instead of equal (`participants` then lists everyone on the bill). */
  bill?: DemoBill
  date: string
  category: string
}

/** The expense's split with real ids; shared by the seeder and the e2e balance check. */
export function demoSplit(e: DemoExpense, id: (key: DemoPersonKey) => string): SplitInput {
  if (!e.bill) return {mode: 'equal', participants: e.participants.map(id)}
  return {
    mode: 'items',
    items: e.bill.items.map((item, i) => ({
      id: `item-${i}`,
      name: item.name,
      amount: item.amount,
      participants: item.people.map((p): ItemParticipant => (typeof p === 'string' ? id(p) : {id: id(p[0]), weight: p[1]})),
    })),
    tax: e.bill.tax,
    tip: e.bill.tip,
    service: e.bill.service,
    discount: e.bill.discount,
  }
}

export type DemoPersonKey = 'me' | keyof typeof DEMO_FRIENDS
export type DemoGroupKey = keyof typeof DEMO_GROUPS

export const DEMO_FRIENDS = {
  riya: 'Riya Sharma',
  arjun: 'Arjun Mehta',
  priya: 'Priya Nair',
  sam: 'Sam Carter',
  lena: 'Lena Fischer',
  diego: 'Diego Alves',
} as const

export const DEMO_GROUPS = {
  goa: {
    name: 'Goa trip',
    kind: 'trip',
    currency: 'INR',
    startDate: '2025-12-20',
    endDate: '2025-12-27',
    tz: 'Asia/Kolkata',
    members: ['riya', 'arjun', 'priya', 'sam'],
  },
  flat: {
    name: 'Flat 4B',
    kind: 'home',
    currency: 'INR',
    startDate: null,
    endDate: null,
    tz: 'Asia/Kolkata',
    members: ['riya', 'arjun'],
  },
  lisbon: {
    name: 'Lisbon',
    kind: 'trip',
    currency: 'EUR',
    startDate: '2026-04-10',
    endDate: '2026-04-15',
    tz: 'Europe/Lisbon',
    members: ['sam', 'lena', 'diego'],
  },
} as const

const GOA: DemoPersonKey[] = ['me', 'riya', 'arjun', 'priya', 'sam']
const FLAT: DemoPersonKey[] = ['me', 'riya', 'arjun']
const LISBON: DemoPersonKey[] = ['me', 'sam', 'lena', 'diego']

export const DEMO_EXPENSES: DemoExpense[] = [
  // Goa trip (INR)
  {title: 'Villa, 4 nights', group: 'goa', currency: 'INR', total: minor('4000000'), payers: {me: minor('4000000')}, participants: GOA, date: '2025-12-20', category: 'stay'},
  {title: 'Scooter rentals', group: 'goa', currency: 'INR', total: minor('600000'), payers: {arjun: minor('600000')}, participants: GOA, date: '2025-12-21', category: 'transport'},
  {title: 'Groceries', group: 'goa', currency: 'INR', total: minor('320000'), payers: {me: minor('320000')}, participants: GOA, date: '2025-12-21', category: 'groceries'},
  {title: 'Dinner at Thalassa', group: 'goa', currency: 'INR', total: minor('1250000'), payers: {riya: minor('750000'), priya: minor('500000')}, participants: GOA, date: '2025-12-22', category: 'food'},
  {title: 'Parasailing', group: 'goa', currency: 'INR', total: minor('900000'), payers: {sam: minor('900000')}, participants: ['me', 'riya', 'sam'], date: '2025-12-23', category: 'entertainment'},
  /*
   * Itemised, with portions (owner rule 5): beers 2:3:1, 5% tax and 10% service on top.
   * Subtotals 720 / 1,020 / 1,020 / 870 / 270 take 15% extras each, so every share is whole.
   */
  {
    title: 'Bar tab at Britto’s',
    group: 'goa',
    currency: 'INR',
    total: minor('448500'),
    payers: {riya: minor('448500')},
    participants: GOA,
    bill: {
      items: [
        {name: 'Kingfisher, 6 pints', amount: minor('180000'), people: [['me', 2], ['sam', 3], 'riya']},
        {name: 'Cocktails', amount: minor('120000'), people: ['riya', 'priya']},
        {name: 'Nachos', amount: minor('60000'), people: ['me', 'riya', 'arjun', 'priya', 'sam']},
        {name: 'Masala fries', amount: minor('30000'), people: ['arjun', 'priya']},
      ],
      tax: minor('19500'),
      tip: minor('0'),
      service: minor('39000'),
      discount: minor('0'),
    },
    date: '2025-12-23',
    category: 'food',
  },
  {title: 'Beach shack lunch', group: 'goa', currency: 'INR', total: minor('450000'), payers: {priya: minor('450000')}, participants: GOA, date: '2025-12-24', category: 'food'},
  {title: 'Cab to airport', group: 'goa', currency: 'INR', total: minor('240000'), payers: {me: minor('120000'), arjun: minor('120000')}, participants: ['me', 'riya', 'arjun', 'priya'], date: '2025-12-27', category: 'transport'},
  // Flat 4B (INR)
  {title: 'Rent, January', group: 'flat', currency: 'INR', total: minor('6000000'), payers: {me: minor('6000000')}, participants: FLAT, date: '2026-01-01', category: 'stay'},
  {title: 'Electricity bill', group: 'flat', currency: 'INR', total: minor('345000'), payers: {riya: minor('345000')}, participants: FLAT, date: '2026-01-10', category: 'bills'},
  {title: 'Wi-Fi', group: 'flat', currency: 'INR', total: minor('119700'), payers: {arjun: minor('119700')}, participants: FLAT, date: '2026-01-12', category: 'bills'},
  {title: 'Rent, February', group: 'flat', currency: 'INR', total: minor('6000000'), payers: {riya: minor('6000000')}, participants: FLAT, date: '2026-02-01', category: 'stay'},
  {title: 'BigBasket order', group: 'flat', currency: 'INR', total: minor('276000'), payers: {me: minor('276000')}, participants: FLAT, date: '2026-02-02', category: 'groceries'},
  {title: 'Cleaning supplies', group: 'flat', currency: 'INR', total: minor('84000'), payers: {arjun: minor('84000')}, participants: FLAT, date: '2026-02-15', category: 'shopping'},
  // Lisbon (EUR)
  {title: 'Airbnb in Alfama', group: 'lisbon', currency: 'EUR', total: minor('72000'), payers: {lena: minor('72000')}, participants: LISBON, date: '2026-04-10', category: 'stay'},
  {title: 'Pastéis de Belém', group: 'lisbon', currency: 'EUR', total: minor('2400'), payers: {me: minor('2400')}, participants: LISBON, date: '2026-04-11', category: 'food'},
  {title: 'Tram 28 tickets', group: 'lisbon', currency: 'EUR', total: minor('1200'), payers: {diego: minor('1200')}, participants: LISBON, date: '2026-04-11', category: 'transport'},
  {title: 'Fado night', group: 'lisbon', currency: 'EUR', total: minor('16000'), payers: {sam: minor('10000'), me: minor('6000')}, participants: LISBON, date: '2026-04-12', category: 'entertainment'},
  {title: 'Seafood at Ramiro', group: 'lisbon', currency: 'EUR', total: minor('18400'), payers: {me: minor('18400')}, participants: LISBON, date: '2026-04-13', category: 'food'},
  // Direct (no group)
  {title: 'Concert tickets', group: null, currency: 'INR', total: minor('500000'), payers: {me: minor('500000')}, participants: ['me', 'priya'], date: '2026-03-08', category: 'entertainment'},
  {title: 'Coffee beans', group: null, currency: 'EUR', total: minor('1800'), payers: {sam: minor('1800')}, participants: ['me', 'sam'], date: '2026-05-02', category: 'groceries'},
  {title: 'Movie night', group: null, currency: 'INR', total: minor('90000'), payers: {riya: minor('90000')}, participants: ['me', 'riya'], date: '2026-06-14', category: 'entertainment'},
]
