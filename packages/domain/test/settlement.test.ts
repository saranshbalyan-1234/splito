import {describe, expect, test} from 'bun:test'
import fc from 'fast-check'

import {type EdgeRule, type PlanMode, planSettlement, type SettlementRules, type Transfer} from '../src/settlement'

const none: SettlementRules = {allowListOnly: false, edges: {}}

const ids = ['A', 'B', 'C', 'D', 'E']
const arbNet = fc
  .tuple(fc.subarray(ids, {minLength: 2}), fc.array(fc.bigInt({min: -500n, max: 500n}), {minLength: 5, maxLength: 5}))
  .map(([ms, vs]) => {
    const net: Record<string, bigint> = {}
    let s = 0n
    ms.slice(0, -1).forEach((m, i) => {
      net[m] = vs[i]!
      s += vs[i]!
    })
    net[ms.at(-1)!] = -s
    return net
  })
const arbRules = fc.record({
  allowListOnly: fc.boolean(),
  edges: fc.dictionary(
    fc.tuple(fc.constantFrom(...ids), fc.constantFrom(...ids)).map(([a, b]) => `${a}>${b}`),
    fc.constantFrom<EdgeRule>('allowed', 'preferred', 'excluded'),
  ),
})
const arbMode = fc.constantFrom<PlanMode>('direct', 'transit')

function applyTransfers(net: Record<string, bigint>, ts: Transfer[]) {
  const n = {...net}
  for (const t of ts) {
    n[t.from] = (n[t.from] ?? 0n) + t.amount
    n[t.to] = (n[t.to] ?? 0n) - t.amount
  }
  return Object.values(n)
}

describe('planSettlement (A07)', () => {
  const net = {A: -100n, B: 0n, C: 100n}
  const rules: SettlementRules = {allowListOnly: false, edges: {'A>C': 'excluded'}}

  test('transit routes via B', () =>
    expect(planSettlement(net, rules, 'transit')).toMatchObject({
      status: 'ok',
      transfers: [
        {from: 'A', to: 'B', amount: 100n},
        {from: 'B', to: 'C', amount: 100n},
      ],
    }))
  test('direct infeasible', () => expect(planSettlement(net, rules, 'direct')).toMatchObject({status: 'infeasible', stuck: ['A']}))
  test('all A outbound excluded', () => {
    const r: SettlementRules = {allowListOnly: false, edges: {'A>B': 'excluded', 'A>C': 'excluded'}}
    for (const m of ['direct', 'transit'] as const) expect(planSettlement(net, r, m).status).toBe('infeasible')
  })
  test('no excluded edge ever used', () =>
    fc.assert(
      fc.property(arbNet, arbRules, arbMode, (n, r, m) => {
        const p = planSettlement(n, r, m)
        return p.status !== 'ok' || p.transfers.every(t => r.edges[`${t.from}>${t.to}`] !== 'excluded')
      }),
    ))
  test('allow-list plans only use listed edges', () =>
    fc.assert(
      fc.property(arbNet, arbRules, arbMode, (n, r, m) => {
        const p = planSettlement(n, {...r, allowListOnly: true}, m)
        return p.status !== 'ok' || p.transfers.every(t => ['allowed', 'preferred'].includes(r.edges[`${t.from}>${t.to}`] ?? ''))
      }),
    ))
  test('ok plans settle every balance exactly', () =>
    fc.assert(
      fc.property(arbNet, arbRules, arbMode, (n, r, m) => {
        const p = planSettlement(n, r, m)
        return p.status !== 'ok' || applyTransfers(n, p.transfers).every(v => v === 0n)
      }),
    ))
  test('no rules is always feasible in both modes', () =>
    fc.assert(fc.property(arbNet, arbMode, (n, m) => planSettlement(n, none, m).status === 'ok')))
  test('preferred wins deterministically', () => {
    const n = {A: -100n, B: 100n, C: 100n, D: -100n}
    const r: SettlementRules = {allowListOnly: false, edges: {'A>C': 'preferred', 'D>B': 'preferred'}}
    const p = planSettlement(n, r, 'direct')
    expect(p).toMatchObject({
      status: 'ok',
      transfers: [
        {from: 'A', to: 'C', amount: 100n},
        {from: 'D', to: 'B', amount: 100n},
      ],
    })
    expect(planSettlement({D: -100n, C: 100n, B: 100n, A: -100n}, r, 'direct').hash).toBe(p.hash)
  })
  test('hash changes when rules change', () =>
    expect(planSettlement({A: -1n, B: 1n}, none, 'direct').hash).not.toBe(
      planSettlement({A: -1n, B: 1n}, {allowListOnly: false, edges: {'B>A': 'excluded'}}, 'direct').hash,
    ))
  test('allow-list restricts', () => expect(planSettlement({A: -100n, C: 100n}, {allowListOnly: true, edges: {}}, 'direct').status).toBe('infeasible'))
  test('no rules = all edges', () => expect(planSettlement({A: -100n, C: 100n}, none, 'direct').status).toBe('ok'))
  test('all settled = empty plan', () => expect(planSettlement({A: 0n, B: 0n}, none, 'direct')).toMatchObject({status: 'ok', transfers: []}))
  test('unbalanced throws', () => expect(() => planSettlement({A: -1n}, none, 'direct')).toThrow('UNBALANCED'))
})
