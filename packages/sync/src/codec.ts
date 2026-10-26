/** JSON with lossless bigint: 12n <-> {"$bigint":"12"}. */
export function encode(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? {$bigint: x.toString()} : x))
}

export function decode(s: string): unknown {
  return JSON.parse(s, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 1 && typeof x.$bigint === 'string' ? BigInt(x.$bigint) : x,
  )
}
