import {
  type BalanceRow,
  balanceRowsFromNets,
  type CurrencyCode,
  ZERO,
} from '@splito/domain'
import {
  type Entity,
  type EntityType,
  type Expense,
  type Group,
  type Key,
  type NetBalance,
  type Page,
  type Repayment,
  type Store,
  touches,
  type WriteOff,
} from '@splito/sync'

import {MORE as MORE_CHANGE, type Query} from '#/data/projections'
import {
  type HistoryEntry,
  type HistoryStream,
  mergeHistory,
  PAGE,
  shareEntries,
} from './historyMerge'

/*
 * Balance and history reads over the local database's indexes and
 * projections (ARCHITECTURE 9.8). Nothing here reads a whole money store:
 * balances come from the `balances` / `pair_balances` sums the mutations keep,
 * lists from cursor-paged index reads. Every query keeps its previous answer
 * when the new one is equal, so memoised rows and figures stay put.
 */

const isMoney = (c: Parameters<typeof touches>[0]) =>
  touches(c, 'expense') || touches(c, 'repayment') || touches(c, 'writeoff')

const sameBig = (a: bigint, b: bigint) => a === b

/* -------------------------------------------------------------------------- */
/* Balances                                                                   */
/* -------------------------------------------------------------------------- */

type Nets = Record<CurrencyCode, Record<string, bigint>>

function sameRows(prev: BalanceRow[] | undefined, next: BalanceRow[]) {
  return (
    !!prev &&
    prev.length === next.length &&
    prev.every((r, i) => {
      const n = next[i]!
      return (
        r.person === n.person &&
        r.groupId === n.groupId &&
        r.currency === n.currency &&
        sameBig(r.amount, n.amount)
      )
    })
  )
}

function netsOf(rows: NetBalance[]): Nets {
  const nets: Nets = {}
  for (const r of rows) (nets[r.currency] ??= {})[r.personId] = r.amount
  return nets
}

const balanceRowQueries = new Map<string, Query<BalanceRow[]>>()

/**
 * My balance with each person, per group and currency (`balanceRows`):
 * outside groups from the pair sums, inside a group from the plan over that
 * group's stored net under its rules. Reads only the groups I have a balance
 * in.
 */
export function balanceRowsQuery(me: string): Query<BalanceRow[]> {
  const key = `balanceRows:${me}`
  let q = balanceRowQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: c => isMoney(c) || touches(c, 'group'),
      loader: store => async (_c, prev) => {
        const [pairs, mine] = await Promise.all([
          store.pairBalances(me),
          store.balances({personId: me}),
        ])
        const groupIds = [
          ...new Set(
            mine.flatMap(b => (b.groupId && b.amount !== ZERO ? [b.groupId] : [])),
          ),
        ]
        const [nets, groups] = await Promise.all([
          Promise.all(groupIds.map(id => store.balances({groupId: id}))),
          store.getMany<Group>('group', groupIds),
        ])
        const rows = balanceRowsFromNets(
          me,
          pairs.map(p => ({
            person: p.otherId,
            groupId: null,
            currency: p.currency,
            amount: p.amount,
          })),
          Object.fromEntries(groupIds.map((id, i) => [id, netsOf(nets[i]!)])),
          Object.fromEntries(groups.map(g => [g.id, g.data.rules])),
        )
        return sameRows(prev, rows) ? prev! : rows
      },
    }
    balanceRowQueries.set(key, q)
  }
  return q
}

/** My net per group and currency (> 0: the group owes me); settled groups are left out. */
export type GroupBalances = Record<string, Record<CurrencyCode, bigint>>

const myGroupQueries = new Map<string, Query<GroupBalances>>()

export function myGroupBalancesQuery(me: string): Query<GroupBalances> {
  const key = `myGroupBalances:${me}`
  let q = myGroupQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: isMoney,
      loader: store => async (_c, prev) => {
        const out: GroupBalances = {}
        for (const b of await store.balances({personId: me}))
          if (b.groupId && b.amount !== ZERO)
            (out[b.groupId] ??= {})[b.currency] = b.amount
        return prev && sameGroupBalances(prev, out) ? prev : out
      },
    }
    myGroupQueries.set(key, q)
  }
  return q
}

