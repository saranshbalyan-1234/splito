# Splito M1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable offline Splito app (web first, native via dev client) where a user adds friends and groups, records expenses with exact split arithmetic, and sees per-person and per-group balances. It is built on an extracted Bluesky UI shell with smooth motion, and every write is durable locally with an outbox.

**Architecture:** pnpm monorepo. Pure money/split/ledger/settlement rules live in `packages/domain` (bun-tested, no UI/network). The local durable store, outbox and mutations live in `packages/sync` behind one `Store` interface with SQL and IndexedDB implementations. `apps/client` is an Expo app whose design system, primitives and motion are extracted from Bluesky `social-app`, with Splito navigation and screens on top. No server in this milestone: status shows "Saved on this device".

**Tech Stack:** Expo 58.0.14, React Native 0.88.0, React 19.3.0, react-native-web ^0.21.4, Reanimated 4.7.1 + react-native-worklets 0.13.0, Gesture Handler ~3.3.0, react-native-screens 4.30.0, @react-navigation/native ^7.1.33 / native-stack ^7.14.4 / bottom-tabs ^7.15.5, Lingui ^5.9.2, react-native-svg 15.16.0, expo-sqlite 58.0.14, idb 8.0.4, lottie-react-native 7.5.0, lucide-react-native 1.61.0, fast-check 4.10.2, fake-indexeddb 6.2.6, Playwright, Bun 1.4.2 (test runner for packages).

**Spec:** `docs/superpowers/specs/2026-10-26-splito-design.md` (plus `../Splito-Claude-Prompt.txt` for detailed rules).

## Global Constraints

