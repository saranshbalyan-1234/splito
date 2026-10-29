import {useDemoMode} from '#/state/demo'
import {useSession} from '#/state/session'
import {type SyncDotState, syncDotState} from './syncState'

/**
 * The aggregate sync state for the avatar dot. Signed out until the auth
 * backend lands, so the honest answer is 'local' (red).
 * TODO(F-2103): feed isOnline and pendingOps from the sync engine; until it
 * exists a signed-in device could never be proven synced, so this stays
 * conservative and reports 'syncing'.
 */
export function useSyncDot(): SyncDotState {
  const {canSync: hasSession} = useSession()
  const {demo} = useDemoMode()
  return syncDotState({
    demo,
    hasSession,
    isOnline: true,
    pendingOps: hasSession ? 1 : 0,
  })
}
