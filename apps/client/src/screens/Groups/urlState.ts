import {flag, oneOf, type Params} from '#/lib/links/listState'
import {type GroupFilters} from './filter'

const TYPE = ['all', 'trip', 'home', 'couple', 'other'] as const
const STATUS = ['active', 'inactive', 'all'] as const
const SHOW = ['all', 'owed', 'owe', 'settled'] as const
const SORT = ['recent', 'name', 'amount'] as const

/** What the address sets of the Groups filters (`/groups?type=trip&status=all&show=owe&currency=EUR&sort=name&settled=1&hidden=1`). */
export function readGroupParams(params: Params): Partial<GroupFilters> {
  const out: Partial<GroupFilters> = {}
  const type = oneOf(params?.type, TYPE as readonly string[])
  const status = oneOf(params?.status, STATUS)
  const show = oneOf(params?.show, SHOW)
  const sort = oneOf(params?.sort, SORT)
  if (type) out.type = type as GroupFilters['type']
  if (status) out.status = status
  if (show) out.show = show
  if (sort) out.sort = sort
  if (params?.currency && /^[A-Z]{3}$/.test(params.currency)) out.currency = params.currency
  if (flag(params?.settled) !== undefined) out.showSettled = flag(params?.settled)
  if (flag(params?.hidden) !== undefined) out.showHidden = flag(params?.hidden)
  return out
}

export function groupParams(f: GroupFilters, stock: GroupFilters): Record<string, string | undefined> {
  const diff = <K extends 'type' | 'status' | 'show' | 'sort' | 'currency'>(k: K) => (f[k] === stock[k] ? undefined : f[k])
  return {
    type: diff('type'),
    status: diff('status'),
    show: diff('show'),
    sort: diff('sort'),
    currency: diff('currency'),
    settled: f.showSettled ? '1' : undefined,
    hidden: f.showHidden ? '1' : undefined,
  }
}
