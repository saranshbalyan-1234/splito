import {CURRENCIES} from '@splito/domain'

const namers = new Map<string, Intl.DisplayNames | null>()

function namerFor(locale: string) {
  let namer = namers.get(locale)
  if (namer === undefined) {
    try {
      namer = new Intl.DisplayNames([locale], {type: 'currency'})
    } catch {
      // No DisplayNames on this runtime, or an unknown locale tag.
      namer = null
    }
    namers.set(locale, namer)
  }
  return namer
}

/**
 * A currency's name in the UI language (Intl), else the catalog's English
 * name, else the code itself. Never throws, for any code or locale.
 */
export function currencyName(code: string, locale: string): string {
  try {
    return namerFor(locale)?.of(code) ?? CURRENCIES[code]?.name ?? code
  } catch {
    // DisplayNames.of throws RangeError on a malformed code.
    return CURRENCIES[code]?.name ?? code
  }
}
