/**
 * The large demo dataset (ARCHITECTURE 26.1, F-227): a year of realistic
 * Splito use for the owner's testing and for performance checks. The app
 * writes it in dev and e2e builds only (`apps/client/src/data/demoLarge.ts`).
 *
 * `generateLargeDemo` is pure and deterministic: the same seed, day and "me"
 * give the same plan (people, groups, then every write in time order). Every
 * id it makes starts with `DEMO_LARGE_PREFIX`, which is the tag: adding
 * twice is a no-op and "Remove demo data" erases exactly those rows. It lives
 * here, beside the domain, because it builds money: amounts, splits and
 * settle-ups, exactly, per currency.
 */
import {
  allocate,
  computeShares,
  type CurrencyCode,
  type ExpenseRecord,
  getCurrency,
  groupNet,
  type LedgerRecord,
  type LocalDate,
  pairwiseBalances,
  planSettlement,
  type SplitInput,
  sumMinor,
  validateExpense,
} from '@splito/domain'

import {
  createExpense,
  createGroup,
  createPerson,
  createRepayments,
  createWriteOffs,
  deleteExpense,
  deleteRepayment,
  deleteWriteOff,
  type ExpenseDraft,
  type Group,
  type RepaymentInput,
  updateExpense,
} from './mutations'
import type {Store, Tx} from './store'
import type {MutationCtx} from './types'

export const DEMO_LARGE_PREFIX = 'demo-large-'
export const DEMO_LARGE_SEED = 0x5911_7000

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/* -------------------------------------------------------------------------- */
/* Seeded randomness                                                          */
/* -------------------------------------------------------------------------- */

/** mulberry32: a tiny, fast, well-mixed 32-bit PRNG; the same seed gives the same stream everywhere. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeRng(seed: number) {
  const next = mulberry32(seed)
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))
  return {
    next,
    int,
    chance: (p: number) => next() < p,
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    /** `n` distinct items in their original order. */
    sample<T>(xs: readonly T[], n: number): T[] {
      const idx = xs.map((_, i) => i)
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[idx[i], idx[j]] = [idx[j]!, idx[i]!]
      }
      return idx
        .slice(0, n)
        .sort((x, y) => x - y)
        .map(i => xs[i]!)
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Cast                                                                       */
/* -------------------------------------------------------------------------- */

const FRIENDS = {
  aanya: ['Aanya Iyer', 'aanya.iyer@okhdfcbank'],
  vihaan: ['Vihaan Malhotra', 'vihaan.m@okaxis'],
  kabir: ['Kabir Singh', 'kabirsingh@ybl'],
  neha: ['Neha Joshi', 'neha.joshi@okicici'],
  rohan: ['Rohan Desai', null],
  meera: ['Meera Pillai', 'meera.pillai@oksbi'],
  ishaan: ['Ishaan Chatterjee', null],
  tanvi: ['Tanvi Bhatt', 'tanvibhatt@paytm'],
  aditya: ['Aditya Rao', null],
  sneha: ['Sneha Kulkarni', 'sneha.k@okhdfcbank'],
  pooja: ['Pooja Reddy', null],
  karan: ['Karan Kapoor', 'karan.kapoor@ybl'],
  nisha: ['Nisha Agarwal', null],
  vikram: ['Vikram Nair', 'vikram.nair@okaxis'],
  rahul: ['Rahul Verma', null],
  dev: ['Dev Menon', null],
  faisal: ['Faisal Siddiqui', 'faisal.s@okicici'],
  joseph: ['Joseph D’Souza', null],
  varun: ['Varun Gupta', null],
  mom: ['Mom', null],
  dad: ['Dad', 'dad.sethi@oksbi'],
  ananya: ['Ananya Sethi', 'ananya.sethi@okhdfcbank'],
  zara: ['Zara Khan', null],
  ines: ['Inês Costa', null],
  mateo: ['Mateo García', null],
  kenji: ['Kenji Tanaka', null],
  yuki: ['Yuki Sato', null],
  oliver: ['Oliver Bennett', null],
  emma: ['Emma Clarke', null],
  maya: ['Maya Thompson', null],
} as const satisfies Record<string, readonly [string, string | null]>

type Friend = keyof typeof FRIENDS
type Who = Friend | 'me'

const INDIAN: Friend[] = ['aanya', 'vihaan', 'kabir', 'neha', 'rohan', 'meera', 'ishaan', 'tanvi', 'aditya', 'sneha', 'karan', 'zara', 'rahul', 'dev']

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/** `title|category|low|high[|flags]` in major units; `i`: often itemised; `r`: rare (a team outing, not a lunch). */
type Tpl = string

type Ctx = {
  key: string
  name: string
  kind: Group['kind']
  currency: CurrencyCode
  tz: string
  members: Friend[]
  /** Trips and the wedding: days ago the dates start, and how many days. */
  span?: [number, number]
}

const GROUPS: Ctx[] = [
  {key: 'goa', name: 'Goa getaway', kind: 'trip', currency: 'INR', tz: 'Asia/Kolkata', members: ['kabir', 'neha', 'rohan', 'meera', 'ishaan', 'tanvi'], span: [300, 6]},
  {key: 'lisbon', name: 'Lisbon & Sintra', kind: 'trip', currency: 'EUR', tz: 'Europe/Lisbon', members: ['ines', 'mateo', 'zara', 'aditya'], span: [205, 6]},
  {key: 'bali', name: 'Bali & Bangkok', kind: 'trip', currency: 'USD', tz: 'Asia/Makassar', members: ['aanya', 'kabir', 'zara', 'aditya'], span: [152, 9]},
  {key: 'wedding', name: 'Rohan & Meera’s wedding', kind: 'other', currency: 'INR', tz: 'Asia/Kolkata', members: ['rohan', 'meera', 'karan', 'neha', 'ishaan', 'tanvi', 'kabir'], span: [118, 4]},
  {key: 'tokyo', name: 'Tokyo', kind: 'trip', currency: 'JPY', tz: 'Asia/Tokyo', members: ['kenji', 'yuki', 'vihaan', 'sneha', 'rahul'], span: [84, 8]},
  {key: 'roadtrip', name: 'Coorg road trip', kind: 'trip', currency: 'INR', tz: 'Asia/Kolkata', members: ['kabir', 'zara', 'neha', 'ishaan'], span: [48, 5]},
  {key: 'london', name: 'London', kind: 'trip', currency: 'GBP', tz: 'Europe/London', members: ['oliver', 'emma', 'aanya', 'vihaan'], span: [24, 6]},
  {key: 'flat', name: 'Flat 4B', kind: 'home', currency: 'INR', tz: 'Asia/Kolkata', members: ['aanya', 'vihaan']},
  {key: 'office', name: 'Office lunch', kind: 'other', currency: 'INR', tz: 'Asia/Kolkata', members: ['vikram', 'sneha', 'rahul', 'pooja', 'karan', 'nisha', 'aditya']},
  {key: 'family', name: 'Family', kind: 'other', currency: 'INR', tz: 'Asia/Kolkata', members: ['mom', 'dad', 'ananya']},
  {key: 'football', name: 'Sunday football', kind: 'other', currency: 'INR', tz: 'Asia/Kolkata', members: ['dev', 'faisal', 'joseph', 'varun', 'karan', 'ishaan', 'rahul', 'aditya', 'vihaan']},
  {key: 'bookclub', name: 'Book club', kind: 'other', currency: 'INR', tz: 'Asia/Kolkata', members: ['tanvi', 'meera', 'nisha', 'ananya', 'sneha']},
]

