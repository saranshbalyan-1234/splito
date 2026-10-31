import {startTransition, useEffect, useState} from 'react'

/* Bluesky's feed page size; the next page loads two screens before the end, so scrolling never waits. */
const PAGE = 30
/*
 * Rows a page grows by per commit. A commit of a whole page of Activity rows (27 rows, their DOM, layout effects and the
 * browser's layout) was one task of about 1.1 s at CPU x6 during the first fling; six rows a frame keep each commit short.
 */
const STEP = 6

/**
 * Pages a long list, the next page added as the end comes near, as Bluesky
 * pages its feeds: Bluesky's web `List` renders every row it is given, and a
 * year of activity or expenses is thousands of rows. Call the hook before
 * any early return; call what it returns with the rows, and pass `shown` and
 * `onEndReached` to the List. A new `resetKey` (a query, a tab) starts again
 * at one page.
 *
 * A page grows a few rows a frame, each step a transition: React builds the rows in slices that yield to the browser
 * and commits a few at a time, so a fling keeps its frames while they are made (17.1). The end is two screens away
 * when the next page is asked for, so it lands before it is reached.
 */
export function usePagedRows(resetKey?: unknown) {
  const [paging, setPaging] = useState({count: PAGE, target: PAGE, key: resetKey})
  const isSameKey = Object.is(paging.key, resetKey)
  const count = isSameKey ? paging.count : PAGE
  const target = isSameKey ? paging.target : PAGE
  useEffect(() => {
    if (count >= target) return
    const frame = requestAnimationFrame(() =>
      startTransition(() =>
        setPaging(p => (Object.is(p.key, resetKey) ? {...p, count: Math.min(p.count + STEP, p.target)} : p)),
      ),
    )
    return () => cancelAnimationFrame(frame)
  }, [count, target, resetKey])
  return <T>(rows: T[]) => {
    const shown = rows.length > count ? rows.slice(0, count) : rows
    const onEndReached = () => {
      /* While a page is still growing the list's end keeps moving; the next page is asked for once it has landed. */
      if (shown.length < rows.length && count >= target)
        setPaging({count, target: Math.min(target + PAGE, rows.length), key: resetKey})
    }
    return {shown, onEndReached}
  }
}
