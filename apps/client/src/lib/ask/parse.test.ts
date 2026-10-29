import {expect, test} from 'bun:test'
import {DEFAULT_CATEGORIES} from '@splito/sync'

import {closestSuggestion, isQuestion, parseQuestion} from './parse'
import {type Intent, type Vocab} from './types'

const person = (id: string, name: string) => ({id, name})
const vocab: Vocab = {
  people: [
    person('p-riya', 'Riya Sharma'),
    person('p-arjun', 'Arjun Mehta'),
    person('p-priya', 'Priya Nair'),
    person('p-sam', 'Sam Carter'),
    person('p-lena', 'Lena Fischer'),
    person('p-diego', 'Diego Alves'),
  ],
  groups: [person('g-goa', 'Goa trip'), person('g-flat', 'Flat 4B'), person('g-lisbon', 'Lisbon')],
  categories: DEFAULT_CATEGORIES.map(c => ({id: c.id, name: c.name})),
}

const RIYA = person('p-riya', 'Riya Sharma')
const GOA = person('g-goa', 'Goa trip')
const FLAT = person('g-flat', 'Flat 4B')

/** The intent's shape, with only the fields the table pins down. */
type Pin = Partial<Record<string, unknown>> & {kind: Intent['kind']}

const TABLE: Array<[string, Pin]> = [
  // Balance with a person
  ['What does Riya owe me?', {kind: 'balance', person: RIYA}],
  ['How much do I owe Riya?', {kind: 'balance', person: RIYA}],
  ["What's my balance with Riya Sharma", {kind: 'balance', person: RIYA}],
  ['does arjun owe me anything', {kind: 'balance', person: person('p-arjun', 'Arjun Mehta')}],
  ["Riya's balance", {kind: 'balance', person: RIYA}],
  ['Riya ka balance kitna hai', {kind: 'balance', person: RIYA}],
  ['Riya ne mujhe kitna dena hai', {kind: 'balance', person: RIYA}],
  ['mujhe Riya ko kitna dena hai', {kind: 'balance', person: RIYA}],
  // Who owes me most / whom I owe most
  ['Who owes me the most?', {kind: 'ranking', direction: 'owedToMe'}],
  ['who owes me', {kind: 'ranking', direction: 'owedToMe'}],
  ['Whom do I owe the most?', {kind: 'ranking', direction: 'iOwe'}],
  ['who do I owe', {kind: 'ranking', direction: 'iOwe'}],
  ['Who owes whom?', {kind: 'ranking', direction: 'both'}],
  ['how much do I owe in total', {kind: 'ranking', direction: 'iOwe'}],
  ['how much am I owed', {kind: 'ranking', direction: 'owedToMe'}],
  ['my balance', {kind: 'ranking', direction: 'both'}],
  ['kisne mujhe sabse zyada dena hai', {kind: 'ranking', direction: 'owedToMe'}],
  ['mujhe kisko sabse zyada dena hai', {kind: 'ranking', direction: 'iOwe'}],
  ['मुझे किसको देना है', {kind: 'ranking', direction: 'iOwe'}],
  ['किसने मुझे सबसे ज्यादा देना है', {kind: 'ranking', direction: 'owedToMe'}],
  // A group's balance and who owes whom in it
  ['Who owes whom in Goa trip?', {kind: 'groupBalance', group: GOA}],
  ['balance in Flat 4B', {kind: 'groupBalance', group: FLAT}],
  ['settle up Goa trip', {kind: 'groupBalance', group: GOA}],
  ['Goa trip mein kaun kisko kitna dena hai', {kind: 'groupBalance', group: GOA}],
  ['Goa trip', {kind: 'groupBalance', group: GOA}],
  // Spend by period / category / group / person
  ['How much did I spend on food this month?', {kind: 'spend', category: 'food', period: {kind: 'month', offset: 0}, measure: 'share'}],
  ['How much did I spend last month', {kind: 'spend', period: {kind: 'month', offset: -1}, category: undefined}],
  ['total spending this year', {kind: 'spend', period: {kind: 'year', offset: 0}}],
  ['how much did I spend today', {kind: 'spend', period: {kind: 'today'}}],
  ['spent yesterday', {kind: 'spend', period: {kind: 'yesterday'}}],
  ['how much did I spend in the last 30 days', {kind: 'spend', period: {kind: 'days', n: 30}}],
  ['spending in March 2026', {kind: 'spend', period: {kind: 'monthOf', month: 3, year: 2026}}],
  ['what did I spend in december', {kind: 'spend', period: {kind: 'monthOf', month: 12, year: undefined}}],
  ['spending in 2025', {kind: 'spend', period: {kind: 'yearOf', year: 2025}}],
  ['How much did I spend on groceries last week', {kind: 'spend', category: 'groceries', period: {kind: 'week', offset: -1}}],
  ['How much did the Goa trip cost?', {kind: 'spend', group: GOA, measure: 'total'}],
  ['how much did I spend in Goa trip', {kind: 'spend', group: GOA, measure: 'share'}],
  ['how much did I pay for Flat 4B this year', {kind: 'spend', group: FLAT, measure: 'paid'}],
  ['how much did Priya spend this month', {kind: 'spend', person: person('p-priya', 'Priya Nair'), period: {kind: 'month', offset: 0}}],
  ['Show my spending by category this year', {kind: 'spend', breakdown: 'category', period: {kind: 'year', offset: 0}}],
  ['spending by person', {kind: 'spend', breakdown: 'person'}],
  ['spending by group this year', {kind: 'spend', breakdown: 'group'}],
  ['food spending all time', {kind: 'spend', category: 'food', period: {kind: 'all'}}],
  ['mera kharcha is mahine', {kind: 'spend', period: {kind: 'month', offset: 0}}],
  ['pichle mahine kitna kharch hua', {kind: 'spend', period: {kind: 'month', offset: -1}}],
  ['इस महीने मेरा खर्च कितना है', {kind: 'spend', period: {kind: 'month', offset: 0}}],
  ['खाना पर इस साल कितना खर्च किया', {kind: 'spend', category: 'food', period: {kind: 'year', offset: 0}}],
  // Trends
  ['Show my Goa trip spending by day', {kind: 'trend', group: GOA, by: 'day', measure: 'share'}],
  ['spending by month this year', {kind: 'trend', by: 'month', period: {kind: 'year', offset: 0}}],
  ['monthly spending trend', {kind: 'trend', by: 'month'}],
  ['daily food spending this month', {kind: 'trend', by: 'day', category: 'food', period: {kind: 'month', offset: 0}}],
  ['show spending trend over time', {kind: 'trend'}],
  ['Lisbon spending day by day', {kind: 'trend', group: person('g-lisbon', 'Lisbon'), by: 'day'}],
  ['roz ka kharcha is mahine', {kind: 'trend', by: 'day'}],
  ['हर दिन का खर्च', {kind: 'trend', by: 'day'}],
  // Find expenses (handed to Search)
  ['find expenses with pizza', {kind: 'find', query: 'pizza'}],
  ['search for taxi', {kind: 'find', query: 'taxi'}],
  ['show expenses over 1000', {kind: 'find', query: '>1000'}],
  ['list expenses under 500', {kind: 'find', query: '<500'}],
  ['look for airbnb', {kind: 'find', query: 'airbnb'}],
  ['pizza dhundo', {kind: 'find', query: 'pizza'}],
  // Split N ways
  ['Split last night\'s dinner 3 ways', {kind: 'split', ways: 3, title: 'Dinner', amountText: undefined}],
  ['split 1200 4 ways', {kind: 'split', ways: 4, amountText: '1200'}],
  ['split ₹1,200 between 4', {kind: 'split', ways: 4, amountText: '1,200', currency: 'INR'}],
  ['divide $90 among 3 people', {kind: 'split', ways: 3, amountText: '90', currency: 'USD'}],
  ['split the taxi 1.5k with 2 friends', {kind: 'split', ways: 3, amountText: '1.5k', title: 'Taxi'}],
  ['1200 ko 4 mein baato', {kind: 'split', ways: 4, amountText: '1200'}],
  ['१२०० को 4 लोगों में बांटो', {kind: 'split', ways: 4, amountText: '1200'}],
  // Split with Indian units: the unit joins its number and stays out of the title
  ['Split 1 lakh 4 ways', {kind: 'split', ways: 4, amountText: '1lakh', title: undefined}],
  ['split 2.5 lakh between 5', {kind: 'split', ways: 5, amountText: '2.5lakh', title: undefined}],
  ['split the rent 1.2 cr 3 ways', {kind: 'split', ways: 3, amountText: '1.2cr', title: 'Rent'}],
  ['split 50 k among 5 people', {kind: 'split', ways: 5, amountText: '50k'}],
  ['5 हज़ार को 5 लोगों में बांटो', {kind: 'split', ways: 5, amountText: '5k'}],
  ['2 लाख को 4 लोगों में बांटो', {kind: 'split', ways: 4, amountText: '2lakh'}],
  // Words the grammar does not know are never dropped: a search, or an honest no
  ['How much did I spend at Starbucks?', {kind: 'find', query: 'starbucks'}],
  ['expenses over 1,00,000', {kind: 'find', query: '>1,00,000'}],
  ['How much did I spend at Starbucks this month?', {kind: 'unsupported'}],
  ['how much on food at Zomato', {kind: 'unsupported'}],
  ['what is my average spending', {kind: 'unsupported'}],
  ['weekly spending at Starbucks', {kind: 'unsupported'}],
  ['Can you delete the dinner expense?', {kind: 'unsupported'}],
  ['please edit my food expense', {kind: 'unsupported'}],
  ['remove the taxi expense', {kind: 'unsupported'}],
  ['add 500 for lunch with Riya', {kind: 'unsupported', suggestion: {key: 'split'}}],
  ['change the amount of my last dinner', {kind: 'unsupported'}],
  ['dinner ka kharcha delete karo', {kind: 'unsupported'}],
  ['यह खर्चा हटाओ', {kind: 'unsupported'}],
  ['Riya ka kharcha mitao', {kind: 'unsupported'}],
  ['how much did I spend this month on entertainment and shopping', {kind: 'unsupported'}],
  ['how much did I spend in the last two weeks', {kind: 'spend', period: {kind: 'days', n: 14}}],
  ['add up my food spending this month', {kind: 'spend', category: 'food'}],
  // A group named on an owe question scopes the answer to that group
  ['Who owes me in Goa trip?', {kind: 'groupBalance', group: GOA}],
  ['who do I owe in Flat 4B', {kind: 'groupBalance', group: FLAT}],
  ['Goa trip mein kisne mujhe dena hai', {kind: 'groupBalance', group: GOA}],
  ['what does Riya owe me in Goa trip', {kind: 'unsupported', suggestion: {key: 'balanceWith', name: 'Riya Sharma'}}],
  // A balance between two other people is not my balance
  ['Who owes Riya?', {kind: 'unsupported', suggestion: {key: 'balanceWith', name: 'Riya Sharma'}}],
  ['does Riya owe Arjun', {kind: 'unsupported'}],
  ['What does Riya owe Arjun?', {kind: 'unsupported'}],
  ['how much does Arjun owe Riya', {kind: 'unsupported'}],
  ['Riya ne Arjun ko kitna dena hai', {kind: 'unsupported'}],
  ['Riya and Arjun balance', {kind: 'unsupported'}],
  ['how much does Riya owe', {kind: 'unsupported', suggestion: {key: 'balanceWith', name: 'Riya Sharma'}}],
  ['Riya', {kind: 'balance', person: RIYA}],
  ['Riya Sharma', {kind: 'balance', person: RIYA}],
  ['does Riya owe me anything', {kind: 'balance', person: RIYA}],
  ['Riya balance', {kind: 'balance', person: RIYA}],
  // A person in a spend question: their share, never whole-record totals or my paid
  ['how much did I spend with Riya', {kind: 'find', query: 'Riya Sharma'}],
  ['how much did Priya spend altogether this month', {kind: 'spend', measure: 'share', person: person('p-priya', 'Priya Nair')}],
  ['how much did I pay Riya this month', {kind: 'unsupported'}],
  ['how much did I pay for Riya', {kind: 'unsupported'}],
  ['how much did I spend with Riya this month', {kind: 'unsupported'}],
  ['daily spending of Priya', {kind: 'trend', measure: 'share', person: person('p-priya', 'Priya Nair')}],
  ['how much did Riya and Arjun spend', {kind: 'unsupported'}],
  // Help and greetings
  ['help', {kind: 'help'}],
  ['what can you do?', {kind: 'help'}],
  ['hi', {kind: 'help'}],
  ['नमस्ते', {kind: 'help'}],
  // Outside the grammar: honest, with the closest supported question
  ['Will I be able to afford a new phone?', {kind: 'unsupported'}],
  ['write me a poem about money', {kind: 'unsupported'}],
  ['what is the weather in Goa', {kind: 'unsupported'}],
  ['', {kind: 'unsupported'}],
]