- Upstream: `bluesky-social/social-app` @ `4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465`, local clone at `../upstream/social-app`.
- Package manager pnpm 11.28.5; client toolchain Node ^24.22.1 (upstream `devEngines`, copy into root `package.json`). Packages are tested with `bun test` (Bun 1.4.2).
- Money is `bigint` minor units in memory and a decimal string in JSON/storage. No `number` arithmetic on money anywhere. `MAX_MINOR = 10n ** 15n`; out-of-range → error.
- Every financial record carries its currency. Never sum unlike currencies.
- Rounding: largest remainder; ties go to the participant ID that sorts first by `localeCompare`-free code-unit order (`a < b`). 100 split 3 ways → 34, 33, 33.
- Dates: `date` is `YYYY-MM-DD` (real calendar date, years 1900–2200) plus `tz` IANA string. No October-2026 limits.
- Never copy: `assets/illustrations/`, `assets/icons/ui/`, generated glyph files in `src/components/icons/*.tsx` (Central icon paths), `src/view/icons/Logo*.tsx`, `assets/images/`, any Bluesky logo, app icon or name in UI.
- Keep with notices: Inter (`assets/fonts/inter/` + `OFL.txt`).
- Each copied or adapted upstream file starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — <upstream path>`; `LICENSES/bluesky-social-app.txt` holds upstream's LICENSE text; every copy is recorded in `docs/REUSE_MAP.md`.
- No AT Protocol, Bluesky session or social code in `apps/client`.
- Status copy is exactly: `Saved on this device`, `Waiting for connection`, `Syncing`, `Synced`, `Needs attention`. M1 only produces `Saved on this device`.
- All animations honour reduced motion (static fallback). Lottie never drives navigation.
- Commit after each task (repo initialised in Task 1). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Amount typed with grouping or too many decimals (`1,200.50`, `12.345` for INR, `12.5` for JPY) → clear validation error, never silent rounding. Test: Task 2 `parseAmount` cases.
2. Invalid or edge calendar dates (`2026-02-30`, `2028-02-29`, `1899-12-31`) → reject invalid, accept valid leap day. Test: Task 2 `parseLocalDate`.
3. A mutation that throws midway (e.g. split validation after entity write) → nothing persisted, no outbox entry, on both SQL and IndexedDB stores. Test: Task 6 shared contract `rollsBackOnThrow`.
4. Reopening the store after writes (app relaunch) → entities, history and outbox still present, outbox `seq` order preserved. Test: Task 6 `survivesReopen`.
5. Payer who is not a participant (paid entirely for others), and removing a person still referenced by expenses → the first works; the second is refused with `PERSON_IN_USE`. Tests: Task 3 `payerNotParticipant`, Task 7 `deletePersonInUse`.

---

## File Structure

```
splito/
  package.json, pnpm-workspace.yaml, tsconfig.base.json, .gitignore, .nvmrc (24)
  LICENSES/bluesky-social-app.txt, NOTICE.md
  docs/REUSE_MAP.md, docs/COMPLETION_MATRIX.md, README.md
  packages/domain/src/
    currency.ts      catalog, parseAmount, formatAmount
    date.ts          parseLocalDate, LocalDate
    allocate.ts      largest-remainder allocation
    split.ts         computeShares, validateExpense, SplitError
    ledger.ts        records, pairwiseBalances, personSummary, groupNet
    settlement.ts    planSettlement (min-cost flow)
    hash.ts          fnv1a64 canonical hash
    index.ts
  packages/domain/test/*.test.ts
  packages/sync/src/
    types.ts         Entity, OutboxOp, EntityType, MutationCtx
    codec.ts         bigint-safe JSON encode/decode
    store.ts         Store, Tx interfaces
    sqlStore.ts      SqlStore over SqlExecutor
    idbStore.ts      IdbStore over idb
    mutations.ts     createPerson, createGroup, createExpense, updateExpense, deleteExpense, restoreExpense, deletePerson
    selectors.ts     loadLedger, toDomainRecords
  packages/sync/test/{storeContract.ts, sqlStore.test.ts, idbStore.test.ts, mutations.test.ts}
  apps/client/
    app.config.ts, package.json, babel.config.js, metro.config.js, tsconfig.json, index.ts
    src/alf/**                 adapted from upstream src/alf
    src/components/**          adapted primitives (list in Task 8)
    src/components/icons/      common.tsx (adapted) + lucide.tsx (Splito wrapper)
    src/lib/{haptics,logger,env}.ts, src/state/{a11y,dialogs}.tsx, src/storage/
    src/data/{store.native.ts, store.web.ts, StoreProvider.tsx, hooks.ts}
    src/navigation/{Navigation.tsx, linking.ts, Shell.tsx, Shell.web.tsx}
    src/screens/{People, Person, Groups, Group, AddExpense, AddPerson, CreateGroup, Activity, Profile}.tsx
    src/motion/{AnimatedAmount.tsx, SuccessCheck.tsx, Illustration.tsx}
    assets/lottie/{empty-people.json, empty-groups.json, success.json}  (original, generated by scripts/lottie.ts)
    e2e/*.spec.ts, playwright.config.ts
```

---

### Task 1: Monorepo and domain currency/date primitives

**Files:**
- Create: `splito/package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/{currency,date,index}.ts`
- Test: `packages/domain/test/currency.test.ts`, `packages/domain/test/date.test.ts`

**Interfaces:**
- Produces:
  - `type CurrencyCode = string`
  - `interface CurrencyInfo { code: CurrencyCode; scale: 0 | 2 | 3; symbol: string; name: string }`
  - `const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyInfo>>` covering at least INR, USD, EUR, GBP, AED, SGD, THB, AUD, CAD, CHF, CNY, HKD, NZD, LKR, NPR, MYR, IDR (2), JPY, KRW, VND (0), KWD, BHD, OMR (3)
  - `getCurrency(code: string): CurrencyInfo` (throws `DomainError('UNKNOWN_CURRENCY')`)
  - `parseAmount(input: string, code: CurrencyCode): bigint` — accepts optional leading `-`, digits, optional `.` + up to `scale` digits; trims whitespace; rejects anything else with `DomainError('INVALID_AMOUNT')` or `DomainError('TOO_MANY_DECIMALS')`; enforces `MAX_MINOR`
  - `formatAmount(minor: bigint, code: CurrencyCode, locale: string): string` — `Intl.NumberFormat(locale, {style:'currency', currency, minimumFractionDigits: scale, maximumFractionDigits: scale})` fed a decimal string (no float conversion)
  - `class DomainError extends Error { code: string }`, `const MAX_MINOR = 10n ** 15n`
  - `type LocalDate = string` (`YYYY-MM-DD`), `parseLocalDate(s: string): LocalDate` (throws `DomainError('INVALID_DATE')`)

- [ ] **Step 1: Root setup.** `git init` in `splito/`; root `package.json` with `"private": true`, `packageManager: "pnpm@11.28.5"`, upstream `devEngines` block, scripts `test` (`pnpm -r test`), `typecheck`. Workspace globs `apps/*`, `packages/*`. Domain package script `"test": "bun test"`, devDependency `fast-check@4.10.2`. Install pnpm with `npm i -g pnpm@11.28.5` if missing.
- [ ] **Step 2: Write failing tests**

```ts
// currency.test.ts
expect(parseAmount('12.34', 'INR')).toBe(1234n)
expect(parseAmount('1200', 'JPY')).toBe(1200n)
expect(parseAmount('12.345', 'BHD')).toBe(12345n)
expect(() => parseAmount('12.345', 'INR')).toThrow('TOO_MANY_DECIMALS')
expect(() => parseAmount('12.5', 'JPY')).toThrow('TOO_MANY_DECIMALS')
expect(() => parseAmount('1,200.50', 'INR')).toThrow('INVALID_AMOUNT')
expect(() => parseAmount('', 'INR')).toThrow('INVALID_AMOUNT')
expect(() => parseAmount('10000000000000.00', 'INR')).toThrow('OUT_OF_RANGE')
expect(() => getCurrency('XXX')).toThrow('UNKNOWN_CURRENCY')
expect(formatAmount(10000000n, 'INR', 'en-IN')).toBe('₹1,00,000.00')
expect(formatAmount(1200n, 'JPY', 'en-US')).toBe('¥1,200')
expect(formatAmount(12345n, 'BHD', 'en-US')).toMatch(/12\.345/)
// date.test.ts
expect(parseLocalDate('2028-02-29')).toBe('2028-02-29')
expect(parseLocalDate('2031-01-15')).toBe('2031-01-15')
for (const bad of ['2026-02-30', '2027-02-29', '1899-12-31', '2201-01-01', '2026-1-5', 'x'])
  expect(() => parseLocalDate(bad)).toThrow('INVALID_DATE')
```

- [ ] **Step 3: Run** `cd packages/domain && bun test` → FAIL (modules missing).
- [ ] **Step 4: Implement** the interfaces above. `DomainError.message` equals its code so `toThrow(code)` matches.
- [ ] **Step 5: Run** `bun test` → PASS.
- [ ] **Step 6: Commit** `feat(domain): currency catalog, amount parsing, local dates`.

### Task 2: Exact allocation and split modes

**Files:**
- Create: `packages/domain/src/{allocate,split}.ts`
- Test: `packages/domain/test/split.test.ts`

**Interfaces:**
- Consumes: `DomainError`, `MAX_MINOR` (Task 1)
- Produces:
  - `allocate(total: bigint, weights: ReadonlyArray<{ id: string; weight: bigint }>): Record<string, bigint>` — weights > 0; negative total allocates `-total` then negates; result sums to `total` exactly
  - `type SplitInput =`
    `| { mode: 'equal'; participants: string[] }`
    `| { mode: 'exact'; amounts: Record<string, bigint> }`
    `| { mode: 'percent'; basisPoints: Record<string, number> }` (integers, sum 10000)
    `| { mode: 'shares'; shares: Record<string, number> }` (positive integers)
    `| { mode: 'items'; items: Array<{ id: string; amount: bigint; participants: string[] }>; tax: bigint; tip: bigint; discount: bigint }`
  - `computeShares(total: bigint, split: SplitInput): Record<string, bigint>`
  - `validateExpense(e: { total: bigint; payers: Record<string, bigint>; shares: Record<string, bigint> }): void`
  - Error codes: `EMPTY_PARTICIPANTS`, `TOTAL_MISMATCH`, `PERCENT_NOT_100`, `NON_POSITIVE_WEIGHT`, `UNASSIGNED_ITEM`, `PAYERS_MISMATCH`, `OUT_OF_RANGE`, `DUPLICATE_PARTICIPANT`

Items mode: each item is split equally among its participants with `allocate`. Then `tax + tip - discount` is allocated pro-rata to each person's item subtotal (weights = subtotals; persons with zero subtotal excluded). Items sum + tax + tip − discount must equal `total`, else `TOTAL_MISMATCH`.

- [ ] **Step 1: Write failing tests**

```ts
test('equal 100/3 stable tie-break', () =>
  expect(computeShares(100n, {mode:'equal', participants:['c','a','b']})).toEqual({a:34n, b:33n, c:33n}))
test('permutation invariant', () => fc.assert(fc.property(arbParticipants, ps =>
  deepEq(computeShares(1000n, {mode:'equal', participants: ps}),
         computeShares(1000n, {mode:'equal', participants: shuffle(ps)})))))
test('conservation all modes', () => fc.assert(fc.property(arbTotal, arbSplit, (t, s) =>
  sum(Object.values(computeShares(t, s(t)))) === t)))
test('exact must match', () => expect(() => computeShares(100n, {mode:'exact', amounts:{a:50n,b:40n}})).toThrow('TOTAL_MISMATCH'))
test('percent', () => expect(computeShares(1000n, {mode:'percent', basisPoints:{a:3333,b:3333,c:3334}})).toEqual({a:333n,b:333n,c:334n}))
test('percent not 100', () => expect(() => computeShares(1000n, {mode:'percent', basisPoints:{a:5000}})).toThrow('PERCENT_NOT_100'))
test('shares 2:1', () => expect(computeShares(300n, {mode:'shares', shares:{a:2,b:1}})).toEqual({a:200n,b:100n}))
test('items with tax tip discount', () => expect(computeShares(1150n, {mode:'items',
  items:[{id:'i1',amount:600n,participants:['a']},{id:'i2',amount:400n,participants:['a','b']}],
  tax:100n, tip:100n, discount:50n})).toEqual({a:920n, b:230n}))
test('unassigned item', () => expect(() => computeShares(100n, {mode:'items', items:[{id:'i',amount:100n,participants:[]}], tax:0n,tip:0n,discount:0n})).toThrow('UNASSIGNED_ITEM'))
test('JPY scale 0 refund', () => expect(computeShares(-100n, {mode:'equal', participants:['a','b','c']})).toEqual({a:-34n,b:-33n,c:-33n}))
test('multiple payers reconcile', () => expect(() => validateExpense({total:100n, payers:{a:60n,b:40n}, shares:{a:50n,b:50n}})).not.toThrow())
test('payers mismatch', () => expect(() => validateExpense({total:100n, payers:{a:60n}, shares:{a:50n,b:50n}})).toThrow('PAYERS_MISMATCH'))
test('payerNotParticipant', () => expect(() => validateExpense({total:100n, payers:{z:100n}, shares:{a:50n,b:50n}})).not.toThrow())
test('overflow', () => expect(() => computeShares(MAX_MINOR + 1n, {mode:'equal', participants:['a']})).toThrow('OUT_OF_RANGE'))
```

Check the items expectation by hand before implementing: a subtotal 600 + 200 = 800, b 200. Adjustment 150 split 800:200 → 120 / 30. Result a 920, b 230; sum 1150.

- [ ] **Step 2: Run** `bun test test/split.test.ts` → FAIL.
- [ ] **Step 3: Implement** `allocate` (floor quotas, distribute remainder by largest fractional part `(total*w) % W`, ties by id ascending), then `computeShares` and `validateExpense`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): exact allocation and split modes`.

### Task 3: Ledger balances and People aggregation

**Files:**
- Create: `packages/domain/src/ledger.ts`
- Test: `packages/domain/test/ledger.test.ts`

**Interfaces:**
- Consumes: `allocate`, `validateExpense`
- Produces:
  - `interface ExpenseRecord { kind: 'expense'; id: string; groupId: string | null; currency: CurrencyCode; total: bigint; payers: Record<string, bigint>; shares: Record<string, bigint>; date: LocalDate; deleted: boolean }`
  - `interface RepaymentRecord { kind: 'repayment'; id: string; groupId: string | null; currency: CurrencyCode; from: string; to: string; amount: bigint; date: LocalDate; deleted: boolean }`
  - `type LedgerRecord = ExpenseRecord | RepaymentRecord`
  - `interface BalanceRow { person: string; groupId: string | null; currency: CurrencyCode; amount: bigint }` (amount > 0 = person owes me)
  - `pairwiseBalances(records: LedgerRecord[], me: string): BalanceRow[]` — per expense, participant p owes payer q `allocate(share_p, payers as weights)[q]`, self-debt ignored; repayment `from→to` of x reduces from's debt to `to` by x. Deleted records skipped. Rows with amount 0 omitted.
  - `interface PersonSummary { person: string; byCurrency: Record<CurrencyCode, { total: bigint; direct: bigint; groups: Record<string, bigint> }> }`
  - `personSummary(rows: BalanceRow[], opts: { includeGroups: boolean }): PersonSummary[]` — sorted by person id
  - `groupNet(records: LedgerRecord[], groupId: string): Record<CurrencyCode, Record<string, bigint>>` — paid − share, plus repayments (from +amount, to −amount); sums to 0 per currency

- [ ] **Step 1: Write failing tests** (A04)

```ts
const direct = exp({id:'e1', groupId:null, currency:'INR', total:200n, payers:{me:200n}, shares:{me:100n, x:100n}})
const grp    = exp({id:'e2', groupId:'g1', currency:'INR', total:100n, payers:{me:100n}, shares:{me:50n, x:50n}})
const usd    = exp({id:'e3', groupId:null, currency:'USD', total:1000n, payers:{me:1000n}, shares:{me:500n, x:500n}})
test('direct + group = 150 INR', () => expect(personSummary(pairwiseBalances([direct, grp], 'me'), {includeGroups:true})[0].byCurrency.INR)
  .toEqual({total:150n, direct:100n, groups:{g1:50n}}))
test('include groups off = 100', () => expect(personSummary(pairwiseBalances([direct, grp], 'me'), {includeGroups:false})[0].byCurrency.INR.total).toBe(100n))
test('other currency separate', () => { const s = personSummary(pairwiseBalances([direct, grp, usd], 'me'), {includeGroups:true})[0]
  expect(Object.keys(s.byCurrency).sort()).toEqual(['INR','USD']); expect(s.byCurrency.USD.total).toBe(500n) })
test('partial repayment', () => expect(pairwiseBalances([direct, rep({from:'x', to:'me', amount:40n, groupId:null, currency:'INR'})], 'me')[0].amount).toBe(60n))
test('deleted skipped', () => expect(pairwiseBalances([{...direct, deleted:true}], 'me')).toEqual([]))
test('groupNet sums to zero', () => fc.assert(fc.property(arbGroupRecords, rs =>
  Object.values(groupNet(rs, 'g')).every(m => sum(Object.values(m)) === 0n))))
test('multi-payer pairwise', () => expect(pairwiseBalances([exp({id:'e', groupId:null, currency:'INR', total:300n,
  payers:{me:200n, y:100n}, shares:{me:100n, x:100n, y:100n}})], 'me')).toEqual(expect.arrayContaining([
  {person:'x', groupId:null, currency:'INR', amount:67n}])))
```

`exp`/`rep` are test helpers filling `kind`, `date: '2026-01-01'` and `deleted: false`.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): pairwise balances and people aggregation`.

### Task 4: Constrained settlement planner

**Files:**
- Create: `packages/domain/src/{settlement,hash}.ts`
- Test: `packages/domain/test/settlement.test.ts`

**Interfaces:**
- Produces:
  - `type EdgeRule = 'allowed' | 'preferred' | 'excluded'`
  - `interface SettlementRules { allowListOnly: boolean; edges: Record<string /* `${from}>${to}` */, EdgeRule> }`
  - `type PlanMode = 'direct' | 'transit'`
  - `interface Transfer { from: string; to: string; amount: bigint }`
  - `type Plan = { status: 'ok'; mode: PlanMode; transfers: Transfer[]; hash: string } | { status: 'infeasible'; mode: PlanMode; reason: 'NO_ROUTE'; stuck: string[]; hash: string }`
  - `planSettlement(net: Record<string, bigint>, rules: SettlementRules, mode: PlanMode): Plan` — net < 0 owes, > 0 is owed, sum must be 0 (else `DomainError('UNBALANCED')`)
  - `fnv1a64(s: string): string` (16 hex chars)

Edge eligibility: `excluded` never. With `allowListOnly`, only `allowed`/`preferred`. Otherwise any ordered member pair is eligible. Direct mode keeps only debtor→creditor edges. Cost: preferred 1, allowed 3, so each extra hop costs more than a preference saves. Algorithm (members sorted by id for determinism):

```
super source S → each debtor d (cap −net[d], cost 0); each creditor c → sink T (cap net[c], cost 0)
eligible edges u→v (cap = sum of debts, cost as above)
successive shortest paths with Bellman-Ford over residual graph; relax edges in sorted (u,v) order;
  among equal-cost paths keep the first found (strict < when relaxing)
