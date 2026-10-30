import {type TabId} from '@splito/sync'

import {type FeedState} from '#/components/activity/feed'

/**
 * Per-device settings read synchronously at startup (fonts must be known
 * before first paint). Preferences that shape the first frame are mirrored
 * here from the preferences registry, which stays the source of truth (see
 * `#/state/preferences/mirror`).
 */
export type Device = {
  fontScale: '-2' | '-1' | '0' | '1' | '2'
  fontFamily: 'system' | 'theme'
  deviceId: string
  /** Local id of the "me" person; becomes linked to an account at sign-in. */
  meId: string
  /** Each account's own "me" person id, as JSON (`{accountId: uuid}`): two accounts on a device never share an identity. `meId` above is the pre-account device one (the old database's, and what `Move` re-points). */
  meIds: string
  colorMode: 'system' | 'light' | 'dark'
  darkTheme: 'dim' | 'dark'
  /** Accent hex (`#rrggbb`). */
  accent: string
  /** How money direction is coloured (F-1801), mirrored so every balance paints right at once. */
  moneyPalette: 'default' | 'colorblind' | 'mono'
  /** The tab the app opens on, mirrored from the `homeTab` preference. Renamed from `homeTab` in F-256, when the tab ids changed ('people' used to mean Home): an old value is never read. */
  startTab: TabId
  /** The key before F-256 (its 'people' meant Home): read only as a fallback for `startTab` at launch, never written. */
  homeTab: string
  hapticsEnabled: boolean
  /** Activity read/hidden marks: personal, so they stay on this device. */
  activityFeed: FeedState
  /** Search's recent queries, newest first (Bluesky's `searchTermHistory`). */
  searchHistory: string[]
  /** Ask Splito's conversation (`lib/ask/history`: JSON, newest 200 messages). Device-only: never ledger data, the outbox or a backup. */
  askChat: string
  /** The question being typed in Ask Splito, kept when the drawer closes. */
  askDraft: string
  /** A link opened before sign-in, as its path (`/groups/abc/balances`): resumed once someone is signed in (F-254, F-250). */
  linkIntent: string
  /** The first-launch check for a link kept from before the install (`lib/links/deferred`) has run. */
  deferredLinkChecked: boolean
  /** Dev and e2e: the old `demo-large-` rows were purged from the real database (one time). */
  demoLegacyPurged: boolean
  /** The signed-in account (F-250); absent when signed out. Not a credential: the API token joins it with the real auth API (ARCHITECTURE 11). */
  session: {id: string; name: string; email?: string; phone?: string}
  /** The intro slides were seen or skipped on this install (F-249, `onboarding.tourSeen`). Device storage, not the database: the database is per account and stays closed while signed out. */
  tourSeen: boolean
  /** The app language picked while signed out (the intro's chip); moved into the account's `language` preference at sign-in, once. */
  language: 'en' | 'hi'
  /** The language the signed-out screens open in (kept after log out, and when the intro's chip picks one). */
  deviceLanguage: 'en' | 'hi'
  /** The sign-in choice last used on this device (owner 144): preselected on the next Continue. */
  authMethod: 'password' | 'code'
  /** Dev and e2e only: the local accounts of the dev AuthClient, as JSON. */
  devAccounts: string
  /** The account whose log out (erase) has started and not finished: the app shows "Logging out" until it has, even after a restart. */
  loggingOut: string
  /** The one-time offer "Move this device's data into your account" (F-2104) was answered. */
  legacyOffered: boolean
}
