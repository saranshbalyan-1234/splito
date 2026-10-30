/** The web has no RefreshControl: `PullSurface` is its pull handler. */
export function useRefreshControl(_: {
  enabled?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  progressViewOffset?: number
}): undefined {
  return undefined
}
