/** Native pulls through the RefreshControl of `List` and `Layout.Content` (`useRefreshControl`); nothing is drawn or measured here. */
export function usePullToRefresh(_: {enabled?: boolean; onRefresh?: () => void | Promise<unknown>}): {
  contentRef: undefined
  indicator: null
} {
  return {contentRef: undefined, indicator: null}
}
