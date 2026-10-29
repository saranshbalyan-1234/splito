import {flag, flagParam, oneOf, type Params, param} from '#/lib/links/listState'
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

/**
 * The params an Apply writes (one rule, `param` / `flagParam`): a value is left out only when it is the stock
 * one and so is the saved preference it would fall back to (`saved`, as it was before this Apply).
 */
export function peopleParams(f: PeopleFilters, stock: PeopleFilters, saved: Partial<PeopleFilters> = {}): Record<string, string | undefined> {
  return {
    show: param(f.show, stock.show),
    sort: param(f.sort, stock.sort, saved.sort),
    currency: param(f.currency, stock.currency),
    groups: flagParam(f.includeGroups, stock.includeGroups, saved.includeGroups),
    settled: flagParam(f.showSettled, stock.showSettled, saved.showSettled),
    hidden: flagParam(f.showHidden, stock.showHidden, saved.showHidden),
  }
}
