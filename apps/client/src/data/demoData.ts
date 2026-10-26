/**
 * Demo dataset for `?demo=1` in dev/E2E builds (see `demo.ts`). Pure data so
 * E2E can recompute the expected balances with `@splito/domain`.
 *
 * People are referenced by key ('me' is the local user). Amounts are minor
 * units. Every split divides exactly, so balances don't depend on the
 * id-ordered tie-break that real (random) ids would get for remainders.
 */
import {type ItemParticipant, type SplitInput} from '@splito/domain'
import {type demoDirectory} from '@splito/sync'

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
  {title: 'Villa, 4 nights', group: 'goa', currency: 'INR', total: 4000000n, payers: {me: 4000000n}, participants: GOA, date: '2025-12-20', category: 'stay'},
  {title: 'Scooter rentals', group: 'goa', currency: 'INR', total: 600000n, payers: {arjun: 600000n}, participants: GOA, date: '2025-12-21', category: 'transport'},
  {title: 'Groceries', group: 'goa', currency: 'INR', total: 320000n, payers: {me: 320000n}, participants: GOA, date: '2025-12-21', category: 'groceries'},
  {title: 'Dinner at Thalassa', group: 'goa', currency: 'INR', total: 1250000n, payers: {riya: 750000n, priya: 500000n}, participants: GOA, date: '2025-12-22', category: 'food'},
  {title: 'Parasailing', group: 'goa', currency: 'INR', total: 900000n, payers: {sam: 900000n}, participants: ['me', 'riya', 'sam'], date: '2025-12-23', category: 'entertainment'},
  /*
   * Itemised, with portions (owner rule 5): beers 2:3:1, 5% tax and 10% service on top.
   * Subtotals 720 / 1,020 / 1,020 / 870 / 270 take 15% extras each, so every share is whole.
   */
  {
    title: 'Bar tab at Britto’s',
    group: 'goa',
    currency: 'INR',
    total: 448500n,
    payers: {riya: 448500n},
    participants: GOA,
    bill: {
      items: [
        {name: 'Kingfisher, 6 pints', amount: 180000n, people: [['me', 2], ['sam', 3], 'riya']},
        {name: 'Cocktails', amount: 120000n, people: ['riya', 'priya']},
        {name: 'Nachos', amount: 60000n, people: ['me', 'riya', 'arjun', 'priya', 'sam']},
        {name: 'Masala fries', amount: 30000n, people: ['arjun', 'priya']},
      ],
      tax: 19500n,
      tip: 0n,
      service: 39000n,
      discount: 0n,
    },
    date: '2025-12-23',
    category: 'food',
  },
  {title: 'Beach shack lunch', group: 'goa', currency: 'INR', total: 450000n, payers: {priya: 450000n}, participants: GOA, date: '2025-12-24', category: 'food'},
  {title: 'Cab to airport', group: 'goa', currency: 'INR', total: 240000n, payers: {me: 120000n, arjun: 120000n}, participants: ['me', 'riya', 'arjun', 'priya'], date: '2025-12-27', category: 'transport'},
  // Flat 4B (INR)
  {title: 'Rent, January', group: 'flat', currency: 'INR', total: 6000000n, payers: {me: 6000000n}, participants: FLAT, date: '2026-01-01', category: 'stay'},
  {title: 'Electricity bill', group: 'flat', currency: 'INR', total: 345000n, payers: {riya: 345000n}, participants: FLAT, date: '2026-01-10', category: 'bills'},
  {title: 'Wi-Fi', group: 'flat', currency: 'INR', total: 119700n, payers: {arjun: 119700n}, participants: FLAT, date: '2026-01-12', category: 'bills'},
  {title: 'Rent, February', group: 'flat', currency: 'INR', total: 6000000n, payers: {riya: 6000000n}, participants: FLAT, date: '2026-02-01', category: 'stay'},
  {title: 'BigBasket order', group: 'flat', currency: 'INR', total: 276000n, payers: {me: 276000n}, participants: FLAT, date: '2026-02-02', category: 'groceries'},
  {title: 'Cleaning supplies', group: 'flat', currency: 'INR', total: 84000n, payers: {arjun: 84000n}, participants: FLAT, date: '2026-02-15', category: 'shopping'},
  // Lisbon (EUR)
  {title: 'Airbnb in Alfama', group: 'lisbon', currency: 'EUR', total: 72000n, payers: {lena: 72000n}, participants: LISBON, date: '2026-04-10', category: 'stay'},
  {title: 'Pastéis de Belém', group: 'lisbon', currency: 'EUR', total: 2400n, payers: {me: 2400n}, participants: LISBON, date: '2026-04-11', category: 'food'},
  {title: 'Tram 28 tickets', group: 'lisbon', currency: 'EUR', total: 1200n, payers: {diego: 1200n}, participants: LISBON, date: '2026-04-11', category: 'transport'},
  {title: 'Fado night', group: 'lisbon', currency: 'EUR', total: 16000n, payers: {sam: 10000n, me: 6000n}, participants: LISBON, date: '2026-04-12', category: 'entertainment'},
  {title: 'Seafood at Ramiro', group: 'lisbon', currency: 'EUR', total: 18400n, payers: {me: 18400n}, participants: LISBON, date: '2026-04-13', category: 'food'},
  // Direct (no group)
  {title: 'Concert tickets', group: null, currency: 'INR', total: 500000n, payers: {me: 500000n}, participants: ['me', 'priya'], date: '2026-03-08', category: 'entertainment'},
  {title: 'Coffee beans', group: null, currency: 'EUR', total: 1800n, payers: {sam: 1800n}, participants: ['me', 'sam'], date: '2026-05-02', category: 'groceries'},
  {title: 'Movie night', group: null, currency: 'INR', total: 90000n, payers: {riya: 90000n}, participants: ['me', 'riya'], date: '2026-06-14', category: 'entertainment'},
]

/**
 * The demo account directory (26.18): who is "on Splito" in demo mode, and an
 * invite code that opens someone else's invite. Invented people, example.com
 * addresses and fictional numbers only.
 */
export const DEMO_DIRECTORY: Parameters<typeof demoDirectory>[0] = {
  accounts: [
    {accountId: 'demo-ananya', name: 'Ananya Gupta', contact: {kind: 'email', value: 'ananya@example.com'}},
    {accountId: 'demo-kabir', name: 'Kabir Khan', contact: {kind: 'phone', value: '+919812345678'}},
    {accountId: 'demo-maya', name: 'Maya Chen', contact: {kind: 'email', value: 'maya@example.com'}},
    {accountId: 'demo-ishaan', name: 'Ishaan Verma', contact: {kind: 'email', value: 'ishaan@example.com'}},
    {accountId: 'demo-sara', name: 'Sara Ali', contact: {kind: 'phone', value: '+14155550134'}},
  ],
  invites: {
    ananya2026demo: {kind: 'friend', inviter: 'demo-ananya', groupName: null},
  },
}

/** Someone not on Splito, already invited in the demo. */
export const DEMO_INVITED = {name: 'Neha Joshi', contact: {kind: 'phone', value: '+919988776655'}} as const
