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
  colorMode: 'system' | 'light' | 'dark'
  darkTheme: 'dim' | 'dark'
  /** Accent hex (`#rrggbb`). */
  accent: string
  density: 'comfortable' | 'compact'
  /** How money direction is coloured (F-1801), mirrored so every balance paints right at once. */
  moneyPalette: 'default' | 'colorblind' | 'mono'
  homeTab: TabId
  hapticsEnabled: boolean
  /** Activity read/hidden marks: personal, so they stay on this device. */
  activityFeed: FeedState
  /** Search's recent queries, newest first (Bluesky's `searchTermHistory`). */
  searchHistory: string[]
  /** Ask Splito's conversation (`lib/ask/history`: JSON, newest 200 messages). Device-only: never ledger data, the outbox or a backup. */
  askChat: string
  /** The question being typed in Ask Splito, kept when the drawer closes. */
  askDraft: string
  /** Dev and e2e: the old `demo-large-` rows were purged from the real database (one time). */
  demoLegacyPurged: boolean
}
