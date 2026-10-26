import {useEffect} from 'react'

import {activateLanguage} from '#/locale/i18n'
import {usePref} from '#/data/hooks'

/** Keeps the UI language in step with the `language` preference. */
export function LocaleFromPrefs() {
  const [language] = usePref('language')
  useEffect(() => {
    if (language) activateLanguage(language)
  }, [language])
  return null
}
