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

/**
 * The one rule for writing a list-state param (F-241 acceptance 5): leave it out only when the value is the stock
 * one AND the saved preference in effect is too, since an absent param falls back to the preference. Anything
 * else is written explicitly, `0` as well as `1` for a flag.
 */
export function param(value: string, stock: string, saved: string = stock): string | undefined {
  return value === stock && saved === stock ? undefined : value
}

export function flagParam(value: boolean, stock: boolean, saved: boolean = stock): string | undefined {
  return param(value ? '1' : '0', stock ? '1' : '0', saved ? '1' : '0')
}
