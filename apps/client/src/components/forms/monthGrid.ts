import {addDays, type LocalDate, type WeekStart} from '@splito/domain'

/** The month `ym` ("YYYY-MM") moved by `by` months. */
export function shiftMonth(ym: string, by: number): string {
  const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}

/**
 * The cells of a month calendar, whole weeks from `weekStart`: `null` pads the days of the neighbouring
 * months, so the length is always a multiple of 7.
 */
export function monthGrid(
  ym: string,
  weekStart: WeekStart,
): Array<LocalDate | null> {
  const first = `${ym}-01`
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() - weekStart + 7) % 7
  const days = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()
  const cells: Array<LocalDate | null> = [
    ...Array.from({length: lead}, () => null),
    ...Array.from({length: days}, (_, i) => addDays(first, i)),
  ]
  while (cells.length % 7) cells.push(null)
  return cells
}