/** Rough rupees per unit, for local spends paid by an Indian card in rupees (DCC); never used to convert a balance. */
const CARD_INR: Record<CurrencyCode, number> = {EUR: 90, USD: 84, GBP: 107, JPY: 0.56, THB: 2.4}

/** A trip's bookings and daily spends; `stayCurrency` when the stay was booked online in another currency. */
const TRIP_TPL: Record<string, {flights: Tpl; stay: Tpl[]; stayCurrency?: CurrencyCode; daily: Tpl[]}> = {
  goa: {
    flights: 'Flights to Goa|transport|26000|38000',
    stay: ['Villa in Assagao|stay|480|650'],
    stayCurrency: 'USD',
    daily: [
      'Scooter rentals|transport|1800|3200', 'Cab to Anjuna|transport|600|1400', 'Fuel for the scooters|transport|400|900',
      'Breakfast at Artjuna|food|1400|2600|i', 'Lunch at a beach shack|food|1800|4200|i', 'Dinner at Gunpowder|food|3200|6800|i',
      'Fish thali at Ritz Classic|food|1600|3000|i', 'Parasailing at Calangute|entertainment|3000|6000',
      'Club entry at Hilltop|entertainment|4000|8000', 'Dudhsagar day tour|entertainment|6000|9000',
      'Sunset cruise on the Mandovi|entertainment|3000|5000', 'Beer and snacks|groceries|900|2400',
      'Supermarket run|groceries|1200|3200', 'Anjuna flea market|shopping|800|3500',
    ],
  },
  lisbon: {
    flights: 'Flights to Lisbon|transport|185000|260000',
    stay: ['Airbnb in Alfama|stay|780|1150'],
    daily: [
      'Metro passes|transport|25|45', 'Uber to Belém|transport|9|16', 'Train to Sintra|transport|12|20', 'Tram 28 tickets|transport|9|18',
      'Pastéis de Belém|food|8|18', 'Lunch at Time Out Market|food|60|110|i', 'Dinner at Ramiro|food|120|210|i',
      'Coffee and pastries|food|7|16', 'Tasca dinner in Bairro Alto|food|70|130|i', 'Fado night|entertainment|80|140',
      'Pena Palace tickets|entertainment|56|84', 'Oceanário tickets|entertainment|50|80', 'Pingo Doce run|groceries|25|60',
      'Cork souvenirs|shopping|20|60',
    ],
  },
  bali: {
    flights: 'Flights to Bali|transport|140000|190000',
    stay: ['Villa in Ubud|stay|780|1300', 'Hotel in Seminyak|stay|420|700'],
    daily: [
      'Driver for the day|transport|45|70', 'Scooter rental|transport|20|35', 'Grab to Canggu|transport|8|15',
      'Dinner at Locavore|food|180|320|i', 'Warung lunch|food|15|35|i', 'Smoothie bowls|food|18|30',
      'Beach club day beds|food|90|160|i', 'Mount Batur sunrise trek|entertainment|140|220', 'Surf lessons|entertainment|90|150',
      'Tegallalang rice terraces|entertainment|12|24', 'Balinese massage|other|60|110', 'Ubud art market|shopping|25|80',
    ],
  },
  tokyo: {
    flights: 'Flights to Tokyo|transport|240000|320000',
    stay: ['Hotel in Shinjuku|stay|180000|260000', 'Ryokan in Hakone|stay|96000|140000'],
    daily: [
      'Suica top-up|transport|6000|12000', 'Shinkansen to Kyoto|transport|56000|72000', 'Taxi to Shibuya|transport|2400|4200',
      'Ichiran ramen|food|5200|7800', 'Sushi at Tsukiji|food|12000|24000|i', 'Izakaya dinner|food|14000|26000|i',
      'Konbini breakfast|food|2200|4200', 'Yakiniku dinner|food|18000|32000|i', 'teamLab Planets|entertainment|19200|22800',
      'Shibuya Sky|entertainment|12000|15000', 'Karaoke in Shinjuku|entertainment|8000|14000',
      'Don Quijote haul|shopping|8000|22000', 'Uniqlo Ginza|shopping|9000|24000',
    ],
  },
  roadtrip: {
    flights: 'Car rental from Zoomcar|transport|9000|14000',
    stay: ['Homestay in Madikeri|stay|180|260'],
    stayCurrency: 'USD',
    daily: [
      'Fuel|transport|2500|4200', 'FASTag tolls|transport|300|900', 'Breakfast at Kamat|food|600|1200|i',
      'Pandi curry lunch|food|1400|2800|i', 'Dinner at the homestay|food|1600|3200', 'Coffee at a plantation café|food|400|900',
      'Abbey Falls entry|entertainment|150|300', 'Dubare elephant camp|entertainment|1200|2400',
      'River rafting at Barapole|entertainment|3500|6000', 'Coorg coffee and spices|shopping|900|2600',
    ],
  },
  london: {
    flights: 'Flights to London|transport|260000|360000',
    stay: ['Airbnb in Shoreditch|stay|950|1400'],
    daily: [
      'Oyster top-up|transport|40|80', 'Uber to Camden|transport|14|26', 'Train to Oxford|transport|60|90',
      'Dishoom breakfast|food|55|90|i', 'Sunday roast at The Eagle|food|90|150|i', 'Borough Market lunch|food|35|70',
      'Pints at the pub|food|30|60|i', 'Flat whites|food|10|20', 'West End show|entertainment|180|320',
      'Tower of London tickets|entertainment|90|130', 'Warner Bros. Studio Tour|entertainment|190|240',
      'Tesco run|groceries|20|45', 'Camden Market|shopping|25|80',
    ],
  },
}

/** The Bangkok leg of the Bali trip, in baht. */
const BANGKOK: Tpl[] = [
  'BTS cards|transport|600|900', 'Tuk-tuk to Khao San|transport|200|400', 'Street food at Yaowarat|food|600|1400|i',
  'Dinner at Jay Fai|food|3200|5200|i', 'Rooftop drinks at Octave|food|2400|4200|i', 'Mango sticky rice|food|240|480',
  'Grand Palace tickets|entertainment|2000|2500', 'Chatuchak market|shopping|1200|3600', 'Thai massage|other|1200|2000',
]

const WEDDING: Tpl[] = [
  'Flights to Udaipur|transport|36000|52000', 'Sangeet outfits|shopping|12000|32000', 'Wedding gift for Rohan & Meera|shopping|25000|40000',
  'Mehendi artist|other|4000|7000', 'Cabs from the airport|transport|1600|2800', 'Lunch at Ambrai|food|5200|8600|i',
  'Dhol for the baraat|entertainment|6000|11000', 'Haldi flowers|other|2500|4500', 'Rehearsal snacks|food|1800|3600|i',
  'Makeup and hair|other|9000|16000', 'After-party drinks|food|6000|12000|i',
]

