import {addDays, type DateRange, periodRange, type WeekStart} from '@splito/domain'

import {type PeriodInfo, type PeriodSpec} from './types'

const pad = (n: number) => String(n).padStart(2, '0')
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/**
 * The dates a period means on `today`. `all` has no dates of its own (it is
 * whatever the ledger holds, per currency), so it returns null.
 */
export function resolvePeriod(spec: PeriodSpec, today: string, weekStart: WeekStart): PeriodInfo | null {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  const info = (r: DateRange, extra: Partial<PeriodInfo> = {}): PeriodInfo => ({kind: spec.kind, from: r.from, to: r.to, ...extra})
  switch (spec.kind) {
    case 'all':
      return null
    case 'today':
      return info({from: today, to: today})
    case 'yesterday': {
      const d = addDays(today, -1)
      return info({from: d, to: d})
    }
    case 'week':
    case 'month':
    case 'year':
      return info(periodRange(spec.kind, today, weekStart, spec.offset), {offset: spec.offset})
    case 'days':
      return info({from: addDays(today, 1 - spec.n), to: today}, {n: spec.n})
    case 'months': {
      const first = new Date(Date.UTC(y, m - spec.n, 1))
      return info({from: `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-01`, to: today}, {n: spec.n})
    }
    case 'monthOf': {
      // No year: the latest such month that has begun.
      const year = spec.year ?? (spec.month > m ? y - 1 : y)
      return info({from: `${year}-${pad(spec.month)}-01`, to: `${year}-${pad(spec.month)}-${pad(lastDayOf(year, spec.month))}`})
    }
    case 'yearOf':
      return info({from: `${spec.year}-01-01`, to: `${spec.year}-12-31`})
  }
}
