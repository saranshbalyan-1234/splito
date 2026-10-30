import {type Category, DEFAULT_CATEGORIES} from '@splito/sync'

/**
 * The category an id names. One that is gone (deleted since its expenses were saved, or an id from a newer app) is
 * the real "Other", so every screen falls back the same way, not to the raw id, a made-up "Other" or "".
 */
export function findCategory(categories: readonly Category[], id: string): Category {
  return categories.find(c => c.id === id) ?? categories.find(c => c.id === 'other') ?? DEFAULT_CATEGORIES.at(-1)!
}

/** True while a built-in category still has its stock name, which is the only name that follows the UI language. */
export function hasStockName(category: Pick<Category, 'id' | 'name'>): boolean {
  return DEFAULT_CATEGORIES.find(c => c.id === category.id)?.name === category.name
}

const named = new WeakMap<Category, Map<string, Category>>()

/**
 * `found` under the id asked for and the name to show. The same inputs give the same object, so a memoised tile or
 * row that is handed it does not re-render when only its parent did (a fresh `{...found}` per render did, in the
 * renders gate).
 */
export function nameCategory(found: Category, id: string, name: string): Category {
  let byKey = named.get(found)
  if (!byKey) named.set(found, (byKey = new Map()))
  const key = `${id}\0${name}`
  let category = byKey.get(key)
  if (!category) byKey.set(key, (category = {...found, id, name}))
  return category
}
