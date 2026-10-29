import {flag, oneOf, type Params} from '#/lib/links/listState'
import {type PeopleFilters} from './components/FriendsFilterDialog'

const SHOW = ['all', 'owesYou', 'youOwe', 'settled'] as const
const SORT = ['amount', 'name', 'recent'] as const

/** What the address sets of the People filters (`/?show=owesYou&sort=name&currency=EUR&groups=0&settled=1&hidden=1`). */
export function readPeopleParams(params: Params): Partial<PeopleFilters> {
  const out: Partial<PeopleFilters> = {}
  const show = oneOf(params?.show, SHOW)
  const sort = oneOf(params?.sort, SORT)
  if (show) out.show = show
  if (sort) out.sort = sort
  if (params?.currency && /^[A-Z]{3}$/.test(params.currency)) out.currency = params.currency
  if (flag(params?.groups) !== undefined) out.includeGroups = flag(params?.groups)
  if (flag(params?.settled) !== undefined) out.showSettled = flag(params?.settled)
  if (flag(params?.hidden) !== undefined) out.showHidden = flag(params?.hidden)
  return out
}

/** The params an Apply writes: what differs from `stock`; a value back at stock clears its key. */
export function peopleParams(f: PeopleFilters, stock: PeopleFilters): Record<string, string | undefined> {
  return {
    show: f.show === stock.show ? undefined : f.show,
    sort: f.sort === stock.sort ? undefined : f.sort,
    currency: f.currency === stock.currency ? undefined : f.currency,
    groups: f.includeGroups === stock.includeGroups ? undefined : f.includeGroups ? '1' : '0',
    settled: f.showSettled ? '1' : undefined,
    hidden: f.showHidden ? '1' : undefined,
  }
}
