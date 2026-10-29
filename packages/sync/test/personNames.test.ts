import {beforeEach, expect, test} from 'bun:test'

import {acceptFriendRequest, receiveFriendRequest, sendFriendRequest} from '../src/friends'
import {createGroup, createPerson, displayPerson, ensureMe, type Person, updatePerson} from '../src/mutations'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type Entity, type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let ctx: MutationCtx
let n = 0
beforeEach(async () => {
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => 1_000_000, newId: () => 'id' + ++n}
})

test('every person-name save path capitalises word by word (owner 181)', async () => {
  expect((await ensureMe(s, ctx, ' saransh  balyan ')).data.name).toBe('Saransh Balyan')
  const a = await createPerson(s, ctx, {name: 'anne-marie  d’souza'})
  expect(a.data.name).toBe('Anne-Marie D’souza')
  expect((await updatePerson(s, ctx, a.id, {name: 'mcDonald x'})).data.name).toBe('McDonald X')
  const out = await sendFriendRequest(s, ctx, {contact: {kind: 'email', value: 'z@example.com'}, name: 'zoe hart', reach: 'on-splito'})
  expect(out.data.name).toBe('Zoe Hart')
  const inc = await receiveFriendRequest(s, ctx, {id: 'r1', accountId: 'acc-r', name: 'riya sharma', contact: null})
  expect(inc.data.name).toBe('Riya Sharma')
  expect((await acceptFriendRequest(s, ctx, 'r1')).person.data.name).toBe('Riya Sharma')
})

test('a contact standing in for a name, group names and titles are left alone', async () => {
  await ensureMe(s, ctx, 'Me')
  const c = {kind: 'email', value: 'amy@example.com'} as const
  expect((await createPerson(s, ctx, {name: '', contact: c})).data.name).toBe('amy@example.com')
  expect((await createGroup(s, ctx, {name: 'goa getaway', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: []})).data.name).toBe('goa getaway')
})

test('displayPerson fixes old lower-case rows and returns a correct row as is', () => {
  const row = (name: string, contact?: Person['contact']) => ({id: 'p', data: {name, isMe: false, ...(contact ? {contact} : {})}}) as Entity<Person>
  expect(displayPerson(row('saransh balyan')).data.name).toBe('Saransh Balyan')
  const ok = row('Saransh Balyan')
  expect(displayPerson(ok)).toBe(ok)
  const mail = row('amy@example.com', {kind: 'email', value: 'amy@example.com'})
  expect(displayPerson(mail)).toBe(mail)
})
