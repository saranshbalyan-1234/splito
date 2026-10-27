/*
 * The date and time of a reminder, as the sheet's fields hold them: local `YYYY-MM-DD` and `HH:MM`
 * (24-hour, the format of `<input type="date">` and `<input type="time">`). Reminders fire in the device's
 * own time zone, since the notification is the device's.
 */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{1,2}):(\d{2})$/

/** Epoch ms of a local date and time, or null when either is not a real one (Feb 30, 25:00). */
export function parseWhen(date: string, time: string): number | null {
  const d = DATE.exec(date.trim())
  const t = TIME.exec(time.trim())
  if (!d || !t) return null
  const [y, mo, day, h, mi] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])]
  const at = new Date(y, mo - 1, day, h, mi)
  const isReal = at.getFullYear() === y && at.getMonth() === mo - 1 && at.getDate() === day && h < 24 && mi < 60
  return isReal ? at.getTime() : null
}

const two = (n: number) => String(n).padStart(2, '0')

export const dateInput = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

export const timeInput = (ms: number) => {
  const d = new Date(ms)
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}

/** The quick picks of the sheet, all at 9:00 in the morning: tomorrow, in 3 days, next Monday, next month. */
export function quickPicks(now: number): Array<{id: 'tomorrow' | 'in3days' | 'nextWeek' | 'nextMonth'; at: number}> {
  const d = new Date(now)
  const nineOn = (y: number, m: number, day: number) => new Date(y, m, day, 9, 0).getTime()
  const [y, m, day] = [d.getFullYear(), d.getMonth(), d.getDate()]
  // Next Monday: 1 to 7 days ahead, never today.
  const untilMonday = ((8 - d.getDay()) % 7) || 7
  return [
    {id: 'tomorrow', at: nineOn(y, m, day + 1)},
    {id: 'in3days', at: nineOn(y, m, day + 3)},
    {id: 'nextWeek', at: nineOn(y, m, day + untilMonday)},
    // The same day next month, or its last day when that month is shorter.
    {id: 'nextMonth', at: Math.min(nineOn(y, m + 1, day), nineOn(y, m + 2, 0))},
  ]
}
