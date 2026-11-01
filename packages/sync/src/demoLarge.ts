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

import {merchantSetupOf} from './bill'
import {type CommentInput, createComment, deleteComment, editComment} from './comments'
import {type DisputeInput, type HoldInput, acceptDispute, holdRecord, raiseDispute, rejectDispute, releaseHold, reopenDispute, withdrawDispute} from './disputes'
import {removeFriend} from './friends'
import {deleteGroup, makeGroupInactive, type MemberExitInput, removeGroupMember, setGroupHidden} from './groupLifecycle'
import {
  createExpense,
  createGroup,
  createPerson,
  createRepayments,
  createWriteOffs,
  deleteExpense,
  deletePerson,
  deleteRepayment,
  deleteWriteOff,
  type ExpenseDraft,
  type Group,
  type RepaymentInput,
  restoreExpense,
  setItemHidden,
  updateExpense,
} from './mutations'
import {setPref} from './preferences'
import {recordNudge, scheduleReminder} from './reminders'
import {type Store} from './store'
import {type MutationCtx} from './types'

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
  /* The friends of the Wave B story (below): a deleted and a removed friend, a settled one, people who left a group. */
  raj: ['Raj Khanna', null],
  deepa: ['Deepa Nambiar', null],
  anil: ['Anil Joshi', null],
  bhavna: ['Bhavna Shah', null],
  chirag: ['Chirag Modi', null],
  chloe: ['Chloé Martin', null],
  ravi: ['Ravi Teja', null],
  tara: ['Tara Bose', null],
  /* The six friends of the curated story (below): the e2e specs, screenshots and the first-run tour lean on them. */
  riya: ['Riya Sharma', null],
  arjun: ['Arjun Mehta', null],
  priya: ['Priya Nair', null],
  sam: ['Sam Carter', null],
  lena: ['Lena Fischer', null],
  diego: ['Diego Alves', null],
} as const satisfies Record<string, readonly [string, string | null]>

type Friend = keyof typeof FRIENDS
type Who = Friend | 'me'

const WAVE_B_FRIENDS: Friend[] = ['raj', 'deepa', 'anil', 'bhavna', 'chirag', 'chloe', 'ravi', 'tara']

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
  /** A trip's place (owner 182). */
  location?: string
}

