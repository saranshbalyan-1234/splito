/** How long ago something was deleted, as a unit and a whole number (rounded down). Pure, so it is unit tested. */
export type DeletedAge =
  | {unit: 'now'}
  | {unit: 'minute' | 'hour' | 'day' | 'month'; value: number}
  /** A year or more: read as a date, not "12 months ago". */
  | {unit: 'date'}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY

/** `at` is when it was deleted, `now` the clock (the shared minute ticker). Under a minute is "just now". */
export function deletedAge(at: number, now: number): DeletedAge {
  const ms = now - at
  if (ms < MINUTE) return {unit: 'now'}
  if (ms < HOUR) return {unit: 'minute', value: Math.floor(ms / MINUTE)}
  if (ms < DAY) return {unit: 'hour', value: Math.floor(ms / HOUR)}
  if (ms < MONTH) return {unit: 'day', value: Math.floor(ms / DAY)}
  const months = Math.floor(ms / MONTH)
  return months < 12 ? {unit: 'month', value: months} : {unit: 'date'}
}