test.each(TABLE)('%j reads as its intent', (question, pin) => {
  const intent = parseQuestion(question, vocab) as Record<string, unknown>
  for (const [key, want] of Object.entries(pin)) expect(intent[key], `${question} -> ${key}`).toEqual(want)
})

test('milna and milega are owing words; a bare "net" is not a balance word', () => {
  expect(parseQuestion('mujhe kitna milega', vocab)).toMatchObject({kind: 'ranking', direction: 'owedToMe'})
  expect(parseQuestion('kisne mujhe kitna milna hai', vocab)).toMatchObject({kind: 'ranking', direction: 'owedToMe'})
  expect(parseQuestion('net worth of my plan', vocab).kind).toBe('unsupported')
  expect(parseQuestion('my net balance', vocab)).toMatchObject({kind: 'ranking', direction: 'both'})
})

test('the table holds at least 40 questions across every intent', () => {
  expect(TABLE.length).toBeGreaterThanOrEqual(40)
  const kinds = new Set(TABLE.map(([, pin]) => pin.kind))
  for (const k of ['balance', 'ranking', 'groupBalance', 'spend', 'trend', 'find', 'split', 'help', 'unsupported']) expect(kinds.has(k as Intent['kind'])).toBe(true)
})

test('a name two people share is a question back, not a guess', () => {
  const twins: Vocab = {...vocab, people: [person('a', 'Riya Sharma'), person('b', 'Riya Kapoor')]}
  const intent = parseQuestion('What does Riya owe me?', twins)
  expect(intent.kind).toBe('clarify')
  expect((intent as {options: unknown[]}).options).toHaveLength(2)
  // The full name settles it.
  expect(parseQuestion('What does Riya Kapoor owe me?', twins)).toEqual({kind: 'balance', person: person('b', 'Riya Kapoor')})
})

