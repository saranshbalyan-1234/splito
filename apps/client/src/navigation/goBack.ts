import {type AllNavigatorParams} from '#/lib/routes/types'

/** A route to land on: a name plus its params. */
export type Fallback = {
  [K in keyof AllNavigatorParams]: AllNavigatorParams[K] extends undefined
    ? {name: K; params?: undefined}
    : {name: K; params: AllNavigatorParams[K]}
}[keyof AllNavigatorParams]

type BackNavigation = {
  canGoBack(): boolean
  goBack(): void
  navigate(...args: never[]): void
}

/**
 * Where Back goes when there is no history (a deep link, a refresh, a new
 * tab): each page's parent, else People (ARCHITECTURE 3, A-014).
 */
export function backFallback(route: {name: string; params?: object}): Fallback {
  const params = (route.params ?? {}) as Record<string, string | undefined>
  switch (route.name) {
    case 'Group':
    case 'CreateGroup':
      return {name: 'Groups'}
    case 'Settle':
      return params.groupId ? {name: 'Group', params: {groupId: params.groupId}} : {name: 'Groups'}
    case 'EditExpense':
      return params.expenseId ? {name: 'Expense', params: {expenseId: params.expenseId}} : {name: 'People'}
    case 'SettingsSection':
      return {name: 'Settings'}
    default:
      return {name: 'People'}
  }
}

/**
 * The routes to put under a deep-linked page so Back has somewhere to go
 * (web has no stack history after a deep link or refresh): its parents from
 * `backFallback`, outermost first, then the page itself. People is always
 * at the bottom.
 */
export function backChain<R extends {name: string; params?: object}>(route: R): Array<R | Fallback> {
  const parent = backFallback(route)
  return parent.name === route.name ? [route] : [...backChain(parent), route]
}

/** Back one page, or to `fallback` when this page was opened directly. Every Back and close path uses it. */
export function goBack(navigation: BackNavigation, fallback: Fallback) {
  if (navigation.canGoBack()) navigation.goBack()
  else (navigation.navigate as (name: string, params?: object) => void)(fallback.name, fallback.params)
}
