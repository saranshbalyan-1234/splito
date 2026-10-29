/**
 * A list page's filters in the address (F-241). Each page names its keys and values once; a key left out of the
 * address falls back to the saved preference (F-1413), so the address only ever carries what differs from
 * the page's stock values. Read on render, written on Apply (never on mount).
 */
export type Params = Record<string, string | undefined> | undefined

/** `groups=0` / `settled=1` style flags. */
export const flag = (value: string | undefined): boolean | undefined => (value === undefined ? undefined : value === '1')

/** `value` if it is one of `allowed`, else undefined. */
export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined
}
