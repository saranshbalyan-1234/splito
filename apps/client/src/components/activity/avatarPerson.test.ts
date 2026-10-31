/// <reference types="bun" />
import {expect, test} from 'bun:test'
import {type ActivityEvent} from '@splito/sync'

import {avatarPersonId} from './avatarPerson'

const ev = (e: Record<string, unknown>) => e as unknown as ActivityEvent
const requests = new Map([['r1', {data: {personId: 'friend'}}], ['r2', {data: {personId: null}}]])

test('the avatar is who made the change', () => {
  expect(avatarPersonId(ev({entityType: 'expense', kind: 'expense.created', actor: 'riya'}), requests)).toBe('riya')
})

test('a received or accepted friend request shows the friend, and nobody when they are not a person yet', () => {
  const base = {entityType: 'friendRequest', actor: 'me', data: {personId: null}}
  expect(avatarPersonId(ev({...base, kind: 'friendRequest.received', entityId: 'r1'}), requests)).toBe('friend')
  expect(avatarPersonId(ev({...base, kind: 'friendRequest.accepted', entityId: 'r1'}), requests)).toBe('friend')
  expect(avatarPersonId(ev({...base, kind: 'friendRequest.received', entityId: 'r2'}), requests)).toBeUndefined()
  // Falls back to the event's own copy when the request is gone from the snapshot.
  expect(avatarPersonId(ev({...base, kind: 'friendRequest.received', entityId: 'gone', data: {personId: 'from-event'}}), requests)).toBe('from-event')
  // A sent request is the actor's.
  expect(avatarPersonId(ev({...base, kind: 'friendRequest.sent', entityId: 'r1'}), requests)).toBe('me')
})

test('a dispute shows who raised it, and an answer shows who answered', () => {
  const base = {entityType: 'dispute', actor: 'admin', data: {raisedBy: 'sam'}}
  expect(avatarPersonId(ev({...base, kind: 'dispute.opened'}), requests)).toBe('sam')
  for (const kind of ['dispute.accepted', 'dispute.rejected', 'dispute.released'])
    expect(avatarPersonId(ev({...base, kind}), requests)).toBe('admin')
})
