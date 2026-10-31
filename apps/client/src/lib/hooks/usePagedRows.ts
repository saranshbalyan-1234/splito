import {startTransition, useState} from 'react'

/* Bluesky's feed page size; the next page loads two screens before the end, so scrolling never waits. */
const PAGE = 30

/**
 * Pages a long list, the next page added as the end comes near, as Bluesky
 * pages its feeds: Bluesky's web `List` renders every row it is given, and a
 * year of activity or expenses is thousands of rows. Call the hook before
 * any early return; call what it returns with the rows, and pass `shown` and
 * `onEndReached` to the List. A new `resetKey` (a query, a tab) starts again
 * at one page.
 */
export function usePagedRows(resetKey?: unknown) {
  const [paging, setPaging] = useState({pages: 1, key: resetKey})
  const pages = Object.is(paging.key, resetKey) ? paging.pages : 1
  return <T>(rows: T[]) => {
    const shown =
      rows.length > pages * PAGE ? rows.slice(0, pages * PAGE) : rows
    /*
     * A transition: React builds the next page's rows (their DOM included) in slices that yield to the browser, so a
     * fling keeps its frames while they are made; it was one task per page (Activity: 27 rows, about 1.1 s at CPU x6).
     * The end is two screens away when this runs, so the page lands before it is reached. Growing a page a few rows
     * per commit was tried and dropped: each step waited on a commit, an effect and the list's resize and intersection
     * observers, so reading far back (the specs wheel through a year of Activity) fell behind (17.1).
     */
    const onEndReached = () => {
      if (shown.length < rows.length)
        startTransition(() => setPaging({pages: pages + 1, key: resetKey}))
    }
    return {shown, onEndReached}
  }
}
