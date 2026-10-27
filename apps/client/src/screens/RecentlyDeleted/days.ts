const DAY_MS = 86_400_000

/**
 * Whole days an item has left in the bin (at least 1 while it is listed): until its own `purgeAfter`, the end
 * date stamped when it was deleted (decision 102), not the setting as it is now.
 */
export function daysLeft(purgeAfter: number, now: number) {
  return Math.max(1, Math.ceil((purgeAfter - now) / DAY_MS))
}
