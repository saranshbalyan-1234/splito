import {useEffect} from 'react'

import {activateLanguage} from '#/locale/i18n'
import {usePref} from '#/data/hooks'
import {device} from '#/storage'

/**
 * Keeps the UI language in step with the `language` preference. A language picked while signed out (the intro's chip)
 * is taken into the account once, here, so the person's choice before sign-in is not lost.
 */
export function LocaleFromPrefs() {
  const [language, setLanguage] = usePref('language')
  useEffect(() => {
    if (language === undefined) return
    const chosen = device.get(['language'])
    if (chosen) {
      device.remove(['language'])
      if (chosen !== language) return void setLanguage(chosen)
    }
    activateLanguage(language)
  }, [language, setLanguage])
  return null
}
