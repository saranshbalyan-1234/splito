import {plural, t} from '@lingui/core/macro'

const DAY = 86_400_000

/** "today", "yesterday", "3 days ago": requests move in days. Shared by the friend and group request rows. */
export function ago(ms: number) {
  // Rounded: the minute tick lags the clock, so floor would read 2 days as "yesterday".
  const days = Math.round(ms / DAY)
  if (days <= 0) return t`today`
  return plural(days, {one: 'yesterday', other: '# days ago'})
}
