import 'fake-indexeddb/auto'

import {Database} from 'bun:sqlite'
import {describe, expect, test} from 'bun:test'
import {
  createExpense,
  createGroup,
  createPerson,
  ensureMe,
  isNeverSync,
  type MutationCtx,
  openIdbStore,
  openSqlStore,
  sendableOps,
  setPref,
  type Store,
} from '@splito/sync'
import {IDBFactory} from 'fake-indexeddb'
import {parseMinor} from '@splito/domain'

import {DEMO_ME, purgeLegacyDemo, readDemoMode, resumeDemo, seedDemo, writeDemoMode} from '#/data/demoSeed'

/*
 * Demo mode's data side (ARCHITECTURE 26.1, F-228a) on both store engines:
 * IndexedDB (web) and SQLite (native), each as two separate databases the way
 * the app opens them (`splito` and `splito-demo`).
 */

type Engine = {name: string; open: (db: 'real' | 'demo') => Promise<Store>}

function sqlite(): Engine {
  const dbs = new Map<string, Database>()
  return {
    name: 'SQLite',
    open: async which => {
      // The same file reopened sees its rows: keep each in-memory database alive for the test.
      let db = dbs.get(which)
      if (!db) dbs.set(which, (db = new Database(':memory:')))
      const d = db
      return openSqlStore({
        exec: async sql => void d.run(sql),
        run: async (sql, params) => void d.query(sql).run(...(params as never[])),
        all: async (sql, params) => d.query(sql).all(...(params as never[])) as never,
        withTransaction: async fn => {
          d.run('BEGIN IMMEDIATE')
          try {
            const r = await fn()
            d.run('COMMIT')
            return r
          } catch (e) {
            d.run('ROLLBACK')
            throw e
          }
        },
        // Closing a connection must not drop the data: the file stays.
        close: async () => {},
      })
    },
  }
}

function indexedDb(): Engine {
  const factory = new IDBFactory()
  return {name: 'IndexedDB', open: which => openIdbStore(which === 'real' ? 'splito' : 'splito-demo', factory)}
}

let n = 0
const realCtx: MutationCtx = {deviceId: 'device-1', actor: 'real-me', now: () => 1_760_000_000_000 + ++n * 1000, newId: () => `real-${++n}`}
const demoCtx: MutationCtx = {deviceId: 'device-1', actor: DEMO_ME, now: () => Date.now(), newId: () => `demo-${++n}`}

/** Everything a database holds, as comparable text (bigint as strings). */
async function snapshot(store: Store) {
  const dump = await store.dump()
  return JSON.stringify(
    {dump, balances: await store.balances(), pairs: await store.pairBalances(realCtx.actor), sync: await store.syncCounts()},
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v instanceof Set ? [...v] : v),
  )
}

/** The real data a person would have by now: friends, a group, an expense, a changed setting, queued ops. */
async function realData(store: Store) {
  await ensureMe(store, realCtx, 'Me')
  const friend = await createPerson(store, realCtx, {name: 'Asha Real'})
  const group = await createGroup(store, realCtx, {name: 'Real flat', kind: 'home', currency: 'INR', memberIds: [friend.id], startDate: null, endDate: null})
  await createExpense(store, realCtx, {
    title: 'Real groceries',
    groupId: group.id,
    currency: 'INR',
    total: parseMinor('120000'),
    payers: {[realCtx.actor]: parseMinor('120000')},
    split: {mode: 'equal', participants: [realCtx.actor, friend.id]},
    date: '2026-10-20',
    tz: 'Asia/Kolkata',
    category: 'groceries',
    notes: '',
  })
  await setPref(store, realCtx, 'theme', 'dark')
}

