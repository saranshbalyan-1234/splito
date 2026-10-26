// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/routes.ts
import {Router} from '#/lib/routes/router'
import {type FlatNavigatorParams} from './lib/routes/types'

type AllNavigatableRoutes = Pick<
  FlatNavigatorParams,
  'People' | 'Groups' | 'Activity' | 'Profile' | 'AddExpense'
>

export const router = new Router<AllNavigatableRoutes>({
  People: '/',
  Groups: '/groups',
  Activity: '/activity',
  Profile: '/profile',
  AddExpense: '/expense/new',
})
