import {useEffect} from 'react'

import {activateLanguage} from '#/locale/i18n'
import {usePref} from '#/data/hooks'
import {device} from '#/storage'

/**
 * Keeps the UI language in step with the `language` preference. A language picked while signed out (the intro's chip)
 * is taken into the account once, here, so the person's choice before sign-in is not lost. The device copy is removed
 * only once the account's write has committed: removing it first lost the choice to a reload that came before the
 * write (found by `language.spec`).
 */
export function LocaleFromPrefs() {
  const [language, setLanguage] = usePref('language')
  useEffect(() => {
    if (language === undefined) return
    const chosen = device.get(['language'])
    if (chosen && chosen !== language) {
      activateLanguage(chosen)
      void setLanguage(chosen).then(() => device.remove(['language']))
      return
    }
    if (chosen) device.remove(['language'])
    activateLanguage(language)
  }, [language, setLanguage])
  return null
}
