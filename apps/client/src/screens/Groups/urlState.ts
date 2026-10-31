import {flag, flagParam, oneOf, type Params, param} from '#/lib/links/listState'
import {type GroupFilters} from './filter'

const TYPE = ['all', 'trip', 'home', 'couple', 'other'] as const
const STATUS = ['active', 'inactive', 'all'] as const
const SHOW = ['all', 'owed', 'owe', 'settled'] as const

/** What the address sets of the Groups filters (`/groups?type=trip&status=all&show=owe&currency=EUR&settled=1&hidden=1`). */
export function readGroupParams(params: Params): Partial<GroupFilters> {
  const out: Partial<GroupFilters> = {}
  const type = oneOf(params?.type, TYPE as readonly string[])
  const status = oneOf(params?.status, STATUS)
  const show = oneOf(params?.show, SHOW)
  if (type) out.type = type as GroupFilters['type']
  if (status) out.status = status
  if (show) out.show = show
  if (params?.currency && /^[A-Z]{3}$/.test(params.currency)) out.currency = params.currency
  if (flag(params?.settled) !== undefined) out.showSettled = flag(params?.settled)
  if (flag(params?.hidden) !== undefined) out.showHidden = flag(params?.hidden)
  return out
}

/** The params an Apply writes: the same rule as People (`peopleParams`). */
export function groupParams(f: GroupFilters, stock: GroupFilters, saved: Partial<GroupFilters> = {}): Record<string, string | undefined> {
  return {
    type: param(f.type, stock.type),
    status: param(f.status, stock.status),
    show: param(f.show, stock.show),
    currency: param(f.currency, stock.currency),
    settled: flagParam(f.showSettled, stock.showSettled, saved.showSettled),
    hidden: flagParam(f.showHidden, stock.showHidden, saved.showHidden),
  }
}
