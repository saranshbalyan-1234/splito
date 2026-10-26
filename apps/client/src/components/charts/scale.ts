import {useState} from 'react'
import {type LayoutChangeEvent} from 'react-native'

/**
 * `v / max` as a number in [0, 1], for geometry only (pixels, angles).
 * Amounts themselves stay bigint and are only ever shown via `formatAmount`.
 */
export function fraction(v: bigint, max: bigint): number {
  if (max <= 0n || v <= 0n) return 0
  if (v >= max) return 1
  return Number((v * 1_000_000n) / max) / 1_000_000
}

/** Whole percent of `whole`, computed in bigint so it never drifts from the amounts. */
export function percentOf(part: bigint, whole: bigint): number {
  if (whole <= 0n) return 0
  return Number((part * 1000n) / whole) / 10
}

/** The width a chart gets from its parent, 0 until the first layout. */
export function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0)
  return [
    width,
    e => {
      const w = Math.round(e.nativeEvent.layout.width)
      if (w !== width) setWidth(w)
    },
  ]
}
