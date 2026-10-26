import {type LocalDate} from '@splito/domain'
import {type PrefValue} from '@splito/sync'

/**
 * A calendar date (`YYYY-MM-DD`, the day it happened where it happened) in
 * the Date format preference. Never shifted by a timezone: an expense's local
 * date is the same everywhere.
 */
export function formatLocalDate(
  date: LocalDate,
  format: PrefValue<'dateFormat'>,
  locale: string,
): string {
  const [y, m, d] = date.split('-')
  switch (format) {
    case 'dmy':
      return `${d}/${m}/${y}`
    case 'mdy':
      return `${m}/${d}/${y}`
    case 'ymd':
      return date
    case 'auto':
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  }
}

/** The device's IANA timezone. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** The timezone the Timezone preference resolves to. */
export function resolveTimeZone(pref: PrefValue<'timezone'>): string {
  return pref === 'device' ? deviceTimeZone() : pref
}

/** Today's calendar date in `timeZone`. */
export function todayIn(timeZone: string, now = new Date()): LocalDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
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

/** Every IANA timezone this runtime knows, falling back to a short list. */
export function allTimeZones(): string[] {
  const intl = Intl as unknown as {
    supportedValuesOf?: (key: string) => string[]
  }
  try {
    const zones = intl.supportedValuesOf?.('timeZone')
    if (zones?.length) return zones
  } catch {}
  return [
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
    'Australia/Sydney',
    'UTC',
  ]
}
