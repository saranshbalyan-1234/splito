import {type TabId} from '@splito/sync'

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
  homeTab: TabId
  hapticsEnabled: boolean
}