test('a group named like a category is a group, not the category', () => {
  const v: Vocab = {...vocab, groups: [person('g-food', 'Food Court')]}
  const intent = parseQuestion('how much did I spend in Food Court', v) as {group?: unknown; category?: unknown}
  expect(intent.group).toEqual(person('g-food', 'Food Court'))
  expect(intent.category).toBeUndefined()
})

test('a renamed category is understood by its new name', () => {
  const v: Vocab = {...vocab, categories: [{id: 'food', name: 'Eating out'}, {id: 'other', name: 'Other'}]}
  expect((parseQuestion('how much on eating out this month', v) as {category?: string}).category).toBe('food')
})

test('"may" is a month only beside a year or "in"', () => {
  expect((parseQuestion('how much may I spend', vocab) as {period?: unknown}).period).toBeUndefined()
  expect((parseQuestion('what did I spend in May', vocab) as {period?: unknown}).period).toEqual({kind: 'monthOf', month: 5, year: undefined})
})

test('the nearest supported question follows the topic of the unsupported one', () => {
  expect(closestSuggestion('should I worry about what I owe', vocab)).toEqual({key: 'owedMost'})
  expect(closestSuggestion('is my money being spent wisely', vocab)).toMatchObject({key: 'spendCategory'})
  expect(closestSuggestion('can I split the bill better', vocab)).toEqual({key: 'split'})
  expect(closestSuggestion('compare my trip day to day', vocab)).toEqual({key: 'groupByDay', name: 'Goa trip'})
})

test('Enter in Search starts a chat only for questions, never for a name or a plain search', () => {
  for (const q of ['What does Riya owe me?', 'who owes me', 'how much did I spend on food', 'Show my Goa trip spending by day', 'Split 1200 4 ways', 'kitna kharch hua is mahine', 'mera kharcha is mahine'])
    expect(isQuestion(q, vocab), q).toBe(true)
  for (const q of ['dinner', 'Riya', 'Goa trip', '> 1000', 'march 2026', 'pizza dhundo', 'airbnb', 'show'])
    expect(isQuestion(q, vocab), q).toBe(false)
})
