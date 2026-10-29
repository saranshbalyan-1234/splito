import {useSyncExternalStore} from 'react'

import {activateLanguage, type AppLanguage, i18n} from '#/locale/i18n'
import {usePref} from '#/data/hooks'
import {device} from '#/storage'

/**
 * The app language for the language dropdown (Bluesky's `useLanguagePrefs`
 * and `useLanguagePrefsApi`): the `language` preference Settings > Language
 * edits (F-1816).
 */
export function useAppLanguage() {
  const [language = 'en', setLanguage] = usePref('language')
  return {language, setLanguage}
}

/** Signed out there is no database to hold a preference: the choice is the device's, and the account takes it at sign-in (`LocaleFromPrefs`). */
export function setDeviceLanguage(language: AppLanguage) {
  device.set(['language'], language)
  activateLanguage(language)
}

/** The language of a signed-out screen, for the dropdown there. */
export function useDeviceLanguage() {
  const language = useSyncExternalStore(
    l => i18n.on('change', l),
    () => i18n.locale as AppLanguage,
  )
  return {language, setLanguage: setDeviceLanguage}
}
