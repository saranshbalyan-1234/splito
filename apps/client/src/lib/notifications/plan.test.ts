import {expect, test} from 'bun:test'

import {dueBetween, type LiveReminder, planSync, reminderKey} from './plan'

const at = (d: number, h = 9) => new Date(2026, 10, d, h).getTime()
const r = (id: string, dueAt: number, repeat: LiveReminder['repeat'] = 'none', body = 'Settle up with Riya'): LiveReminder => ({id, dueAt, repeat, personId: 'riya', groupId: null, title: 'Splito reminder', body})
const now = at(1)

test('a new reminder is armed once, an unchanged one is left alone', () => {
  const a = r('a', at(5))
  expect(planSync([a], {}, now)).toEqual({cancel: [], arm: [a]})
  const armed = {a: {osIds: ['os1'], key: reminderKey(a), rearmAt: null}}
  expect(planSync([a], armed, now)).toEqual({cancel: [], arm: []})
})

test('a cancelled reminder, and one edited to another time, are cancelled; the edit is armed again', () => {
  const a = r('a', at(5))
  const armed = {a: {osIds: ['os1'], key: reminderKey(a), rearmAt: null}}
  expect(planSync([], armed, now)).toEqual({cancel: ['a'], arm: []})
  const moved = r('a', at(6))
  expect(planSync([moved], armed, now)).toEqual({cancel: ['a'], arm: [moved]})
  // A rename or a language switch changes the words, so it is armed again.
  const renamed = r('a', at(5), 'none', 'Riya से हिसाब करें')
  expect(planSync([renamed], armed, now)).toEqual({cancel: ['a'], arm: [renamed]})
})

test('a one-off whose time has passed is not armed (and an armed one is cleared)', () => {
  const past = r('p', at(0))
  expect(planSync([past], {}, now)).toEqual({cancel: [], arm: []})
  const armed = {p: {osIds: ['os1'], key: 'old', rearmAt: null}}
  expect(planSync([past], armed, now)).toEqual({cancel: ['p'], arm: []})
})

test('a one-shot standing in for a repeat is re-planned once it is past', () => {
  const weekly = r('w', at(20), 'weekly')
  const armed = {w: {osIds: ['os1'], key: reminderKey(weekly), rearmAt: at(20, 10)}}
  expect(planSync([weekly], armed, at(19))).toEqual({cancel: [], arm: []})
  expect(planSync([weekly], armed, at(21))).toEqual({cancel: ['w'], arm: [weekly]})
})

test('what fired in a window: one entry per reminder, soonest first, repeats included', () => {
  const live = [r('once', at(3)), r('later', at(9)), r('daily', at(1), 'daily'), r('old', at(0))]
  expect(dueBetween(live, at(2), at(4))).toEqual([
    {id: 'daily', at: at(3)},
    {id: 'once', at: at(3)},
  ])
  // The start is exclusive, the end inclusive.
  expect(dueBetween(live, at(3), at(3))).toEqual([])
  expect(dueBetween(live, at(2, 23), at(3))).toEqual([{id: 'daily', at: at(3)}, {id: 'once', at: at(3)}])
})
