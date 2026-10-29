import {useDemoMode} from '#/state/demo'
import {useSession} from '#/state/session'
import {type SyncDotState, syncDotState} from './syncState'

/**
 * The aggregate sync state for the avatar dot. An account that cannot sync yet
 * (`canSync` is false until the sync engine exists, signed in or not) is
 * honestly 'local' (red).
 * TODO(F-2103): feed isOnline and pendingOps from the sync engine; until it
 * exists a signed-in device could never be proven synced, so this stays
 * conservative and reports 'syncing'.
 */
export function useSyncDot(): SyncDotState {
  const {canSync} = useSession()
  const {demo} = useDemoMode()
  return syncDotState({
    demo,
    hasSession: canSync,
    isOnline: true,
    pendingOps: canSync ? 1 : 0,
  })
}
