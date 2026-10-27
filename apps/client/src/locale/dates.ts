import {addDays, type LocalDate, todayIn as domainTodayIn} from '@splito/domain'
import {type PrefValue} from '@splito/sync'

import {IANA_TIME_ZONES} from '#/locale/timeZones'

/**
 * A calendar date (`YYYY-MM-DD`, the day it happened where it happened) in
 * the Date format preference. Never shifted by a timezone: an expense's local
 * date is the same everywhere. `intl` shapes the `auto` format only (the
 * explicit formats are always numeric); a `weekday` is kept as a prefix.
 */
export function formatDay(
  date: LocalDate,
  format: PrefValue<'dateFormat'>,
  locale: string,
  intl: Intl.DateTimeFormatOptions = {dateStyle: 'medium'},
): string {
  const [y, m, d] = date.split('-')
  const at = Date.UTC(Number(y), Number(m) - 1, Number(d))
  const weekday = (style: NonNullable<Intl.DateTimeFormatOptions['weekday']>) =>
    new Intl.DateTimeFormat(locale, {weekday: style, timeZone: 'UTC'}).format(at)
  let text: string
  switch (format) {
    case 'dmy':
      text = `${d}/${m}/${y}`
      break
    case 'mdy':
      text = `${m}/${d}/${y}`
      break
    case 'ymd':
      text = date
      break
    case 'auto':
      return new Intl.DateTimeFormat(locale, {...intl, timeZone: 'UTC'}).format(at)
  }
  return intl.weekday ? `${weekday(intl.weekday)}, ${text}` : text
}

/** `formatDay` in its default (medium) shape. */
export function formatLocalDate(
  date: LocalDate,
  format: PrefValue<'dateFormat'>,
  locale: string,
): string {
  return formatDay(date, format, locale)
}

/** The device's IANA timezone. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** The timezone the Timezone preference resolves to. */
export function resolveTimeZone(pref: PrefValue<'timezone'>): string {
  return pref === 'device' ? deviceTimeZone() : pref
}

/**
 * The calendar date in `timeZone` at `now`, `offsetDays` calendar days away
 * (calendar arithmetic, so a daylight-saving day of 23 or 25 hours is safe).
 */
export function todayIn(timeZone: string, now = new Date(), offsetDays = 0): LocalDate {
  const today = domainTodayIn(timeZone, now.getTime())
  return offsetDays ? addDays(today, offsetDays) : today
}

/** Whole calendar days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/** "GMT+5:30"-style offset of `timeZone` right now, or '' if unknown. */
export function utcOffsetLabel(timeZone: string, now = new Date()): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', {timeZone, timeZoneName: 'shortOffset'})
        .formatToParts(now)
        .find(p => p.type === 'timeZoneName')?.value ?? ''
    )
  } catch {
    return ''
  }
}

/**
 * Every canonical IANA timezone. A bundled list, not `Intl.supportedValuesOf`:
 * Hermes lacks it, and browsers list legacy names (Asia/Calcutta) first.
 */
export function allTimeZones(): readonly string[] {
  return IANA_TIME_ZONES
}
