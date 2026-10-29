import {expect, test} from 'bun:test'

import {isInStore} from './inStore'
import {resolveLink} from './resolve'

const ID = '3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77'
const OTHER = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
const store = (rows: Record<string, string[]>) => ({get: async (type: string, id: string) => (rows[type]?.includes(id) ? {id} : undefined)})

test('a link is in the store when every id it names is', async () => {
  const demo = store({person: [ID], group: [OTHER], writeoff: [OTHER]})
  expect(await isInStore(demo, resolveLink(`/people/${ID}`).target)).toBe(true)
  expect(await isInStore(demo, resolveLink(`/people/${OTHER}`).target)).toBe(false)
  expect(await isInStore(demo, resolveLink(`/groups/${OTHER}/balances`).target)).toBe(true)
  expect(await isInStore(demo, resolveLink(`/groups/${ID}`).target)).toBe(false)
  expect(await isInStore(demo, resolveLink(`/payment/${OTHER}`).target)).toBe(true)
  expect(await isInStore(demo, resolveLink(`/expense/${ID}`).target)).toBe(false)
})

test('ids in the query count too, and a link with no id is always in', async () => {
  const demo = store({person: [ID]})
  expect(await isInStore(demo, resolveLink(`/expense/new?personId=${ID}`).target)).toBe(true)
  expect(await isInStore(demo, resolveLink(`/expense/new?groupId=${OTHER}`).target)).toBe(false)
  expect(await isInStore(demo, resolveLink('/groups').target)).toBe(true)
})
