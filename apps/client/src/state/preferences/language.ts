import {usePref} from '#/data/hooks'

/**
 * The app language for the language dropdown (Bluesky's `useLanguagePrefs`
 * and `useLanguagePrefsApi`): the `language` preference Settings > Language
 * edits (F-1816).
 */
export function useAppLanguage() {
  const [language = 'en', setLanguage] = usePref('language')
  return {language, setLanguage}
}