for (const engine of [sqlite, indexedDb]) {
  describe(`demo mode on ${engine().name}`, () => {
    test(
      'a demo session with edits leaves the real database byte-identical (rows, prefs, history, outbox); its only footprint is demo.mode',
      async () => {
        const e = engine()
        const real = await e.open('real')
        await realData(real)
        const before = await snapshot(real)
        expect(await readDemoMode(real)).toBe(false)

        // Turn it on: the demo database is opened and seeded, then the real one learns of the mode.
        const demo = await e.open('demo')
        await ensureMe(demo, demoCtx, 'Me')
        await seedDemo(demo, demoCtx)
        await writeDemoMode(real, realCtx, true)
        expect(await readDemoMode(real)).toBe(true)

        // A session with edits: a new friend, an expense, a setting, all in the demo database.
        const friend = await createPerson(demo, demoCtx, {name: 'Typed in demo'})
        await createExpense(demo, demoCtx, {
          title: 'Demo edit',
          groupId: null,
          currency: 'INR',
          total: parseMinor('50000'),
          payers: {[DEMO_ME]: parseMinor('50000')},
          split: {mode: 'equal', participants: [DEMO_ME, friend.id]},
          date: '2026-10-21',
          tz: 'Asia/Kolkata',
          category: 'food',
          notes: '',
        })
        await setPref(demo, demoCtx, 'theme', 'light')
        await demo.close()

        // Turn it off: only the mode row changes in the real database.
        await writeDemoMode(real, realCtx, false)
        expect(await readDemoMode(real)).toBe(false)
        const during = await snapshot(real)
        const strip = (s: string) => {
          const d = JSON.parse(s)
          d.dump.entities = d.dump.entities.filter((x: {type: string; id: string}) => !(x.type === 'preference' && x.id === 'demo.mode'))
          // The mode row is a local-only preference row: the one extra row the sync counts see.
          if (d.sync.preferences?.local) d.sync.preferences.local -= 1
          if (d.sync.preferences && !Object.values(d.sync.preferences).some(Boolean)) delete d.sync.preferences
          return JSON.stringify(d)
        }
        expect(strip(during)).toBe(strip(before))
        // The mode row is a device preference with no outbox op and no history row: nothing queued, nothing to sync.
        const dump = await real.dump()
        expect(dump.outbox.some(o => o.entityId === 'demo.mode')).toBe(false)
        expect(dump.history.some(h => h.entityId === 'demo.mode')).toBe(false)
        // Nothing of the demo data is in it.
        expect(dump.entities.some(x => x.id.startsWith('demo-large-'))).toBe(false)
        expect(dump.outbox.some(o => o.entityId.startsWith('demo-large-'))).toBe(false)
      },
      600_000,
    )

    // Seeding on the pure-JS IndexedDB of the test runner takes half a minute a time; the engine-independent checks run on SQLite.
    const onSqlite = engine().name === 'SQLite' ? test : test.skip
    onSqlite(
      'the demo database holds the one dataset, with its own preferences, history and outbox; seeding twice writes nothing',
      async () => {
        const e = engine()
        const demo = await e.open('demo')
        await ensureMe(demo, demoCtx, 'Me')
        expect(await seedDemo(demo, demoCtx)).toBe(true)
        expect(await seedDemo(demo, demoCtx)).toBe(false)

        const groups = (await demo.getAll<{name: string}>('group')).map(g => g.data.name)
        for (const name of ['Goa trip', 'Flat 4B', 'Lisbon', 'Tokyo', 'Koramangala flat']) expect(groups).toContain(name)
        const people = (await demo.getAll<{name: string}>('person')).map(p => p.data.name)
        for (const name of ['Riya Sharma', 'Arjun Mehta', 'Priya Nair', 'Sam Carter', 'Lena Fischer', 'Diego Alves']) expect(people).toContain(name)

        // Multi-currency, every currency separate (26.13).
        const currencies = new Set<string>()
        let after = null as Awaited<ReturnType<Store['page']>>['next']
        do {
          // full-read-ok: a test counting the seeded currencies, a page at a time.
          const page = await demo.page<{currency: string}>('expense', {after, limit: 500})
          for (const x of page.items) currencies.add(x.data.currency)
          after = page.next
        } while (after)
        for (const c of ['INR', 'EUR', 'USD', 'GBP', 'THB', 'JPY', 'BHD', 'KWD']) expect(currencies.has(c)).toBe(true)

        // The demo database queued its own ops (they are never sent: no engine runs for demo mode).
        const dump = await demo.dump()
        expect(dump.outbox.length).toBeGreaterThan(1000)
        expect(dump.history.length).toBeGreaterThan(1000)
        // The friend requests and invite links of the 26.18 flow are there too.
        expect((await demo.getAll('friendRequest')).length).toBe(9)
        expect((await demo.getAll('inviteLink')).length).toBe(9)

        // Never-sync (M9): the demo store holds over a thousand queued ops and the sync client is offered none.
        expect(isNeverSync(demo)).toBe(true)
        expect((await demo.outboxByStatus('queued')).length).toBeGreaterThan(1000)
        expect(await sendableOps(demo)).toEqual([])

        // A cut-off block is finished by the next open (M2): the marker is written last, so with it gone (and part of the
        // block missing) the block is erased and written again, never doubled.
        const requests = await demo.getAll('friendRequest')
        await demo.erase([...requests.slice(0, 4).map(r => ({type: 'friendRequest' as const, id: r.id})), {type: 'preference', id: 'demo.seed.invites'}])
        await demo.erase([{type: 'preference', id: 'demo.seed.feedback'}])
        expect((await demo.getAll('friendRequest')).length).toBe(5)
        expect(await seedDemo(demo, demoCtx)).toBe(true)
        expect((await demo.getAll('friendRequest')).length).toBe(9)
        expect((await demo.getAll('inviteLink')).length).toBe(9)
        expect((await demo.getAll('feedback')).length).toBe(3)
        expect((await demo.getAll<{name: string}>('person')).filter(p => p.data.name === 'Tanvi Rao').length).toBe(1)
        expect(await seedDemo(demo, demoCtx)).toBe(false)
        await demo.close()
      },
      300_000,
    )

    onSqlite(
      'a demo database that will not open at boot does not lock the app: the mode is turned off in the real database',
      async () => {
        const real = await engine().open('real')
        await ensureMe(real, realCtx, 'Me')
        await writeDemoMode(real, realCtx, true)
        const failures: unknown[] = []
        const opened = await resumeDemo(
          {store: real, ctx: realCtx},
          async () => {
            throw new Error('IndexedDB blocked')
          },
          e => failures.push(e),
        )
        expect(opened).toBeNull()
        expect(failures).toHaveLength(1)
        expect(await readDemoMode(real)).toBe(false)
        // When it does open, nothing changes.
        await writeDemoMode(real, realCtx, true)
        expect(await resumeDemo({store: real, ctx: realCtx}, async () => 'store')).toBe('store')
        expect(await readDemoMode(real)).toBe(true)
        await real.close()
      },
      60_000,
    )

    onSqlite(
      'demo rows older builds wrote into the real database are erased once, and nothing else is',
      async () => {
        const real = await engine().open('real')
        await realData(real)
        // What the old large-set URL switch left behind: the whole dataset, in the real database next to real data.
        await seedDemo(real, {...realCtx, now: () => Date.now()})
        expect((await real.dump()).entities.some(x => x.id.startsWith('demo-large-'))).toBe(true)
        let done = false
        const flag = {isDone: () => done, markDone: () => void (done = true)}
        expect(await purgeLegacyDemo(real, flag)).toBeGreaterThan(1000)
        const dump = await real.dump()
        expect(dump.entities.some(x => x.id.startsWith('demo-large-'))).toBe(false)
        expect(dump.history.some(h => h.entityId.startsWith('demo-large-'))).toBe(false)
        expect(dump.outbox.some(o => o.entityId.startsWith('demo-large-'))).toBe(false)
        const names = (await real.getAll<{name: string}>('person')).map(p => p.data.name)
        expect(names).toContain('Asha Real')
        expect((await real.getAll<{name: string}>('group')).map(g => g.data.name)).toEqual(['Real flat'])
        expect(await real.count('expense')).toBe(1)
        expect(done).toBe(true)
        // Once: the flag stops a second pass.
        expect(await purgeLegacyDemo(real, flag)).toBe(0)
        await real.close()
      },
      300_000,
    )

    onSqlite(
      'the old demo purge leaves everything alone when a real expense points at a demo person (it would dangle), and does not look again',
      async () => {
        const real = await engine().open('real')
        await realData(real)
        await seedDemo(real, {...realCtx, now: () => Date.now()})
        await createExpense(real, realCtx, {
          title: 'Real lunch with a demo person',
          groupId: null,
          currency: 'INR',
          total: parseMinor('900'),
          payers: {[realCtx.actor]: parseMinor('900')},
          split: {mode: 'equal', participants: [realCtx.actor, 'demo-large-p-riya']},
          date: '2026-10-21',
          tz: 'Asia/Kolkata',
          category: 'food',
          notes: '',
        })
        let done = false
        const flag = {isDone: () => done, markDone: () => void (done = true)}
        expect(await purgeLegacyDemo(real, flag)).toBe(0)
        expect(done).toBe(true)
        expect((await real.dump()).entities.some(x => x.id === 'demo-large-p-riya')).toBe(true)
        await real.close()
      },
      300_000,
    )

    onSqlite(
      'seeding is atomic and resumable: a failure half-way leaves nothing, the next try completes',
      async () => {
        const e = engine()
        const demo = await e.open('demo')
        await ensureMe(demo, demoCtx, 'Me')
        let puts = 0
        const failing: Store = {
          ...demo,
          transaction: fn =>
            demo.transaction(tx =>
              fn({
                ...tx,
                put: async x => {
                  if (++puts === 400) throw new Error('page left half-way')
                  return tx.put(x)
                },
              }),
            ),
        }
        await expect(seedDemo(failing, demoCtx)).rejects.toThrow('half-way')
        expect((await demo.getAll('person')).map(p => p.id)).toEqual([DEMO_ME])
        expect(await demo.getAll('group')).toEqual([])
        expect(await demo.count('expense')).toBe(0)
        expect(await demo.getAll('friendRequest')).toEqual([])

        // The next open finishes it; once more is a no-op.
        expect(await seedDemo(demo, demoCtx)).toBe(true)
        expect((await demo.getAll('group')).length).toBe(21)
        expect(await seedDemo(demo, demoCtx)).toBe(false)

        // A run cut off after the ledger but before the Wave B follow-ups (friend removal, group deletion, exits) finishes them once.
        const before = (await demo.dump()).history.length
        await demo.transaction(async tx => {
          const mark = await tx.get('preference', 'demo.seed.late')
          await tx.put({...mark!, deleted: true, version: mark!.version + 1})
        })
        expect(await seedDemo(demo, demoCtx)).toBe(true)
        expect((await demo.dump()).history.length).toBe(before)
        expect(await seedDemo(demo, demoCtx)).toBe(false)

        await demo.close()
      },
      300_000,
    )
  })
}