/** Everyday expenses of the ongoing groups, with how often one turns up on a given day. */
const EVERYDAY: Record<string, {p: number; tpl: Tpl[]}> = {
  flat: {
    p: 0.55,
    tpl: [
      'BigBasket order|groceries|900|3600', 'Blinkit order|groceries|250|1200', 'Zepto order|groceries|200|900',
      'Milk and eggs|groceries|300|700', 'Cleaning supplies|shopping|400|1200', 'Plumber visit|bills|500|1500|r',
      'Water tanker|bills|700|1200', 'Pizza night|food|1200|2400|i', 'Swiggy dinner|food|700|1800|i', 'Sunday brunch at home|groceries|600|1600',
      'Bedsheets and towels|shopping|1800|4200|r', 'Pest control|bills|1200|2200|r',
    ],
  },
  office: {
    p: 0.7,
    tpl: [
      'Lunch at Truffles|food|1800|4200|i', 'Meghana Foods biryani|food|1600|3800|i', 'Swiggy team order|food|1400|3800|i',
      'Chai and samosas|food|120|360', 'Third Wave coffees|food|600|1400', 'Dosa at Rameshwaram Café|food|400|900|i',
      'Friday team dinner|food|6000|14000|ir', 'Birthday cake|food|900|1800|r', 'Team bowling at Amoeba|entertainment|4000|8000|r',
      'Momos from Dzukou|food|500|1200',
    ],
  },
  family: {
    p: 0.32,
    tpl: [
      'Groceries for home|groceries|2400|6800', 'Dad’s medicines|other|800|2800', 'Doctor’s appointment|other|800|1500',
      'Car service|transport|4800|9800|r', 'Plants for the balcony|shopping|900|2600', 'Family dinner at Punjab Grill|food|4200|8600|i',
      'Train tickets to Jaipur|transport|3600|7200|r', 'Sweets from Haldiram’s|food|900|2400', 'New pressure cooker|shopping|1800|3200|r',
      'Electricity at home|bills|2600|6400',
    ],
  },
  football: {
    p: 0.1,
    tpl: [
      'New ball|shopping|1200|2200', 'Bibs|shopping|900|1600', 'Post-match chai|food|200|600', 'Gatorade|groceries|400|900',
      'Tournament entry fee|entertainment|5000|8000|r', 'First-aid kit|other|600|1200|r',
    ],
  },
  bookclub: {
    p: 0.05,
    tpl: ['Bookstore haul at Blossom|shopping|1200|3600', 'Author talk tickets|entertainment|1200|2400', 'Snacks for book club|groceries|500|1200'],
  },
}

const DIRECT: Tpl[] = [
  'Coffee|food|300|900', 'Movie tickets|entertainment|600|1400', 'Uber home|transport|250|800', 'Concert tickets|entertainment|3000|9000|r',
  'Brunch|food|1400|3600|i', 'Birthday gift|shopping|1500|5000|r', 'Cab to the airport|transport|700|1400', 'Dinner|food|1600|4800|i',
  'Drinks at Toit|food|1800|4200|i', 'IPL tickets|entertainment|3000|8000|r', 'Groceries|groceries|400|1800', 'Petrol|transport|1000|2500',
  'Stand-up show|entertainment|1200|2400', 'Ice cream at Corner House|food|300|700', 'Parking|transport|100|300',
]

/** Direct expenses abroad, with the friend there. */
const ABROAD: Array<{who: Friend; currency: CurrencyCode; tpl: Tpl[]}> = [
  {who: 'maya', currency: 'USD', tpl: ['Bagels and coffee|food|14|28', 'Subway cards|transport|34|34', 'MoMA tickets|entertainment|50|60', 'Dinner in Brooklyn|food|80|160|i', 'Knicks tickets|entertainment|180|320', 'Uber to JFK|transport|60|90']},
  {who: 'mateo', currency: 'EUR', tpl: ['Tapas in La Latina|food|40|80|i', 'Prado tickets|entertainment|30|30', 'Vermut and olives|food|12|24', 'Cercanías tickets|transport|8|14']},
  {who: 'oliver', currency: 'GBP', tpl: ['Curry on Brick Lane|food|40|70|i', 'Arsenal tickets|entertainment|120|180', 'Pints in Soho|food|20|40']},
  {who: 'kenji', currency: 'JPY', tpl: ['Ramen in Ebisu|food|2600|3600', 'Golden Gai drinks|food|5000|9000', 'Sumo tickets|entertainment|18000|26000']},
]

const MENUS: Record<CurrencyCode, Array<[string, number, number]>> = {
  INR: [
    ['Butter chicken', 420, 520], ['Dal makhani', 320, 380], ['Garlic naan', 70, 90], ['Paneer tikka', 340, 420], ['Chicken biryani', 380, 480],
    ['Masala chaas', 90, 120], ['Kingfisher pint', 280, 360], ['Fresh lime soda', 110, 150], ['Gulab jamun', 140, 180], ['Veg thali', 320, 420],
    ['Prawn curry', 520, 680], ['Cocktail', 450, 650], ['Masala dosa', 120, 180], ['Filter coffee', 60, 90], ['Mutton rogan josh', 480, 620],
  ],
  EUR: [
    ['Bacalhau à Brás', 14, 19], ['Polvo à lagareiro', 22, 28], ['Vinho verde, bottle', 16, 24], ['Sardinhas grelhadas', 12, 16],
    ['Pastel de nata', 1.3, 1.6], ['Caldo verde', 4.5, 6], ['Super Bock', 2.5, 3.5], ['Francesinha', 13, 16], ['Tapas plate', 7, 12], ['Sangria jug', 14, 20],
  ],
  USD: [
    ['Nasi goreng', 5, 8], ['Mie goreng', 5, 7], ['Babi guling', 7, 10], ['Bintang', 3, 4.5], ['Smoothie bowl', 6, 9], ['Sate lilit', 6, 8],
    ['Grilled snapper', 14, 22], ['Cocktail', 9, 14], ['Burger', 14, 19], ['Craft beer', 7, 10],
  ],
  THB: [
    ['Pad thai', 120, 220], ['Tom yum goong', 180, 320], ['Green curry', 160, 260], ['Mango sticky rice', 120, 180], ['Chang beer', 90, 140],
    ['Som tam', 90, 150], ['Massaman curry', 180, 280], ['Crab omelette', 900, 1200],
  ],
  JPY: [
    ['Tonkotsu ramen', 980, 1400], ['Gyoza', 450, 650], ['Highball', 450, 650], ['Sashimi platter', 2800, 4800], ['Yakitori set', 1600, 2400],
    ['Edamame', 380, 520], ['Draft Asahi', 550, 750], ['Okonomiyaki', 1200, 1600], ['Nigiri set', 3200, 5200],
  ],
  GBP: [
    ['Fish and chips', 16, 21], ['Sunday roast', 19, 26], ['Pint of IPA', 6.2, 7.5], ['Scotch egg', 6.5, 8], ['Sticky toffee pudding', 7.5, 9],
    ['Burger', 15, 19], ['Glass of red', 8, 11], ['Chicken ruby', 14, 17], ['Bacon naan roll', 9, 11],
  ],
}

const PAY_NOTES: Record<CurrencyCode, string[]> = {
  INR: ['UPI', 'GPay', 'PhonePe', 'Paytm', 'Cash', 'Bank transfer', ''],
  EUR: ['Revolut', 'Bank transfer', 'MB Way', 'Cash'],
  USD: ['Wise', 'Venmo', 'Cash'],
  GBP: ['Monzo', 'Bank transfer', 'Revolut'],
  JPY: ['Cash', 'Wise'],
  THB: ['Cash', 'PromptPay'],
}