const GROUPS: Ctx[] = [
  {key: 'goa', name: 'Goa getaway', kind: 'trip', location: 'Goa', currency: 'INR', tz: 'Asia/Kolkata', members: ['kabir', 'neha', 'rohan', 'meera', 'ishaan', 'tanvi'], span: [300, 6]},
  {key: 'lisbon', name: 'Lisbon & Sintra', kind: 'trip', location: 'Lisbon & Sintra', currency: 'EUR', tz: 'Europe/Lisbon', members: ['ines', 'mateo', 'zara', 'aditya'], span: [205, 6]},
  {key: 'bali', name: 'Bali & Bangkok', kind: 'trip', location: 'Bali & Bangkok', currency: 'USD', tz: 'Asia/Makassar', members: ['aanya', 'kabir', 'zara', 'aditya'], span: [152, 9]},
  {key: 'wedding', name: 'Rohan & Meera’s wedding', kind: 'other', currency: 'INR', tz: 'Asia/Kolkata', members: ['rohan', 'meera', 'karan', 'neha', 'ishaan', 'tanvi', 'kabir'], span: [118, 4]},
  {key: 'tokyo', name: 'Tokyo', kind: 'trip', location: 'Tokyo', currency: 'JPY', tz: 'Asia/Tokyo', members: ['kenji', 'yuki', 'vihaan', 'sneha', 'rahul'], span: [84, 8]},
  {key: 'roadtrip', name: 'Coorg road trip', kind: 'trip', location: 'Coorg', currency: 'INR', tz: 'Asia/Kolkata', members: ['kabir', 'zara', 'neha', 'ishaan'], span: [48, 5]},
  {key: 'london', name: 'London', kind: 'trip', location: 'London', currency: 'GBP', tz: 'Europe/London', members: ['oliver', 'emma', 'aanya', 'vihaan'], span: [24, 6]},
  {key: 'flat', name: 'Koramangala flat', kind: 'home', currency: 'INR', tz: 'Asia/Kolkata', members: ['aanya', 'vihaan']},
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
/* The curated story                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Three small groups and six friends with fixed, hand-checked numbers (ARCHITECTURE 26.1: the one demo set
 * folds in what the old small set held). They stand beside the year of generated use, share none of its
 * groups or people (so each friend's balance is exactly what is written here), and are never settled up.
 * Their dates are fixed (the e2e specs search and read them), so over time they age like any old trip.
 */

type CuratedGroup = 'goa' | 'flat' | 'lisbon'
type CuratedFriend = 'riya' | 'arjun' | 'priya' | 'sam' | 'lena' | 'diego'
type CuratedWho = CuratedFriend | 'me'
const STORY_FRIENDS: readonly CuratedFriend[] = ['riya', 'arjun', 'priya', 'sam', 'lena', 'diego']

const CURATED_GROUPS: Record<CuratedGroup, {name: string; kind: Group['kind']; location?: string; currency: CurrencyCode; start: string | null; end: string | null; tz: string; members: CuratedFriend[]}> = {
  goa: {name: 'Goa trip', kind: 'trip', location: 'Goa', currency: 'INR', start: '2025-12-20', end: '2025-12-27', tz: 'Asia/Kolkata', members: ['riya', 'arjun', 'priya', 'sam']},
  flat: {name: 'Flat 4B', kind: 'home', currency: 'INR', start: null, end: null, tz: 'Asia/Kolkata', members: ['riya', 'arjun']},
  lisbon: {name: 'Lisbon', kind: 'trip', location: 'Lisbon', currency: 'EUR', start: '2026-04-10', end: '2026-04-15', tz: 'Europe/Lisbon', members: ['sam', 'lena', 'diego']},
}

type CuratedBill = {
  items: Array<{name: string; amount: bigint; people: Array<CuratedWho | [CuratedWho, number]>}>
  tax: bigint
  tip: bigint
  service: bigint
  discount: bigint
}
type CuratedExpense = {
  title: string
  group: CuratedGroup | null
  currency: CurrencyCode
  total: bigint
  payers: Partial<Record<CuratedWho, bigint>>
  participants: CuratedWho[]
  /** Itemised instead of equal (`participants` then lists everyone on the bill). */
  bill?: CuratedBill
  date: string
  category: string
  notes?: string
}

const GOA: CuratedWho[] = ['me', 'riya', 'arjun', 'priya', 'sam']
const FLAT: CuratedWho[] = ['me', 'riya', 'arjun']
const LISBON: CuratedWho[] = ['me', 'sam', 'lena', 'diego']

/** Every split divides exactly, so balances never depend on the id-ordered tie-break for remainders. */
const CURATED_EXPENSES: CuratedExpense[] = [
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
  // Priced in another currency than the group's own (26.13): Sam bought gear abroad.
  {title: 'Snorkel gear', group: 'goa', currency: 'USD', total: 10000n, payers: {sam: 10000n}, participants: GOA, date: '2025-12-22', category: 'shopping'},
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
  {title: 'Fado night', group: 'lisbon', currency: 'EUR', total: 16000n, payers: {sam: 10000n, me: 6000n}, participants: LISBON, date: '2026-04-12', category: 'entertainment', notes: 'Dinner and a show in Alfama'},
  {title: 'Seafood at Ramiro', group: 'lisbon', currency: 'EUR', total: 18400n, payers: {me: 18400n}, participants: LISBON, date: '2026-04-13', category: 'food', notes: 'Farewell dinner, Sam picked the wine'},
  // A flight booked from India: Lisbon holds rupees and euros side by side.
  {title: 'Flights from Delhi', group: 'lisbon', currency: 'INR', total: 8400000n, payers: {me: 8400000n}, participants: LISBON, date: '2026-04-02', category: 'transport'},
  // Direct (no group)
  {title: 'Concert tickets', group: null, currency: 'INR', total: 500000n, payers: {me: 500000n}, participants: ['me', 'priya'], date: '2026-03-08', category: 'entertainment'},
  {title: 'Coffee beans', group: null, currency: 'EUR', total: 1800n, payers: {sam: 1800n}, participants: ['me', 'sam'], date: '2026-05-02', category: 'groceries'},
  // One friend, a second currency each: Riya in euros, Priya in dollars.
  {title: 'Duty-free chocolate', group: null, currency: 'EUR', total: 4000n, payers: {riya: 4000n}, participants: ['me', 'riya'], date: '2026-04-16', category: 'shopping'},
  {title: 'Online course', group: null, currency: 'USD', total: 3000n, payers: {priya: 3000n}, participants: ['me', 'priya'], date: '2026-05-20', category: 'other'},
  // Zero- and three-decimal currencies: yen has no minor unit, dinar has three.
  {title: 'Ramen in Shibuya', group: null, currency: 'JPY', total: 4200n, payers: {me: 4200n}, participants: ['me', 'arjun'], date: '2026-03-20', category: 'food'},
  {title: 'Layover duty-free', group: null, currency: 'BHD', total: 12500n, payers: {diego: 12500n}, participants: ['me', 'diego'], date: '2026-04-09', category: 'shopping'},
  {title: 'Taxi in Kuwait City', group: null, currency: 'KWD', total: 4800n, payers: {me: 4800n}, participants: ['me', 'lena'], date: '2026-04-09', category: 'transport'},
  {title: 'Movie night', group: null, currency: 'INR', total: 90000n, payers: {riya: 90000n}, participants: ['me', 'riya'], date: '2026-06-14', category: 'entertainment', notes: 'Pizza dinner at Riya’s before the film'},
]

/* -------------------------------------------------------------------------- */
/* The plan                                                                   */
/* -------------------------------------------------------------------------- */

export type DemoOp =
  | {kind: 'person'; at: number; actor: string; id: string; name: string; upiId: string | null}
  | {kind: 'group'; at: number; actor: string; id: string; input: Parameters<typeof createGroup>[2]}
  | {kind: 'expense'; at: number; actor: string; id: string; draft: ExpenseDraft}
  | {kind: 'expense.update'; at: number; actor: string; id: string; draft: ExpenseDraft}
  | {kind: 'expense.delete' | 'expense.restore' | 'repayment.delete' | 'writeoff.delete'; at: number; actor: string; id: string}
  | {kind: 'repayment' | 'writeoff'; at: number; actor: string; id: string; input: RepaymentInput}
  /* Wave B features (F-604, F-615, F-1118/9, F-1203, F-1204, F-403): each runs the real mutation. */
  | {kind: 'person.delete' | 'person.remove'; at: number; actor: string; id: string}
  | {kind: 'group.inactive' | 'group.hide' | 'group.delete'; at: number; actor: string; id: string}
  | {kind: 'member.exit'; at: number; actor: string; id: string; input: Omit<MemberExitInput, 'groupId'>}
  | {kind: 'item.hide'; at: number; actor: string; id: string; type: 'expense' | 'repayment' | 'writeoff' | 'person'}
  | {kind: 'comment'; at: number; actor: string; id: string; input: Omit<CommentInput, 'id'>}
  | {kind: 'comment.edit'; at: number; actor: string; id: string; body: string}
  | {kind: 'comment.delete'; at: number; actor: string; id: string}
  | {kind: 'reminder.self'; at: number; actor: string; id: string; input: Parameters<typeof scheduleReminder>[2]}
  | {kind: 'reminder.nudge'; at: number; actor: string; id: string; input: Parameters<typeof recordNudge>[2]}
  | {kind: 'merchant.setup'; at: number; actor: string; id: string; title: string; charges: Parameters<typeof merchantSetupOf>[1]}
  /* Disputes and holds (F-1210): raised as `actor` (or as `input.raisedBy`, recorded by `actor`), answered by `actor`. */
  | {kind: 'dispute'; at: number; actor: string; id: string; input: Omit<DisputeInput, 'id'>}
  | {kind: 'dispute.hold'; at: number; actor: string; id: string; input: Omit<HoldInput, 'id'>}
  | {kind: 'dispute.answer'; at: number; actor: string; id: string; action: 'accept' | 'reject' | 'withdraw' | 'release' | 'reopen'; note?: string}

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
    // The story's six friends join two weeks ago, with their groups (below), so Activity opens on them.
    if (STORY_FRIENDS.includes(key as CuratedFriend) || WAVE_B_FRIENDS.includes(key as Friend)) continue
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
        location: g.location ?? null,
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
    ['faisal', 'KWD', 'Stopover dinner in Kuwait City', 'food', 8, 20, 'Asia/Kuwait'],
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

  /* --------------------- Deleted items (they stay in their lists, struck) ----------------------- */

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

  /* ----------------------- the curated story (fixed numbers) -------------------- */

  {
    const MINUTE_ = MINUTE
    const cdate = (date: LocalDate) => date
    const cid = (w: CuratedWho) => pid(w)
    const gidOf = (key: CuratedGroup) => `${DEMO_LARGE_PREFIX}g-story-${key}`
    let at = now - 14 * DAY
    for (const key of STORY_FRIENDS) {
      at += 7 * MINUTE_
      ops.push({kind: 'person', at, actor: me, id: pid(key), name: FRIENDS[key][0], upiId: null})
      counts.people++
    }
    for (const [key, g] of Object.entries(CURATED_GROUPS) as Array<[CuratedGroup, (typeof CURATED_GROUPS)[CuratedGroup]]>) {
      at += 5 * HOUR
      ops.push({
        kind: 'group',
        at,
        actor: me,
        id: gidOf(key),
        input: {name: g.name, kind: g.kind, currency: g.currency, startDate: g.start && cdate(g.start), endDate: g.end && cdate(g.end), location: g.location ?? null, memberIds: [me, ...g.members.map(cid)]},
      })
      counts.groups++
    }
    const start = now - 12 * DAY
    const step = (12 * DAY - 2 * HOUR) / CURATED_EXPENSES.length
    const ids: Record<string, string> = {}
    /* When each curated expense went in, and its draft: the disputes below hang on them. */
    const whenOf: Record<string, number> = {}
    const drafts: Record<string, ExpenseDraft> = {}
    for (const [i, e] of CURATED_EXPENSES.entries()) {
      const split: SplitInput = e.bill
        ? {
            mode: 'items',
            items: e.bill.items.map((item, k) => ({
              id: `item-${k}`,
              name: item.name,
              amount: item.amount,
              participants: item.people.map(p => (typeof p === 'string' ? cid(p) : {id: cid(p[0]), weight: p[1]})),
            })),
            tax: e.bill.tax,
            tip: e.bill.tip,
            service: e.bill.service,
            discount: e.bill.discount,
          }
        : {mode: 'equal', participants: e.participants.map(cid)}
      const draft: ExpenseDraft = {
        title: e.title,
        groupId: e.group ? gidOf(e.group) : null,
        currency: e.currency,
        total: e.total,
        payers: Object.fromEntries(Object.entries(e.payers).map(([k, v]) => [cid(k as CuratedWho), v!])),
        split,
        date: cdate(e.date),
        tz: e.group ? CURATED_GROUPS[e.group].tz : 'Asia/Kolkata',
        category: e.category,
        notes: e.notes ?? '',
      }
      const top = Object.entries(e.payers).sort(([, x], [, y]) => (x! > y! ? -1 : 1))[0]![0] as CuratedWho
      const when = start + i * step + (i % 3) * 40 * MINUTE_
      const id = nextId('e')
      ids[e.title] = id
      whenOf[e.title] = when
      drafts[e.title] = draft
      // The dinner went in with the wrong total and was fixed an hour ago (shows as an edit in Activity).
      if (e.title === 'Dinner at Thalassa') {
        ops.push({kind: 'expense', at: when, actor: cid(top), id, draft: {...draft, total: 1_000_000n, payers: {[cid('riya')]: 500_000n, [cid('priya')]: 500_000n}}})
        ops.push({kind: 'expense.update', at: now - 70 * MINUTE_, actor: cid(top), id, draft})
        counts.edits++
      } else ops.push({kind: 'expense', at: when, actor: cid(top), id, draft})
      counts.expenses++
    }
    /* Comments (F-1204): a thread on the dinner, with an edit and a deleted comment. */
    const thread = (n: string, who: CuratedWho, ago: number, body: string, mentions: CuratedWho[] = []) => {
      const id = `${DEMO_LARGE_PREFIX}c-${n}`
      ops.push({kind: 'comment', at: now - ago, actor: cid(who), id, input: {targetType: 'expense', targetId: ids['Dinner at Thalassa']!, body, mentions: mentions.map(cid)}})
      return id
    }
    thread('1', 'riya', 8 * DAY, 'Booked the table for eight, the sunset one.')
    thread('2', 'priya', 8 * DAY - 50 * MINUTE, 'Can I pay my half of the starter separately?', ['riya'])
    const typo = thread('3', 'me', 7 * DAY, 'Splitting it equally, the starters were shared.', ['priya'])
    ops.push({kind: 'comment.edit', at: now - 7 * DAY + 20 * MINUTE, actor: me, id: typo, body: 'Splitting it equally, the starters and desserts were shared.'})
    const oops = thread('4', 'sam', 7 * DAY - 3 * HOUR, 'Wrong thread, sorry!')
    ops.push({kind: 'comment.delete', at: now - 7 * DAY + 4 * HOUR, actor: cid('sam'), id: oops})
    thread('5', 'riya', 5 * DAY, 'All good. Total fixed an hour after (it was 10,000 by mistake).')
    /* A deleted duplicate that the owner then hid from the list (decisions 104 to 106). */
    {
      const dup = nextId('e')
      const g = CURATED_GROUPS.goa
      ops.push({kind: 'expense', at: now - 6 * DAY, actor: cid('arjun'), id: dup, draft: {title: 'Scooter rentals (duplicate)', groupId: gidOf('goa'), currency: 'INR', total: 600_000n, payers: {[cid('arjun')]: 600_000n}, split: {mode: 'equal', participants: [me, ...g.members.map(cid)]}, date: dateOf(now - 6 * DAY), tz: g.tz, category: 'transport', notes: ''}})
      /* Sam saw it twice and said so before Arjun deleted it: that dispute closes as Gone (the delete answers it). */
      ops.push({kind: 'dispute', at: now - 6 * DAY + 20 * MINUTE_, actor: cid('sam'), id: `${DEMO_LARGE_PREFIX}d-gone`, input: {targetType: 'expense', targetId: dup, reason: 'duplicate', note: 'This is the scooter bill again.', proposedFix: {kind: 'duplicate', of: ids['Scooter rentals']!}}})
      ops.push({kind: 'expense.delete', at: now - 6 * DAY + HOUR, actor: cid('arjun'), id: dup})
      ops.push({kind: 'item.hide', at: now - 6 * DAY + 2 * HOUR, actor: me, id: dup, type: 'expense'})
      counts.deleted++
    }
    // Groceries deleted by mistake and put back: both show in Activity.
    ops.push({kind: 'expense.delete', at: now - 40 * MINUTE_, actor: me, id: ids.Groceries!})
    ops.push({kind: 'expense.restore', at: now - 38 * MINUTE_, actor: me, id: ids.Groceries!})
    /* Recently deleted: added and then deleted, so balances are unchanged and the bin has one of each kind. */
    const binned = (title: string, group: CuratedGroup, total: bigint, payer: CuratedWho, added: number, deleted: number, category: string) => {
      const id = nextId('e')
      const g = CURATED_GROUPS[group]
      ops.push({
        kind: 'expense',
        at: added,
        actor: cid(payer),
        id,
        draft: {title, groupId: gidOf(group), currency: 'INR', total, payers: {[cid(payer)]: total}, split: {mode: 'equal', participants: [me, ...g.members.map(cid)]}, date: dateOf(added), tz: g.tz, category, notes: ''},
      })
      ops.push({kind: 'expense.delete', at: deleted, actor: cid(payer), id})
      counts.deleted++
    }
    binned('Sunset cruise', 'goa', 300_000n, 'arjun', now - 3 * DAY, now - 2 * DAY, 'entertainment')
    binned('Takeout pizza', 'flat', 135_000n, 'me', now - 26 * HOUR, now - 20 * HOUR, 'food')
    /*
     * Disputes and holds (F-1210) in every state, in rupees, euros, dollars and pounds. A disputed record keeps
     * counting; "Disputed" / "On hold" mark it and its balances carry an "of which disputed" line.
     */
    {
      const d = (n: string) => `${DEMO_LARGE_PREFIX}d-${n}`
      /* Never before the record exists, never in the future. */
      const soon = (title: string, plus: number) => Math.min(whenOf[title]! + plus, now - 5 * MINUTE_)
      const bar = CURATED_EXPENSES.find(x => x.title.startsWith('Bar tab'))!.title
      // Open, with a proposed fix, waiting for me (I administer the group): the shop charged less.
      ops.push({kind: 'dispute', at: soon('Scooter rentals', 3 * HOUR), actor: cid('sam'), id: d('open-fix'), input: {targetType: 'expense', targetId: ids['Scooter rentals']!, reason: 'wrong_amount', note: 'The shop charged 5,400, not 6,000.', proposedFix: {kind: 'amount', amount: 540_000n}}})
      // Open, raised by me, waiting for Sam.
      ops.push({kind: 'dispute', at: soon('Parasailing', 2 * HOUR), actor: me, id: d('open-mine'), input: {targetType: 'expense', targetId: ids.Parasailing!, reason: 'wrong_share', note: 'I skipped the second ride.'}})
      // One item of the bar tab: my portion of the pints.
      ops.push({kind: 'dispute', at: soon(bar, 4 * HOUR), actor: me, id: d('item'), input: {targetType: 'expense', targetId: ids[bar]!, itemId: 'item-0', reason: 'wrong_share', note: 'I only had one pint.'}})
      // Accepted (euros): the tram ticket was cheaper; Diego fixed it by hand and said yes.
      ops.push({kind: 'dispute', at: soon('Tram 28 tickets', HOUR), actor: me, id: d('accepted'), input: {targetType: 'expense', targetId: ids['Tram 28 tickets']!, reason: 'wrong_amount', note: 'The tickets were 10, not 12.', proposedFix: {kind: 'amount', amount: 1000n}}})
      ops.push({kind: 'expense.update', at: soon('Tram 28 tickets', 2 * HOUR), actor: cid('diego'), id: ids['Tram 28 tickets']!, draft: {...drafts['Tram 28 tickets']!, total: 1000n, payers: {[cid('diego')]: 1000n}}})
      counts.edits++
      ops.push({kind: 'dispute.answer', at: soon('Tram 28 tickets', 2 * HOUR + MINUTE_), actor: cid('diego'), id: d('accepted'), action: 'accept', note: 'Fixed, thanks.'})
      // Rejected (euros): Sam picked the wine.
      ops.push({kind: 'dispute', at: soon('Seafood at Ramiro', HOUR), actor: cid('sam'), id: d('rejected'), input: {targetType: 'expense', targetId: ids['Seafood at Ramiro']!, reason: 'wrong_share', note: 'I did not drink any of it.'}})
      ops.push({kind: 'dispute.answer', at: soon('Seafood at Ramiro', 3 * HOUR), actor: me, id: d('rejected'), action: 'reject', note: 'You picked the wine!'})
      // Withdrawn (dollars): Priya checked and dropped it.
      ops.push({kind: 'dispute', at: soon('Snorkel gear', HOUR), actor: cid('priya'), id: d('withdrawn'), input: {targetType: 'expense', targetId: ids['Snorkel gear']!, reason: 'not_part', note: 'I thought this was only for the snorkellers.'}})
      ops.push({kind: 'dispute.answer', at: soon('Snorkel gear', 5 * HOUR), actor: cid('priya'), id: d('withdrawn'), action: 'withdraw'})
      // Reopened (rupees): rejected once, reopened with the receipt, open again.
      ops.push({kind: 'dispute', at: soon('Beach shack lunch', HOUR), actor: cid('riya'), id: d('reopened'), input: {targetType: 'expense', targetId: ids['Beach shack lunch']!, reason: 'wrong_amount', note: 'The bill I saw was 4,200.', proposedFix: {kind: 'amount', amount: 420_000n}}})
      ops.push({kind: 'dispute.answer', at: soon('Beach shack lunch', 3 * HOUR), actor: cid('priya'), id: d('reopened'), action: 'reject', note: 'That bill left out the tip.'})
      ops.push({kind: 'dispute.answer', at: soon('Beach shack lunch', 6 * HOUR), actor: cid('riya'), id: d('reopened'), action: 'reopen', note: 'Here is the receipt photo, no tip on it.'})
      // On hold (rupees): waiting for a refund.
      ops.push({kind: 'dispute.hold', at: soon('Electricity bill', 2 * HOUR), actor: cid('arjun'), id: d('hold-open'), input: {targetType: 'expense', targetId: ids['Electricity bill']!, note: 'Waiting for the refund from the board.'}})
      // Still open in euros (Lena left before the show) and in dollars (I asked Priya to hold the course until I see the invoice).
      ops.push({kind: 'dispute', at: soon('Fado night', 2 * HOUR), actor: cid('lena'), id: d('open-eur'), input: {targetType: 'expense', targetId: ids['Fado night']!, reason: 'wrong_share', note: 'I left before the show started.'}})
      ops.push({kind: 'dispute.hold', at: soon('Online course', HOUR), actor: me, id: d('hold-usd'), input: {targetType: 'expense', targetId: ids['Online course']!, note: 'Waiting for the invoice.'}})
      // A hold let go (euros).
      ops.push({kind: 'dispute.hold', at: soon('Airbnb in Alfama', HOUR), actor: me, id: d('hold-released'), input: {targetType: 'expense', targetId: ids['Airbnb in Alfama']!, note: 'Need the receipt first.'}})
      ops.push({kind: 'dispute.answer', at: soon('Airbnb in Alfama', 4 * HOUR), actor: cid('lena'), id: d('hold-released'), action: 'release'})
    }
    const paid = nextId('r')
    ops.push({kind: 'repayment', at: now - 2 * DAY, actor: cid('priya'), id: paid, input: {id: paid, groupId: null, currency: 'INR', from: cid('priya'), to: me, amount: 250_000n, date: dateOf(now - 2 * DAY), tz: 'Asia/Kolkata', note: 'UPI'}})
    ops.push({kind: 'repayment.delete', at: now - 5 * HOUR, actor: me, id: paid})
    const forgiven = nextId('w')
    ops.push({kind: 'writeoff', at: now - 4 * DAY, actor: cid('sam'), id: forgiven, input: {id: forgiven, groupId: null, currency: 'EUR', from: cid('sam'), to: me, amount: 900n, date: dateOf(now - 4 * DAY), tz: 'Europe/Lisbon', note: 'Coffee on me'}})
    ops.push({kind: 'writeoff.delete', at: now - 3 * DAY, actor: me, id: forgiven})
    counts.deleted += 2
  }

  /* ------------------ the Wave B story (every feature of owner decision 109) ------------------ */

  {
    const gB = (key: string) => `${DEMO_LARGE_PREFIX}g-b-${key}`
    const gidOf = (key: CuratedGroup) => `${DEMO_LARGE_PREFIX}g-story-${key}`
    const tz = 'Asia/Kolkata'
    let at = now - 160 * DAY
    for (const key of WAVE_B_FRIENDS) {
      at += 9 * MINUTE
      ops.push({kind: 'person', at, actor: me, id: pid(key), name: FRIENDS[key][0], upiId: null})
      counts.people++
    }
    const group = (key: string, creator: Who, input: {name: string; kind: Group['kind']; location?: string; currency: CurrencyCode; startDate?: string; endDate?: string; members: Who[]}, when: number) => {
      ops.push({
        kind: 'group',
        at: when,
        actor: pid(creator),
        id: gB(key),
        input: {name: input.name, kind: input.kind, currency: input.currency, startDate: input.startDate ?? null, endDate: input.endDate ?? null, location: input.location ?? null, memberIds: input.members.map(pid)},
      })
      counts.groups++
    }
    /** An equal-split expense in a story group, paid by one person. */
    const spend = (key: string, title: string, category: string, currency: CurrencyCode, total: bigint, payer: Who, people: Who[], when: number, notes = '') => {
      const id = nextId('e')
      ops.push({
        kind: 'expense',
        at: when,
        actor: pid(payer),
        id,
        draft: {title, groupId: gB(key), currency, total, payers: {[pid(payer)]: total}, split: {mode: 'equal', participants: people.map(pid)}, date: dateOf(when), tz, category, notes},
      })
      counts.expenses++
      return id
    }

    /* A cabin weekend made by Anil: Chirag left, then Anil handed admin on to me (F-615). */
    const cabin: Who[] = ['me', 'anil', 'bhavna', 'chirag']
    group('cabin', 'anil', {name: 'Weekend cabin', kind: 'trip', location: 'Lonavala', currency: 'INR', startDate: dayAgo(33), endDate: dayAgo(31), members: cabin}, now - 36 * DAY)
    spend('cabin', 'Cabin booking', 'stay', 'INR', 1_800_000n, 'anil', cabin, now - 33 * DAY, 'Two nights, firewood included')
    spend('cabin', 'Groceries and firewood', 'groceries', 'INR', 640_000n, 'bhavna', cabin, now - 32 * DAY)
    spend('cabin', 'Zip-line, charged in dollars', 'entertainment', 'USD', 12_000n, 'chirag', cabin, now - 32 * DAY + 2 * HOUR, 'Card billed in USD')
    ops.push({kind: 'member.exit', at: now - 28 * DAY, actor: pid('chirag'), id: gB('cabin'), input: {personId: pid('chirag'), choice: 'keep', date: dayAgo(28), tz}})
    ops.push({kind: 'member.exit', at: now - 27 * DAY, actor: pid('anil'), id: gB('cabin'), input: {personId: pid('anil'), choice: 'keep', handAdminTo: me, date: dayAgo(27), tz}})

    /* An inactive group: takes no new expenses, balances still count (F-604). */
    const chai: Who[] = ['me', 'raj', 'deepa']
    group('chai', 'me', {name: 'Old office chai', kind: 'other', currency: 'INR', members: chai}, now - 150 * DAY)
    spend('chai', 'Chai for the team', 'food', 'INR', 36_000n, 'raj', chai, now - 140 * DAY)
    spend('chai', 'Biscuits and snacks', 'groceries', 'INR', 54_000n, 'me', chai, now - 120 * DAY)
    ops.push({kind: 'group.inactive', at: now - 90 * DAY, actor: me, id: gB('chai')})

    /* A hidden group: out of my lists, still reachable from the filter (F-604). */
    const santa: Who[] = ['me', 'raj', 'deepa', 'bhavna']
    group('santa', 'me', {name: 'Secret Santa', kind: 'other', currency: 'INR', members: santa}, now - 70 * DAY)
    spend('santa', 'Gift exchange budget', 'shopping', 'INR', 480_000n, 'deepa', santa, now - 68 * DAY)
    ops.push({kind: 'group.hide', at: now - 60 * DAY, actor: me, id: gB('santa')})

    /* A deleted group: stays in the list, read only, its expenses struck (decisions 103, 105). */
    const gym: Who[] = ['me', 'raj']
    group('gym', 'me', {name: 'Gym buddies', kind: 'other', currency: 'INR', members: gym}, now - 100 * DAY)
    spend('gym', 'Annual gym pass', 'other', 'INR', 2_400_000n, 'me', gym, now - 99 * DAY)
    spend('gym', 'Protein tub', 'groceries', 'INR', 380_000n, 'raj', gym, now - 95 * DAY)
    ops.push({kind: 'group.delete', at: now - 20 * DAY, actor: me, id: gB('gym')})
    counts.deleted += 3

    /* A settled group and friend: Paris in euros, squared up. Chloe's thank-you note hangs on the payment. */
    const paris: Who[] = ['me', 'chloe']
    group('paris', 'me', {name: 'Paris weekend', kind: 'trip', location: 'Paris', currency: 'EUR', startDate: dayAgo(55), endDate: dayAgo(53), members: paris}, now - 58 * DAY)
    spend('paris', 'Hotel near Montmartre', 'stay', 'EUR', 24_000n, 'me', paris, now - 55 * DAY)
    spend('paris', 'Metro passes', 'transport', 'EUR', 3_000n, 'chloe', paris, now - 54 * DAY)
    // The train home was booked in pounds: a second currency, squared up too.
    spend('paris', 'Eurostar to London', 'transport', 'GBP', 9_000n, 'chloe', paris, now - 53 * DAY)
    const pounds = nextId('r')
    ops.push({kind: 'repayment', at: now - 52 * DAY + MINUTE, actor: me, id: pounds, input: {id: pounds, groupId: gB('paris'), currency: 'GBP', from: me, to: pid('chloe'), amount: 4_500n, date: dayAgo(52), tz: 'Europe/London', note: 'Monzo'}})
    counts.repayments++
    // Chloe says the pounds never arrived (pounds: a payment not received, open).
    ops.push({kind: 'dispute', at: now - 3 * DAY, actor: pid('chloe'), id: `${DEMO_LARGE_PREFIX}d-payment`, input: {targetType: 'repayment', targetId: pounds, reason: 'not_received', note: 'Nothing in my Monzo yet.'}})
    const squared = nextId('r')
    ops.push({kind: 'repayment', at: now - 52 * DAY, actor: me, id: squared, input: {id: squared, groupId: gB('paris'), currency: 'EUR', from: pid('chloe'), to: me, amount: 10_500n, date: dayAgo(52), tz: 'Europe/Paris', note: 'Revolut'}})
    counts.repayments++
    ops.push({kind: 'comment', at: now - 52 * DAY + 5 * MINUTE, actor: pid('chloe'), id: `${DEMO_LARGE_PREFIX}c-paid`, input: {targetType: 'repayment', targetId: squared, body: 'Sent! That makes us even.', mentions: []}})

    /* The Supper Factory bill (F-403): food and alcohol taxed differently, service stacked, round-off to 2,522.00. */
    const delhi: Who[] = ['me', 'raj', 'deepa']
    group('delhi', 'me', {name: 'Delhi dinners', kind: 'other', currency: 'INR', members: delhi}, now - 30 * DAY)
    const FOOD_B = [['Paneer Tikka', 20000n], ['Dal Makhani', 25000n], ['Butter Naan', 18000n], ['Biryani', 21000n], ['Kebab Platter', 19000n], ['Raita', 22000n], ['Gulab Jamun', 17100n], ['Masala Papad', 19000n]] as const
    const ALCOHOL_B = [['Whisky', 25000n], ['Beer', 15000n]] as const
    const supper = nextId('e')
    ops.push({
      kind: 'expense',
      at: now - 29 * DAY,
      actor: me,
      id: supper,
      draft: {
        title: 'The Supper Factory',
        groupId: gB('delhi'),
        currency: 'INR',
        total: 252_200n,
        payers: {[me]: 252_200n},
        split: {
          mode: 'items',
          items: [
            // Raj had only food; I had food and both drinks; Deepa shared everything.
            ...FOOD_B.map(([name, amount], n) => ({
              id: `food-${n}`,
              name,
              amount,
              taxClass: 'food',
              participants: n < 3 ? [pid('raj'), pid('deepa')] : n < 6 ? [me, pid('deepa')] : [pid('raj'), me, pid('deepa')],
            })),
            ...ALCOHOL_B.map(([name, amount], n) => ({id: `alc-${n}`, name, amount, taxClass: 'alcohol', participants: [me, pid('deepa')] })),
          ],
          tax: 0n,
          tip: 0n,
          service: 0n,
          discount: 0n,
          charges: [
            {id: 'service', name: 'Service charge', kind: 'service', value: {mode: 'percent', basisPoints: 1000}, appliesTo: {type: 'all'}, stacksOn: 'items'},
            {id: 'vat-food', name: 'VAT 12.5%', kind: 'tax', value: {mode: 'percent', basisPoints: 1250}, appliesTo: {type: 'classes', classes: ['food']}, stacksOn: 'earlier'},
            {id: 'vat-alc', name: 'VAT 20%', kind: 'tax', value: {mode: 'percent', basisPoints: 2000}, appliesTo: {type: 'classes', classes: ['alcohol']}, stacksOn: 'earlier'},
          ],
          roundOff: {minor: 39n},
        },
        date: dateOf(now - 29 * DAY),
        tz,
        category: 'food',
        notes: 'Printed total 2,522.00 (round-off +0.39)',
      },
    })
    counts.expenses++
    ops.push({
      kind: 'merchant.setup',
      at: now - 29 * DAY + HOUR,
      actor: me,
      id: gB('setup'),
      title: 'The Supper Factory',
      charges: [
        {name: 'Service charge', kind: 'service', mode: 'percent', basisPoints: 1000, stacksOn: 'items'},
        {name: 'VAT 12.5%', kind: 'tax', mode: 'percent', basisPoints: 1250, classes: ['food'], stacksOn: 'earlier'},
        {name: 'VAT 20%', kind: 'tax', mode: 'percent', basisPoints: 2000, classes: ['alcohol'], stacksOn: 'earlier'},
      ],
    })

    /* A deleted friend (never used) and a removed friend (squared up first) stay in People (decisions 103, 105). */
    ops.push({kind: 'person.delete', at: now - 25 * DAY, actor: me, id: pid('ravi')})
    const parcel = nextId('e')
    ops.push({kind: 'expense', at: now - 80 * DAY, actor: me, id: parcel, draft: {title: 'Shared parcel', groupId: null, currency: 'INR', total: 150_000n, payers: {[me]: 150_000n}, split: {mode: 'equal', participants: [me, pid('tara')]}, date: dateOf(now - 80 * DAY), tz, category: 'shopping', notes: ''}})
    counts.expenses++
    const back = nextId('r')
    ops.push({kind: 'repayment', at: now - 78 * DAY, actor: me, id: back, input: {id: back, groupId: null, currency: 'INR', from: pid('tara'), to: me, amount: 75_000n, date: dayAgo(78), tz, note: 'UPI'}})
    counts.repayments++
    ops.push({kind: 'person.remove', at: now - 70 * DAY, actor: me, id: pid('tara')})

    /* Reminders (F-1118 Remind, F-1119 Remind me): shared nudges and my own scheduled ones. */
    const rem = (n: string) => `${DEMO_LARGE_PREFIX}rem-${n}`
    ops.push({kind: 'reminder.nudge', at: now - 3 * DAY, actor: me, id: rem('1'), input: {personId: pid('priya'), groupId: gidOf('goa'), amounts: {INR: 250_000n}, via: 'share'}})
    ops.push({kind: 'reminder.nudge', at: now - 2 * DAY, actor: me, id: rem('2'), input: {personId: pid('sam'), groupId: null, amounts: {EUR: 900n}, via: 'whatsapp'}})
    ops.push({kind: 'reminder.self', at: now - 1 * DAY, actor: me, id: rem('3'), input: {personId: pid('riya'), groupId: null, dueAt: now + 2 * DAY, repeat: 'monthly'}})
    ops.push({kind: 'reminder.self', at: now - 20 * HOUR, actor: me, id: rem('4'), input: {personId: '', groupId: gidOf('lisbon'), dueAt: now + 5 * DAY, repeat: 'none'}})

    /* Personal expenses (owner 230: an expense tracker too): only I paid and only I share them, so they count in my
       spending and move no balance. Added last, so no id or random choice above shifts. */
    for (const [title, category, total, days] of [
      ['Haircut', 'other', 60_000n, 12],
      ['Gym membership', 'bills', 250_000n, 34],
      ['Books', 'shopping', 89_900n, 47],
    ] as const) {
      const id = nextId('e')
      ops.push({kind: 'expense', at: now - days * DAY, actor: me, id, draft: {title, groupId: null, currency: 'INR', total, payers: {[me]: total}, split: {mode: 'equal', participants: [me]}, date: dayAgo(days), tz, category, notes: ''}})
      counts.expenses++
    }
  }

  // Stable time order: people and groups first (they come first in the list and in time).
  const order = new Map(ops.map((o, i) => [o, i]))
  ops.sort((x, y) => x.at - y.at || order.get(x)! - order.get(y)!)
  return {ops, counts}
}