function sameGroupBalances(a: GroupBalances, b: GroupBalances) {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every(g => {
    const x = a[g]!
    const y = b[g]
    if (!y) return false
    const kx = Object.keys(x)
    return kx.length === Object.keys(y).length && kx.every(c => y[c] !== undefined && sameBig(x[c]!, y[c]!))
  })
}

/** A currency a person has had with me, and where: in a group, or outside groups (`groupId` null). */
export type SeenCurrency = {currency: string; groupId: string | null}

/** Currencies each person and each group of mine has had, settled ones included (a stored net row stays while records exist). */
export type SeenCurrencies = {
  people: Record<string, SeenCurrency[]>
  groups: Record<string, string[]>
}

const seenQueries = new Map<string, Query<SeenCurrencies>>()

/**
 * Which currencies a friend or a group has ever had with me, so a currency
 * that is square now still filters (audit m3). One read of the small `balances`
 * projection (a row per person, group and currency), never of the ledger. A
 * friend's entries keep their group, so Include groups off can leave them out.
 */
export function seenCurrenciesQuery(me: string): Query<SeenCurrencies> {
  const key = `seenCurrencies:${me}`
  let q = seenQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: isMoney,
      loader: store => async (_c, prev) => {
        const people = new Map<string, Map<string, SeenCurrency>>()
        const groups = new Map<string, Set<string>>()
        for (const b of await store.balances()) {
          if (b.personId !== me) {
            const own = people.get(b.personId) ?? new Map<string, SeenCurrency>()
            own.set(JSON.stringify([b.currency, b.groupId]), {currency: b.currency, groupId: b.groupId || null})
            people.set(b.personId, own)
          } else if (b.groupId) groups.set(b.groupId, (groups.get(b.groupId) ?? new Set()).add(b.currency))
        }
        const next: SeenCurrencies = {
          people: Object.fromEntries(
            [...people].map(([id, m]) => [id, [...m.values()].sort((x, y) => x.currency.localeCompare(y.currency) || (x.groupId ?? '').localeCompare(y.groupId ?? ''))]),
          ),
          groups: Object.fromEntries([...groups].map(([id, cs]) => [id, [...cs].sort()])),
        }
        return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      },
    }
    seenQueries.set(key, q)
  }
  return q
}

const groupNetQueries = new Map<string, Query<Nets>>()

/** One group's stored net per currency and person (`groupNet`), people with nothing left out. */
export function groupNetsQuery(groupId: string): Query<Nets> {
  const key = `groupNets:${groupId}`
  let q = groupNetQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: isMoney,
      loader: store => async (_c, prev) => {
        const nets = netsOf(await store.balances({groupId}))
        return prev && sameNets(prev, nets) ? prev : nets
      },
    }
    groupNetQueries.set(key, q)
  }
  return q
}

function sameNets(a: Nets, b: Nets) {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every(c => {
    const x = a[c]!
    const y = b[c]
    if (!y) return false
    const kx = Object.keys(x)
    return kx.length === Object.keys(y).length && kx.every(p => y[p] !== undefined && sameBig(x[p]!, y[p]!))
  })
}

/* -------------------------------------------------------------------------- */
/* Activity times                                                             */
/* -------------------------------------------------------------------------- */

const sameMap = <V>(a: Map<string, V>, b: Map<string, V>) =>
  a.size === b.size && [...a].every(([k, v]) => b.get(k) === v)

/** When each group last saw activity (epoch ms): its own change or any record's in it, a delete included (26.17). */
export const groupActivityQuery: Query<Map<string, number>> = {
  key: 'groupActivity',
  isTouchedBy: c => isMoney(c) || touches(c, 'group'),
  loader: store => async (_c, prev) => {
    const next = await store.groupActivity()
    return prev && sameMap(prev, next) ? prev : next
  },
}

/** When each person last saw activity (epoch ms), for the "recent" friends sort only: an index read of `people.lastActivityAt`. */
export const lastActivityQuery: Query<Map<string, number>> = {
  key: 'lastActivity',
  isTouchedBy: isMoney,
  loader: store => async (_c, prev) => {
    const next = await store.lastActivity()
    return prev && sameMap(prev, next) ? prev : next
  },
}

