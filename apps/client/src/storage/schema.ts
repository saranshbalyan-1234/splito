/** Per-device settings read synchronously at startup (fonts must be known before first paint). */
export type Device = {
  fontScale: '-2' | '-1' | '0' | '1' | '2'
  fontFamily: 'system' | 'theme'
  deviceId: string
  /** Local id of the "me" person; becomes linked to an account at sign-in. */
  meId: string
  colorMode: 'system' | 'light' | 'dark'
  hapticsEnabled: boolean
  /** Epoch ms of the last "Mark all read"; changes from others after it are unread. */
  notificationsSeenAt: number
}
