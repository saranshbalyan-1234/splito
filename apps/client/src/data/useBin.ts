import {useEffect, useState} from 'react'
import {type BinItem, loadBin} from '@splito/sync'

import {usePref, useStore} from '#/data/hooks'

export type Bin = {
  items: BinItem[]
  /** When the list was read, for "N days left". */
  readAt: number
  days: number
}

/**
 * Recently deleted, live: re-read after every committed transaction and when
 * the `history.binDays` window changes. Undefined until the first read.
 * Reads only tombstones and their history, never the live ledger.
 */
export function useBin(): Bin | undefined {
  const store = useStore()
  const [days] = usePref('history.binDays')
  const [bin, setBin] = useState<Bin>()
  useEffect(() => {
    if (days === undefined) return
    let isCancelled = false
    const run = () => {
      const readAt = Date.now()
      void loadBin(store, readAt, days).then(items => {
        if (!isCancelled) setBin({items, readAt, days})
      })
    }
    run()
    const off = store.subscribe(run)
    return () => {
      isCancelled = true
      off()
    }
  }, [store, days])
  return bin
}
