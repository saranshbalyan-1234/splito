import {getLocales} from 'expo-localization'
import {type PrefValue} from '@splito/sync'

import {usePref} from '#/data/hooks'

/**
 * The locale amounts are formatted in. `auto` follows the UI language: Hindi
 * uses `hi-IN` (Indian grouping, 1,00,000), English follows the device
 * (so en-IN devices also get Indian grouping). An explicit Number format
 * preference wins.
 */
export function resolveNumberLocale(
  pref: PrefValue<'numberLocale'>,
  language: PrefValue<'language'>,
  deviceTag: string | undefined,
): string {
  if (pref !== 'auto') return pref
  if (language === 'hi') return 'hi-IN'
  return deviceTag?.startsWith('en') ? deviceTag : 'en'
}

/** `resolveNumberLocale` for the current preferences and device. */
export function useNumberLocale() {
  const [pref = 'auto'] = usePref('numberLocale')
  const [language = 'en'] = usePref('language')
  return resolveNumberLocale(pref, language, getLocales()[0]?.languageTag)
}
