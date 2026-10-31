import {AppState} from 'react-native'
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

let device: ReturnType<typeof getLocales>[number] | undefined | null = null
const forgetDevice = () => void (device = null)
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('languagechange', forgetDevice)
AppState.addEventListener?.('change', state => state === 'active' && forgetDevice())

/**
 * The device's first locale, read once and again only when the OS language may have changed (web `languagechange`,
 * native return to the app). expo-localization's web `getLocales()` builds `Intl` objects on every call: called per
 * row through `useNumberLocale`, it was 4 % of opening Friends and invites (45 rows) at 6x CPU.
 */
export function deviceLocale() {
  if (device === null) device = getLocales()[0]
  return device
}

/** `resolveNumberLocale` for the current preferences and device. */
export function useNumberLocale() {
  const [pref = 'auto'] = usePref('numberLocale')
  const [language = 'en'] = usePref('language')
  return resolveNumberLocale(pref, language, deviceLocale()?.languageTag)
}
