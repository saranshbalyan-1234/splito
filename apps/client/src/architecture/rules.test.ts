import {describe, expect, test} from 'bun:test'

import {BASELINE} from './baseline'
import {blank, CLIENT, importsOf, moneyOperators, moneyPageReads, reuseContext, type RuleContext, type RuleName, RULES} from './rules'
import {countAll} from './scan'

/**
 * Architecture rules: counts per file may only go down (ARCHITECTURE.md § 19,
 * A-001). A failure prints the exact baseline line to add, change or delete.
 */
describe('architecture baseline', () => {
  const counts = countAll()

  for (const name of Object.keys(RULES) as RuleName[]) {
    test(name, () => {
      const now = counts[name]
      const was = BASELINE[name]
      const problems: string[] = []
      for (const [file, n] of Object.entries(now)) {
        const base = was[file] ?? 0
        if (n > base)
          problems.push(
            base === 0
              ? `NEW  ${file}: ${n} (fix it; the rule is: ${RULES[name].why})`
              : `UP   ${file}: ${base} -> ${n} (fix the new ones; the rule is: ${RULES[name].why})`,
          )
      }
      for (const [file, base] of Object.entries(was)) {
        const n = now[file] ?? 0
        if (n < base)
          problems.push(
            n === 0
              ? `STALE ${file}: now 0 -> delete the line   '${file}': ${base},`
              : `STALE ${file}: now ${n} -> change the line to   '${file}': ${n},`,
          )
      }
      expect(problems).toEqual([])
    })
  }
})

const ctx: RuleContext = {reusePaths: new Set(), copiedPaths: new Set()}
const count = (name: RuleName, source: string, path = `${CLIENT}components/X.tsx`) =>
  RULES[name].appliesTo(path) ? RULES[name].count(path, source, ctx) : 0

