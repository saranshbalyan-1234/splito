/** Bluesky's DM split view does not exist in Splito; adapted components ask, so answer no. */
export function useIsWithinSplitView() {
  return {isWithinSplitView: false, isWithinLeftPanel: false}
}
