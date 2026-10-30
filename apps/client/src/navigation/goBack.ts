import {fromTab} from '#/lib/routes/helpers'
import {type AllNavigatorParams} from '#/lib/routes/types'

/** A route to land on: a name plus its params. */
export type Fallback = {
  [K in keyof AllNavigatorParams]: undefined extends AllNavigatorParams[K]
    ? {name: K; params?: AllNavigatorParams[K]}
    : {name: K; params: AllNavigatorParams[K]}
}[keyof AllNavigatorParams]

type BackNavigation = {
  canGoBack(): boolean
  goBack(): void
  navigate(...args: never[]): void
}

type Params = Record<string, string | undefined>

/**
 * The parent of every route (owner 184, F-263): where Back goes when there is no history to go back to (a refresh, a
 * pasted address, a notification, a new tab), and what `backChain` stacks under a deep-linked page so a second Back keeps
 * climbing. One entry per route: the type has no optional key, so a route added without a parent fails to compile, and
 * `goBack.test.ts` walks the route table as well. The default is Home, never People. A main screen opened from a link
 * (owner 179) goes back to the tab its `from` names. An expense or payment's real parent (its group, else the friend) needs
 * the record, so it is Home here and the page itself puts the real chain under it once loaded (`useRealParents`).
 */
const PARENT: {[K in Exclude<keyof AllNavigatorParams, 'Sheet'>]: (params: Params) => Fallback} = {
  Tabs: () => ({name: 'Home'}),
  Home: () => ({name: 'Home'}),
  People: p => ({name: fromTab(p.from) ?? 'Home'}) as Fallback,
  Groups: p => ({name: fromTab(p.from) ?? 'Home'}) as Fallback,
  Analytics: p => ({name: fromTab(p.from) ?? 'Home'}) as Fallback,
  Activity: p => ({name: fromTab(p.from) ?? 'Home'}) as Fallback,
  PushedHome: () => ({name: 'Home'}),
  PushedPeople: () => ({name: 'Home'}),
  PushedGroups: () => ({name: 'Home'}),
  PushedAnalytics: () => ({name: 'Home'}),
  PushedActivity: () => ({name: 'Home'}),
  Profile: () => ({name: 'Settings'}),
  Settings: () => ({name: 'Home'}),
  Search: () => ({name: 'Home'}),
  SettingsSection: () => ({name: 'Settings'}),
  Welcome: () => ({name: 'Home'}),
  FriendsAndInvites: () => ({name: 'People'}),
  Person: () => ({name: 'People'}),
  Group: () => ({name: 'Groups'}),
  Settle: p => (p.groupId ? {name: 'Group', params: {groupId: p.groupId}} : {name: 'Groups'}),
  AddExpense: () => ({name: 'Home'}),
  EditExpense: p => (p.expenseId ? {name: 'Expense', params: {expenseId: p.expenseId}} : {name: 'Home'}),
  Expense: () => ({name: 'Home'}),
  Repayment: () => ({name: 'Home'}),
  AddFriend: () => ({name: 'People'}),
  InviteLinks: () => ({name: 'FriendsAndInvites'}),
  CreateInvite: () => ({name: 'FriendsAndInvites'}),
  ShareInvite: () => ({name: 'FriendsAndInvites'}),
  Invite: () => ({name: 'Home'}),
  CreateGroup: () => ({name: 'Groups'}),
}

/** Every route that has a parent, for the test that walks the route table. */
export const ROUTES_WITH_PARENT = Object.keys(PARENT)

/**
 * The chain an expense or payment sits on (owner 184): its group (Home > Groups > the group), else the one friend it is
 * with (Home > People > the person), else just Home. Pure, so a test pins it. `others` are the people on it besides me.
 */
export function realParentsFor(record: {groupId: string | null; others: readonly string[]}): Fallback[] {
  if (record.groupId) return [{name: 'Home'}, {name: 'Groups'}, {name: 'Group', params: {groupId: record.groupId}}]
  if (record.others.length === 1) return [{name: 'Home'}, {name: 'People'}, {name: 'Person', params: {personId: record.others[0]!}}]
  return [{name: 'Home'}]
}

/** Where Back goes from `route` when there is no history: its parent (default Home). */
export function backFallback(route: {name: string; params?: object}): Fallback {
  const parent = (PARENT as Record<string, (params: Params) => Fallback>)[route.name]
  return parent ? parent((route.params ?? {}) as Params) : {name: 'Home'}
}

/**
 * The routes to put under a deep-linked page so Back has somewhere to go
 * (web has no stack history after a deep link or refresh): its parents from
 * `backFallback`, outermost first, then the page itself. Home is always
 * at the bottom. A tab screen's parent that is the tab itself (Home) ends the chain.
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
