import {DomainError} from './errors'

/**
 * Splits `total` minor units across weights with no loss. Largest remainder method:
 * every id gets floor(total * w / W), and the leftover units go one each to the
 * largest fractional remainders, ties broken by id (code-unit order, smallest first).
 */
export function allocate(total: bigint, weights: ReadonlyArray<{id: string; weight: bigint}>): Record<string, bigint> {
  if (weights.length === 0) throw new DomainError('EMPTY_PARTICIPANTS')
  if (weights.some(w => w.weight <= 0n)) throw new DomainError('NON_POSITIVE_WEIGHT')
  if (new Set(weights.map(w => w.id)).size !== weights.length) throw new DomainError('DUPLICATE_PARTICIPANT')

  const neg = total < 0n
  const t = neg ? -total : total
  const W = weights.reduce((a, w) => a + w.weight, 0n)
  const parts = weights.map(w => ({id: w.id, quota: (t * w.weight) / W, rem: (t * w.weight) % W}))
  let leftover = t - parts.reduce((a, p) => a + p.quota, 0n)
  const order = [...parts].sort((x, y) => (x.rem === y.rem ? (x.id < y.id ? -1 : 1) : x.rem > y.rem ? -1 : 1))
  for (const p of order) {
    if (leftover === 0n) break
    p.quota += 1n
    leftover -= 1n
  }
  return Object.fromEntries(parts.map(p => [p.id, neg ? -p.quota : p.quota]))
}