if total flow < total debt → infeasible; stuck = debtors with unsent flow (sorted)
transfers = edges u→v (members only) with flow > 0, sorted by (from, to)
hash = fnv1a64(canonical JSON of {net sorted, rules sorted, mode})
```

- [ ] **Step 1: Write failing tests** (A07)

```ts
const net = {A:-100n, B:0n, C:100n}
const rules = {allowListOnly:false, edges:{'A>C':'excluded'}}
test('transit routes via B', () => expect(planSettlement(net, rules, 'transit')).toMatchObject({status:'ok',
  transfers:[{from:'A',to:'B',amount:100n},{from:'B',to:'C',amount:100n}]}))
test('direct infeasible', () => expect(planSettlement(net, rules, 'direct')).toMatchObject({status:'infeasible', stuck:['A']}))
test('all A outbound excluded', () => { const r = {allowListOnly:false, edges:{'A>B':'excluded','A>C':'excluded'}}
  for (const m of ['direct','transit'] as const) expect(planSettlement(net, r, m).status).toBe('infeasible') })
test('no excluded edge ever used', () => fc.assert(fc.property(arbNet, arbRules, arbMode, (n, r, m) => {
  const p = planSettlement(n, r, m); return p.status !== 'ok' || p.transfers.every(t => r.edges[`${t.from}>${t.to}`] !== 'excluded') })))
