import {type DateRange} from '@splito/domain'

import {activityPath} from '#/lib/links/make'
import {type Scope} from '#/lib/scope'

/**
 * Where Analytics' expenses are listed (owner 226): Activity on All with Type = Expenses and the page's period,
 * currency and scope carried over as filters (`activityPath` leaves Everything out). A tapped bar narrows the days, a
 * slice or category row names its `category`, a person row its `personId`. A bar is cut to the page's own period, so the
 * list never holds an expense the page does not count. Open it with `openLink` or an `ActivityLink`: it lands as a pushed
 * copy with Back (owners 179, 190).
 */
export function expensesPath(
  page: {range: DateRange; currency: string; scope: Scope},
  narrow: {from?: string; to?: string; category?: string; personId?: string} = {},
): string {
  const {range} = page
  return activityPath({
    types: ['expenses'],
    from: narrow.from && narrow.from > range.from ? narrow.from : range.from,
    to: narrow.to && narrow.to < range.to ? narrow.to : range.to,
    currency: page.currency || undefined,
    category: narrow.category,
    personId: narrow.personId,
    scope: page.scope,
  })
}
