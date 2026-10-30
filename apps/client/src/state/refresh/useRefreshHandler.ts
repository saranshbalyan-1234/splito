import {refreshAll} from '#/state/refresh/refreshAll'
import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'

/**
 * The refresh a list or scroll view runs when none is passed (Bluesky's `List` takes `onRefresh`; Splito's screens
 * never do, so the shared layer supplies this one). Stable across renders.
 */
export function useRefreshHandler(onRefresh?: () => void | Promise<unknown>): () => Promise<unknown> {
  return useNonReactiveCallback(() => (onRefresh ? Promise.resolve(onRefresh()) : refreshAll()))
}
