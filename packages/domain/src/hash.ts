const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK = (1n << 64n) - 1n

/** 64-bit FNV-1a over UTF-16 code units, as 16 hex chars. Fingerprint only — not cryptographic. */
export function fnv1a64(s: string): string {
  let h = FNV_OFFSET
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i))
    h = (h * FNV_PRIME) & MASK
  }
  return h.toString(16).padStart(16, '0')
}
