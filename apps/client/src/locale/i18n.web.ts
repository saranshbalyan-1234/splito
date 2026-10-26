// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/locale/i18n.web.ts
/* Browsers ship full Intl; no polyfills on web (see i18n.ts for native). */
import {i18n} from '@lingui/core'

import {messages as messagesEn} from '#/locale/locales/en/messages'
import {messages as messagesHi} from '#/locale/locales/hi/messages'

/** Launch languages (spec section 5): English default, Hindi second. */
export type AppLanguage = 'en' | 'hi'

/*
 * Compiled catalogs (`pnpm intl:extract && pnpm intl:compile`). Production
 * builds strip source strings from the macros, so without these the UI would
 * show message IDs. Hindi strings still missing a translation compile to the
 * English source (`fallbackLocales` in lingui.config.ts).
 */
i18n.load({en: messagesEn, hi: messagesHi})
i18n.activate('en')

/** Switches the UI language; components re-render through `I18nProvider`. */
export function activateLanguage(language: AppLanguage) {
  if (i18n.locale !== language) {
    i18n.activate(language)
  }
}

export {i18n}
