import {
  type NavigationState,
  type NavigatorScreenParams,
  type PartialState,
} from '@react-navigation/native'
import {type NativeStackNavigationProp} from '@react-navigation/native-stack'

/** The bottom bar / sidebar destinations, in display order. */
export type TabParams = {
  People: undefined
  Groups: undefined
  Analytics: undefined
  Activity: undefined
}

/** Every route in the owner's route table (paths live in `#/routes` and `#/navigation/linking`). */
export type RootStackParams = {
  /** Native only: the drawer names a tab through here, since v7 doesn't navigate into children by name. */
  Tabs: NavigatorScreenParams<TabParams> | undefined
  /** Opened from the avatar's drawer, so it is pushed like Settings. */
  Profile: undefined
  Settings: undefined
  /** The old Search page's link: opens the Search & Ask drawer with `q` typed in (`/search?q=dinner`). */
  Search: {q?: string} | undefined
  SettingsSection: {section: string}
  /** Settings > Account: honest until the auth backend exists. */
  SignIn: undefined
  /** Settings > Recently deleted (also in the drawer). */
  RecentlyDeleted: undefined
  Person: {personId: string}
  /** `tab` opens a section directly (`/groups/:groupId?tab=rules`). */
  Group: {groupId: string; tab?: 'expenses' | 'balances' | 'members' | 'rules'}
  Settle: {groupId: string}
  AddExpense: {personId?: string; groupId?: string}
  Expense: {expenseId: string}
  /** A recorded payment's page: its details and discussion (F-1204). */
  Repayment: {repaymentId: string}
  EditExpense: {expenseId: string}
  AddFriend: undefined
  /** Manage invite links. */
  InviteLinks: undefined
  /** The invite link / QR sheet: a new link (friend, or `groupId`'s group). */
  CreateInvite: {kind?: 'friend' | 'group'; groupId?: string} | undefined
  /** The same sheet for a link you already made. */
  ShareInvite: {code: string}
  /** Someone else's invite link, opened (`splito://invite/<code>`, `https://splito.app/invite/<code>`). */
  Invite: {code: string}
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
