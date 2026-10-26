// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/routes.ts
import {Router} from '#/lib/routes/router'
import {type FlatNavigatorParams} from './lib/routes/types'

/**
 * The owner's route table, the one source for the router and both linking
 * configs. First match wins, so the static `new` paths come before the `:id`
 * paths they would otherwise match.
 */
export const ROUTE_PATHS = {
  People: '/',
  Groups: '/groups',
  Analytics: '/analytics',
  Activity: '/activity',
  Profile: '/profile',
  Settings: '/settings',
  SettingsSection: '/settings/:section',
  AddFriend: '/friends/new',
  Person: '/people/:personId',
  CreateGroup: '/groups/new',
  Settle: '/groups/:groupId/settle',
  Group: '/groups/:groupId',
  AddExpense: '/expense/new',
  EditExpense: '/expense/:expenseId/edit',
  Expense: '/expense/:expenseId',
} as const satisfies Record<keyof FlatNavigatorParams, string>

export type RouteName = keyof typeof ROUTE_PATHS

export const router = new Router<FlatNavigatorParams>(ROUTE_PATHS)
