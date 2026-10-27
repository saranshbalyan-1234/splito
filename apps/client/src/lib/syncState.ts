/**
 * What the sync-status dot on the user's avatar shows (ARCHITECTURE 26.7):
 * 'synced' only once the server has acknowledged everything, 'syncing' while
 * changes wait or the device is offline, 'local' with no account (nothing is
 * backed up). One pure rule so every sink agrees.
 */
export type SyncDotState = 'synced' | 'syncing' | 'local'

export function syncDotState({
  hasSession,
  isOnline,
  pendingOps,
}: {
  hasSession: boolean
  isOnline: boolean
  /** Outbox operations the server has not acknowledged. */
  pendingOps: number
}): SyncDotState {
  if (!hasSession) return 'local'
  return isOnline && pendingOps === 0 ? 'synced' : 'syncing'
}
