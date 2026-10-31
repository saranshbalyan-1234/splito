import {expect, test} from 'bun:test'
import {type Entity, type Group, type Person} from '@splito/sync'

import {countFriends, countGroups, yearRange} from './stats'

const person = (id: string, data: Partial<Person>) => ({id, data: {name: id, isMe: false, ...data}}) as Entity<Person>
const group = (id: string, data: Partial<Group>) => ({id, data: {name: id, members: [], ...data}}) as unknown as Entity<Group>

test('friends are everyone but me', () => {
  expect(countFriends([person('me', {isMe: true}), person('a', {}), person('b', {})])).toBe(2)
  expect(countFriends([])).toBe(0)
})

test('groups count the ones still running', () => {
  expect(countGroups([group('g1', {}), group('g2', {}), group('g3', {archived: true}), group('g4', {inactive: true})])).toBe(2)
  expect(countGroups([])).toBe(0)
})

test('this year runs from 1 January to 31 December', () => {
  expect(yearRange('2026-10-31')).toEqual({from: '2026-01-01', to: '2026-12-31'})
  expect(yearRange('2024-02-29')).toEqual({from: '2024-01-01', to: '2024-12-31'})
})
