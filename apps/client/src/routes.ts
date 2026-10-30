// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/routes.ts
import {Router} from '#/lib/routes/router'
import {type FlatNavigatorParams} from './lib/routes/types'

/**
 * The owner's route table, the one source for the router and both linking
 * configs. First match wins, so the static `new` paths come before the `:id`
 * paths they would otherwise match.
 */
export const ROUTE_PATHS = {
  People: '/people',
  Groups: '/groups',
  Analytics: '/analytics',
  Activity: '/activity',
  Settings: '/settings',
  Profile: '/profile',
  Welcome: '/welcome/:step',
  FriendsAndInvites: '/settings/friends',
  Search: '/search',
  SettingsSection: '/settings/:section',
  AddFriend: '/friends/new',
  InviteLinks: '/invites',
  CreateInvite: '/invites/new',
  ShareInvite: '/invites/:code/share',
  Invite: '/invite/:code',
  Person: '/people/:personId',
  CreateGroup: '/groups/new',
  Settle: '/groups/:groupId/settle',
  Group: '/groups/:groupId',
  AddExpense: '/expense/new',
  EditExpense: '/expense/:expenseId/edit',
  Expense: '/expense/:expenseId',
  Repayment: '/payment/:repaymentId',
} as const satisfies Record<Exclude<keyof FlatNavigatorParams, 'Sheet'>, string>

export type RouteName = keyof typeof ROUTE_PATHS

/**
 * Old paths that redirect, so the URL changes too: the feed was briefly
 * Notifications, and Recently deleted is gone (deleted items stay in their lists, decision 103): its link opens
 * Your data with a note. Both linking configs read paths through this.
 */
export function redirectOldPath(path: string) {
  /* Before F-256 the Friends list was Home: its list state (`/?sort=name&show=owesYou`) and Filters sheet (`/filters`) belong to People now. */
  const rootQuery = path.match(/^\/?\?(.*)$/)
  /* Home is gone (owner 198): its Overview is the top of Analytics. */
  if (rootQuery && /(^|&)overview=/.test(rootQuery[1]!)) return `/analytics?${rootQuery[1]}`
  if (rootQuery && /(^|&)(show|sort|currency|groups|settled|hidden)=/.test(rootQuery[1]!)) return `/people?${rootQuery[1]}`
  return path
    .replace(/^\/?filters(?=[/?#]|$)/, '/people/filters')
    .replace(/^\/?notifications(?=[/?#]|$)/, '/activity')
    .replace(/^\/?settings\/recently-deleted(?=[/?#]|$)/, '/settings/data?note=deleted-stay')
    /* Export and Import moved under Your data (owner 205). */
    .replace(/^\/?settings\/(export|import)(?=[/?#]|$)/, '/settings/data/$1')
}

export const router = new Router<Omit<FlatNavigatorParams, 'Sheet'>>(ROUTE_PATHS)
