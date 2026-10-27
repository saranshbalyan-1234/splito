// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/locale/languages.ts (APP_LANGUAGES)
import {type AppLanguage} from '#/locale/i18n'

/**
 * The one list of languages Splito ships, each named in its own script and
 * in English ("हिन्दी – Hindi"), as Bluesky's `APP_LANGUAGES` does. The
 * language dropdown and Settings > Language both read it, so a language added
 * with F-1811 appears in both once it is listed here and in the `language`
 * preference.
 */
export const APP_LANGUAGES: {code2: AppLanguage; name: string}[] = [
  {code2: 'en', name: 'English'},
  {code2: 'hi', name: 'हिन्दी – Hindi'},
]

/** The listed name of `code`, or the code itself for one this build does not list. */
export function appLanguageName(code: string): string {
  return APP_LANGUAGES.find(l => l.code2 === code)?.name ?? code
}
