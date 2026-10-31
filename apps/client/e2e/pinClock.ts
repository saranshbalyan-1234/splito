import {type Page} from '@playwright/test'

/**
 * The time a spec that depends on "now" pins the page to: noon on 30 Oct 2026, the day the demo data and its
 * specs were written. The demo's change times, "recently active", Analytics periods and "today" are relative to
 * now, so the same spec ranked "Recently active people" differently on 31 Oct than on 30 Oct (overviewLayout "Overview
 * scope" failed from midnight; pinned to 29 or 28 Oct it fails the same way), and a renders baseline read
 * different content from one day to the next (ARCHITECTURE 17.1).
 */
export const PINNED_NOW = '2026-10-30T12:00:00+05:30'

/**
 * `Date` starts each page load at `iso` and keeps running from there. Playwright's `clock.setFixedTime` freezes
 * it, and the app then never reaches its first screen (its timers compare dates), so an offset is applied instead.
 */
export function pinClock(page: Page, iso: string = PINNED_NOW) {
  return page.addInitScript(at => {
    const Real = Date
    const offset = new Date(at).getTime() - Real.now()
    class Pinned extends Real {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(Real.now() + offset)
        else super(...(args as [number]))
      }
      static now() {
        return Real.now() + offset
      }
    }
    window.Date = Pinned as DateConstructor
  }, iso)
}
