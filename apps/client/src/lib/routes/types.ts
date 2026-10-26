import {
  type NavigationState,
  type PartialState,
} from '@react-navigation/native'
import {type NativeStackNavigationProp} from '@react-navigation/native-stack'

/** The bottom bar / sidebar destinations, in display order. */
export type TabParams = {
  People: undefined
  Groups: undefined
  Analytics: undefined
  Activity: undefined
  Profile: undefined
}

/** Every route in the owner's route table (paths live in `#/routes` and `#/navigation/linking`). */
export type RootStackParams = {
  Tabs: undefined
  Settings: undefined
  SettingsSection: {section: string}
  Person: {personId: string}
  Group: {groupId: string}
  Settle: {groupId: string}
  AddExpense: {personId?: string; groupId?: string}
  Expense: {expenseId: string}
  EditExpense: {expenseId: string}
  AddFriend: undefined
  CreateGroup: undefined
}

/** Web renders every route in one flat stack, like Bluesky's FlatNavigator. */
export type FlatNavigatorParams = TabParams & Omit<RootStackParams, 'Tabs'>

export type AllNavigatorParams = RootStackParams & TabParams

/** As upstream: a stack navigation prop, so `push`/`replace`/`popTo` are typed. */
export type NavigationProp = NativeStackNavigationProp<AllNavigatorParams>

/* The types below are adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/routes/types.ts */

export type State =
  NavigationState | Omit<PartialState<NavigationState>, 'stale'>

export type RouteParams = Record<string, string>
export type MatchResult = {params: RouteParams}
export type Route = {
  match: (path: string) => MatchResult | undefined
  build: (params?: Record<string, any>) => string
}
