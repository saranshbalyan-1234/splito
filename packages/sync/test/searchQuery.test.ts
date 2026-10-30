import {describe, expect, test} from 'bun:test'

import {parseQuery, removeChip} from '../src/searchQuery'

/*
 * F-246 acceptance 4: a table of queries with the tokens and chips each must give. Kinds are written as a token's
 * `kind`, an alternative as `any(a|b)`; chips as their facet. Today is not needed: periods stay symbolic until the engine runs.
 */
const kinds = (q: string, mark: '.' | ',' = '.') =>
  parseQuery(q, {mark}).tokens.map(function describeToken(t): string {
    return t.kind === 'any' ? `any(${t.options.map(describeToken).join('|')})` : t.kind
  })
const facets = (q: string): string[] => parseQuery(q).chips.map(c => c.facet)

const TABLE: Array<[query: string, tokens: string[], chips: string[]]> = [
  // Words
  ['Netflix', ['text'], []],
  ['dinner at thalassa', ['text', 'place'], ['place']],
  ['Pastéis de Belém', ['text', 'text', 'text'], []],
  ['', [], []],
  ['   ', [], []],
  // Amounts
  ['450', ['amount'], []],
  ['₹450', ['amount'], []],
  ['12.50', ['amount'], []],
  ['1,00,000', ['amount'], []],
  ['2k', ['amount'], []],
  ['1.5 lakh', ['amount'], []],
  ['2 cr', ['amount'], []],
  ['> 1000', ['compare'], ['amount']],
  ['>1000', ['compare'], ['amount']],
  ['>= 1,000', ['compare'], ['amount']],
  ['< 50', ['compare'], ['amount']],
  ['<=50', ['compare'], ['amount']],
  ['over 500', ['compare'], ['amount']],
  ['above 500', ['compare'], ['amount']],
  ['more than 500', ['compare'], ['amount']],
  ['greater than 500', ['compare'], ['amount']],
  ['at least 500', ['compare'], ['amount']],
  ['under 500', ['compare'], ['amount']],
  ['below 500', ['compare'], ['amount']],
  ['less than 500', ['compare'], ['amount']],
  ['at most 500', ['compare'], ['amount']],
  ['up to 500', ['compare'], ['amount']],
  ['over 1k', ['compare'], ['amount']],
  ['over 1 lakh', ['compare'], ['amount']],
  ['between 200 and 800', ['between'], ['amount']],
  ['from 200 to 800', ['between'], ['amount']],
  ['200-800', ['between'], ['amount']],
  ['around 1k', ['around'], ['amount']],
  ['about 500', ['around'], ['amount']],
  ['~500', ['around'], ['amount']],
  ['EUR between 10 and 50', ['between'], ['amount']],
  ['50 eur', ['amount'], ['amount']],
  ['€50', ['amount'], []],
  ['> 20 EUR', ['compare'], ['amount']],
  // Dates
  ['today', ['day'], ['period']],
  ['yesterday', ['day'], ['period']],
  ['march', ['month'], ['period']],
  ['march 2026', ['month'], ['period']],
  ['sept', ['month'], ['period']],
  ['this month', ['period'], ['period']],
  ['last month', ['period'], ['period']],
  ['last week', ['period'], ['period']],
  ['this year', ['period'], ['period']],
  ['last year', ['period'], ['period']],
  ['2025', ['amount'], []],
  // People
  ['paid by Riya', ['person'], ['person']],
  ['by riya', ['person'], ['person']],
  ['paid by me', ['person'], ['person']],
  ['with Sam', ['person'], ['person']],
  ['paid by riya or sam', ['any(person|person)'], ['any']],
  // Places and combinations
  ['in Goa', ['place'], ['place']],
  ['food or travel in Goa over 500', ['any(text|text)', 'place', 'compare'], ['any', 'place', 'amount']],
  ['paid by Riya last month', ['person', 'period'], ['person', 'period']],
  ['dinner paid by riya last month over 500', ['text', 'person', 'period', 'compare'], ['person', 'period', 'amount']],
  ['food and travel', ['text', 'text'], []],
  ['march or april', ['any(month|month)'], ['any']],
  // Statuses and types
  ['deleted', ['status'], ['status']],
  ['settled', ['status'], ['status']],
  ['owed', ['status'], ['status']],
  ['disputed', ['status'], ['status']],
  ['hidden', ['status'], ['status']],
  ['inactive', ['status'], ['status']],
  ['status:disputed', ['status'], ['status']],
  ['status: disputed', ['status'], ['status']],
  ['deleted payments', ['status', 'type'], ['status', 'type']],
  ['payments', ['type'], ['type']],
  ['write-off', ['type'], ['type']],
  ['write off', ['type'], ['type']],
  ['comments', ['type'], ['type']],
  ['type:expense', ['type'], ['type']],
  ['group dinner', ['type', 'text'], ['type']],
  // Currency
  ['EUR', ['currency'], ['currency']],
  ['usd', ['currency'], ['currency']],
  // Hindi
  ['कल', ['day'], ['period']],
  ['आज', ['day'], ['period']],
  ['पिछले महीने', ['period'], ['period']],
  ['इस हफ्ते', ['period'], ['period']],
  ['अप्रैल', ['month'], ['period']],
  ['500 से ज्यादा', ['compare'], ['amount']],
  ['500 से कम', ['compare'], ['amount']],
  ['हटाया', ['status'], ['status']],
  ['विवादित', ['status'], ['status']],
  ['riya ने', ['person'], ['person']],
  ['riya के साथ', ['person'], ['person']],
  ['चाय', ['text'], []],
]

describe('the query table', () => {
  test('has at least 60 queries', () => expect(TABLE.length).toBeGreaterThanOrEqual(60))
  test.each(TABLE)('%j', (query, tokens, chips) => {
    expect(kinds(query)).toEqual(tokens)
    expect(facets(query)).toEqual(chips)
  })

  test('a number is read in the number format: de-DE "1.000" is a thousand', () => {
    expect(parseQuery('>1.000,00', {mark: ','}).tokens).toEqual([{kind: 'compare', op: '>', amounts: ['1000.00']}])
  })

  test('shorthand multiplies: 2k, 1.5 lakh, 2 cr, 0.2 lakh', () => {
    const amounts = (q: string) => (parseQuery(q).tokens[0] as {amounts: string[]}).amounts
    expect(amounts('2k')).toEqual(['2000'])
    expect(amounts('1.5 lakh')).toEqual(['150000'])
    expect(amounts('2 cr')).toEqual(['20000000'])
    expect(amounts('>= 0.2 lakh')).toEqual(['20000'])
  })

  test('a currency beside an amount belongs to it', () => {
    expect(parseQuery('EUR between 10 and 50').tokens).toEqual([{kind: 'between', from: ['10'], to: ['50'], currency: 'EUR'}])
    expect(parseQuery('₹450').tokens).toEqual([{kind: 'amount', amounts: ['450'], text: '450', currency: 'INR'}])
  })

  test('removing a chip takes out exactly its words', () => {
    const q = 'dinner paid by riya last month over 500'
    const {chips} = parseQuery(q)
    expect(chips.map(c => removeChip(q, c))).toEqual(['dinner last month over 500', 'dinner paid by riya over 500', 'dinner paid by riya last month'])
  })

  test('the literal reading keeps status and type words as text', () => {
    expect(parseQuery('group dinner', {isLiteral: true}).tokens.map(t => t.kind)).toEqual(['text', 'text'])
  })
})
