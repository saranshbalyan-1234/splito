import {describe, expect, test} from 'bun:test'

import {createOpenedTracker, type Timers} from '#/lib/hooks/openedTracker'

function fake() {
  let now = 0
  let nextId = 1
  const pending = new Map<number, {at: number; cb: () => void}>()
  const timers: Timers = {
    set(cb, ms) {
      const id = nextId++
      pending.set(id, {at: now + ms, cb})
      return id
    },
    clear(h) {
      pending.delete(h as number)
    },
  }
  const advance = (ms: number) => {
    const target = now + ms
    for (;;) {
      const due = [...pending.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      pending.delete(due[0])
      now = due[1].at
      due[1].cb()
    }
    now = target
  }
  return {timers, advance}
}

const make = () => {
  const f = fake()
  let opened = 0
  const t = createOpenedTracker({onOpened: () => opened++, timers: f.timers, quietMs: 16, fallbackMs: 700})
  return {...f, t, opened: () => opened}
}

describe('createOpenedTracker', () => {
  test('a screen with no transition (the first tab on a cold start) opens after a frame, not after the fallback', () => {
    const s = make()
    s.advance(15)
    expect(s.opened()).toBe(0)
    s.advance(2)
    expect(s.opened()).toBe(1)
  })

  test('a transition holds it until transitionEnd', () => {
    const s = make()
    s.t.transitionStart()
    s.advance(300)
    expect(s.opened()).toBe(0)
    s.t.transitionEnd(false)
    expect(s.opened()).toBe(1)
  })

  test('a closing transition end does not open it', () => {
    const s = make()
    s.t.transitionStart()
    s.t.transitionEnd(true)
    expect(s.opened()).toBe(0)
  })

  test('the fallback opens it when the end never comes, and only once', () => {
    const s = make()
    s.t.transitionStart()
    s.advance(699)
    expect(s.opened()).toBe(0)
    s.advance(2)
    expect(s.opened()).toBe(1)
    s.t.transitionEnd(false)
    s.advance(2000)
    expect(s.opened()).toBe(1)
  })

  test('disposed, it never opens', () => {
    const s = make()
    s.t.dispose()
    s.advance(2000)
    expect(s.opened()).toBe(0)
  })
})
