/** Smallest card the Overview grid plans for (ARCHITECTURE 26.12, owners 113/114). */
export const MIN_CARD = 240
const MAX_COLUMNS = 3

/**
 * Columns for `count` currency cards in a content area `width` px wide: fit =
 * floor(width / 240) capped at 3, then the balanced rule so rows stay even
 * (1 -> 1, 2 -> 2, 3 -> 3, 4 -> 2 x 2, 5 -> 3 + 2, 6 -> 3 x 2, 7+ -> 3 a row).
 * Unmeasured (0) reads as one column.
 */
export function overviewColumns(width: number, count: number) {
  const fit = Math.max(1, Math.min(MAX_COLUMNS, Math.floor(width / MIN_CARD)))
  if (count <= fit) return Math.max(1, count)
  return fit === 3 && count === 4 ? 2 : fit
}

/** Amount sizes, largest first; below the last one the figure wraps. */
const SIZES = [
  ['text_3xl', 30],
  ['text_2xl', 24],
  ['text_xl', 20],
  ['text_lg', 18],
] as const
/* Tabular bold digits run about 0.62 em; commas and dots are narrower, so this over-estimates and never clips. */
const EM = 0.62

/**
 * The biggest atom whose figure fits `room` px (the card's inner width less
 * the arrow), starting at `from` ('text_2xl' on phones); text_lg when none
 * does, where the figure wraps rather than ellipsize.
 */
export function amountSize(
  text: string,
  room: number,
  from: (typeof SIZES)[number][0] = 'text_3xl',
  fontScale = 1,
) {
  const start = SIZES.findIndex(([name]) => name === from)
  for (const [name, px] of SIZES.slice(start)) {
    if (text.length * px * EM * fontScale <= room) return name
  }
  return 'text_lg'
}
