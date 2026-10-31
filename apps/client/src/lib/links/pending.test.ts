import {beforeEach, describe, expect, test} from 'bun:test'

import {done, focusChanged, hasPending, peek, PENDING_TTL_MS, queue, resetPendingForTests} from './pending'
import {resolveLink} from './resolve'

const ID = '3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77'
const OTHER = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
const target = (path: string) => resolveLink(path).target
const person = {name: 'Person', params: {personId: ID}}

beforeEach(resetPendingForTests)

describe('the phone holds a link\'s sheet for its page', () => {
  test('consume: it is found for its page and chain, and stays until the dialog has opened', () => {
    queue(target(`/people/${ID}/record-payment`), 0)
    expect(peek(person, ['record-payment'], 1)).toEqual({})
    // Looking again changes nothing: a dialog that was not mounted yet can ask once more (retry).
    expect(peek(person, ['record-payment'], 500)).toEqual({})
    done()
    expect(peek(person, ['record-payment'], 501)).toBeUndefined()
  })

  test('retry: still there after any number of looks, until the TTL', () => {
    queue(target(`/people/${ID}/record-payment`), 0)
    for (let t = 100; t < PENDING_TTL_MS; t += 900) expect(peek(person, ['record-payment'], t)).toBeDefined()
    expect(peek(person, ['record-payment'], PENDING_TTL_MS + 1)).toBeUndefined()
    expect(hasPending()).toBe(false)
  })

  test('leak: leaving the page drops it, so a later visit does not open a sheet', () => {
    queue(target(`/people/${ID}/record-payment`), 0)
    // Before its page has shown (navigating there) a change elsewhere does not drop it.
    expect(focusChanged({name: 'Home', params: {}})).toBe(false)
    expect(focusChanged({name: 'Person', params: {personId: ID}})).toBe(false)
    expect(peek(person, ['record-payment'], 10)).toBeDefined()
    // The person goes to another page: it is gone.
    expect(focusChanged({name: 'Groups', params: {}})).toBe(true)
    expect(peek(person, ['record-payment'], 11)).toBeUndefined()
    expect(focusChanged({name: 'Person', params: {personId: ID}})).toBe(false)
    expect(peek(person, ['record-payment'], 12)).toBeUndefined()
  })

  test('a new link replaces the held one, and a link with no sheet clears it', () => {
    queue(target(`/people/${ID}/record-payment`), 0)
    queue(target(`/people/${ID}/edit`), 1)
    expect(peek(person, ['record-payment'], 2)).toBeUndefined()
    expect(peek(person, ['edit'], 2)).toBeDefined()
    queue(target(`/people/${ID}`), 3)
    expect(hasPending()).toBe(false)
  })
})

describe('owner', () => {
  test('only the page the link named takes its sheet', () => {
    queue(target(`/people/${ID}/record-payment`), 0)
    expect(peek({name: 'Person', params: {personId: OTHER}}, ['record-payment'], 1)).toBeUndefined()
    expect(peek({name: 'Group', params: {groupId: ID}}, ['record-payment'], 1)).toBeUndefined()
    // A dialog with no page (a provider's) never takes a page's sheet.
    expect(peek(null, ['record-payment'], 1)).toBeUndefined()
  })

  test('a shell sheet (Search, Send feedback) goes to a dialog with no page, not to a page\'s', () => {
    queue(target('/?feedback=new'), 0)
    expect(peek(person, ['feedback'], 1)).toBeUndefined()
    expect(peek(null, ['feedback'], 1)).toEqual({})
    queue(target('/search?q=dinner&mode=ask'), 0)
    expect(peek(null, ['search'], 1)).toEqual({q: 'dinner', mode: 'ask'})
  })
})

describe('what a phone holds of a chain', () => {
  test('never a picker over a sheet: only the parent is held', () => {
    queue(target(`/people/${ID}/record-payment/currency`), 0)
    expect(peek(person, ['record-payment'], 1)).toBeDefined()
    expect(peek(person, ['record-payment', 'currency'], 1)).toBeUndefined()
  })

  test('nothing over a composer (its pickers are dialogs over a native modal)', () => {
    queue(target('/expense/new/currency'), 0)
    expect(hasPending()).toBe(false)
    queue(target('/groups/new/currency'), 0)
    expect(hasPending()).toBe(false)
  })
})