/* -------------------------------------------------------------------------- */
/* Paged history                                                              */
/* -------------------------------------------------------------------------- */

/** A merged, newest-first list of ledger entries and how to read further into it. */
export type HistoryPager = {
  entries: HistoryEntry[]
  /** True when nothing older exists. */
  isDone: boolean
  loadMore: () => void
}

/**
 * Cursor-paged history over several indexed streams (one group's records, or
 * the records between two people). A commit that touches the ledger starts
 * the streams again at the length the screen already shows; `loadMore` adds
 * a page. Rows that did not change keep their objects.
 */
export function historyPagerQuery(
  key: string,
  makeStreams: (store: Store) => HistoryStream[],
  isTouchedBy: Query<unknown>['isTouchedBy'] = isMoney,
  size = PAGE,
): Query<HistoryPager> {
  return {
    key,
    isTouchedBy,
    loader: (store, controls) => {
      let want = size
      let streams = makeStreams(store)
      const loadMore = () => {
        want += PAGE
        controls.reload(MORE_CHANGE)
      }
      return async (change, prev) => {
        if (change !== MORE_CHANGE) streams = makeStreams(store)
        const {entries, isDone} = await mergeHistory(streams, want)
        const shared = shareEntries(prev?.entries, entries)
        return prev && shared === prev.entries && prev.isDone === isDone
          ? prev
          : {entries: shared, isDone, loadMore}
      }
    },
  }
}

const countQueries = new Map<string, Query<number>>()

/** How many rows an index range of one type holds: an index count, no rows read. */
export function countQuery(key: string, type: EntityType, q: Parameters<Store['count']>[1]): Query<number> {
  let query = countQueries.get(key)
  if (!query) {
    query = {key, isTouchedBy: c => touches(c, type), loader: store => () => store.count(type, q)}
    countQueries.set(key, query)
  }
  return query
}

/* -------------------------------------------------------------------------- */
/* Streams                                                                    */
/* -------------------------------------------------------------------------- */

type IndexRead = {index: string; eq: Key}

/** A few more rows than wanted (some are filtered out), never more than a page. */
const pageFor = (want: number) => Math.min(PAGE, Math.max(want * 2, 8))

/** The live rows of one money type through one index, newest date first, kept if `accept` says so. */
export function indexStream<T extends Expense | Repayment | WriteOff>(
  store: Store,
  kind: HistoryEntry['kind'],
  read: IndexRead,
  accept: (e: Entity<T>) => boolean = () => true,
): HistoryStream {
  let after: Key | null = null
  return {
    items: [],
    isDone: false,
    async read(want) {
      let added = 0
      while (added < want && !this.isDone) {
        // full-read-ok: `read` carries the eq / min / max range; the pager reads only as far as was asked (`want`)
        const page: Page<Entity<T>> = await store.page<T>(kind, {...read, dir: 'prev', after, limit: pageFor(want)})
        after = page.next
        this.isDone = !page.next
        for (const entity of page.items) {
          if (entity.deleted || !accept(entity)) continue
          this.items.push({kind, entity} as HistoryEntry)
          added++
        }
      }
    },
  }
}

/**
 * A person's live expenses, newest date first, through their `expense_parties`
 * rows (one index read, then the expenses by id), kept if `accept` says so.
 * `onlyDirect` skips group expenses before reading them.
 */
export function partyStream(
  store: Store,
  read: IndexRead,
  accept: (e: Entity<Expense>) => boolean,
  onlyDirect = false,
): HistoryStream {
  let after: Key | null = null
  return {
    items: [],
    isDone: false,
    async read(want) {
      let added = 0
      while (added < want && !this.isDone) {
        // full-read-ok: `read` carries the eq range; the pager reads only as far as was asked (`want`)
        const page = await store.parties({...read, dir: 'prev', after, limit: pageFor(want)})
        after = page.next
        this.isDone = !page.next
        const ids = page.items.filter(p => !onlyDirect || p.groupId === null).map(p => p.expenseId)
        for (const entity of await store.getMany<Expense>('expense', ids)) {
          if (entity.deleted || !accept(entity)) continue
          this.items.push({kind: 'expense', entity})
          added++
        }
      }
    },
  }
}
