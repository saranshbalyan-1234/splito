import {describe, expect, test} from 'bun:test'

import {disputedInGroup, disputedWith, withoutDisputed} from '../src/disputed'

const pair = (currency: string, amount: bigint, groupId: string | null = null) => ({groupId, currency, amount})

describe('disputedWith', () => {
  test('the part of a balance on disputed records, per currency', () => {
    expect(disputedWith([pair('INR', 400n), pair('EUR', 90n)], {INR: 1200n, EUR: 90n}, true)).toEqual({INR: 400n, EUR: 90n})
  })
  test('it points the way the balance does, and never exceeds it', () => {
    expect(disputedWith([pair('INR', -300n)], {INR: 1200n}, true)).toEqual({})
    expect(disputedWith([pair('INR', -300n)], {INR: -200n}, true)).toEqual({INR: 200n})
    expect(disputedWith([pair('INR', 5000n)], {INR: 1200n}, true)).toEqual({INR: 1200n})
  })
  test('groups count only when groups are included', () => {
    const pairs = [pair('INR', 400n), pair('INR', 250n, 'g1')]
    expect(disputedWith(pairs, {INR: 1000n}, true)).toEqual({INR: 650n})
    expect(disputedWith(pairs, {INR: 1000n}, false)).toEqual({INR: 400n})
  })
  test('a settled currency, or no pairs, has nothing', () => {
    expect(disputedWith([pair('INR', 400n)], {INR: 0n}, true)).toEqual({})
    expect(disputedWith(undefined, {INR: 100n}, true)).toEqual({})
  })
})

describe('disputedInGroup', () => {
  const row = (personId: string, currency: string, amount: bigint) => ({personId, groupId: 'g', currency, amount, count: 1})
  test('the group total is what the disputed records move; mine points the way my net does', () => {
    const rows = [row('me', 'INR', 600n), row('bob', 'INR', -400n), row('ann', 'INR', -200n), row('bob', 'EUR', 90n), row('me', 'EUR', -90n)]
    expect(disputedInGroup(rows, 'me', {INR: 1000n, EUR: -50n})).toEqual({total: {INR: 600n, EUR: 90n}, mine: {INR: 600n, EUR: 50n}})
  })
  test('nothing disputed, or a settled net, has no line', () => {
    expect(disputedInGroup(undefined, 'me', {INR: 100n})).toEqual({total: {}, mine: {}})
    expect(disputedInGroup([row('me', 'INR', 100n)], 'me', {INR: 0n}).mine).toEqual({})
    expect(disputedInGroup([row('me', 'INR', -100n)], 'me', {INR: 300n}).mine).toEqual({})
  })
})

describe('withoutDisputed', () => {
  const row = (personId: string, currency: string, amount: bigint) => ({personId, groupId: 'g', currency, amount, count: 1})
  test('takes the disputed part out of the nets and says how much was left out', () => {
    const nets = {INR: {me: 700n, bob: -300n, ann: -400n}}
    const rows = [row('me', 'INR', 300n), row('bob', 'INR', -300n)]
    expect(withoutDisputed(nets, rows)).toEqual({nets: {INR: {me: 400n, bob: 0n, ann: -400n}}, leftOut: {INR: 300n}})
    expect(nets.INR.me).toBe(700n)
  })
  test('with nothing disputed the nets are untouched', () => {
    expect(withoutDisputed({INR: {me: 5n, bob: -5n}}, [])).toEqual({nets: {INR: {me: 5n, bob: -5n}}, leftOut: {}})
  })
  test('the rest still nets to zero in every currency', () => {
    const nets = {INR: {me: 700n, bob: -300n, ann: -400n}, EUR: {me: -90n, bob: 90n}}
    const rows = [row('me', 'INR', 300n), row('bob', 'INR', -300n), row('me', 'EUR', -90n), row('bob', 'EUR', 90n)]
    for (const net of Object.values(withoutDisputed(nets, rows).nets)) expect(Object.values(net).reduce((a, b) => a + b, 0n)).toBe(0n)
  })
})
