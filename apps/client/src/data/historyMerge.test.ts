import {expect, test} from 'bun:test'
import fc from 'fast-check'
import {type Entity, type Expense} from '@splito/sync'

import {type HistoryEntry, type HistoryStream, mergeHistory, shareEntries} from './historyMerge'

const entry = (id: string, date: string, updatedAt: number): HistoryEntry => ({
  kind: 'expense',
  entity: {id, type: 'expense', data: {date} as Expense, version: 1, deleted: false, createdAt: 1, updatedAt, syncStatus: 'local', serverVersion: null, syncedAt: null, syncError: null} as Entity<Expense>,
})

/** A stream over a fixed list in the order an index gives (date desc, then id desc), `page` entries per read. */
function stream(list: HistoryEntry[], page: number): HistoryStream {
  const ordered = [...list].sort((x, y) => (x.entity.data.date === y.entity.data.date ? (x.entity.id < y.entity.id ? 1 : -1) : x.entity.data.date < y.entity.data.date ? 1 : -1))
  let at = 0
  return {
    items: [],
    isDone: ordered.length === 0,
    async read(want) {
      const to = Math.min(ordered.length, at + Math.max(want, page))
      this.items.push(...ordered.slice(at, to))
      at = to
      this.isDone = at >= ordered.length
    },
  }
}

const full = (lists: HistoryEntry[][]) =>
  lists
    .flat()
    .sort((x, y) => {
      const dx = x.entity.data.date
      const dy = y.entity.data.date
      return dx !== dy ? (dx < dy ? 1 : -1) : x.entity.updatedAt !== y.entity.updatedAt ? y.entity.updatedAt - x.entity.updatedAt : x.entity.id < y.entity.id ? -1 : 1
    })
    .map(e => e.entity.id)

test('merging paged streams gives the same first N as sorting everything, even with many entries on one day', async () => {
  const day = fc.constantFrom('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05')
  const list = fc.array(fc.record({date: day, updatedAt: fc.integer({min: 1, max: 50})}), {maxLength: 25})
  await fc.assert(
    fc.asyncProperty(fc.array(list, {minLength: 1, maxLength: 4}), fc.integer({min: 1, max: 30}), fc.integer({min: 1, max: 6}), async (lists, want, page) => {
      let n = 0
      const made = lists.map(l => l.map(x => entry(`e${String(n++).padStart(3, '0')}`, x.date, x.updatedAt)))
      const { entries, isDone } = await mergeHistory(made.map(l => stream(l, page)), want)
      const expected = full(made)
      expect(entries.map(e => e.entity.id)).toEqual(expected.slice(0, want))
      expect(isDone).toBe(expected.length <= want)
    }),
    {numRuns: 300},
  )
})

test('shareEntries keeps unchanged entries and the array itself when nothing changed', () => {
  const prev = [entry('a', '2026-10-01', 1), entry('b', '2026-10-01', 1)]
  expect(shareEntries(prev, [entry('a', '2026-10-01', 1), entry('b', '2026-10-01', 1)])).toBe(prev)
  const next = shareEntries(prev, [entry('a', '2026-10-01', 1), entry('b', '2026-10-01', 2)])
  expect(next).not.toBe(prev)
  expect(next[0]).toBe(prev[0]!)
  expect(next[1]).not.toBe(prev[1]!)
})
