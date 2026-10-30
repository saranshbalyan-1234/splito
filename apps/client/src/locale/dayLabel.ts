import {type LocalDate} from '@splito/domain'

import {daysBetween, todayIn} from '#/locale/dates'

/** The calendar day an instant falls on in a time zone (the Timezone preference, never the device's). */
export function dayOfInstant(at: number, timeZone: string): LocalDate {
  return todayIn(timeZone, new Date(at))
}

/** How a day is worded relative to today: Today, Yesterday, a weekday within the week, otherwise the date. */
export type DayBucket = 'today' | 'yesterday' | 'weekday' | 'date'

/**
 * The one rule behind every day header and divider (Activity sections, Comments dividers, dispute lines).
 * Both days are calendar days in the same zone, so a daylight-saving day of 23 or 25 hours is safe. A day
 * within the last six days, or one still ahead, is named by its weekday.
 */
export function dayBucket(day: LocalDate, today: LocalDate): DayBucket {
  const ago = daysBetween(day, today)
  if (ago === 0) return 'today'
  if (ago === 1) return 'yesterday'
  return ago < 7 ? 'weekday' : 'date'
}
