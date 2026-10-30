import {describe, expect, test} from 'bun:test'

import {createPressInGate, isPlainPrimaryPress, PRESS_IN_CLICK_WINDOW_MS} from '#/lib/hooks/pressIn'

describe('createPressInGate', () => {
  test('the click that follows a press-in is swallowed once', () => {
    let t = 0
    const gate = createPressInGate(() => t)
    gate.acted()
    t = 120
    expect(gate.swallowsClick()).toBe(true)
    expect(gate.swallowsClick()).toBe(false)
  })

  test('a click-only activation (Enter, a screen reader) with no press-in is never swallowed', () => {
    const gate = createPressInGate(() => 5000)
    expect(gate.swallowsClick()).toBe(false)
  })

  test('a press-in whose release never clicked does not swallow a later activation', () => {
    let t = 0
    const gate = createPressInGate(() => t)
    gate.acted() // dragged off, cancelled: no click came
    t = PRESS_IN_CLICK_WINDOW_MS + 1
    expect(gate.swallowsClick()).toBe(false)
  })
})

describe('isPlainPrimaryPress', () => {
  test('plain primary presses act in place; modifiers and other buttons keep the browser default', () => {
    expect(isPlainPrimaryPress({})).toBe(true)
    expect(isPlainPrimaryPress({button: 0})).toBe(true)
    for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) expect(isPlainPrimaryPress({[key]: true})).toBe(false)
    expect(isPlainPrimaryPress({button: 1})).toBe(false)
    expect(isPlainPrimaryPress({button: 2})).toBe(false)
  })
})
