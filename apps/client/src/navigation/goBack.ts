import {fromTab, navigateArgs} from '#/lib/routes/helpers'
import {startPage} from '#/lib/routes/startTab'
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

/** The route Back climbs to from a top-level page (owner 198: there is no Home, so the start tab). */
const home = (): Fallback => ({name: startPage()}) as Fallback

/**
 * The parent of every route (owner 184, F-263): where Back goes when there is no history to go back to (a refresh, a
 * pasted address, a notification, a new tab), and what `backChain` stacks under a deep-linked page so a second Back keeps
 * climbing. One entry per route: the type has no optional key, so a route added without a parent fails to compile, and
 * `goBack.test.ts` walks the route table as well. The default is the start tab (owner 198: there is no Home). A main screen opened from a link
 * (owner 179) goes back to the tab its `from` names. An expense or payment's real parent (its group, else the friend) needs
 * the record, so it is the start tab here and the page itself puts the real chain under it once loaded (`useRealParents`).
 */
const SUPPORT_PAGES = ['feedback', 'help', 'about']

const PARENT: {[K in Exclude<keyof AllNavigatorParams, 'Sheet'>]: (params: Params) => Fallback} = {
  Tabs: () => home(),
  People: p => ({name: fromTab(p.from) ?? startPage()}) as Fallback,
  Groups: p => ({name: fromTab(p.from) ?? startPage()}) as Fallback,
  Analytics: p => ({name: fromTab(p.from) ?? startPage()}) as Fallback,
  Activity: p => ({name: fromTab(p.from) ?? startPage()}) as Fallback,
  PushedPeople: () => home(),
  PushedGroups: () => home(),
  PushedAnalytics: () => home(),
  PushedActivity: () => home(),
  PushedSettings: () => home(),
  Profile: () => home(),
  Settings: p => ({name: fromTab(p.from) ?? startPage()}) as Fallback,
  Search: () => home(),
  /* The help pages sit under Support (owner 204), so Back from a refreshed one climbs to it, then to Settings. */
  SettingsSection: p => (SUPPORT_PAGES.includes(p.section ?? '') ? {name: 'SettingsSection', params: {section: 'support'}} : {name: 'Settings'}),
  Welcome: () => home(),
  FriendsAndInvites: () => ({name: 'People'}),
  Person: () => ({name: 'People'}),
  Group: () => ({name: 'Groups'}),
  Settle: p => (p.groupId ? {name: 'Group', params: {groupId: p.groupId}} : {name: 'Groups'}),
  AddExpense: () => home(),
  EditExpense: p => (p.expenseId ? {name: 'Expense', params: {expenseId: p.expenseId}} : home()),
  Expense: () => home(),
  Repayment: () => home(),
  AddFriend: () => ({name: 'People'}),
  InviteLinks: () => ({name: 'FriendsAndInvites'}),
  CreateInvite: () => ({name: 'FriendsAndInvites'}),
  ShareInvite: () => ({name: 'FriendsAndInvites'}),
  Invite: () => home(),
  CreateGroup: () => ({name: 'Groups'}),
}

/** Every route that has a parent, for the test that walks the route table. */
export const ROUTES_WITH_PARENT = Object.keys(PARENT)

/**
 * The chain an expense or payment sits on (owner 184): its group (start tab > Groups > the group), else the one friend
 * it is with (start tab > People > the person), else just the start tab. Pure, so a test pins it. `others` are the
 * people on it besides me.
 */
export function realParentsFor(record: {groupId: string | null; others: readonly string[]}): Fallback[] {
  const chain: Fallback[] = record.groupId
    ? [home(), {name: 'Groups'}, {name: 'Group', params: {groupId: record.groupId}}]
    : record.others.length === 1
      ? [home(), {name: 'People'}, {name: 'Person', params: {personId: record.others[0]!}}]
      : [home()]
  /* When the start tab is the list itself (Groups), it is not listed twice. */
  return chain.filter((r, i) => i === 0 || r.name !== chain[i - 1]!.name)
}

/** Where Back goes from `route` when there is no history: its parent (default the start tab). */
export function backFallback(route: {name: string; params?: object}): Fallback {
  const parent = (PARENT as Record<string, (params: Params) => Fallback>)[route.name]
  return parent ? parent((route.params ?? {}) as Params) : home()
}

/**
 * The routes to put under a deep-linked page so Back has somewhere to go
 * (web has no stack history after a deep link or refresh): its parents from
 * `backFallback`, outermost first, then the page itself. The start tab is always
 * at the bottom. A tab screen's parent that is the tab itself (the start tab) ends the chain.
 */
export function backChain<R extends {name: string; params?: object}>(route: R): Array<R | Fallback> {
  const parent = backFallback(route)
  /* A tab's parent is itself without params and ends the chain; a section page's parent is another section. */
  return parent.name === route.name && !parent.params ? [route] : [...backChain(parent), route]
}

/**
 * Back one page, or to `fallback` when this page was opened directly. Every Back and close path uses it. `isWeb` is
 * `IS_WEB`, passed in so this stays testable: a tab fallback is `('Tabs', {screen})` on native, or Back from Profile to
 * Settings (a tab) does nothing there (`navigateArgs`).
 */
export function goBack(navigation: BackNavigation, fallback: Fallback, isWeb: boolean) {
  if (navigation.canGoBack()) navigation.goBack()
  else {
    const to = navigateArgs(fallback.name, fallback.params, isWeb)
    ;(navigation.navigate as (name: string, params?: object) => void)(to.name, to.params)
  }
}