const NOTES: Record<string, string[]> = {
  food: ['Great place, we should come back', 'Split the dessert too', 'Includes the tip', 'Birthday treat for the table', 'Kitchen closed early, ordered in'],
  transport: ['Surge pricing, sorry', 'Booked through MakeMyTrip', 'Window seats', 'Return trip included'],
  stay: ['Deposit refunded later', 'Two rooms, breakfast included', 'Booked on Airbnb', 'Includes the cleaning fee'],
  entertainment: ['Booked online', 'Front row!', 'Includes booking fee'],
  shopping: ['Receipt in the group chat', 'Returned one item later'],
  groceries: ['Weekly stock-up', 'Includes snacks for the weekend'],
  bills: ['Paid on the app', 'Late fee waived'],
  other: ['Paid in cash'],
}

/* -------------------------------------------------------------------------- */
/* The plan                                                                   */
/* -------------------------------------------------------------------------- */

export type DemoOp =
  | {kind: 'person'; at: number; actor: string; id: string; name: string; upiId: string | null}
  | {kind: 'group'; at: number; actor: string; id: string; input: Parameters<typeof createGroup>[2]}
  | {kind: 'expense'; at: number; actor: string; id: string; draft: ExpenseDraft}
  | {kind: 'expense.update'; at: number; actor: string; id: string; draft: ExpenseDraft}
  | {kind: 'expense.delete' | 'repayment.delete' | 'writeoff.delete'; at: number; actor: string; id: string}
  | {kind: 'repayment' | 'writeoff'; at: number; actor: string; id: string; input: RepaymentInput}

export type DemoPlan = {ops: DemoOp[]; counts: DemoCounts}
export type DemoCounts = {people: number; groups: number; expenses: number; repayments: number; writeOffs: number; deleted: number; edits: number}

