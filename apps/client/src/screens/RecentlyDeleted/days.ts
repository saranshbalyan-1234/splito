const DAY_MS = 86_400_000

/** Whole days an item has left in the bin (at least 1 while it is listed). */
export function daysLeft(deletedAt: number, days: number, now: number) {
  return Math.max(1, Math.ceil((deletedAt + days * DAY_MS - now) / DAY_MS))
}
