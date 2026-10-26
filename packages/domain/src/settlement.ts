import {DomainError} from './errors'
import {fnv1a64} from './hash'

export type EdgeRule = 'allowed' | 'preferred' | 'excluded'

/** Directed payer→recipient rules, keyed `${from}>${to}`. */
export interface SettlementRules {
  allowListOnly: boolean
  edges: Record<string, EdgeRule>
}

export type PlanMode = 'direct' | 'transit'

export interface Transfer {
  from: string
  to: string
  amount: bigint
}

export type Plan =
  | {status: 'ok'; mode: PlanMode; transfers: Transfer[]; hash: string}
  | {status: 'infeasible'; mode: PlanMode; reason: 'NO_ROUTE'; stuck: string[]; hash: string}

// Preferred is cheaper than allowed; any extra hop costs more than a preference saves.
const COST = {preferred: 1, allowed: 3} as const

interface Arc {
  to: number
  cap: bigint
  cost: number
  rev: number
}

/**
 * Min-cost feasible flow on the authorized edge graph (successive shortest paths,
 * Bellman-Ford, deterministic by member id). Minimizes routing cost, not transfer count.
 * net < 0 owes, net > 0 is owed.
 */
export function planSettlement(net: Record<string, bigint>, rules: SettlementRules, mode: PlanMode): Plan {
  const members = Object.keys(net).sort()
  if (members.reduce((a, m) => a + net[m]!, 0n) !== 0n) throw new DomainError('UNBALANCED')
  const hash = fnv1a64(
    JSON.stringify([
      members.map(m => [m, net[m]!.toString()]),
      rules.allowListOnly,
      Object.entries(rules.edges).sort(([a], [b]) => (a < b ? -1 : 1)),
      mode,
    ]),
  )

  // Nodes: 0 = source, 1..n = members, n+1 = sink.
  const n = members.length
  const S = 0
  const T = n + 1
  const graph: Arc[][] = Array.from({length: n + 2}, () => [])
  const addArc = (u: number, v: number, cap: bigint, cost: number) => {
    graph[u]!.push({to: v, cap, cost, rev: graph[v]!.length})
    graph[v]!.push({to: u, cap: 0n, cost: -cost, rev: graph[u]!.length - 1})
  }

  let totalDebt = 0n
  members.forEach((m, i) => {
    const v = net[m]!
    if (v < 0n) {
      addArc(S, i + 1, -v, 0)
      totalDebt -= v
    } else if (v > 0n) addArc(i + 1, T, v, 0)
  })

  const memberArcs: Array<{from: string; to: string; u: number; idx: number}> = []
  members.forEach((a, i) =>
    members.forEach((b, j) => {
      if (a === b) return
      if (mode === 'direct' && !(net[a]! < 0n && net[b]! > 0n)) return
      const rule = rules.edges[`${a}>${b}`] ?? (rules.allowListOnly ? 'excluded' : 'allowed')
      if (rule === 'excluded') return
      memberArcs.push({from: a, to: b, u: i + 1, idx: graph[i + 1]!.length})
      addArc(i + 1, j + 1, totalDebt, COST[rule])
    }),
  )

  let flow = 0n
  for (;;) {
    const dist: number[] = new Array(n + 2).fill(Infinity)
    const prev: Array<{u: number; idx: number} | null> = new Array(n + 2).fill(null)
    dist[S] = 0
    for (let round = 0; round < n + 1; round++) {
      let changed = false
      for (let u = 0; u < n + 2; u++) {
        if (dist[u] === Infinity) continue
        graph[u]!.forEach((arc, idx) => {
          if (arc.cap > 0n && dist[u]! + arc.cost < dist[arc.to]!) {
            dist[arc.to] = dist[u]! + arc.cost
            prev[arc.to] = {u, idx}
            changed = true
          }
        })
      }
      if (!changed) break
    }
    if (dist[T] === Infinity) break

    let push = totalDebt
    for (let v = T; v !== S; v = prev[v]!.u) {
      const arc = graph[prev[v]!.u]![prev[v]!.idx]!
      if (arc.cap < push) push = arc.cap
    }
    for (let v = T; v !== S; v = prev[v]!.u) {
      const arc = graph[prev[v]!.u]![prev[v]!.idx]!
      arc.cap -= push
      graph[arc.to]![arc.rev]!.cap += push
    }
    flow += push
  }

  if (flow < totalDebt) {
    const stuck = graph[S]!.filter(arc => arc.cost === 0 && arc.cap > 0n).map(arc => members[arc.to - 1]!)
    return {status: 'infeasible', mode, reason: 'NO_ROUTE', stuck: stuck.sort(), hash}
  }

  const transfers = memberArcs
    .map(({from, to, u, idx}) => ({from, to, amount: totalDebt - graph[u]![idx]!.cap}))
    .filter(t => t.amount > 0n)
  return {status: 'ok', mode, transfers, hash}
}