describe('scanner', () => {
  test('blanks comments, and strings only when asked', () => {
    const src = "const a = '#fff' // '#000'\n/* rgb(1) */ const b = `x${c}y`"
    expect(blank(src, {strings: true})).toContain("'#fff'")
    expect(blank(src, {strings: true})).not.toContain('#000')
    expect(blank(src, {strings: true})).not.toContain('rgb')
    expect(blank(src, {strings: false})).not.toContain('#fff')
    expect(blank(src, {strings: false})).toContain('${c}')
  })

  test('a regex literal is code, a division is not a regex', () => {
    expect(blank("const r = /'/g; const s = 'a'", {strings: false})).toContain("/'/g")
    expect(blank('const q = a / b / c', {strings: false})).toBe('const q = a / b / c')
  })

  test('imports, re-exports, require and dynamic import', () => {
    const src = "import x from 'a'\nexport {y} from \"b\"\nconst z = require('c')\nconst w = import('d')\n// import q from 'e'"
    expect(importsOf(src)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('counters', () => {
  test('hardDelete: erase, a row delete of a record table or SQL DELETE outside migration and the engines', () => {
    const screen = `${CLIENT}screens/Group/index.tsx`
    expect(count('hardDelete', 'await store.erase(refs)', screen)).toBe(1)
    expect(count('hardDelete', "await rows.delete('expenses', [id])", 'packages/sync/src/mutations.ts')).toBe(1)
    expect(count('hardDelete', 'await rows.delete(ENTITY_STORE[type], [id])', 'packages/sync/src/groupLifecycle.ts')).toBe(1)
    expect(count('hardDelete', 'await db.run(`DELETE FROM groups WHERE id = ?`, [id])', 'packages/sync/src/mutations.ts')).toBe(1)
    // Projection rows, Maps and Sets, comments, migration, the erase primitive and the dev tools are fine.
    expect(count('hardDelete', "await rows.delete('balances', key); listeners.delete(fn); known.delete(id)", 'packages/sync/src/ledgerProjection.ts')).toBe(0)
    expect(count('hardDelete', '// store.erase(refs) is forbidden here', screen)).toBe(0)
    expect(count('hardDelete', 'await rows.delete(ENTITY_STORE.preference, [id])', 'packages/sync/src/migrate.ts')).toBe(0)
    expect(count('hardDelete', 'await rows.delete(ENTITY_STORE[type], [id])', 'packages/sync/src/core.ts')).toBe(0)
    expect(count('hardDelete', 'if (refs.length) await store.erase(refs)', `${CLIENT}data/demoSeed.ts`)).toBe(0)
  })

  test('personAvatarOutsideLink: a UserAvatar outside PersonLink', () => {
    const screen = `${CLIENT}screens/Group/X.tsx`
    expect(count('personAvatarOutsideLink', '<UserAvatar size={32} name={n} type="user" />', screen)).toBe(1)
    expect(count('personAvatarOutsideLink', '// <UserAvatar here\n<PersonLink id={id} name={n} />', screen)).toBe(0)
    expect(count('personAvatarOutsideLink', '<UserAvatar size={32} name={n} type="user" />', `${CLIENT}components/PersonLink.tsx`)).toBe(0)
  })

  test('externalHandOff: Linking.openURL, Share.share and navigator.share outside their one gate', () => {
    const screen = `${CLIENT}screens/Person/index.tsx`
    expect(count('externalHandOff', 'await Linking.openURL(url)', screen)).toBe(1)
    expect(count('externalHandOff', 'await Share.share({message})', `${CLIENT}lib/remind/share.ts`)).toBe(1)
    expect(count('externalHandOff', 'await navigator.share({text})', screen)).toBe(1)
    // The gates, other Linking calls and comments are fine.
    expect(count('externalHandOff', 'await Linking.openURL(url)', `${CLIENT}lib/openExternal.ts`)).toBe(0)
    expect(count('externalHandOff', 'await Share.share({message}); await navigator.share({text})', `${CLIENT}lib/sharing.ts`)).toBe(0)
    expect(count('externalHandOff', 'void Linking.openSettings()', screen)).toBe(0)
    expect(count('externalHandOff', '// Linking.openURL(url) is forbidden here', screen)).toBe(0)
  })

  test('moneyFullRead', () => {
    const screen = `${CLIENT}screens/People/index.tsx`
    expect(count('moneyFullRead', "const all = await store.getAll<Expense>('expense')", screen)).toBe(1)
    expect(count('moneyFullRead', "const e = useEntities<Expense>('expense'); const l = useLedger()", screen)).toBe(2)
    expect(count('moneyFullRead', "entitiesQuery('repayment')", `${CLIENT}data/projections.ts`)).toBe(1)
    expect(count('moneyFullRead', "const rows = await store.getAll('writeoff')", 'packages/sync/src/activity.ts')).toBe(1)
    // Small stores, index reads, comments and the one maintenance reader are fine.
    expect(count('moneyFullRead', "useEntities<Person>('person'); store.page('expense', {index: 'byDate', min: from})", screen)).toBe(0)
    expect(count('moneyFullRead', "// getAll('expense') is forbidden here", screen)).toBe(0)
    expect(count('moneyFullRead', '// full-read-ok: export\nexport async function loadLedger(store) {}', 'packages/sync/src/selectors.ts')).toBe(0)
    expect(count('moneyFullRead', 'export async function loadLedger(store) {}', 'packages/sync/src/selectors.ts')).toBe(1)
  })

  test('moneyFullRead: any page, parties or row range of a money store with no bound, loop or not', () => {
    const screen = `${CLIENT}screens/Analytics/useReport.ts`
    // The in-memory mirror this rule exists to keep out: every page of every money store.
    const mirror = `for (const kind of KINDS) {
      let after: Key | null = null
      do {
        const page = await store.page(kind, {index: 'byUpdatedAt', after, limit: 500})
        after = page.next
      } while (after)
    }`
    expect(count('moneyFullRead', mirror, screen)).toBe(1)
    expect(count('moneyFullRead', "while (!isDone) { const p = await store.page('expense', {after, limit: 50}); isDone = !p.next }", screen)).toBe(1)
    expect(count('moneyFullRead', "for (;;) { const p = await store.parties({index: 'byPersonDate', after}); if (!p.next) break }", screen)).toBe(1)
    expect(count('moneyFullRead', "do { const p = await store.page('writeoff', {after}); after = p.next } while (true)", 'packages/sync/src/x.ts')).toBe(1)
    // The ways round the old loop-only rule: one call with a huge limit, a loop whose condition is a function,
    // a helper or recursion, an empty bound, a row-level range of the table.
    expect(count('moneyFullRead', "const all = await store.page('expense', {index: 'byDate', limit: 1_000_000})", screen)).toBe(1)
    expect(count('moneyFullRead', "const all = await store.page('expense', {limit: ALL})", screen)).toBe(1)
    expect(count('moneyFullRead', "while ((async () => (p = await store.page('expense', {after})))()) {}", screen)).toBe(1)
    expect(count('moneyFullRead', "const next = (after) => store.page('repayment', {after}).then(p => p.next && next(p.next))", screen)).toBe(1)
    expect(count('moneyFullRead', "store.page('expense', {index: 'byDate', min: '', limit: 50})", screen)).toBe(1)
    expect(count('moneyFullRead', "store.page('expense', {index: 'byFrom', eq: [], limit: 50})", screen)).toBe(1)
    expect(count('moneyFullRead', "store.page('expense', {index: 'byDate', min: undefined})", screen)).toBe(1)
    expect(count('moneyFullRead', "const all = await rows.range('expenses', {})", 'packages/sync/src/x.ts')).toBe(1)
    expect(count('moneyFullRead', "const all = await rows.range(ENTITY_STORE[type], {})", 'packages/sync/src/x.ts')).toBe(1)
    expect(count('moneyFullRead', "const all = await rows.range('expense_parties', {index: 'byPersonDate', dir: 'prev'})", 'packages/sync/src/x.ts')).toBe(1)
    // A key range (eq, min, max) is not the whole store; small stores page freely.
    expect(count('moneyFullRead', "do { const p = await store.page(type, {index: 'byFrom', eq: [id], after, limit: 20}); after = p.next } while (after)", screen)).toBe(0)
    expect(count('moneyFullRead', "do { const p = await store.page('expense', {index: 'byDate', min: a, max: b, after}); after = p.next } while (after)", screen)).toBe(0)
    expect(count('moneyFullRead', "const r = await rows.range('expenses', {index: 'byDate', min: from, max: to})", 'packages/sync/src/x.ts')).toBe(0)
    expect(count('moneyFullRead', "do { const p = await store.page('person', {after}); after = p.next } while (after)", screen)).toBe(0)
    expect(count('moneyFullRead', "await rows.range('people', {})", 'packages/sync/src/x.ts')).toBe(0)
    expect(count('moneyFullRead', 'do { await work() } while (after)', screen)).toBe(0)
    // Migration and the dev tools are the file allowlist; anything else says so beside the call.
    expect(count('moneyFullRead', mirror, `${CLIENT}data/demoSeed.ts`)).toBe(0)
    expect(count('moneyFullRead', mirror, 'packages/sync/src/migrate.ts')).toBe(0)
    expect(count('moneyFullRead', mirror, 'packages/sync/src/selectors.ts')).toBe(1)
    expect(count('moneyFullRead', "// full-read-ok: export reads everything\nconst all = await store.page('expense', {limit: 500})", 'packages/sync/src/selectors.ts')).toBe(0)
    expect(count('moneyFullRead', "const all = await store.page('expense', {limit: 500}) // full-read-ok: a scrolled pager", screen)).toBe(0)
    expect(count('moneyFullRead', "// full-read-ok:\nconst all = await store.page('expense', {limit: 500})", screen)).toBe(1) // a reason is required
    expect(count('moneyFullRead', "// full-read-ok: old\n\n\n\n\nconst all = await store.page('expense', {limit: 500})", screen)).toBe(1) // beside the call, not far above
    expect(moneyPageReads("// store.page('expense')")).toEqual([])
  })

  test('demoStaticImport', () => {
    expect(count('demoStaticImport', "import {DemoModeRows} from '#/screens/Settings/DemoMode'")).toBe(1)
    expect(count('demoStaticImport', "import {openDemo} from '#/data/demoMode'\nexport {x} from '@splito/sync/demoLarge'")).toBe(2)
    expect(count('demoStaticImport', "import DemoBusyCover from '#/components/DemoBusyCover'")).toBe(1)
    expect(count('demoStaticImport', "import {seedDemo} from '#/data/demoSeed'")).toBe(1)
    expect(count('demoStaticImport', "import {seedDemo} from '#/data/demoSeed'", `${CLIENT}data/demoMode.ts`)).toBe(0)
    expect(count('demoStaticImport', "const m = await import('#/screens/Settings/DemoMode')")).toBe(0)
    expect(count('demoStaticImport', "const B = lazy(() => import('#/components/DemoBusyCover'))")).toBe(0)
    expect(count('demoStaticImport', "import {x} from '#/data/demoMode'", `${CLIENT}screens/Settings/DemoMode.tsx`)).toBe(0)
    // Side-effect imports and require() bundle it too; a comment does not.
    expect(count('demoStaticImport', "import '#/data/demoMode'\nimport \"@splito/sync/demoLarge\"")).toBe(2)
    expect(count('demoStaticImport', "const m = require('#/screens/Settings/DemoMode')")).toBe(1)
    expect(count('demoStaticImport', "// import '#/data/demoMode'\nconst m = import('#/data/demoMode')")).toBe(0)
  })

  test('rawColour', () => {
    expect(count('rawColour', "const c = '#1185fe'; const d = 'rgba(0,0,0,0.5)'")).toBe(2)
    expect(count('rawColour', "// '#fff'\nconst c = t.palette.primary_500")).toBe(0)
    expect(count('rawColour', "const c = '#fff'", `${CLIENT}alf/themes.ts`)).toBe(0)
  })

  test('rnModal', () => {
    expect(count('rnModal', "import {Modal, View} from 'react-native'")).toBe(1)
    expect(count('rnModal', "import {View} from 'react-native'\nimport {Modal} from '#/components/Modal'")).toBe(0)
  })

  test('expoHaptics', () => {
    expect(count('expoHaptics', "import * as Haptics from 'expo-haptics'")).toBe(1)
    expect(count('expoHaptics', "import * as Haptics from 'expo-haptics'", `${CLIENT}lib/haptics/index.ts`)).toBe(0)
  })

  test('viewFiles', () => {
    expect(count('viewFiles', '', `${CLIENT}view/com/util/New.tsx`)).toBe(1)
    expect(count('viewFiles', '', `${CLIENT}view/com/util/List.tsx`)).toBe(0)
  })

  test('credentialAccess', () => {
    expect(count('credentialAccess', "localStorage.setItem('a', b); headers = {Authorization: t}")).toBe(2)
    expect(count('credentialAccess', '// localStorage is not used here')).toBe(0)
  })

  test('consoleOutsideLogger', () => {
    expect(count('consoleOutsideLogger', 'console.log(x)')).toBe(1)
    expect(count('consoleOutsideLogger', '// console.log(x)\nlogger.info(x)')).toBe(0)
  })

  test('moneyArithmetic', () => {
    expect(count('moneyArithmetic', 'const z = 0n')).toBe(1)
    expect(count('moneyArithmetic', 'const v = BigInt(s)')).toBe(1)
    expect(count('moneyArithmetic', "import {x} from '@splito/domain'\nconst d = a.amount - b.amount")).toBe(1)
    expect(count('moneyArithmetic', "import {x} from '@splito/domain'\nconst n = isMe ? -r.amount : r.amount")).toBe(1)
    expect(count('moneyArithmetic', "import {x} from '@splito/domain'\ntotal += share")).toBe(1)
    // Sign checks against the domain's ZERO, display strings and comments are not maths.
    expect(count('moneyArithmetic', "import {ZERO} from '@splito/domain'\nconst up = net > ZERO")).toBe(0)
    expect(count('moneyArithmetic', "import {x} from '@splito/domain'\nconst s = '+' + formatAmount(v)")).toBe(0)
    expect(count('moneyArithmetic', '// total - 0n\nconst label = `${total}-x`')).toBe(0)
    // A file that never touches money is not checked for operators.
    expect(count('moneyArithmetic', 'const l = lightness - amount')).toBe(0)
  })

  test('moneyOperators ignores numbers named otherwise', () => {
    expect(moneyOperators('const i = index - 1; const w = width / 2')).toBe(0)
  })

  test('rawNumberOnMoney', () => {
    expect(count('rawNumberOnMoney', 'const n = Number(row.amount)')).toBe(1)
    expect(count('rawNumberOnMoney', 'const s = x.toFixed(2)')).toBe(1)
    expect(count('rawNumberOnMoney', 'const n = Number(process.env.PORT)')).toBe(0)
  })

  test('unlikeCurrencySum', () => {
    expect(count('unlikeCurrencySum', 'const s = xs.reduce((a, b) => a + b, 0n)')).toBe(1)
    expect(count('unlikeCurrencySum', 'const m = xs.reduce((a, b) => (b > a ? b : a), ZERO)')).toBe(0)
  })

  test('layerDirection', () => {
    expect(count('layerDirection', "import {useMe} from '#/data/hooks'", `${CLIENT}components/A.tsx`)).toBe(1)
    expect(count('layerDirection', "import {useMe} from '#/data/hooks'", `${CLIENT}screens/A.tsx`)).toBe(0)
  })

  test('siblingFeatures', () => {
    const path = `${CLIENT}features/settle/A.tsx`
    expect(count('siblingFeatures', "import {x} from '#/features/capture/y'", path)).toBe(1)
    expect(count('siblingFeatures', "import {x} from '#/features/settle/y'", path)).toBe(0)
  })

  test('packageBoundaries', () => {
    expect(count('packageBoundaries', "import {x} from '@splito/sync'", 'packages/domain/src/a.ts')).toBe(1)
    expect(count('packageBoundaries', "import {x} from './currency'", 'packages/domain/src/a.ts')).toBe(0)
    expect(count('packageBoundaries', "import {useState} from 'react'", 'packages/sync/src/a.ts')).toBe(1)
    expect(count('packageBoundaries', "import {x} from '@splito/domain'", 'packages/sync/src/a.ts')).toBe(0)
  })

  test('persistenceOutsideSync', () => {
    expect(count('persistenceOutsideSync', "import * as SQLite from 'expo-sqlite'")).toBe(1)
    expect(count('persistenceOutsideSync', "import * as SQLite from 'expo-sqlite'", `${CLIENT}data/store.ts`)).toBe(0)
  })

  test('storeAccess', () => {
    expect(count('storeAccess', "const rows = await store.getAll('expense')", `${CLIENT}screens/A.tsx`)).toBe(1)
    expect(count('storeAccess', "const {store} = useData()", `${CLIENT}screens/A.tsx`)).toBe(1)
    expect(count('storeAccess', 'await createExpense(store, ctx, draft)', `${CLIENT}screens/A.tsx`)).toBe(0)
    expect(count('storeAccess', "const rows = await store.getAll('expense')", `${CLIENT}data/hooks.ts`)).toBe(0)
  })

  test('attribution', () => {
    const header = '// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Button.tsx\n'
    const path = `${CLIENT}components/Button.tsx`
    const listed = reuseContext(['## Copied files\n\n| `src/components/Button.tsx` | `src/components/Button.tsx` | - |'])
    expect(RULES.attribution.count(path, header, listed)).toBe(0)
    // Header but no reuse row.
    expect(RULES.attribution.count(path, header, ctx)).toBe(1)
    // Listed as copied but the header is missing.
    expect(RULES.attribution.count(path, 'export {}', listed)).toBe(1)
    // Attribution present but not as the first line.
    expect(RULES.attribution.count(path, `import x from 'y'\n${header}`, listed)).toBe(2)
  })
})
