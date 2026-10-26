import {type LocalDate} from '@splito/domain'
import {getLocales} from 'expo-localization'

import {formatLocalDate, resolveTimeZone} from '#/locale/dates'
import {usePref} from '#/data/hooks'

/** The locale dates are written in: Hindi uses hi-IN, English follows the device. */
export function useDateLocale(): string {
  const [language = 'en'] = usePref('language')
  if (language === 'hi') return 'hi-IN'
  const tag = getLocales()[0]?.languageTag
  return tag?.startsWith('en') ? tag : 'en'
}

/** Formats calendar dates by the Date format preference. */
export function useFormatLocalDate() {
  const [format = 'auto'] = usePref('dateFormat')
  const locale = useDateLocale()
  return (date: LocalDate) => formatLocalDate(date, format, locale)
}

/** The IANA timezone from the Timezone preference (the device's by default). */
export function useTimeZone(): string {
  const [pref = 'device'] = usePref('timezone')
  return resolveTimeZone(pref)
}
