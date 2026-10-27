import {usePref} from '#/data/hooks'

/**
 * The app language for the language dropdown (Bluesky's `useLanguagePrefs`
 * and `useLanguagePrefsApi`): the `language` preference Settings > Language
 * edits, and the device preference that shows the dropdown at all (F-1816).
 */
export function useAppLanguage() {
  const [language = 'en', setLanguage] = usePref('language')
  const [isShown = true] = usePref('rightColumn.languageDropdown')
  return {language, setLanguage, isShown}
}