test('ok plans settle every balance exactly', () => fc.assert(fc.property(arbNet, arbRules, arbMode, (n, r, m) => {
  const p = planSettlement(n, r, m); return p.status !== 'ok' || applyTransfers(n, p.transfers).every(v => v === 0n) })))
test('preferred wins deterministically', () => {
  const n = {A:-100n, B:100n, C:100n, D:-100n}
  const r = {allowListOnly:false, edges:{'A>C':'preferred','D>B':'preferred'}}
  const p = planSettlement(n, r, 'direct')
  expect(p).toMatchObject({status:'ok', transfers:[{from:'A',to:'C',amount:100n},{from:'D',to:'B',amount:100n}]})
  expect(planSettlement(n, r, 'direct').hash).toBe(p.hash) })
test('allow-list restricts', () => expect(planSettlement({A:-100n, C:100n}, {allowListOnly:true, edges:{}}, 'direct').status).toBe('infeasible'))
test('no rules = all edges', () => expect(planSettlement({A:-100n, C:100n}, {allowListOnly:false, edges:{}}, 'direct').status).toBe('ok'))
test('unbalanced throws', () => expect(() => planSettlement({A:-1n}, {allowListOnly:false, edges:{}}, 'direct')).toThrow('UNBALANCED'))
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): constrained min-cost settlement planner`.

### Task 5: Sync types, codec and Store interface

**Files:**
- Create: `packages/sync/package.json` (deps `@splito/domain: workspace:*`, `idb@8.0.4`; dev `fake-indexeddb@6.2.6`), `packages/sync/src/{types,codec,store,index}.ts`
- Test: `packages/sync/test/codec.test.ts`

**Interfaces:**
- Produces:
  - `type EntityType = 'person' | 'group' | 'expense'`
  - `interface Entity<T = unknown> { type: EntityType; id: string; data: T; version: number; deleted: boolean; updatedAt: number }`
  - `interface OutboxOp { seq?: number; opId: string; deviceId: string; actor: string; entityType: EntityType; entityId: string; opType: string; baseVersion: number; payload: unknown; schemaVersion: 1; deps: string[]; attempts: number; nextAttemptAt: number | null; lastError: string | null }`
  - `interface HistoryRow { entityType: EntityType; entityId: string; version: number; data: unknown; deleted: boolean; at: number; actor: string }`
  - `interface MutationCtx { deviceId: string; actor: string; now(): number; newId(): string }`
  - `interface Tx { get<T>(type: EntityType, id: string): Promise<Entity<T> | undefined>; put(e: Entity): Promise<void>; appendHistory(h: HistoryRow): Promise<void>; enqueue(op: OutboxOp): Promise<void> }`
  - `interface Store { transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>; getAll<T>(type: EntityType): Promise<Entity<T>[]>; history(type: EntityType, id: string): Promise<HistoryRow[]>; outbox(): Promise<OutboxOp[]>; subscribe(fn: () => void): () => void; close(): Promise<void> }`
  - `encode(v: unknown): string` / `decode(s: string): unknown` — bigint ↔ `{"$bigint":"123"}`

- [ ] **Step 1: Failing test:** `expect(decode(encode({a: 10n ** 15n, b: [1n], c: 'x'}))).toEqual({a: 10n ** 15n, b: [1n], c: 'x'})`; and `encode(1.5)` is plain JSON.
- [ ] **Step 2: Run** `bun test` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(sync): entity, outbox types and bigint codec`.

