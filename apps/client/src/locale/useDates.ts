import {useSyncExternalStore} from 'react'
import {AppState} from 'react-native'
import {addDays, type LocalDate} from '@splito/domain'
import {useLingui} from '@lingui/react/macro'
import {getLocales} from 'expo-localization'

import {
  formatDay,
  resolveTimeZone,
  todayIn,
} from '#/locale/dates'
import {usePref} from '#/data/hooks'

/** The locale dates are written in: Hindi uses hi-IN, English follows the device. */
export function useDateLocale(): string {
  const [language = 'en'] = usePref('language')
  if (language === 'hi') return 'hi-IN'
  const tag = getLocales()[0]?.languageTag
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
