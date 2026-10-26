import {DomainError} from './errors'

/** Calendar date in the place it happened, `YYYY-MM-DD`. */
export type LocalDate = string

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseLocalDate(s: string): LocalDate {
  const m = DATE_RE.exec(s)
  if (!m) throw new DomainError('INVALID_DATE')
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12) throw new DomainError('INVALID_DATE')
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  if (d < 1 || d > daysInMonth) throw new DomainError('INVALID_DATE')
  return s
}
