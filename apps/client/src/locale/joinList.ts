/**
 * A spoken list in the app language ("Bob, Cy and Dee"). Hermes has no
 * Intl.ListFormat, so without it phones fall back to commas. ponytail: add a
 * polyfill if a language needs its own "and".
 */
export function joinList(items: string[], locale: string): string {
  if (typeof Intl === 'undefined' || typeof Intl.ListFormat !== 'function') {
    return items.join(', ')
  }
  try {
    return new Intl.ListFormat(locale, {style: 'long', type: 'conjunction'}).format(items)
  } catch {
    // An unsupported locale tag throws RangeError; the plain join is still readable.
    return items.join(', ')
  }
}
