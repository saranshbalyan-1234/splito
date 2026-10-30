import {
  type NavigationState,
  type NavigatorScreenParams,
  type PartialState,
} from '@react-navigation/native'
import {type NativeStackNavigationProp} from '@react-navigation/native-stack'

/** A list page's filters as the address carries them; every value a string (`#/lib/links/resolve`). */
export type ListParams = {[key: string]: string | undefined}

/** The bottom bar / sidebar destinations, in display order. */
export type TabParams = {
  /** List state in the address (F-241): `sort`, `show`, `currency`, `groups=0` (no group shares), `settled=1`, `hidden=1`. */
  People: ListParams | undefined
  /** `type`, `status`, `show`, `currency`, `sort`, `settled=1`, `hidden=1`. */
  Groups: ListParams | undefined
  /** `currency` opens the report in that currency (`/analytics?currency=EUR`, an Overview card); also `period`, `offset`, `from`, `to`, `scope`. */
  Analytics: {currency?: string; period?: string; offset?: string; from?: string; to?: string; scope?: string} | undefined
  /** `tab: 'others'` is `/activity/others`, `tab: 'disputed'` is `/activity/disputed`. */
  Activity: {tab?: 'all' | 'others' | 'disputed'} | undefined
}

/** Every route in the owner's route table (paths live in `#/routes` and `#/navigation/linking`). */
export type RootStackParams = {
  /** Native only: the drawer names a tab through here, since v7 doesn't navigate into children by name. */
  Tabs: NavigatorScreenParams<TabParams> | undefined
  /** Opened from the avatar's drawer, so it is pushed like Settings. */
  Profile: undefined
  /** The old Recently deleted link lands here as `?note=deleted-stay` (read raw: a short note under Data). */
  Settings: undefined
  /** The old Search page's link: opens the Search & Ask drawer with `q` typed in (`/search?q=dinner`). */
  Search: {q?: string} | undefined
  SettingsSection: {section: string}
  /** Settings > Account: honest until the auth backend exists. */
  SignIn: undefined
  /** Settings > Friends and invites; `section: 'links'` scrolls to the invite links. */
  FriendsAndInvites: {section?: 'links'} | undefined
  Person: {personId: string; groups?: string}
  /** `tab` opens a section directly (`/groups/:groupId?tab=rules`). */
  Group: {groupId: string; tab?: 'expenses' | 'balances' | 'members'}
  Settle: {groupId: string}
  /** `title`, `amount` (a decimal like "1200.00") and `currency` start the form pre-filled (an Ask Splito action card). */
  AddExpense: {personId?: string; groupId?: string; title?: string; amount?: string; currency?: string}
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

/**
 * A sheet, popup or drawer open over `page` (F-241): on web a route of its own, so the address bar shows it and
 * the browser's Back closes it. It draws nothing; the page's `useDialogControl({url})` shows the sheet.
 */
export type SheetMarker = {
  page: string
  pageParams: Record<string, string>
  /** Outermost first: `['record-payment', 'currency']` is the currency picker inside Record payment. */
  sheets: string[]
  /** Query that belongs to the sheet (`q`, `mode` of Search & Ask). */
  query?: Record<string, string>
}

/** Web renders every route in one flat stack, like Bluesky's FlatNavigator. */
export type FlatNavigatorParams = TabParams & Omit<RootStackParams, 'Tabs'> & {Sheet: SheetMarker}

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
