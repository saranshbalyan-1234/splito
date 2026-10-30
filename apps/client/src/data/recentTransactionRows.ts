import {useMemo} from 'react'
import {personNet, repaymentFlow} from '@splito/domain'
import {useLingui} from '@lingui/react/macro'
import {type RowSyncStatus} from '@splito/sync'

import {useMe, useRecentTransactions} from '#/data/hooks'

/** One of my newest expenses or payments, as a short list draws it (the right column and Home, F-1415). */
export type RecentRow = {
  id: string
  href: string
  title: string
  category: string | null
  currency: string
  /** > 0 you lent / were paid, < 0 you borrowed / paid. */
  net: bigint
  date: string
  updatedAt: number
  syncStatus: RowSyncStatus
}

/** The `size` newest expenses and payments I am on, merged by index from my parties and payments (never the whole ledger). Empty until loaded. */
export function useRecentRows(size: number): RecentRow[] {
  const {t: l} = useLingui()
  const me = useMe()
  const recent = useRecentTransactions(size)
  return useMemo<RecentRow[]>(() => {
    if (!me || !recent) return []
    const out: RecentRow[] = []
    for (const entry of recent.entries) {
      if (entry.kind === 'expense') {
        const e = entry.entity
        out.push({id: e.id, href: `/expense/${e.id}`, title: e.data.title, category: e.data.category, currency: e.data.currency, net: personNet(e.data, me.id), date: e.data.date, updatedAt: e.updatedAt, syncStatus: e.syncStatus})
      } else if (entry.kind === 'repayment') {
        const r = entry.entity
        out.push({id: r.id, href: '/activity', title: r.data.from === me.id ? l`You paid` : l`You got paid`, category: null, currency: r.data.currency, net: repaymentFlow(r.data, me.id), date: r.data.date, updatedAt: r.updatedAt, syncStatus: r.syncStatus})
      }
    }
    return out
  }, [me, recent, l])
}
