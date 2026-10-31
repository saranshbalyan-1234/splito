import {expect, test} from 'bun:test'

import {historyKind} from './historyKind'

const live = {deleted: false}
const gone = {deleted: true}

test('the first version is created, whatever it holds', () => {
  expect(historyKind(live, undefined)).toBe('created')
  expect(historyKind(gone, undefined)).toBe('created')
})

test('a delete and a restore are told by the version before', () => {
  expect(historyKind(gone, live)).toBe('deleted')
  expect(historyKind(live, gone)).toBe('restored')
})

test('a later live version after a live one is an edit, not a restore', () => {
  expect(historyKind(live, live)).toBe('edited')
  expect(historyKind(gone, gone)).toBe('edited')
})
