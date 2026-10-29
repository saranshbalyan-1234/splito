import {describe, expect, test} from 'bun:test'

import {deferredSlot} from '#/components/Deferred'

const base = {ready: false, when: true, wasReadyAtMount: true, sameSize: false}

describe('deferredSlot', () => {
  test('a hot body waits as an empty slot, not a skeleton', () => {
    expect(deferredSlot(base)).toBe('empty')
  })
  test('missing data at mount shows the skeleton, then the body', () => {
    expect(deferredSlot({...base, when: false, wasReadyAtMount: false})).toBe('fallback')
    expect(deferredSlot({...base, ready: true, wasReadyAtMount: false})).toBe('body')
  })
  test('data cleared after the body showed: the skeleton in the same render, never stale rows', () => {
    expect(deferredSlot({...base, ready: false, when: false})).toBe('fallback')
  })
  test('sameSize keeps the skeleton while a hot block waits', () => {
    expect(deferredSlot({...base, sameSize: true})).toBe('fallback')
  })
})
