import {useState} from 'react'

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
    const onEndReached = () => {
      if (shown.length < rows.length)
        setPaging({pages: pages + 1, key: resetKey})
    }
    return {shown, onEndReached}
  }
}