/**
 * Ops that read the store first (a friend's open balance, a member's exit preview), so they cannot run inside the
 * ledger's one transaction: the seed applies them after it, each only if it has not happened yet.
 */
export function isDeferredOp(op: DemoOp): boolean {
  return op.kind === 'person.remove' || op.kind === 'person.delete' || op.kind === 'group.delete' || op.kind === 'member.exit'
}

/** For tests: the plan's expenses as ledger records, as the app would read them back. */
export function planRecords(plan: DemoPlan): ExpenseRecord[] {
  const live = new Map<string, ExpenseDraft>()
  const gone = new Set<string>()
  for (const op of plan.ops) {
    if (op.kind === 'expense' || op.kind === 'expense.update') live.set(op.id, op.draft)
    else if (op.kind === 'expense.delete') gone.add(op.id)
    else if (op.kind === 'expense.restore') gone.delete(op.id)
  }
  const deletedGroups = new Set(plan.ops.filter(o => o.kind === 'group.delete').map(o => o.id))
  return [...live]
    .filter(([id, d]) => !gone.has(id) && !(d.groupId && deletedGroups.has(d.groupId)))
    .map(([id, d]) => ({kind: 'expense', id, groupId: d.groupId, currency: d.currency, total: d.total, payers: d.payers, shares: computeShares(d.total, d.split), date: d.date, deleted: false}))
}