### Task 6: SqlStore and IdbStore with one contract suite

**Files:**
- Create: `packages/sync/src/sqlStore.ts`, `packages/sync/src/idbStore.ts`
- Test: `packages/sync/test/storeContract.ts`, `sqlStore.test.ts` (uses `bun:sqlite` executor), `idbStore.test.ts` (uses `fake-indexeddb`)

**Interfaces:**
- Consumes: Task 5 types
- Produces:
  - `interface SqlExecutor { exec(sql: string): Promise<void>; run(sql: string, params: unknown[]): Promise<void>; all<R>(sql: string, params: unknown[]): Promise<R[]>; withTransaction<T>(fn: () => Promise<T>): Promise<T> }`
  - `openSqlStore(exec: SqlExecutor): Promise<Store>` — runs migrations from a `MIGRATIONS: string[]` array tracked in `meta(schema_version)`
  - `openIdbStore(name: string, factory?: IDBFactory): Promise<Store>`
  - `runStoreContract(name: string, open: () => Promise<Store>, reopen: () => Promise<Store>): void` (test helper)

Schema v1 (SQL; IndexedDB mirrors it with stores `entities` [keyPath `['type','id']`], `history` [`['entityType','entityId','version']`], `outbox` [autoIncrement `seq`, unique index `opId`], `meta`):
`entities(type, id, data TEXT, version INTEGER, deleted INTEGER, updated_at INTEGER, PK(type,id))`, `history(entity_type, entity_id, version, data TEXT, deleted INTEGER, at INTEGER, actor, PK(...))`, `outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT UNIQUE, ... remaining OutboxOp fields, payload TEXT, deps TEXT)`, `meta(key PRIMARY KEY, value)`.

IdbStore transaction: open one `readwrite` IDB transaction over all stores; `fn` must only await Tx calls. Wrap `tx.done`; if `fn` throws, call `idbTx.abort()` and rethrow. `subscribe` listeners fire after commit only. `BroadcastChannel('splito-store')` notifies other tabs (guard `typeof BroadcastChannel`).

- [ ] **Step 1: Contract tests**

```ts
test('put/get/getAll round-trip with bigint data')
test('rollsBackOnThrow', async () => { await expect(store.transaction(async tx => {
    await tx.put(ent('person','p1')); await tx.enqueue(op('o1')); throw new Error('boom') })).rejects.toThrow('boom')
  expect(await store.getAll('person')).toEqual([]); expect(await store.outbox()).toEqual([]) })
test('survivesReopen', async () => { /* write p1 + ops o1,o2 */ const s2 = await reopen()
  expect((await s2.getAll('person')).map(e => e.id)).toEqual(['p1'])
  expect((await s2.outbox()).map(o => o.opId)).toEqual(['o1','o2']) })
test('duplicate opId rejected and rolls back the transaction')
test('subscribe fires once per committed transaction, not on rollback')
test('history ordered by version')
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement both stores.** **Step 4: Run** `bun test` → PASS for both.
- [ ] **Step 5: Commit** `feat(sync): durable SQL and IndexedDB stores`.

### Task 7: Mutations and selectors

**Files:**
- Create: `packages/sync/src/{mutations,selectors}.ts`
- Test: `packages/sync/test/mutations.test.ts` (runs against the `bun:sqlite` store)

**Interfaces:**
- Consumes: domain `computeShares`, `validateExpense`, `parseLocalDate`, `getCurrency`; Store (Task 6)
- Produces (entity data shapes):
  - `interface Person { name: string; isMe: boolean }`
  - `interface Group { name: string; kind: 'trip' | 'home' | 'couple' | 'other'; currency: CurrencyCode; members: Array<{ personId: string; joinedAt: number; leftAt: number | null }>; startDate: LocalDate | null; endDate: LocalDate | null; archived: boolean }`
  - `interface Expense { title: string; groupId: string | null; currency: CurrencyCode; total: bigint; payers: Record<string, bigint>; split: SplitInput; shares: Record<string, bigint>; date: LocalDate; tz: string; category: string; notes: string }`
  - `ensureMe(store, ctx, name: string): Promise<Entity<Person>>` (`ctx.actor` is the me-person id)
  - `createPerson(store, ctx, input: { name: string }): Promise<Entity<Person>>`
  - `deletePerson(store, ctx, id: string): Promise<void>` — throws `DomainError('PERSON_IN_USE')` if any non-deleted expense or group references them
  - `createGroup(store, ctx, input: Omit<Group, 'members' | 'archived'> & { memberIds: string[] }): Promise<Entity<Group>>` — me always included
  - `type ExpenseDraft = Omit<Expense, 'shares'>`
  - `createExpense(store, ctx, d: ExpenseDraft): Promise<Entity<Expense>>`, `updateExpense(store, ctx, id, d: ExpenseDraft): Promise<Entity<Expense>>`, `deleteExpense(store, ctx, id)`, `restoreExpense(store, ctx, id)`
  - Every mutation runs in one `store.transaction`: validate → put entity (version+1) → appendHistory → enqueue op with `opType` in `person.create | person.delete | group.create | expense.create | expense.update | expense.delete | expense.restore` and `baseVersion` = prior version.
  - Group expenses: every participant and payer must be a current group member, else `DomainError('NOT_A_MEMBER')`.
  - `loadLedger(store): Promise<LedgerRecord[]>` maps expenses to `ExpenseRecord`.
  - `syncStatus(store, entityId): Promise<'Saved on this device' | 'Synced'>` — pending outbox op for the id → `Saved on this device`.

- [ ] **Step 1: Failing tests**

```ts
test('createExpense writes entity, history v1 and one outbox op atomically')
test('invalid split leaves nothing behind', async () => {
  await expect(createExpense(s, ctx, {...draft, split:{mode:'exact', amounts:{me:1n}}})).rejects.toThrow('TOTAL_MISMATCH')
  expect(await s.getAll('expense')).toEqual([]); expect(await s.outbox()).toEqual([]) })
