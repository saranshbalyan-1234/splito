import {describe, expect, test} from 'bun:test'

import {disputedInGroup, disputedWith, withoutDisputed, withoutDisputedParts} from '../src/disputed'

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
  const zero = (nets: Record<string, Record<string, bigint>>) => {
    for (const net of Object.values(nets)) expect(Object.values(net).reduce((a, b) => a + b, 0n)).toBe(0n)
  }

  test('takes the disputed part out of the nets and says how much was left out', () => {
    const nets = {INR: {me: 700n, bob: -300n, ann: -400n}}
    const rows = [row('me', 'INR', 300n), row('bob', 'INR', -300n)]
    expect(withoutDisputed(nets, rows)).toEqual({nets: {INR: {me: 400n, bob: 0n, ann: -400n}}, leftOut: {INR: 300n}})
    expect(nets.INR.me).toBe(700n)
  })

  test('with nothing disputed the nets are untouched', () => {
    expect(withoutDisputed({INR: {me: 5n, bob: -5n}}, [])).toEqual({nets: {INR: {me: 5n, bob: -5n}}, leftOut: {}})
  })

  test('a settled group that then had a record disputed has no plan and nothing left out', () => {
    // The dinner was paid back in full: nets are zero, but the dinner is disputed afterwards.
    const out = withoutDisputed({INR: {me: 0n, bob: 0n}}, [row('me', 'INR', 600n), row('bob', 'INR', -600n)])
    expect(out).toEqual({nets: {INR: {me: 0n, bob: 0n}}, leftOut: {}})
  })

  test('a part-repaid balance loses at most what is still owed, never flips', () => {
    // Bob owed 600 on the disputed dinner, paid 300: 300 is still owed.
    const out = withoutDisputed({INR: {me: 300n, bob: -300n}}, [row('me', 'INR', 600n), row('bob', 'INR', -600n)])
    expect(out).toEqual({nets: {INR: {me: 0n, bob: 0n}}, leftOut: {INR: 300n}})
  })

  test('a disputed "payment not received" never asks anyone to pay twice', () => {
    // Bob paid me 500 (recorded), so nothing is owed; the payment is disputed: its part is +500 for Bob, -500 for me.
    const out = withoutDisputed({INR: {me: 0n, bob: 0n}}, [row('bob', 'INR', 500n), row('me', 'INR', -500n)])
    expect(out.nets.INR).toEqual({me: 0n, bob: 0n})
    expect(out.leftOut).toEqual({})
    // With 200 still owed by Bob, the payment's part opposes his net, so nothing changes and he is never pushed past zero.
    const part = withoutDisputed({INR: {me: 200n, bob: -200n}}, [row('bob', 'INR', 500n), row('me', 'INR', -500n)])
    expect(part.nets.INR).toEqual({me: 200n, bob: -200n})
  })

  test('a net that opposes the disputed part is left alone', () => {
    const out = withoutDisputed({INR: {me: 700n, bob: -700n}}, [row('me', 'INR', -300n), row('bob', 'INR', 300n)])
    expect(out).toEqual({nets: {INR: {me: 700n, bob: -700n}}, leftOut: {}})
  })

  test('the side that lost more is scaled back so every currency still sums to zero, and no net flips or grows', () => {
    const nets = {INR: {me: 1000n, bob: -300n, ann: -700n}, EUR: {me: -90n, bob: 90n}}
    const rows = [row('me', 'INR', 900n), row('bob', 'INR', -300n), row('ann', 'INR', -300n), row('me', 'EUR', -90n), row('bob', 'EUR', 90n)]
    const out = withoutDisputed(nets, rows)
    zero(out.nets)
    for (const [c, net] of Object.entries(nets))
      for (const [p, n] of Object.entries(net)) {
        const a = out.nets[c]![p]!
        expect(a === 0n || a > 0n === n > 0n).toBe(true)
        expect(a < 0n ? -a : a).toBeLessThanOrEqual(n < 0n ? -n : n)
      }
    // INR: me could lose 900, bob 300 and ann 300 (600 on the paying side): 600 is what leaves.
    expect(out.leftOut.INR).toBe(600n)
    expect(out.leftOut.EUR).toBe(90n)
  })

  test('property: any nets and any disputed rows keep the nets summing to zero, in range and never flipped', () => {
    let seed = 7
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n)
    for (let run = 0; run < 300; run++) {
      const people = ['a', 'b', 'c', 'd']
      const net: Record<string, bigint> = {}
      let sum = 0n
      for (const p of people.slice(0, 3)) {
        net[p] = BigInt(rnd(2000) - 1000)
        sum += net[p]!
      }
      net.d = -sum
      const rows = people.map(p => row(p, 'INR', BigInt(rnd(1600) - 800)))
      const out = withoutDisputed({INR: net}, rows)
      zero(out.nets)
      for (const p of people) {
        const n = net[p]!
        const a = out.nets.INR![p]!
        expect(a === 0n || a > 0n === n > 0n).toBe(true)
        expect(a < 0n ? -a : a).toBeLessThanOrEqual(n < 0n ? -n : n)
      }
    }
  })
})

describe('withoutDisputedParts', () => {
  test('takes the disputed amount off the parts pointing the way the balance does, in proportion, never below zero', () => {
    const parts = [{groupId: null, amount: 400n}, {groupId: 'g', amount: 600n}, {groupId: 'h', amount: -100n}]
    const out = withoutDisputedParts(parts, 1, 500n)
    expect(out.map(p => p.amount)).toEqual([200n, 300n, -100n])
    expect(withoutDisputedParts(parts, 1, 5000n).map(p => p.amount)).toEqual([0n, 0n, -100n])
    expect(withoutDisputedParts(parts, 1, 0n)).toEqual(parts)
    expect(withoutDisputedParts([{groupId: null, amount: -300n}], -1, 100n)[0]!.amount).toBe(-200n)
  })
})
