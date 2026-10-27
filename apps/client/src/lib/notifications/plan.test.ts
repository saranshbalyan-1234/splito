import {expect, test} from 'bun:test'

import {alertWindow, dueBetween, type LiveReminder, planSync, rearmTime, reminderKey} from './plan'

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

/* The rolling window of one-time alerts that stands in for an OS repeat (a repeat trigger cannot start later or skip a short month). */

test('a repeat is armed as the next few one-time alerts: up to 8, within 60 days, at least one', () => {
  const now = new Date(2026, 9, 27, 14).getTime()
  const daily = alertWindow(new Date(2026, 9, 1, 9).getTime(), 'daily', now)
  expect(daily).toHaveLength(8)
  expect(daily[0]).toBe(new Date(2026, 9, 28, 9).getTime())
  expect(alertWindow(new Date(2026, 9, 1, 9).getTime(), 'weekly', now)).toHaveLength(8)
  // Monthly: only the occurrences within 60 days.
  expect(alertWindow(new Date(2026, 8, 15, 9).getTime(), 'monthly', now)).toEqual([new Date(2026, 10, 15, 9).getTime(), new Date(2026, 11, 15, 9).getTime()])
  // A once-only reminder is its one time; a first alert further than 60 days off still gets armed.
  expect(alertWindow(new Date(2027, 2, 1, 9).getTime(), 'monthly', now)).toEqual([new Date(2027, 2, 1, 9).getTime()])
  expect(alertWindow(new Date(2026, 9, 1, 9).getTime(), 'none', now)).toEqual([])
})

test('"Next month" + Monthly still has a future alert armed after the first one fires', () => {
  const first = new Date(2026, 10, 27, 9).getTime()
  const afterFirst = new Date(2026, 10, 28, 8).getTime()
  const window = alertWindow(first, 'monthly', afterFirst)
  // The next one (27 December) is armed; January is past the 60 days and joins at the next top-up.
  expect(window).toEqual([new Date(2026, 11, 27, 9).getTime()])
  expect(rearmTime(window, afterFirst)).toBe(new Date(2026, 11, 26, 9).getTime())
})

test('a monthly reminder on the 29th to 31st lands on the last day of short months', () => {
  const jan31 = new Date(2026, 0, 31, 9).getTime()
  expect(alertWindow(jan31, 'monthly', new Date(2026, 1, 1).getTime())).toEqual([new Date(2026, 1, 28, 9).getTime(), new Date(2026, 2, 31, 9).getTime()])
  const jan29 = new Date(2026, 0, 29, 9).getTime()
  expect(alertWindow(jan29, 'monthly', new Date(2026, 2, 1).getTime())).toEqual([new Date(2026, 2, 29, 9).getTime(), new Date(2026, 3, 29, 9).getTime()])
})

test('the window stays at the same local hour across a DST change', () => {
  const prev = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    // Clocks go back on 1 November 2026.
    const dueAt = new Date(2026, 9, 30, 9).getTime()
    const window = alertWindow(dueAt, 'daily', new Date(2026, 9, 30, 10).getTime())
    expect(window.slice(0, 4).map(ms => new Date(ms).getHours())).toEqual([9, 9, 9, 9])
    expect(window[1]! - window[0]!).toBe(25 * 3_600_000)
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
})

test('re-planning is due near the end of the window, and on every foreground for a repeat', () => {
  const weekly = r('w', at(1), 'weekly')
  const now = at(10)
  const window = alertWindow(weekly.dueAt, 'weekly', now)
  const rearmAt = rearmTime(window, now)!
  expect(rearmAt).toBeLessThan(window[window.length - 1]!)
  expect(rearmAt).toBeGreaterThan(now)
  const armed = {w: {osIds: ['a'], key: reminderKey(weekly), rearmAt}}
  expect(planSync([weekly], armed, now)).toEqual({cancel: [], arm: []})
  // Coming back to the app tops the window up.
  expect(planSync([weekly], armed, now, {refresh: true})).toEqual({cancel: ['w'], arm: [weekly]})
  // A once-only reminder is left alone.
  const once = r('o', at(20))
  const armedOnce = {o: {osIds: ['a'], key: reminderKey(once), rearmAt: null}}
  expect(planSync([once], armedOnce, now, {refresh: true})).toEqual({cancel: [], arm: []})
})
