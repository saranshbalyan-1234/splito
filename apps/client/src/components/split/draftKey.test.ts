import {expect, test} from 'bun:test'

import {draftContextFor, draftKey} from './draftKey'

/* F-116 m30(a): each place Add expense opens from has its own draft slot. */
test('drafts are keyed by where the composer was opened', () => {
  expect(draftKey({})).toBe('all')
  expect(draftKey({groupId: 'g1'})).toBe('g:g1')
  expect(draftKey({personId: 'p1'})).toBe('p:p1')
  expect(draftKey({groupId: 'g1', personId: 'p1'})).toBe('g:g1|p:p1')
  expect(new Set([draftKey({}), draftKey({groupId: 'g1'}), draftKey({groupId: 'g2'}), draftKey({personId: 'g1'})]).size).toBe(4)
})

test('a form Ask prefilled owns no draft slot, so it can neither overwrite nor clear the saved draft', () => {
  expect(draftContextFor({groupId: 'g1'}, true)).toBeUndefined()
  expect(draftContextFor({groupId: 'g1'}, false)).toEqual({groupId: 'g1'})
})
