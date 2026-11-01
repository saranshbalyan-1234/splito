import {useSyncExternalStore} from 'react'
import {AppState} from 'react-native'
import {addDays, type LocalDate} from '@splito/domain'
import {useLingui} from '@lingui/react/macro'

import {
  formatDay,
  resolveTimeZone,
  todayIn,
} from '#/locale/dates'
import {dayBucket, dayOfInstant} from '#/locale/dayLabel'
import {usePref} from '#/data/hooks'
import {deviceLocale} from '#/locale/numberLocale'

/** The locale dates are written in: Hindi uses hi-IN, English follows the device. */
export function useDateLocale(): string {
  const [language = 'en'] = usePref('language')
  if (language === 'hi') return 'hi-IN'
  const tag = deviceLocale()?.languageTag
  return tag?.startsWith('en') ? tag : 'en'
}

/** The IANA timezone from the Timezone preference (the device's by default). */
export function useTimeZone(): string {
  const [pref = 'device'] = usePref('timezone')
  return resolveTimeZone(pref)
}

/*
 * One shared clock for every "today" reader (F-115 m29): a single interval
 * wakes them all, and useSyncExternalStore re-renders only those whose date
 * changed. It also checks on returning to the app (a long timer is not
 * trusted across sleep, ARCHITECTURE § 10).
 */
// ponytail: 30 s polling; a timer aimed at the exact local midnight if battery ever matters.
const CLOCK_MS = 30_000
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
let appStateSub: {remove: () => void} | undefined

function subscribeClock(onChange: () => void) {
  listeners.add(onChange)
  if (listeners.size === 1) {
    const notify = () => listeners.forEach(l => l())
    timer = setInterval(notify, CLOCK_MS)
    appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') notify()
    })
  }
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) {
      clearInterval(timer)
      appStateSub?.remove()
      appStateSub = undefined
    }
  }
}

/** Today's date in the Timezone preference; re-renders at local midnight and on app resume. */
export function useToday(): LocalDate {
  const tz = useTimeZone()
  return useSyncExternalStore(subscribeClock, () => todayIn(tz))
}

/**
 * Formats a calendar date by the Date format preference (the one place every
 * screen's dates go through, F-115 M18). With `relative` it says Today,
 * Yesterday or Tomorrow first. `intl` shapes the Automatic format only.
 */
export function useFormatDay() {
  const {t: l} = useLingui()
  const [format = 'auto'] = usePref('dateFormat')
  const locale = useDateLocale()
  const today = useToday()
  return (
    date: LocalDate,
    {
      relative = false,
      intl,
    }: {relative?: boolean; intl?: Intl.DateTimeFormatOptions} = {},
  ) => {
    if (relative) {
      if (date === today) return l`Today`
      if (date === addDays(today, -1)) return l`Yesterday`
      if (date === addDays(today, 1)) return l`Tomorrow`
    }
    return formatDay(date, format, locale, intl)
  }
}

/**
 * A span of days as one label in the Date format preference: "1 Jan – 31 Mar 2026", one date for a single day, "From
 * 1 Jan 2026" or "Until 31 Mar 2026" when only one end is known (Activity's period chip, owner 226). The year is
 * written on the first date only when the two ends are in different years.
 */
export function useSpanLabel() {
  const {t: l} = useLingui()
  const formatDay = useFormatDay()
  const long: Intl.DateTimeFormatOptions = {day: 'numeric', month: 'short', year: 'numeric'}
  return (from: LocalDate | undefined, to: LocalDate | undefined): string => {
    if (from && to && from !== to) {
      const start = formatDay(from, {intl: from.slice(0, 4) === to.slice(0, 4) ? {day: 'numeric', month: 'short'} : long})
      return `${start} – ${formatDay(to, {intl: long})}`
    }
    if (from && to) return formatDay(from, {intl: long})
    if (from) {
      const date = formatDay(from, {intl: long})
      return l`From ${date}`
    }
    if (to) {
      const date = formatDay(to, {intl: long})
      return l`Until ${date}`
    }
    return ''
  }
}

/**
 * The one day label (F-274 finding 6): Today, Yesterday, a weekday within the week, otherwise the date in
 * the Date format preference ("Mon, 5 Oct", the year when it is not this one). Takes a calendar day, or an
 * instant, which is first put on its day in the Timezone preference. Activity's day headers, the
 * Comments divider and every relative date go through it, so they always agree.
 */
export function useDayLabel() {
  const {i18n} = useLingui()
  const timeZone = useTimeZone()
  const today = useToday()
  const formatDay = useFormatDay()
  return (when: LocalDate | number): string => {
    const day = typeof when === 'number' ? dayOfInstant(when, timeZone) : when
    const bucket = dayBucket(day, today)
    if (bucket === 'weekday')
      return i18n.date(new Date(`${day}T00:00:00Z`), {
        weekday: 'long',
        timeZone: 'UTC',
      })
    return formatDay(day, {
      relative: true,
      intl: {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
      },
    })
  }
}

/** The time of day of an instant in the Timezone preference ("4:15 PM"): one format for every line that shows one. */
export function useFormatTime() {
  const {i18n} = useLingui()
  const timeZone = useTimeZone()
  return (at: number | Date) => i18n.date(at, {timeStyle: 'short', timeZone})
}

/** An instant as date and time in the Timezone preference ("31 Oct 2026, 4:15 PM"): the exact-moment tooltip and label. */
export function useFormatDateTime() {
  const {i18n} = useLingui()
  const timeZone = useTimeZone()
  return (at: number | Date) => i18n.date(at, {dateStyle: 'medium', timeStyle: 'short', timeZone})
}
