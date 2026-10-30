/** Native pulls through the RefreshControl of `List` and `Layout.Content`; nothing wraps the content. */
export function PullSurface({children}: {enabled?: boolean; onRefresh?: () => void | Promise<unknown>; children: React.ReactNode}) {
  return <>{children}</>
}
