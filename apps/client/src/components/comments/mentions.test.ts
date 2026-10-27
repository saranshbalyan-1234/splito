import {expect, test} from 'bun:test'

import {activeMention, insertMention, matchPeople} from './mentions'

const people = [
  {id: 'me', name: 'You'},
  {id: 'r', name: 'Riya Sharma'},
  {id: 's', name: 'Sam Carter'},
  {id: 'a', name: 'Arjun Rao'},
]

test('finds the @ token at the caret', () => {
  expect(activeMention('hi @ri', 6)).toEqual({start: 3, query: 'ri'})
  expect(activeMention('@', 1)).toEqual({start: 0, query: ''})
  expect(activeMention('hi @riya and more', 8)).toEqual({
    start: 3,
    query: 'riya',
  })
})

test('an @ inside a word, or across a line break, is no mention', () => {
  expect(activeMention('mail me@x.com', 13)).toBeNull()
  expect(activeMention('hi\n@ri', 6)).toEqual({start: 3, query: 'ri'})
  expect(activeMention('@ri\nokay', 8)).toBeNull()
  expect(activeMention('no at here', 5)).toBeNull()
})

test('matches a name or any word of it, whole-name starts first', () => {
  expect(matchPeople(people, 'sh').map(p => p.name)).toEqual(['Riya Sharma'])
  expect(matchPeople(people, 'r').map(p => p.name)).toEqual([
    'Riya Sharma',
    'Arjun Rao',
  ])
  expect(matchPeople(people, '').length).toBe(4)
  expect(matchPeople(people, 'zz')).toEqual([])
  expect(matchPeople(people, '', 2)).toHaveLength(2)
})

test('inserting replaces the token and puts the caret after the space', () => {
  const text = 'thanks @sh please'
  const token = activeMention(text, 10)!
  expect(insertMention(text, token, 10, 'Riya Sharma')).toEqual({
    text: 'thanks @Riya Sharma please',
    caret: 19,
  })
  expect(
    insertMention('hi @s', {start: 3, query: 's'}, 5, 'Sam Carter'),
  ).toEqual({text: 'hi @Sam Carter ', caret: 15})
})
