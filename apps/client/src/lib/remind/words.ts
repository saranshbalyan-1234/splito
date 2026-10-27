import {t} from '@lingui/core/macro'

import {type RemindWords} from './message'

/** The reminder's sentences in the app's current language (the friend gets them as written; F-1111 adds their language). */
export function remindWords(): RemindWords {
  return {
    greeting: name => t`Hi ${name},`,
    oweOne: (amount, group) =>
      group
        ? t`A friendly reminder from Splito: you owe me ${amount} for ${group}.`
        : t`A friendly reminder from Splito: you owe me ${amount}.`,
    oweMany: group =>
      group
        ? t`A friendly reminder from Splito: you owe me the following for ${group}:`
        : t`A friendly reminder from Splito: you owe me the following:`,
    payUpi: upiId => t`Pay by UPI to ${upiId}:`,
    payLink: () => t`Pay here:`,
    thanks: () => t`Thanks!`,
  }
}