const pad = (n: number) => String(n).padStart(2, '0')
const dateOf = (ms: number): LocalDate => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const msOf = (date: LocalDate) => Date.parse(`${date}T00:00:00Z`)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The device's local calendar day, for `today`. */
export function localToday(now = Date.now()): LocalDate {
  const d = new Date(now)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The whole dataset as an ordered list of writes. Pure: the same inputs give
 * the same plan. `today` anchors the year; `now` caps every write time.
 */
export function generateLargeDemo({me, today, now, seed = DEMO_LARGE_SEED}: {me: string; today: LocalDate; now: number; seed?: number}): DemoPlan {
  const rng = makeRng(seed)
  const T = msOf(today)
  const dayAgo = (n: number) => dateOf(T - n * DAY)
  const pid = (w: Who) => (w === 'me' ? me : `${DEMO_LARGE_PREFIX}p-${w}`)
  const gid = (key: string) => `${DEMO_LARGE_PREFIX}g-${key}`
  let seq = 0
  const nextId = (kind: 'e' | 'r' | 'w') => `${DEMO_LARGE_PREFIX}${kind}-${String(++seq).padStart(5, '0')}`
  /** A write time on `date` at about `hour` local (IST-ish), capped a few minutes before now. */
  const timeOn = (date: LocalDate, hour: number) => Math.min(msOf(date) + hour * HOUR - 330 * MINUTE + rng.int(0, 59) * MINUTE, now - rng.int(3, 90) * MINUTE)

  const ops: DemoOp[] = []
  const records: Array<{at: number; record: LedgerRecord}> = []
  const counts: DemoCounts = {people: 0, groups: 0, expenses: 0, repayments: 0, writeOffs: 0, deleted: 0, edits: 0}

  /* People, then groups: a year ago, a few minutes apart. */
  let clock = T - 372 * DAY + 19 * HOUR
  for (const [key, [name, upiId]] of Object.entries(FRIENDS)) {
    clock += rng.int(2, 40) * MINUTE
    ops.push({kind: 'person', at: clock, actor: me, id: pid(key as Friend), name, upiId})
    counts.people++
  }
  for (const g of GROUPS) {
    const start = g.span ? g.span[0] : 366
    const at = g.span ? T - (start + rng.int(40, 50)) * DAY + rng.int(18, 23) * HOUR : (clock += rng.int(1, 6) * HOUR)
    ops.push({
      kind: 'group',
      at,
      actor: me,
      id: gid(g.key),
      input: {
        name: g.name,
        kind: g.kind,
        currency: g.currency,
        startDate: g.span ? dayAgo(g.span[0]) : null,
        endDate: g.span ? dayAgo(g.span[0] - g.span[1] + 1) : null,
        memberIds: [me, ...g.members.map(pid)],
      },
    })
    counts.groups++
  }

  /* ----------------------------- money helpers ---------------------------- */

  /** A plausible amount between `lo` and `hi` major units, in minor units, rounded the way prices are. */
  const money = (currency: CurrencyCode, lo: number, hi: number): bigint => {
    const scale = getCurrency(currency).scale
    const major = lo + rng.next() * (hi - lo)
    if (scale === 0) return BigInt(Math.max(10, Math.round(major / 10) * 10))
    if (currency === 'INR' || currency === 'THB') {
      const step = major >= 2000 ? 10 : 1
      return BigInt(Math.max(1, Math.round(major / step) * step)) * 100n
    }
    // Cents (or fils, for 3-decimal currencies) in steps of ten.
    return BigInt(Math.max(10, Math.round((major * 10 ** scale) / 10) * 10))
  }
  const parseTpl = (tpl: Tpl) => {
    const [title, category, lo, hi, flag] = tpl.split('|') as [string, string, string, string, string?]
    return {title, category, lo: Number(lo), hi: Number(hi), itemised: !!flag?.includes('i'), rare: !!flag?.includes('r')}
  }
  /** A template from a list, the rare ones about a quarter as often. */
  const pickTpl = (tpl: Tpl[]): Tpl => {
    const t = rng.pick(tpl)
    return parseTpl(t).rare && rng.chance(0.75) ? rng.pick(tpl) : t
  }
  const weightsOf = (people: string[], lo: number, hi: number) => people.map(id => ({id, weight: BigInt(rng.int(lo, hi))}))

  /** An itemised bill for `people`, priced from the currency's menu, with that country's charges. */
  const bill = (currency: CurrencyCode, people: string[]): {total: bigint; split: SplitInput} => {
    const menu = MENUS[currency]!
    const items = rng.sample(menu, Math.min(menu.length, rng.int(3, 6))).map(([name, lo, hi], i) => {
      const qty = rng.int(1, Math.min(4, people.length + 1))
      const eaters = rng.chance(0.35) ? people : rng.sample(people, rng.int(1, Math.min(3, people.length)))
      // Portions ("2 of 3 beers") on some shared items.
      const participants = eaters.length > 1 && rng.chance(0.3) ? eaters.map(id => ({id, weight: rng.int(1, 3)})) : eaters
      return {id: `item-${i}`, name: qty > 1 ? `${name} ×${qty}` : name, amount: money(currency, lo, hi) * BigInt(qty), participants}
    })
    // Everyone at the table had something.
    const eaten = new Set(items.flatMap(it => it.participants.map(p => (typeof p === 'string' ? p : p.id))))
    const hungry = people.filter(p => !eaten.has(p))
    if (hungry.length) items.push({id: `item-${items.length}`, name: rng.pick(menu)[0], amount: money(currency, menu[0]![1], menu[0]![2]), participants: hungry})
    const subtotal = sumMinor(items.map(it => it.amount))
    const pct = (bp: number) => {
      const v = (subtotal * BigInt(bp) + 5000n) / 10000n
      return getCurrency(currency).scale === 0 ? v : (v / 10n) * 10n
    }
    const rates: Partial<Record<'tax' | 'tip' | 'service', number>> = {}
    let tax = 0n
    let tip = 0n
    let service = 0n
    let discount = 0n
    if (currency === 'INR') {
      rates.tax = 500
      tax = pct(500)
      if (rng.chance(0.4)) service = pct((rates.service = 1000))
      if (rng.chance(0.2)) discount = BigInt(rng.pick([100, 150, 200, 250])) * 100n
    } else if (currency === 'USD') {
      tax = pct((rates.tax = 1000))
      service = pct((rates.service = 1100))
    } else if (currency === 'THB' && rng.chance(0.5)) {
      service = pct((rates.service = 1000))
      tax = pct((rates.tax = 700))
    } else if (currency === 'GBP' && rng.chance(0.7)) {
      service = pct((rates.service = 1250))
    } else if (currency === 'EUR' && rng.chance(0.4)) {
      tip = pct((rates.tip = rng.pick([500, 1000])))
    }
    return {total: subtotal + tax + tip + service - discount, split: {mode: 'items', items, tax, tip, service, discount, rates}}
  }

  /** A split of `total` over `people` in a mode picked the way people actually split. */
  const splitFor = (total: bigint, people: string[]): SplitInput => {
    const r = rng.next()
    if (people.length < 2 || r < 0.6) return {mode: 'equal', participants: people}
    if (r < 0.7) {
      // Exact amounts: who had what, to the minor unit.
      return {mode: 'exact', amounts: allocate(total, weightsOf(people, 2, 6))}
    }
    if (r < 0.77) {
      const bp = allocate(10000n, weightsOf(people, 1, 4))
      return {mode: 'percent', basisPoints: Object.fromEntries(Object.entries(bp).map(([k, v]) => [k, Number(v)]))}
    }
    if (r < 0.88) return {mode: 'shares', shares: Object.fromEntries(people.map(p => [p, rng.int(1, 3)]))}
    // Equal, with one or two people adding a bit ("I had the extra drink").
    const extra = rng.sample(people, rng.int(1, Math.min(2, people.length)))
    const step = total / BigInt(people.length * 4)
    return {mode: 'adjusted', participants: people, adjustments: Object.fromEntries(extra.map(p => [p, step > 0n ? (step / 10n) * 10n : 0n]))}
  }

  /** One or two payers; "me" pays more often, as the owner of the phone. */
  const payersFor = (total: bigint, pool: string[]): Record<string, bigint> => {
    const first = rng.chance(0.38) && pool.includes(me) ? me : rng.pick(pool)
    if (pool.length < 2 || !rng.chance(0.1)) return {[first]: total}
    const second = rng.pick(pool.filter(p => p !== first))
    const part = (total * BigInt(rng.int(30, 70))) / 100n
    return {[first]: total - part, [second]: part}
  }

  const notesFor = (category: string) => (rng.chance(0.14) ? rng.pick(NOTES[category] ?? NOTES.other!) : '')

  /** Records one expense (and sometimes a later fix to its amount). */
  const addExpense = (e: {title: string; category: string; groupId: string | null; currency: CurrencyCode; tz: string; date: LocalDate; total: bigint; split: SplitInput; payers: Record<string, bigint>; notes?: string; hour?: number}) => {
    const shares = computeShares(e.total, e.split)
    validateExpense({total: e.total, payers: e.payers, shares})
    const draft: ExpenseDraft = {
      title: e.title,
      groupId: e.groupId,
      currency: e.currency,
      total: e.total,
      payers: e.payers,
      split: e.split,
      date: e.date,
      tz: e.tz,
      category: e.category,
      notes: e.notes ?? notesFor(e.category),
    }
    const lag = rng.chance(0.25) ? rng.int(1, 2) * DAY : 0
    const at = Math.min(timeOn(e.date, e.hour ?? rng.int(9, 22)) + lag, now - rng.int(3, 60) * MINUTE)
    const actor = Object.entries(e.payers).sort(([, x], [, y]) => (x > y ? -1 : x < y ? 1 : 0))[0]![0]
    const id = nextId('e')
    // A typo in the amount, fixed a little later (shows as an edit in Activity).
    const payers = Object.keys(e.payers)
    if (e.split.mode === 'equal' && payers.length === 1 && rng.chance(0.012)) {
      const wrong = e.total * 10n
      ops.push({kind: 'expense', at, actor, id, draft: {...draft, total: wrong, payers: {[payers[0]!]: wrong}}})
      ops.push({kind: 'expense.update', at: Math.min(at + rng.int(5, 600) * MINUTE, now - MINUTE), actor, id, draft})
      counts.edits++
    } else {
      ops.push({kind: 'expense', at, actor, id, draft})
    }
    records.push({at, record: {kind: 'expense', id, groupId: e.groupId, currency: e.currency, total: e.total, payers: e.payers, shares, date: e.date, deleted: false}})
    counts.expenses++
  }

  /** A typical group expense from a template: who was there, who paid, how it was split. */
  const fromTpl = (g: Ctx, tpl: Tpl, date: LocalDate, currency = g.currency, opts: {everyone?: boolean; tz?: string; notes?: string; rate?: number} = {}) => {
    const t = parseTpl(tpl)
    // Paid in another currency than the template's (a card charged in rupees): same spend, other units, no bill.
    if (opts.rate) Object.assign(t, {lo: t.lo * opts.rate, hi: t.hi * opts.rate, itemised: false})
    const all = [me, ...g.members.map(pid)]
    const people = opts.everyone || rng.chance(0.55) ? all : rng.sample(all, rng.int(Math.min(2, all.length), all.length))
    if (!people.includes(me) && rng.chance(0.75)) people.unshift(me)
    let total: bigint
    let split: SplitInput
    if (t.itemised && rng.chance(0.55) && people.length >= 2) ({total, split} = bill(currency, people))
    else {
      total = money(currency, t.lo, t.hi)
      split = splitFor(total, people)
    }
    addExpense({title: t.title, category: t.category, groupId: gid(g.key), currency, tz: opts.tz ?? g.tz, date, total, split, payers: payersFor(total, all), notes: opts.notes})
  }

  /* ------------------------------ trips ----------------------------------- */

  for (const g of GROUPS) {
    if (!g.span) continue
    const [startAgo, days] = g.span
    if (g.key === 'wedding') {
      for (let i = 0; i < 26; i++) fromTpl(g, rng.pick(WEDDING), dayAgo(startAgo + rng.int(-days + 1, 20)), 'INR')
      // The hotel: shares by nights stayed.
      const all = [me, ...g.members.map(pid)]
      const hotel = money('INR', 42000, 68000)
      addExpense({title: 'Hotel in Udaipur', category: 'stay', groupId: gid(g.key), currency: 'INR', tz: g.tz, date: dayAgo(startAgo), total: hotel, split: {mode: 'shares', shares: Object.fromEntries(all.map(p => [p, rng.int(2, 4)]))}, payers: {[me]: hotel}, notes: 'Shares are nights stayed'})
      continue
    }
    const tpl = TRIP_TPL[g.key]!
    const all = [me, ...g.members.map(pid)]
    // Flights (or the car) are booked weeks ahead, in rupees, by me: exact fares for everyone flying from India (not the locals).
    const flyers = [me, ...g.members.filter(m => INDIAN.includes(m)).map(pid)]
    const fares = flyers.map(p => [p, money('INR', parseTpl(tpl.flights).lo / all.length, parseTpl(tpl.flights).hi / all.length)] as const)
    const fareTotal = sumMinor(fares.map(([, v]) => v))
    addExpense({title: parseTpl(tpl.flights).title, category: 'transport', groupId: gid(g.key), currency: 'INR', tz: 'Asia/Kolkata', date: dayAgo(startAgo + rng.int(20, 35)), total: fareTotal, split: {mode: 'exact', amounts: Object.fromEntries(fares)}, payers: {[me]: fareTotal}, notes: 'Booked early, fares as quoted'})
    tpl.stay.forEach((s, i) =>
      fromTpl(g, s, dayAgo(startAgo - i * Math.floor(days / 2)), tpl.stayCurrency ?? g.currency, {
        everyone: true,
        notes: tpl.stayCurrency ? 'Booked online, charged in US dollars' : undefined,
      }),
    )
    for (let d = 0; d < days; d++) {
      const date = dayAgo(startAgo - d)
      const inBangkok = g.key === 'bali' && d >= days - 3
      const n = rng.int(6, 10)
      for (let i = 0; i < n; i++) {
        if (inBangkok) fromTpl(g, rng.pick(BANGKOK), date, 'THB', {tz: 'Asia/Bangkok'})
        else if (g.currency !== 'INR' && rng.chance(0.12)) fromTpl(g, rng.pick(tpl.daily), date, 'INR', {rate: CARD_INR[g.currency], notes: 'Paid by card in rupees'})
        else fromTpl(g, rng.pick(tpl.daily), date)
      }
    }
  }

  /* --------------------------- ongoing groups ----------------------------- */

  const ongoing = (key: string) => GROUPS.find(g => g.key === key)!
  const flat = ongoing('flat')
  const family = ongoing('family')
  const football = ongoing('football')
  const bookclub = ongoing('bookclub')
  for (let ago = 362; ago >= 0; ago--) {
    const date = dayAgo(ago)
    const dom = Number(date.slice(8))
    const month = MONTHS[Number(date.slice(5, 7)) - 1]!
    const weekday = new Date(msOf(date)).getUTCDay()

    // Flat 4B: rent by room size (exact), utilities and help, every month.
    if (dom === 1) {
      const rent = {[me]: 2400000n, [pid('aanya')]: 1900000n, [pid('vihaan')]: 1900000n}
      addExpense({title: `Rent, ${month}`, category: 'stay', groupId: gid('flat'), currency: 'INR', tz: flat.tz, date, total: 6200000n, split: {mode: 'exact', amounts: rent}, payers: {[me]: 6200000n}, notes: 'Master bedroom pays more', hour: 10})
      addExpense({title: `Maid, ${month}`, category: 'bills', groupId: gid('flat'), currency: 'INR', tz: flat.tz, date, total: 450000n, split: {mode: 'equal', participants: [me, pid('aanya'), pid('vihaan')]}, payers: {[pid('aanya')]: 450000n}, hour: 11})
    }
    if (dom === 8) {
      const summer = ['April', 'May', 'June'].includes(month)
      const bill = money('INR', summer ? 4200 : 2200, summer ? 6800 : 3800)
      addExpense({title: `Electricity, ${month}`, category: 'bills', groupId: gid('flat'), currency: 'INR', tz: flat.tz, date, total: bill, split: {mode: 'equal', participants: [me, pid('aanya'), pid('vihaan')]}, payers: {[pid('vihaan')]: bill}, notes: summer ? 'AC season' : ''})
    }
    if (dom === 12) addExpense({title: 'ACT Fibernet', category: 'bills', groupId: gid('flat'), currency: 'INR', tz: flat.tz, date, total: 117900n, split: {mode: 'equal', participants: [me, pid('aanya'), pid('vihaan')]}, payers: {[me]: 117900n}})
    if (ago % 45 === 7) addExpense({title: 'Cooking gas cylinder', category: 'bills', groupId: gid('flat'), currency: 'INR', tz: flat.tz, date, total: 90300n, split: {mode: 'equal', participants: [me, pid('aanya'), pid('vihaan')]}, payers: {[rng.pick([me, pid('aanya'), pid('vihaan')])]: 90300n}})
    // A shared subscription billed in dollars, since the spring.
    if (dom === 18 && ago <= 180) addExpense({title: 'ChatGPT Plus', category: 'bills', groupId: gid('flat'), currency: 'USD', tz: flat.tz, date, total: 2000n, split: {mode: 'equal', participants: [me, pid('aanya'), pid('vihaan')]}, payers: {[me]: 2000n}, notes: 'One account for the flat, billed in USD'})
    if (rng.chance(EVERYDAY.flat!.p)) fromTpl(flat, pickTpl(EVERYDAY.flat!.tpl), date)

    // Office lunch on weekdays, and the team's Notion plan (in dollars) for the last few months.
    if (dom === 3 && ago <= 150) {
      const office = [me, ...ongoing('office').members.map(pid)]
      addExpense({title: 'Notion team plan', category: 'bills', groupId: gid('office'), currency: 'USD', tz: 'Asia/Kolkata', date, total: 8000n, split: {mode: 'equal', participants: office}, payers: {[pid('vikram')]: 8000n}})
    }
    if (weekday >= 1 && weekday <= 5 && rng.chance(EVERYDAY.office!.p)) fromTpl(ongoing('office'), pickTpl(EVERYDAY.office!.tpl), date)

    // Family: the shared iCloud plan monthly, and the rest of life.
    if (dom === 15) addExpense({title: 'iCloud+ 2 TB', category: 'bills', groupId: gid('family'), currency: 'INR', tz: family.tz, date, total: 74900n, split: {mode: 'equal', participants: [me, pid('mom'), pid('dad'), pid('ananya')]}, payers: {[me]: 74900n}})
    if (rng.chance(EVERYDAY.family!.p)) fromTpl(family, pickTpl(EVERYDAY.family!.tpl), date)

    // Sunday football: the turf, split by who turned up.
    if (weekday === 0 && rng.chance(0.85)) {
      const all = [me, ...football.members.map(pid)]
      const came = rng.sample(all, rng.int(6, all.length))
      const turf = money('INR', 3000, 4800)
      addExpense({title: 'Turf booking', category: 'entertainment', groupId: gid('football'), currency: 'INR', tz: football.tz, date, total: turf, split: {mode: 'equal', participants: came}, payers: {[rng.pick(came)]: turf}, hour: 7})
    }
    if (rng.chance(EVERYDAY.football!.p)) fromTpl(football, pickTpl(EVERYDAY.football!.tpl), date)

    // Book club: the monthly meet-up at a cafe, and the books.
    if (weekday === 6 && dom <= 7) {
      const people = [me, ...bookclub.members.map(pid)]
      const {total, split} = bill('INR', rng.sample(people, rng.int(4, people.length)))
      addExpense({title: 'Book club at Blue Tokai', category: 'food', groupId: gid('bookclub'), currency: 'INR', tz: bookclub.tz, date, total, split, payers: payersFor(total, people), hour: 17})
      const books = Object.fromEntries(people.map(p => [p, money('INR', 299, 799)]))
      const sum = sumMinor(Object.values(books))
      addExpense({title: 'Books order', category: 'shopping', groupId: gid('bookclub'), currency: 'INR', tz: bookclub.tz, date: dayAgo(ago + 6), total: sum, split: {mode: 'exact', amounts: books}, payers: {[pid('tanvi')]: sum}, notes: 'Everyone’s copy of next month’s pick'})
    }
    if (rng.chance(EVERYDAY.bookclub!.p)) fromTpl(bookclub, pickTpl(EVERYDAY.bookclub!.tpl), date)

    // Direct: subscriptions I pay for friends, and everyday one-to-one spends.
    if (dom === 5) addExpense({title: 'Netflix Premium', category: 'entertainment', groupId: null, currency: 'INR', tz: 'Asia/Kolkata', date, total: 64900n, split: {mode: 'equal', participants: [me, pid('aanya'), pid('vihaan'), pid('kabir')]}, payers: {[me]: 64900n}})
    if (dom === 20) addExpense({title: 'Spotify Family', category: 'entertainment', groupId: null, currency: 'INR', tz: 'Asia/Kolkata', date, total: 17900n, split: {mode: 'equal', participants: [me, pid('neha'), pid('ishaan')]}, payers: {[me]: 17900n}})
    const directToday = rng.chance(0.75) ? rng.int(1, 2) : 0
    for (let i = 0; i < directToday; i++) {
      const t = parseTpl(pickTpl(DIRECT))
      const friend = pid(rng.pick(INDIAN))
      const people = [me, friend]
      let total: bigint
      let split: SplitInput
      if (t.itemised && rng.chance(0.4)) ({total, split} = bill('INR', people))
      else {
        total = money('INR', t.lo, t.hi)
        split = rng.chance(0.85) ? {mode: 'equal', participants: people} : splitFor(total, people)
      }
      const payer = rng.chance(0.55) ? me : friend
      addExpense({title: t.title, category: t.category, groupId: null, currency: 'INR', tz: 'Asia/Kolkata', date, total, split, payers: {[payer]: total}})
    }
  }

  // A week abroad with a friend who lives there, each a few months apart.
  ABROAD.forEach((a, i) => {
    const start = 330 - i * 70 - rng.int(0, 20)
    for (let n = 0; n < 9; n++) {
      const t = parseTpl(rng.pick(a.tpl))
      const people = [me, pid(a.who)]
      let total: bigint
      let split: SplitInput
      if (t.itemised && rng.chance(0.5)) ({total, split} = bill(a.currency, people))
      else {
        total = money(a.currency, t.lo, t.hi)
        split = {mode: 'equal', participants: people}
      }
      const tz = {USD: 'America/New_York', EUR: 'Europe/Madrid', GBP: 'Europe/London', JPY: 'Asia/Tokyo'}[a.currency]!
      addExpense({title: t.title, category: t.category, groupId: null, currency: a.currency, tz, date: dayAgo(start - rng.int(0, 6)), total, split, payers: payersFor(total, people)})
    }
  })

  /*
   * The last two weeks, one to one in other currencies: friends abroad visiting
   * India, and things bought online or on trips. With the INR and group
   * balances still open, most friends end up owing (or owed) in 2-3 currencies.
   */
  const RECENT: Array<[Friend, CurrencyCode, string, string, number, number, string]> = [
    ['kabir', 'USD', 'Steam summer sale bundle', 'entertainment', 30, 60, 'Asia/Kolkata'],
    ['neha', 'EUR', 'Paris Airbnb deposit', 'stay', 180, 260, 'Europe/Paris'],
    ['aditya', 'USD', 'AWS bill for the side project', 'bills', 25, 70, 'Asia/Kolkata'],
    ['rohan', 'EUR', 'Wine from Lisbon duty-free', 'shopping', 40, 90, 'Europe/Lisbon'],
    ['meera', 'USD', 'Kindle books', 'shopping', 15, 40, 'Asia/Kolkata'],
    ['ishaan', 'USD', 'Figma licence', 'bills', 45, 45, 'Asia/Kolkata'],
    ['tanvi', 'GBP', 'Books from Blackwell’s', 'shopping', 30, 70, 'Europe/London'],
    ['zara', 'GBP', 'Theatre tickets for December', 'entertainment', 90, 160, 'Europe/London'],
    ['faisal', 'BHD', 'Dinner in Manama', 'food', 18, 42, 'Asia/Bahrain'],
    ['faisal', 'BHD', 'Souq shopping', 'shopping', 9, 30, 'Asia/Bahrain'],
    ['karan', 'USD', 'Concert tickets in Dubai', 'entertainment', 120, 220, 'Asia/Dubai'],
    ['kenji', 'INR', 'Dinner in Bandra', 'food', 2400, 4800, 'Asia/Kolkata'],
    ['maya', 'INR', 'Old Delhi food walk', 'food', 1800, 3600, 'Asia/Kolkata'],
    ['oliver', 'INR', 'Cricket at Wankhede', 'entertainment', 3000, 6000, 'Asia/Kolkata'],
    ['mateo', 'INR', 'Taj Mahal tickets', 'entertainment', 2200, 2600, 'Asia/Kolkata'],
    ['sneha', 'JPY', 'Matcha from Kyoto', 'groceries', 4000, 9000, 'Asia/Tokyo'],
  ]
  for (const [who, currency, title, category, lo, hi, tz] of RECENT) {
    const total = money(currency, lo, hi)
    const people = [me, pid(who)]
    addExpense({title, category, groupId: null, currency, tz, date: dayAgo(rng.int(1, 12)), total, split: {mode: 'equal', participants: people}, payers: {[rng.chance(0.6) ? me : pid(who)]: total}})
  }

  /* ------------------------- settling up ---------------------------------- */

  records.sort((x, y) => x.at - y.at)
  type Settle = {at: number; date: LocalDate; groupId: string | null; tz: string; fraction: number; only?: (t: {from: string; to: string; currency: CurrencyCode}) => boolean}
  const settles: Settle[] = []
  const on = (ago: number, groupId: string | null, tz: string, fraction: number) => {
    if (ago < 1) return
    const date = dayAgo(ago)
    settles.push({at: timeOn(date, rng.int(19, 23)), date, groupId, tz, fraction})
  }
  for (const g of GROUPS) {
    if (g.span) {
      const endAgo = g.span[0] - g.span[1]
      // Older trips settle in full; the latest one only partly so far.
      on(endAgo - rng.int(3, 9), gid(g.key), g.tz, endAgo < 40 ? 0.45 : 1)
      continue
    }
    const every = g.key === 'family' ? 95 : g.key === 'bookclub' ? 60 : 30
    for (let ago = 362 - rng.int(25, 35); ago > 18; ago -= every + rng.int(-3, 3)) on(ago, gid(g.key), g.tz, g.key === 'family' ? 0.6 : 0.9)
  }
  for (let ago = 300; ago > 14; ago -= rng.int(40, 55)) on(ago, null, 'Asia/Kolkata', 0.75)
  // Maya squares up her dollars in full; her rupees from the Delhi visit stay open.
  on(13, null, 'America/New_York', 1)
  settles.at(-1)!.only = t => t.currency === 'USD' && (t.from === pid('maya') || t.to === pid('maya'))
  settles.sort((x, y) => x.at - y.at)

  const ledger: LedgerRecord[] = []
  let cursor = 0
  for (const s of settles) {
    while (cursor < records.length && records[cursor]!.at < s.at) ledger.push(records[cursor++]!.record)
    let transfers: Array<{from: string; to: string; amount: bigint; currency: CurrencyCode}>
    if (s.groupId) {
      transfers = Object.entries(groupNet(ledger, s.groupId)).flatMap(([currency, net]) => {
        const plan = planSettlement(net, {allowListOnly: false, edges: {}}, 'direct')
        return plan.status === 'ok' ? plan.transfers.map(t => ({...t, currency})) : []
      })
    } else {
      transfers = pairwiseBalances(ledger.filter(r => r.groupId === null), me).map(row =>
        row.amount > 0n ? {from: row.person, to: me, amount: row.amount, currency: row.currency} : {from: me, to: row.person, amount: -row.amount, currency: row.currency},
      )
    }
    const record = (kind: 'repayment' | 'writeoff', t: (typeof transfers)[number], amount: bigint) => {
      const id = nextId(kind === 'writeoff' ? 'w' : 'r')
      const at = s.at + rng.int(0, 180) * MINUTE
      const input: RepaymentInput = {
        id,
        groupId: s.groupId,
        currency: t.currency,
        from: t.from,
        to: t.to,
        amount,
        date: s.date,
        tz: s.tz,
        note: kind === 'writeoff' ? rng.pick(['Call it even', 'Rounding off', 'Don’t worry about it', '']) : rng.pick(PAY_NOTES[t.currency] ?? ['']),
      }
      // A payment is recorded by whoever received it; a write-off by whoever forgave it.
      ops.push({kind, at, actor: t.to, id, input})
      ledger.push({kind, id, groupId: s.groupId, currency: t.currency, from: t.from, to: t.to, amount, date: s.date, deleted: false})
      if (kind === 'writeoff') counts.writeOffs++
      else counts.repayments++
    }
    for (const t of transfers) {
      if (s.only && !s.only(t)) continue
      if (!rng.chance(s.fraction)) continue
      const unit = 10n ** BigInt(getCurrency(t.currency).scale)
      const small = t.amount < unit * (t.currency === 'INR' || t.currency === 'THB' || t.currency === 'JPY' ? 300n : 6n)
      // The odd bit of a bigger debt let go: pay a round amount, call the rest even.
      const odd = t.amount % (unit * (t.currency === 'JPY' ? 1000n : t.currency === 'INR' || t.currency === 'THB' ? 100n : 10n))
      if (small && rng.chance(0.55)) record('writeoff', t, t.amount)
      else if (odd > 0n && odd < t.amount && rng.chance(0.15)) {
        record('repayment', t, t.amount - odd)
        record('writeoff', t, odd)
      } else record('repayment', t, t.amount)
    }
  }

  /* --------------------- Recently deleted (the bin) ----------------------- */

  // Expenses added twice by mistake in the last few weeks, then deleted.
  const recent = records.filter(r => r.record.kind === 'expense' && r.at > now - 25 * DAY && r.at < now - 2 * HOUR)
  for (const r of rng.sample(recent, Math.min(16, recent.length))) {
    const src = ops.find((o): o is Extract<DemoOp, {kind: 'expense'}> => o.kind === 'expense' && o.id === r.record.id)!
    const id = nextId('e')
    const at = r.at + rng.int(1, 20) * MINUTE
    ops.push({kind: 'expense', at, actor: src.actor, id, draft: src.draft})
    ops.push({kind: 'expense.delete', at: Math.min(at + rng.int(10, 600) * MINUTE, now - MINUTE), actor: src.actor, id})
    counts.deleted++
  }
  // Payments recorded twice, and a write-off taken back.
  const lastPays = ops.filter((o): o is Extract<DemoOp, {kind: 'repayment' | 'writeoff'}> => (o.kind === 'repayment' || o.kind === 'writeoff') && o.at < now - DAY).slice(-12)
  for (const src of rng.sample(lastPays, Math.min(4, lastPays.length))) {
    const id = nextId(src.kind === 'writeoff' ? 'w' : 'r')
    const at = Math.max(src.at, now - 20 * DAY) + rng.int(1, 30) * MINUTE
    ops.push({kind: src.kind, at, actor: src.actor, id, input: {...src.input, id}})
    ops.push({kind: src.kind === 'writeoff' ? 'writeoff.delete' : 'repayment.delete', at: Math.min(at + rng.int(30, 900) * MINUTE, now - MINUTE), actor: src.actor, id})
    counts.deleted++
  }

  // Stable time order: people and groups first (they come first in the list and in time).
  const order = new Map(ops.map((o, i) => [o, i]))
  ops.sort((x, y) => x.at - y.at || order.get(x)! - order.get(y)!)
  return {ops, counts}
}

/** For tests: the plan's expenses as ledger records, as the app would read them back. */
export function planRecords(plan: DemoPlan): ExpenseRecord[] {
  const live = new Map<string, ExpenseDraft>()
  for (const op of plan.ops) {
    if (op.kind === 'expense' || op.kind === 'expense.update') live.set(op.id, op.draft)
    else if (op.kind === 'expense.delete') live.delete(op.id)
  }
  return [...live].map(([id, d]) => ({kind: 'expense', id, groupId: d.groupId, currency: d.currency, total: d.total, payers: d.payers, shares: computeShares(d.total, d.split), date: d.date, deleted: false}))
}


/** A store whose transactions run inside `tx`: the real mutations then batch into one commit. */
export function insideTransaction(store: Store, tx: Tx): Store {
  return {...store, transaction: fn => fn(tx)}
}

/**
 * Applies one write of the plan through the real mutations, as its actor at
 * its time. A create that mints its id asks for it first (the plan's id);
 * every other id asked for is an outbox op id.
 */
export async function applyDemoOp(store: Store, base: MutationCtx, op: DemoOp): Promise<void> {
  let pending: string | undefined = op.kind === 'person' || op.kind === 'group' || op.kind === 'expense' ? op.id : undefined
  const ctx: MutationCtx = {
    ...base,
    actor: op.actor,
    now: () => op.at,
    newId: () => {
      const id = pending ?? base.newId()
      pending = undefined
      return id
    },
  }
  const check = (e: {id: string}) => {
    if (e.id !== op.id) throw new Error(`demo id mismatch: ${e.id} != ${op.id}`)
  }
  switch (op.kind) {
    case 'person':
      return check(await createPerson(store, ctx, {name: op.name, upiId: op.upiId}))
    case 'group':
      return check(await createGroup(store, ctx, op.input))
    case 'expense':
      return check(await createExpense(store, ctx, op.draft))
    case 'expense.update':
      return void (await updateExpense(store, ctx, op.id, op.draft))
    case 'expense.delete':
      return deleteExpense(store, ctx, op.id)
    case 'repayment':
      return void (await createRepayments(store, ctx, [op.input]))
    case 'writeoff':
      return void (await createWriteOffs(store, ctx, [op.input]))
    case 'repayment.delete':
      return deleteRepayment(store, ctx, op.id)
    case 'writeoff.delete':
      return deleteWriteOff(store, ctx, op.id)
  }
}