test('update bumps version and keeps history v1 and v2')
test('delete is a tombstone; restore brings it back; balances follow', async () => { /* pairwiseBalances via loadLedger */ })
test('deletePersonInUse', async () => expect(deletePerson(s, ctx, x.id)).rejects.toThrow('PERSON_IN_USE'))
test('group expense with non-member payer rejected', async () => expect(createExpense(...)).rejects.toThrow('NOT_A_MEMBER'))
test('dates outside October 2026 accepted', async () => { for (const d of ['2019-03-01','2031-12-31']) await createExpense(s, ctx, {...draft, date:d}) })
test('syncStatus is Saved on this device after create')
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(sync): atomic mutations with history and outbox`.

### Task 7b: Preferences registry ("everything customizable", spec 3a)

**Files:**
- Create: `packages/sync/src/preferences.ts`
- Modify: `packages/sync/src/types.ts` (add `'preference'` to `EntityType`), `packages/sync/src/mutations.ts`
- Test: `packages/sync/test/preferences.test.ts`

**Interfaces:**
- Produces:
  - `type PrefDef<T> = { key: string; group: 'appearance' | 'motion' | 'defaults' | 'categories' | 'regional' | 'lists' | 'notifications'; scope: 'device' | 'account'; default: T; validate(v: unknown): v is T; label: string }`
  - `const PREFS` registry with at least: `theme` ('system'|'light'|'dark'), `accent` (hex), `textScale` (0.85–1.3), `density` ('comfortable'|'compact'), `motion` ('full'|'reduced'|'off'), `haptics` (bool), `homeTab`, `tabs` (ordered visible list; People always reachable via Settings recovery), `defaultCurrency` ('INR'), `defaultSplitMode` ('equal'), `weekStart` (1), `timezone` ('device' or IANA), `language` ('en'), `dateFormat`, `numberLocale` ('auto'), `peopleSort` ('amount'|'name'|'recent'), `includeGroupsDefault` (true), `swipeLeft`/`swipeRight` (activity actions), `notify.*` (bools), `categories` (array of `{id, name, color, icon, order, hidden}` with default set: Food, Transport, Stay, Shopping, Entertainment, Bills, Groceries, Other)
  - `getPref<K extends keyof typeof PREFS>(store, key: K): Promise<PrefValue<K>>` (falls back to default on missing or invalid)
  - `setPref(store, ctx, key, value)` — validates; account-scope writes enqueue `preference.set`; device-scope writes do not
  - `resetPref(store, ctx, key)`, `resetAllPrefs(store, ctx)`

- [ ] **Step 1: Failing tests:** default returned when unset; invalid value rejected with `DomainError('INVALID_PREF')`; account pref enqueues an outbox op, device pref does not; `tabs` without any route to Settings rejected; reset restores default; categories rename keeps id.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Client follow-through (folded into Tasks 9–12):** Profile tab hosts a Settings screen generated from `PREFS` groups, with "Reset to default" per item and "Reset all". The shell reads `tabs`, `homeTab`, `theme`, `accent`, `textScale`, `density` and `motion`. AddExpense reads `defaultCurrency`, `defaultSplitMode` and `categories`; People reads `peopleSort` and `includeGroupsDefault`. Add E2E `settings.spec.ts`: change accent → Apply → persists after reload; hide Groups tab → tab gone, Settings still reachable; motion 'off' → static illustrations.
- [ ] **Step 6: Commit** `feat(sync): preferences registry`.

### Task 8: Client shell extracted from Bluesky

**Files:**
- Create: `apps/client/{package.json, app.config.ts, babel.config.js, metro.config.js, tsconfig.json, index.ts, App.tsx}`, `LICENSES/bluesky-social-app.txt`, `NOTICE.md`, `docs/REUSE_MAP.md`
- Copy/adapt from upstream (one REUSE_MAP row each):
  - `src/alf/**` (all non-test files) → `apps/client/src/alf/**`. Replace the `#/storage` import with Splito `src/storage` (MMKV-backed per upstream pattern, `localStorage` on web).
  - `src/components/{Typography,Button,Pressable,Loader,Loader.web,Skeleton,Divider,Portal,Prompt}.tsx`, `src/components/{Dialog,Toast,Menu}/**`, `src/components/forms/{TextField,Toggle}*`, `src/components/hooks/useInteractionState.ts`, `src/components/anim/AnimatedCheck.tsx`, `src/components/icons/{common,TEMPLATE}.tsx` → same paths.
  - `src/components/Layout/**` → adapt `Header` to drop `#/state/shell`, `#/screens/Messages/...` and `#/lib/routes/types` (replace with Splito navigation types).
  - `modules/bottom-sheet` → `apps/client/modules/bottom-sheet` (native Dialog sheets).
  - `src/lib/haptics.ts`, `src/state/a11y.tsx`, `src/state/dialogs/**` → same paths. Replace `#/logger` and `#/env` with minimal Splito `src/lib/logger.ts` (same `logger.error/warn/info/debug` surface, console-backed) and `src/env.ts` (`IS_WEB`, `IS_IOS`, `IS_ANDROID`, `IS_NATIVE`, `IS_DEV`).
  - `assets/fonts/inter/**` with `OFL.txt` → `apps/client/assets/fonts/inter/`.
  - `src/locale/` i18n provider setup (Lingui) → `apps/client/src/locale/`, keeping only `en` and `hi` catalogs (empty Splito catalogs).
- Create: `apps/client/src/components/icons/lucide.tsx` exporting Splito icons as `createIcon(LucideComponent)` wrappers that accept upstream icon `Props` (`size` key from `sizes`, `fill` → stroke colour, theme default via `useCommonSVGProps`). Never copy upstream glyph files.

**Interfaces:**
- Produces: `#/alf` (`useTheme`, `atoms as a`, `ThemeProvider`, `useBreakpoints`), `#/components/*` primitives at upstream names, `#/components/icons/lucide` named exports `Plus, Users, UserGroup, Bell, User, ChevronLeft, Check, Trash, Pencil, Receipt`.

- [ ] **Step 1:** Scaffold `apps/client/package.json` with the Tech Stack versions above. Use upstream `babel.config.js` and `metro.config.ts` as the base, with `#/*` → `./src/*` path alias. Use `app.config.ts` with name `Splito`, slug `splito`, scheme `splito`, Splito placeholder icon/splash (simple original SVG-rendered PNGs), and the `expo-dev-client`, Reanimated and `expo-sqlite` plugins.
- [ ] **Step 2:** Copy the files listed, add the attribution header to each, write REUSE_MAP rows (upstream path, SHA, destination, modification, license, validation).
- [ ] **Step 3:** Run `pnpm --filter client exec tsc --noEmit`. Expected: FAIL with unresolved `#/...` imports. Resolve each by copying the upstream dependency (if generic UI/infra) or replacing it with a Splito shim (if social/AT-specific). Record each choice in REUSE_MAP. Repeat until it passes.
- [ ] **Step 4:** `App.tsx` renders ThemeProvider + i18n + a `Button` and a `Dialog` demo. Run `pnpm --filter client exec expo export -p web` → succeeds, then serve `dist` and load it in a browser. Expected: the button renders in Inter and the dialog opens and closes.
- [ ] **Step 5:** Verify no forbidden assets: `grep -rIl "Bluesky\|bsky" apps/client/src apps/client/assets` returns only attribution headers and REUSE_MAP. `ls apps/client/src/components/icons` shows only `common.tsx`, `TEMPLATE.tsx`, `lucide.tsx`.
- [ ] **Step 6: Commit** `feat(client): Expo shell on adapted Bluesky design system`.

### Task 9: Navigation, store wiring and People-first shell

**Files:**
- Create: `apps/client/src/navigation/{Navigation.tsx, linking.ts, Shell.tsx, Shell.web.tsx}`, `apps/client/src/data/{store.native.ts, store.web.ts, StoreProvider.tsx, hooks.ts}`, `apps/client/src/screens/{People,Activity,Profile}.tsx`
- Test: `apps/client/e2e/shell.spec.ts`, `apps/client/playwright.config.ts`

**Interfaces:**
- Consumes: `openSqlStore` (native executor wraps `expo-sqlite` `openDatabaseAsync('splito.db')`; `withTransaction` → `withExclusiveTransactionAsync`), `openIdbStore('splito')` on web, `ensureMe`
- Produces:
  - Route params: `type RootStackParams = { Tabs: undefined; Person: { personId: string }; Group: { groupId: string }; AddExpense: { personId?: string; groupId?: string; expenseId?: string }; AddPerson: undefined; CreateGroup: undefined }`, tabs `People | Groups | Activity | Profile`
  - Linking: `/` People, `/groups`, `/activity`, `/profile`, `/people/:personId`, `/groups/:groupId`, `/expense/new`, `/expense/:expenseId`
  - `useStore(): Store`, `useEntities<T>(type): Entity<T>[]` (re-reads on `subscribe`), `useLedger(): LedgerRecord[]`, `useMe(): Entity<Person>`
  - `MutationCtx` on client: `deviceId` persisted in storage on first run, `newId` = `expo-crypto` `randomUUID`, `actor` = me-person id

Shell: phones use native bottom tabs with a raised central + button (opens AddExpense as `formSheet`/modal). Desktop/tablet (`useBreakpoints().gtMobile`) uses a left sidebar with Splito wordmark, the four destinations and + at the bottom. The wordmark navigates to People and is disabled with `aria-disabled` on People. People has no "People" title.

- [ ] **Step 1: Failing E2E**

```ts
test('People is the initial route with no People title', async ({page}) => {
  await page.goto('/'); await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.getByRole('heading', {name:'People'})).toHaveCount(0) })
test('logo inactive on home, returns home elsewhere', async ({page}) => {
  await page.goto('/groups'); await page.getByTestId('logo').click(); await expect(page).toHaveURL('/')
  await expect(page.getByTestId('logo')).toHaveAttribute('aria-disabled', 'true') })
test('desktop sidebar has + at bottom', async ({page}) => { await page.setViewportSize({width:1280, height:800}); await page.goto('/')
  await expect(page.getByTestId('sidebar-add')).toBeVisible() })
test('mobile has central +', async ({page}) => { await page.setViewportSize({width:390, height:844}); await page.goto('/')
  await expect(page.getByTestId('tab-add')).toBeVisible() })
test('deep link refresh works', async ({page}) => { await page.goto('/groups'); await page.reload(); await expect(page.getByTestId('screen-groups')).toBeVisible() })
```

Playwright `webServer`: `expo export -p web && npx serve dist -s -l 8081`.

- [ ] **Step 2: Run** `pnpm --filter client exec playwright test` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(client): People-first navigation shell with durable local store`.

### Task 10: Friends, groups and expense entry

**Files:**
- Create: `apps/client/src/screens/{AddPerson,CreateGroup,Groups,Group,AddExpense}.tsx`, `apps/client/src/components/split/{SplitEditor.tsx, PayerEditor.tsx, AmountField.tsx}`
- Test: `apps/client/e2e/expense.spec.ts`

**Interfaces:**
- Consumes: `createPerson`, `createGroup`, `createExpense`, `updateExpense`, `deleteExpense`, `restoreExpense`, `parseAmount`, `parseLocalDate`, `computeShares`
- Produces: `AmountField` (`value: string`, `currency`, `onChange`, inline error from `parseAmount` code); `SplitEditor` with modes equal / exact / percent / shares (items mode lands in M3 and is shown in COMPLETION_MATRIX as not started); `PayerEditor` with a single payer by default and an "Multiple payers" expander.

AddExpense is a sheet on mobile and a centred dialog on desktop (upstream `Dialog`). It has a live "remaining to assign" readout and disables Save until `validateExpense` passes. Errors are shown as plain copy (`TOTAL_MISMATCH` → "Shares add up to ₹X, expense is ₹Y"). Delete shows an undo toast (upstream `Toast`) that calls `restoreExpense`. Date uses a native date input (upstream `DateField` if it copies cleanly, else `<input type="date">` on web and the platform picker on native) with no min/max beyond 1900–2200.

- [ ] **Step 1: Failing E2E**

```ts
test('add friend, add equal expense, balance shows, survives reload', async ({page}) => {
  await addPerson(page, 'Riya'); await addExpense(page, {title:'Dinner', amount:'100', with:['Riya'], split:'equal'})
  await expect(page.getByTestId('balance-Riya')).toContainText('₹50.00'); await page.reload()
  await expect(page.getByTestId('balance-Riya')).toContainText('₹50.00')
  await expect(page.getByText('Saved on this device')).toBeVisible() })
test('exact split blocks save until totals match')
test('expense dated 2031-12-31 saves')
test('delete then undo restores balance')
test('group create and group expense shows in group balances')
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(client): friends, groups and expense entry`.

### Task 11: People balances, person page and Include-groups filter

**Files:**
- Modify: `apps/client/src/screens/People.tsx`
- Create: `apps/client/src/screens/Person.tsx`, `apps/client/src/components/people/{BalanceRow.tsx, PeopleFilter.tsx}`
- Test: `apps/client/e2e/people.spec.ts`

**Interfaces:**
- Consumes: `pairwiseBalances`, `personSummary`, `useLedger`, `useMe`
- Produces: `PeopleFilter` holds draft state and commits on **Apply** (`includeGroups` default `true`, persisted in storage). Each row shows one line per currency, "owes you" / "you owe", and group origins as chips. The Person page shows per-currency totals, then expense history filtered by the same `includeGroups`, sorted by date desc then id.

- [ ] **Step 1: Failing E2E** (A04 in UI)

```ts
test('direct 100 + group 50 = 150; Include groups off = 100 and history filtered', async ({page}) => {
  await seedViaUi(page) // direct ₹200 me paid split with X; group ₹100 me paid split with X
  await expect(page.getByTestId('balance-X')).toContainText('owes you ₹150.00')
  await openFilter(page); await page.getByLabel('Include groups').click()
  await expect(page.getByTestId('balance-X')).toContainText('₹150.00') // not applied yet
  await page.getByRole('button', {name:'Apply'}).click()
  await expect(page.getByTestId('balance-X')).toContainText('owes you ₹100.00')
  await page.getByTestId('balance-X').click(); await expect(page).toHaveURL(/\/people\//)
  await expect(page.getByTestId('history-item')).toHaveCount(1)
  await page.goBack(); await expect(page.getByTestId('screen-people')).toBeVisible() })
test('USD debt shown on a separate line, never summed')
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(client): people balances, person page and filter`.

### Task 12: Motion layer — Bluesky smoothness, Expensify-style page illustrations

**Files:**
- Create: `apps/client/src/motion/{AnimatedAmount.tsx, SuccessCheck.tsx, Illustration.tsx, useReducedMotion.ts}`, `apps/client/scripts/lottie.ts`, `apps/client/assets/lottie/{empty-people,empty-groups,empty-activity,success}.json`
- Modify: list screens (People, Groups, Group, Person, Activity), AddExpense, navigation options
- Test: `apps/client/e2e/motion.spec.ts`

**Interfaces:**
- Produces:
  - `AnimatedAmount({ minor: bigint; currency: CurrencyCode })` — Reanimated count from previous to new value over 400 ms. The displayed text is always a `formatAmount` result (interpolated as a bigint step, never a float of money); it renders the final value immediately under reduced motion.
  - `SuccessCheck` — wraps upstream `AnimatedCheck` and a light `expo-haptics` success on native.
  - `Illustration({ name: 'empty-people' | 'empty-groups' | 'empty-activity' | 'success'; size?: number })` — `lottie-react-native` autoplay loop for empty states and once for success. Under reduced motion it shows frame 0 as a static image.
  - `scripts/lottie.ts` generates the original Lottie JSON (simple Splito shapes: coins splitting, people circles) so artwork provenance is ours. Each file records `"meta": {"g": "splito/scripts/lottie.ts"}`.
- List rows use Reanimated `entering={FadeInDown.springify()}`, `exiting={FadeOut}` and `layout={LinearTransition}`. These are disabled under reduced motion.
- Stack: native-stack `animation: 'default'` (platform push) and `gestureEnabled: true`. AddExpense uses `presentation: 'formSheet'` on iOS and the upstream bottom-sheet on Android.
- Skeleton: upstream `Skeleton` shimmer while `useEntities` first loads.

- [ ] **Step 1: Failing E2E**

```ts
test('empty People shows illustration', async ({page}) => { await page.goto('/'); await expect(page.getByTestId('illustration-empty-people')).toBeVisible() })
test('reduced motion: static illustration, amounts final immediately', async ({browser}) => {
  const page = await (await browser.newContext({reducedMotion:'reduce'})).newPage(); await page.goto('/')
  await expect(page.getByTestId('illustration-empty-people')).toHaveAttribute('data-static', 'true') })
test('saving an expense shows success check')
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Manual perf check:** on the web build, record a Chrome Performance trace while scrolling a 500-person seeded list (`?seed=500`, available only in dev builds) and navigating. Note long tasks over 50 ms in `docs/COMPLETION_MATRIX.md`. Native fps check is deferred until a dev build runs on a device (listed as blocked if none).
- [ ] **Step 6: Commit** `feat(client): motion layer and original Lottie illustrations`.

### Task 13: Evidence and handoff docs

**Files:**
- Create: `splito/README.md`, `docs/COMPLETION_MATRIX.md`
- Modify: `docs/REUSE_MAP.md`

- [ ] **Step 1:** README: prerequisites (Node 24, pnpm 11.28.5, Bun 1.4.2), `pnpm install`, `pnpm test`, `pnpm --filter client web`, `pnpm --filter client exec expo run:ios|android` (dev client; needs Xcode/Android SDK), Playwright command.
- [ ] **Step 2:** Run every check and paste exact commands and results into COMPLETION_MATRIX: `pnpm -r test`, `pnpm -r typecheck`, `pnpm --filter client exec playwright test`, `expo export -p web`. Native: attempt `expo prebuild` + `expo run:ios` / `run:android`; record the outcome or the exact blocker.
- [ ] **Step 3:** COMPLETION_MATRIX lists every feature in the spec Section 4 with status implemented / tested / partial / blocked / not started and an evidence link. Mark A02, A04, part of A07, A13 (partial) with test paths. Server sync, auth, invites, items-split UI and everything in v2/v3 are not started.
- [ ] **Step 4: Commit** `docs: completion matrix, reuse map, setup`.