/** For tests and e2e: the plan's whole final ledger, live expenses plus payments and write-offs not taken back. */
export function planLedger(plan: DemoPlan): LedgerRecord[] {
  const taken = new Set(plan.ops.filter(o => o.kind === 'repayment.delete' || o.kind === 'writeoff.delete').map(o => o.id))
  const deletedGroups = new Set(plan.ops.filter(o => o.kind === 'group.delete').map(o => o.id))
  return [
    ...planRecords(plan),
    ...plan.ops
      .filter((o): o is Extract<DemoOp, {kind: 'repayment' | 'writeoff'}> => (o.kind === 'repayment' || o.kind === 'writeoff') && !taken.has(o.id) && !(o.input.groupId && deletedGroups.has(o.input.groupId)))
      .map(o => ({...o.input, kind: o.kind, id: o.id, deleted: false}) as LedgerRecord),
  ]
}

/**
 * Applies one write of the plan through the real mutations, as its actor at
 * its time. A create that mints its id asks for it first (the plan's id);
 * every other id asked for is an outbox op id.
 */
export async function applyDemoOp(store: Store, base: MutationCtx, op: DemoOp): Promise<void> {
  let pending: string | undefined =
    op.kind === 'person' || op.kind === 'group' || op.kind === 'expense' || op.kind === 'reminder.self' || op.kind === 'reminder.nudge' ? op.id : undefined
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
    case 'expense.restore':
      return restoreExpense(store, ctx, op.id)
    case 'repayment':
      return void (await createRepayments(store, ctx, [op.input]))
    case 'writeoff':
      return void (await createWriteOffs(store, ctx, [op.input]))
    case 'repayment.delete':
      return deleteRepayment(store, ctx, op.id)
    case 'writeoff.delete':
      return deleteWriteOff(store, ctx, op.id)
    case 'person.delete':
      return deletePerson(store, ctx, op.id)
    case 'person.remove':
      return void (await removeFriend(store, ctx, op.id))
    case 'group.inactive':
      return void (await makeGroupInactive(store, ctx, op.id))
    case 'group.hide':
      return setGroupHidden(store, ctx, op.id, true)
    case 'group.delete':
      return void (await deleteGroup(store, ctx, op.id))
    case 'member.exit':
      return void (await removeGroupMember(store, ctx, {...op.input, groupId: op.id}))
    case 'item.hide':
      return setItemHidden(store, ctx, op.type, op.id, true)
    case 'comment':
      return check(await createComment(store, ctx, {...op.input, id: op.id}))
    case 'comment.edit':
      return void (await editComment(store, ctx, op.id, {body: op.body}))
    case 'comment.delete':
      return deleteComment(store, ctx, op.id)
    case 'reminder.self':
      return check(await scheduleReminder(store, ctx, op.input))
    case 'reminder.nudge':
      return check(await recordNudge(store, ctx, op.input))
    case 'merchant.setup':
      return setPref(store, ctx, 'bill.merchantSetups', [merchantSetupOf(op.title, op.charges)])
    case 'dispute':
      return check(await raiseDispute(store, ctx, {...op.input, id: op.id}))
    case 'dispute.hold':
      return check(await holdRecord(store, ctx, {...op.input, id: op.id}))
    case 'dispute.answer':
      switch (op.action) {
        case 'accept':
          return void (await acceptDispute(store, ctx, op.id, {note: op.note}))
        case 'reject':
          return void (await rejectDispute(store, ctx, op.id, {note: op.note ?? ''}))
        case 'withdraw':
          return void (await withdrawDispute(store, ctx, op.id))
        case 'release':
          return void (await releaseHold(store, ctx, op.id))
        case 'reopen':
          return void (await reopenDispute(store, ctx, op.id, {note: op.note ?? ''}))
      }
  }
}
