/**
 * What the sync-status dot on the user's avatar shows (ARCHITECTURE 26.7):
 * 'synced' only once the server has acknowledged everything, 'syncing' while
 * changes wait or the device is offline, 'local' with no account (nothing is
 * backed up). One pure rule so every sink agrees.
 */
export type SyncDotState = 'synced' | 'syncing' | 'local' | 'demo'

export function syncDotState({
  hasSession,
  isOnline,
  pendingOps,
  demo = false,
}: {
  hasSession: boolean
  isOnline: boolean
  /** Outbox operations the server has not acknowledged. */
  pendingOps: number
  /** Dev and e2e demo mode: a separate database that never syncs, whatever the account. */
  demo?: boolean
}): SyncDotState {
  if (demo) return 'demo'
  if (!hasSession) return 'local'
  return isOnline && pendingOps === 0 ? 'synced' : 'syncing'
}
