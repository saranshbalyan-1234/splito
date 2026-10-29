import {type RowSyncStatus} from '@splito/sync'

/**
 * What a row's sync state means to the person (ARCHITECTURE 9.8, decision 79).
 * Until an account and a backend exist nothing is ever acknowledged, so a
 * queued row is honestly "Saved on this device"; once someone is signed in the
 * same row reads "Waiting to sync". "Synced" is only ever a row the server
 * acknowledged, and only when someone is signed in.
 */
export type RowStatusKind =
  /** Never queued: only here. */
  | 'local'
  /** Queued, but there is no account to send it to yet. */
  | 'device'
  /** Queued, waiting for a connection or its turn. */
  | 'waiting'
  | 'syncing'
  | 'synced'
  | 'attention'

export function rowStatusKind(status: RowSyncStatus, hasSession: boolean): RowStatusKind {
  switch (status) {
    case 'local':
      return 'local'
    case 'pending':
      return hasSession ? 'waiting' : 'device'
    case 'syncing':
      return 'syncing'
    case 'synced':
      // No account means no server answered: a row marked synced then came from sample data, and is never called synced.
      return hasSession ? 'synced' : 'device'
    case 'failed':
      return 'attention'
  }
}

/**
 * Not yet acknowledged by the server and not refused: drawn lighter (decision 111).
 * `failed` keeps full strength and says "Needs attention" instead.
 */
export function isUnsynced(status: RowSyncStatus): boolean {
  return status === 'local' || status === 'pending' || status === 'syncing'
}
