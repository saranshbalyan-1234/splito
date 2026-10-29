import {type EntityType} from '@splito/sync'

import {type LinkTarget} from '#/lib/links/resolve'
import {pathParamNames} from '#/lib/links/table'

/** Which store a link's id param names. A payment id may be a payment or a write-off. */
const TYPES: Record<string, EntityType[]> = {
  personId: ['person'],
  groupId: ['group'],
  expenseId: ['expense'],
  repaymentId: ['repayment', 'writeoff'],
}

type Reader = {get(type: EntityType, id: string): Promise<unknown>}

/**
 * Whether everything a link names by id is in the store now showing. Demo mode asks "Switch back to your data?"
 * only for a link that names something the demo database does not hold (F-254): a reload of a demo expense's own
 * page, or a link to a demo friend, opens as it is.
 */
export async function isInStore(store: Reader, target: LinkTarget): Promise<boolean> {
  const keys = [...new Set([...pathParamNames(target.name), 'personId', 'groupId'])].filter(k => k in TYPES && target.params[k])
  for (const key of keys) {
    const id = target.params[key]!
    const found = await Promise.all(TYPES[key]!.map(type => store.get(type, id)))
    if (!found.some(Boolean)) return false
  }
  return true
}
