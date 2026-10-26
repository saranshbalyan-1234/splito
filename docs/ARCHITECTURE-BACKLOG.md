# Architecture backlog

The work that makes the code match `docs/ARCHITECTURE.md`. Ids are in execution order: take the lowest open
id whose dependencies are done. Each item flips the matching status tag in `ARCHITECTURE.md` from [Planned] or
[Partial] to [Built] in the same PR, with the Cost and Checks lines (§ 0).

- Baseline: branch `ui/polish-2` at `f510c2d` (2026-10-26). Counts below were measured there; re-measure
  when you start an item. Build on the branch that carries the client (`m1-foundation` has only the packages).
- Effort: **S** = up to half a day, **M** = 1-2 days, **L** = 3-5 days.
- Milestones: **M1** = local-only app, **M2** = Fastify API + sync, **v2** = receipts and other v2 features.
- "Needs" lists anything the owner must supply; such an item stays blocked, and the doc says so.

## Order at a glance

| Id | Item | Effort | Depends on | Milestone |
|---|---|---|---|---|
| **Phase 0: guardrails** |||||
| A-001 | Architecture rule tests with a per-file baseline that only goes down | M | - | M1 |
| A-002 | More architecture counters (imports, platform sets, issues, compiler-safe patterns) | M | A-001 | M1 |
| A-003 | Oxlint errors-only with a stale-failing suppressions baseline | S | - | M1 |
| **Phase 1: money and sync correctness (no server)** |||||
| A-004 | Move client money arithmetic into `packages/domain` | M | A-001 | M1 |
| A-005 | Decoders that never throw; quarantine bad rows | M | - | M1 |
| A-006 | Golden fixtures and the format round-trip test | S | - | M1 |
| A-007 | Outbox lifecycle: classifier, refused state, account scope, per-op telemetry flag | M | A-005 | M1 |
| A-008 | Undo holds the delete op | S | A-007 | M1 |
| A-009 | `followSync()` and one sync-status component | M | A-007 | M1 |
| A-010 | Id shape checks at every boundary | S | - | M1 |
| A-011 | Single-flight submits; ids minted when the sheet opens | S | - | M1 |
| A-012 | Error codes mapped to Lingui messages | S | - | M1 |
| A-013 | Honesty and placeholder copy scan | S | A-009, A-012 | M1 |
| A-014 | `goBack(fallback)`, unknown path to home, not-found states | S | - | M1 |
| A-015 | `useToday(tz)` and the `TimeAgo` leaf; no clock in render | S | - | M1 |
| **Phase 2: client architecture and quality** |||||
| A-016 | Data hooks on shared `useSyncExternalStore` projections | L | A-001 | M1 |
| A-017 | React Compiler bail-out baseline | S | A-016 | M1 |
| A-018 | Root `AppErrorBoundary` and web chunk reload-once | M | - | M1 |
| A-019 | Telemetry module: enqueue-only, privacy scrubbers, "Send diagnostics" switch | M | A-001 | M1 |
| A-020 | Splash gate, store open at import, preferences before paint | M | A-016 | M1 |
| A-021 | Typed-row lists; empty state only after the first query | M | A-016 | M1 |
| A-022 | FormSheet shell/body split; visible disabled reason; closes on leave | M | - | M1 |
| A-023 | Sheet keyboard rules and the iOS picker handover | M | A-022 | M1 |
| A-024 | Form input rules and strict `parseAmount` | M | A-012 | M1 |
| A-025 | Drafts hardening and the `isDraft` selector filter | S | A-024 | M1 |
| A-026 | Virtualised long pickers | S | - | M1 |
| A-027 | One `navigationItems` array, FAB rule list, tabs land at rest | S | - | M1 |
| A-028 | Theming: raw colours to tokens, overlay layers, contrast, selection glyph | M | A-001 | M1 |
| A-029 | Validators and limits in domain | S | - | M1 |
| A-030 | Predicates and permissions in domain | M | A-004 | M1 |
| A-031 | One naming module | S | - | M1 |
| A-032 | Share helper, `openLinkOrToast`, `safeExternalUrl` | S | - | M1 |
| A-033 | Accessibility basics | S | - | M1 |
| A-034 | Analytics charts and documented formulas | M | A-004 | M1 |
| A-035 | Test harness: mandatory sections, geometry, widths, themes, bounded waits | M | - | M1 |
| A-036 | Hermes formatting tests and formatter caches | S | A-006 | M1 |
| A-037 | Performance gates: render counts, Reanimated flags, loops rest | M | A-035 | M1 |
| A-038 | Feature flags module in `#/env` | S | - | M1 |
| A-039 | Version footer: tier badge and update-id slot | S | - | M1 |
| A-040 | Diagnostics screen (dev/internal) | S | A-009 | M1 |
| **Phase 3: sync engine and M2** |||||
| A-041 | Connectivity store and sync scheduler | M | A-007, A-009 | M1/M2 |
| A-042 | Fake sync server and Playwright against it | L | A-041 | M1/M2 |
| A-043 | Pull path rules | M | A-005, A-042 | M2 |
| A-044 | `packages/contracts` and Fastify sync routes | L | A-042, A-043 | M2 |
| A-045 | One HTTP client | M | A-044, A-019 | M2 |
| A-046 | Telemetry vendor wiring; metrics and issues tables live | M | A-019, A-002 | M2 |
| A-047 | Credential store, sessions, sign-out cleanup | M | A-044 | M2 |
| A-048 | `deviceId` kept out of backups | S | A-047 | M2 |
| A-049 | Links for M2: sanitising, intent resume, public pages, per-tier hosts | M | A-014, A-047 | M2 |
| A-050 | OTA (EAS Update) and `RELEASE.md` | M | A-046 | M2 |
| A-051 | Web resilience: keep old chunks, bfcache reload | M | A-018 | M2 |
| A-052 | Release checks | M | - | M2 |
| **Phase 4: v2** |||||
| A-053 | Attachments and receipts pipeline | L | A-044, A-045 | v2 |

---

## Phase 0: guardrails

### A-001 Architecture rule tests with a per-file baseline that only goes down

Rules: ARCHITECTURE.md § 1, § 4, § 6, § 11, § 16.2, spec § 4c. Effort **M**. Depends on: nothing.

Add `apps/client/src/architecture/rules.ts` (one pure counter per rule: `(path, source) => number`, comments
and `*.test.*` files ignored), `baseline.ts` (frozen per-file counts) and `rules.test.ts` (bun, run by the
client's `bun test ./src/`). The counters and their measured baselines:

| Counter | Counts | Baseline today |
|---|---|---|
| `rawColour` | hex (`'#abc'`, `'#aabbcc'`, `'#aabbccdd'`) and `rgb(`/`rgba(` literals outside `src/alf/` | 12 files: `components/forms/SegmentedControl.tsx`, `components/Composer/index.web.tsx`, `components/brand/Logo.tsx`, `components/groups/GroupAvatar.tsx`, `components/icons/{Settings,UserCircle,ChartPie,lucide,HomeOpen}.tsx`, `components/DraggableList/index(.web).tsx`, `view/com/util/UserAvatar.tsx` |
| `rnModal` | `Modal` imported from `react-native` | 0 |
| `expoHaptics` | `expo-haptics` imports outside `src/lib/haptics/` | 0 |
| `viewFiles` | files under `src/view/` not in the frozen list | 0 (the 23 current files are the list) |
| `credentialAccess` | `expo-secure-store` imports, `document.cookie`, `Authorization` headers, `localStorage`/`sessionStorage` outside `src/storage/` | 1 file: `alf/util/useColorModeTheme.ts` (Bluesky theme cache) |
| `moneyArithmetic` | `bigint` literals (`0n`), `BigInt(` and `+ - * / %` on bigint money outside `packages/domain` | 8 files, 51 hits: `components/split/form.ts`, `components/people/ledger.ts`, `components/groups/net.ts`, `screens/People/sort.ts`, `motion/amountSteps.ts`, `components/charts/scale.ts`, `data/demoData.ts`, `data/devTools.ts` |
| `unlikeCurrencySum` | client: `.reduce(` seeded with `0n` or a bigint `+=` accumulator not keyed by currency; domain: a property test that every sum helper returns a per-currency map and refuses mixed currencies | measure when built |
| `consoleOutsideLogger` | `console.*` calls outside `src/logger/` | 2 files: `components/Toast/Toast.tsx`, `components/Dialog/context.ts` (Bluesky) |

Acceptance criteria:
- The test fails when a file's count rises, when a new file scores above 0, and when a count fell but the
  baseline still holds the old number (stale), printing the exact baseline line to change.
- Each counter has a positive and a negative sample in its own test case (a comment containing `#fff` or
  `console.log` does not count).
- `viewFiles` fails on any new path under `src/view/`.
- The whole suite runs in under 2 s.
- `AGENTS.md` gets one line ("architecture rules test: baseline only goes down"), and ARCHITECTURE.md § 19's
  Architecture row is marked [Built].

### A-002 More architecture counters

Rules: § 1, § 2, § 3, § 9, § 16, § 17. Effort **M**. Depends on: A-001.

Add these counters (baseline 0 unless measured otherwise):
- `layerDirection`: `alf/`, `components/` or `lib/` importing `screens/`, `features/` or `data/`.
- `siblingFeatures`: `features/x` importing `features/y`.
- `platformGap`: a `.native`/`.ios`/`.android`/`.web` file without the rest of its set (never baselined).
- `persistenceOutsideSync`: `expo-sqlite` or `indexedDB`/`idb` imports outside `packages/sync` and
  `data/store(.web).ts`.
- `rawTextInput`: `TextInput` from `react-native` outside `components/forms/` (today: `motion/AnimatedAmount`,
  `components/split/fields.tsx`, `components/forms/*`).
- `sentryImport`: any `@sentry/*` import outside `#/logger` and `#/analytics`.
- `undocumentedIssue`: a `recordIssue('<service>', {code})` literal not in ARCHITECTURE.md § 16.5.
- `toLocale`: `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` outside the format modules.
- `setParamsOnMount`: `setParams` inside `useEffect`.
- `workletDefaultParam`: a worklet naming a module constant in a default parameter.
- `nestedPressable`: a Pressable/Button inside a row Pressable.
- `chartLibrary`: chart libraries, CDN `<script>` or WebView for drawing outside `features/analytics/charts`.
- `cameraImport`: a static camera/OCR import outside the capture feature.
- `domainNumberMoney`: `number`-typed money fields in `packages/domain`.
- `clockInRender` (with A-015): `new Date()`/`Date.now()` in component bodies (11 calls in 7 `.tsx` files today, not all in render).

Acceptance: each counter has samples; baselines recorded; ARCHITECTURE.md references updated.

### A-003 Oxlint errors-only with a stale-failing baseline

Rules: § 20. Effort **S**.

Acceptance: an oxlint config at the repo root where every enabled rule is an error; a suppressions baseline
that fails on new violations and on fixed-but-still-recorded ones; a `pnpm lint` script; hook/component
default params of `[]`, `{}` or functions hoisted (or baselined); `pnpm lint` added to the pre-merge checks
next to `pnpm test` and `pnpm typecheck`.

---

## Phase 1: money and sync correctness (no server)

### A-004 Move client money arithmetic into `packages/domain`

Rules: § 1, AGENTS money rules. Effort **M**. Depends on: A-001.

Move the sums, nets and sign checks in `components/split/form.ts`, `components/people/ledger.ts`,
`components/groups/net.ts` and `screens/People/sort.ts` into domain functions (`sumByCurrency`,
`remainingToAssign`, `netForPerson`, `isPositive`/`isZero`), each with a bun test. `motion/amountSteps.ts` and
`components/charts/scale.ts` either move or get a reasoned baseline entry (display-only scaling).

Acceptance: `moneyArithmetic` baseline for those four files is 0; no behaviour change (existing client and
domain tests pass unchanged); `unlikeCurrencySum` is 0 in the client.

### A-005 Decoders that never throw

Rules: § 9.4. Effort **M**.

Acceptance: `codec.decode()` returns `{ok: value} | {skip: reason}` and never throws on a malformed
`$bigint`; one `parse<Kind>V1()` per stored shape (entity, outbox op, history row, preference JSON) used by
both store engines; a skipped row is quarantined (kept, counted, listed in Diagnostics) and never aborts a
load; an amount that does not parse rejects the row and is never `0n`; code-to-message lookups use `Map` or
`Object.hasOwn`; bun tests feed truncated, wrong-type, prototype-key (`toString`) and oversize inputs.

### A-006 Golden fixtures and the format round-trip test

Rules: § 7, § 19. Effort **S**.

Acceptance: bun snapshots for `computeShares` (every split mode, weighted items, tax/tip pro-rata),
`allocate`, settlement plans (direct, fewest payments, rules) and per-currency balances, recorded from real
flows before any change; a test that `parseAmount(formatAmount(x)) === x` for currency exponents 0, 2 and 3
in `en`, `hi` and `en-IN` (Indian grouping); a decoding test for schema version 1 rows; `AGENTS.md` notes that
a snapshot update needs its own commit and reason.

### A-007 Outbox lifecycle

Rules: § 9.3. Effort **M**. Depends on: A-005.

Acceptance:
- `classifyPushFailure(status)` in `packages/sync`: transient = 0, 5xx, 401, 408, 425, 429; 409 = conflict;
  tombstone 404/410 = acknowledged; any other 4xx = refused. Bun table test.
- `OutboxOp` gains `accountId`, `refusedReason`, `createdAt` and `counted`; a schema migration for both
  engines with a test that version-1 rows still load.
- Refused ops never auto-retry, leave pending/backoff, and block only later ops on the same entity.
- `discardOp(opId)` reverts only that op locally (tombstone or inverse with history).
- Ops for one entity drain FIFO; financial ops are never coalesced (test).
- The drain function (pure over a `send` callback) checks `op.accountId` against the session before each
  send and stops otherwise.

### A-008 Undo holds the delete op

Rules: § 9.3. Effort **S**. Depends on: A-007.

Acceptance: one `UNDO_VISIBLE_MS` constant used by every undo toast; delete mutations set
`nextAttemptAt = now + UNDO_VISIBLE_MS`; Undo removes the op and restores the entity in one transaction (bun
test: nothing remains in the outbox after delete + undo); Activity, Expense and Person undo paths use it.

### A-009 `followSync()` and one sync-status component

Rules: § 9.1. Effort **M**. Depends on: A-007.

Acceptance: a pure `followSync({ops, isOnline, now})` returns the app label and per-entity states (quiet
30 s threshold, counts, offline at once, "Needs attention" on refused/conflict), with bun tests;
`syncStatus()` delegates to it; one `SyncStatusText` component replaces the hard-coded "Saved on this
device" in `HeaderAvatar`, `Profile`, `AboutSettings` and Expense `History`; status lines reserve their
height; no looping indicator while waiting; web tab title prefix only after the quiet threshold. "Synced"
cannot appear while M1 has no server (test).

### A-010 Id shape checks at every boundary

Rules: § 9.3. Effort **S**.

Acceptance: `isEntityId(type, s)` in `packages/sync`; deep-link params, share/invite tokens and decoded rows
are checked before use; a counter (A-002 style) fails on `randomUUID()` outside `StoreProvider`'s `ctx`.

### A-011 Single-flight submits

Rules: § 10. Effort **S**.

Acceptance: `lib/hooks/useSingleFlight` (ref closed synchronously, released in `finally`, returns a distinct
`SKIPPED` value); Save expense, Edit expense, Record payment, Settle up, Create group, Add friend and Delete
use it; the composer mints the expense id when it opens; a `tap_while_busy` friction call (no-op sink until
A-019); Playwright double-taps Save and finds exactly one expense.

### A-012 Error codes mapped to Lingui messages

Rules: § 7. Effort **S**.

Acceptance: `locale/domainReasons.ts` maps every `@splito/domain` code (`INVALID_AMOUNT`, `PAYERS_MISMATCH`,
`UNASSIGNED_ITEM`, `UNKNOWN_CURRENCY`, ...) to a Lingui message with a generic fallback; a bun test fails on a
code without a message; screens stop showing raw codes; both `en` and `hi` catalogs compiled.

### A-013 Honesty and placeholder copy scan

Rules: § 5, § 7, § 0.6. Effort **S**. Depends on: A-009, A-012.

Acceptance: a bun test over the source catalog: "Synced" only in the sync-status component's messages; no
"coming soon"; no message claims exactness for FX/OCR; no copy promising unshipped sync, reminders or push;
no digits in input placeholders.

### A-014 `goBack(fallback)`, unknown paths, not-found states

Rules: § 3, § 14. Effort **S**.

Acceptance: `navigation/goBack(navigation, fallbackRoute)` used by `Layout.Header.BackButton` and every
screen close path (CreateGroup, AddFriend, AddExpense, EditExpense, Expense, Person); per-route fallbacks
(Person -> People, Group -> Groups, Expense -> its group or person); an unknown path opens home (web and
native, Playwright test); a deep link to an unknown or tombstoned id shows "not found" with Back, never the
empty state.

### A-015 `useToday(tz)` and `TimeAgo`

Rules: § 10. Effort **S**.

Acceptance: one `lib/today.ts` store (midnight timer, refresh on foreground) behind `useToday(tz)`; Activity
day sections, the composer's default date and Analytics periods use it; relative times render in one
`TimeAgo` leaf on the shared minute ticker that pauses in background; the `clockInRender` counter (A-002) is
0 for the files touched.

---

## Phase 2: client architecture and quality

### A-016 Data hooks on shared projections

Rules: § 9.6. Effort **L**. Depends on: A-001.

Acceptance: `data/hooks.ts` `useLive` is replaced by one shared projection per query (module store +
`useSyncExternalStore` with a module-level subscribe); equal answers keep their object (structural sharing);
mutations declare touched projections and the change notice carries entity types and ids; the
`eslint-disable react-hooks/exhaustive-deps` is gone; rows receive view-models from one selector; a React
Profiler measurement (add expense on a 1,000-expense demo) before and after goes in `COMPLETION_MATRIX.md`.

### A-017 React Compiler bail-out baseline

Rules: § 9.6. Effort **S**. Depends on: A-016.

Acceptance: an architecture test counts uncompiled functions per file using `babel-plugin-react-compiler`'s
logger, against a baseline that only goes down; quirks found go in ARCHITECTURE.md § 23.

### A-018 Root `AppErrorBoundary` and chunk reload-once

Rules: § 15, § 16.2. Effort **M**.

Acceptance: Bluesky's error boundary copied (header + reuse row) at the root with a Lingui error screen and
Try again; on web a chunk-load error reloads once, shows the error screen on a second failure within 60 s;
`hasWorkAtStake()` (open FormSheet with changes) blocks automatic reloads; Playwright simulates a chunk
failure.

### A-019 Telemetry module (no vendor yet)

Rules: § 16.1, § 16.2. Effort **M**. Depends on: A-001.

Acceptance: `#/logger` and `#/analytics` enqueue and never throw; drain on idle after transitions in <= 4 ms
slices keeping recorded times; flush on background; scrubbers (invite tokens, names, amounts, notes, URLs)
with bun tests; `recordMetric` / `recordIssue` / `recordFriction` signatures matching § 16.3; a
`sendDiagnostics` preference (registry entry + Settings row, default decided by owner) that, when off, makes
the sink a no-op (test); the console sink stays for dev; `consoleOutsideLogger` baseline unchanged or lower.

### A-020 Splash gate and first paint

Rules: § 6, § 8. Effort **M**. Depends on: A-016.

Acceptance: the store open and first People/Groups queries start at module import; the native splash is held
(`preventAutoHideAsync`) until fonts, preferences and the first queries resolve, capped at 8 s; the web static
mark is removed at the same point; a failed read falls back and opens the app; paint-affecting preferences
are read synchronously (no theme or language flash on a cold web load, Playwright check); `app.splash`
recorded through A-019; cold-start time recorded in `COMPLETION_MATRIX.md`.

### A-021 Typed-row lists

Rules: § 17. Effort **M**. Depends on: A-016.

Acceptance: People, Groups and Activity render overview cards, section headers, rows and the empty state as
typed rows in one Bluesky `List` with prefixed keys; the empty row renders only after the first query
resolves (Playwright: no "No friends yet" flash on a seeded load); skeleton rows reuse row styles; no List
inside a ScrollView; `removeClippedSubviews={false}` where sticky headers come and go.

### A-022 FormSheet shell/body split

Rules: § 4. Effort **M**.

Acceptance: every FormSheet's store reads live in a body component mounted only while open; save-in-flight,
undo and telemetry live in the caller's hook; content frozen through the exit; a sheet closes when its screen
is left (draft kept); a disabled Save always shows its reason above the footer; editors (category, payment
rule, member) take value + `onDone` and never call a mutation.

### A-023 Sheet keyboard rules and iOS picker handover

Rules: § 4. Effort **M**. Depends on: A-022. Needs: iOS simulator.

Acceptance: `keyboardDismissMode="on-drag"` on sheet bodies; a Done toolbar on decimal-pad fields;
`nestedScrollEnabled` on Android nested lists; opt-in `useKeyboardViewport.web` keeps the footer above the
mobile-web keyboard; each picker opened from a sheet is checked on the iOS simulator and either pushed inside
the sheet or handed over with state and scroll kept; no dialog is reset by `key`; web focus returns with
`preventScroll`.

### A-024 Form input rules

Rules: § 5. Effort **M**. Depends on: A-012.

Acceptance: error timing (over-limit while typing; rest on blur/Save; paste judged at once; no error on
`12.`); edit Save off until a value differs; `parseAmount` rejects hex, exponent and Infinity (bun tests) and
the field keeps the typed string; dependent inputs drop on parent change (group, currency, split mode)
through a reducer; defaults from one pure resolver in domain; update ops carry only changed fields + base
version; user-written text rendered raw.

### A-025 Drafts hardening and `isDraft`

Rules: § 5. Effort **S**. Depends on: A-024.

Acceptance: drafts restore only into untouched fields after storage is ready; writes debounce at 500 ms and
flush on AppState background and `pagehide`; invalid partial amounts are not restored; Edit expense drafts
too; an `isDraft` filter in `packages/sync` selectors with a test that every balance, list, analytics and CSV
selector excludes drafts.

### A-026 Virtualised long pickers

Rules: § 4. Effort **S**.

Acceptance: currency, timezone and category pickers use `Dialog.InnerFlatList` as the only scroller with fixed
row height, `getItemLayout` and `numberOfLines={1}`; no `.map()` inside `Dialog.ScrollableInner` for them;
open time measured on web.

### A-027 Navigation array, FAB rules, tabs at rest

Rules: § 3. Effort **S**.

Acceptance: one `navigationItems` array in `navigation/` feeds the bottom bar, LeftNav and drawer; a test pins
owner rule 3's order; items never depend on loading data; one FAB rule list (hidden on Settings, Profile,
onboarding, pinned-footer screens, keyboard up) decided by the focused screen; tab lists pad by the FAB
clearance; Playwright taps four tabs within 300 ms and asserts the last is visible and at rest.

### A-028 Theming

Rules: § 4, § 6. Effort **M**. Depends on: A-001.

Acceptance: the 12 `rawColour` files move to ALF tokens (new tokens added to every theme) or keep a reasoned
baseline entry (brand mark art); one `layers` constant in `alf/` with Android `zIndex` + `elevation` and a
test that toasts stay on top; the accent picker refuses colours under 3:1 and picks on-accent text by
contrast; selected chips, swatches and filters show a check glyph and `accessibilityState.selected`; amounts
in lists use tabular figures; `useWindowDimensions` in `screens/People/index.tsx` reviewed (band checks use
`useBreakpoints()`).

### A-029 Validators and limits in domain

Rules: § 1. Effort **S**.

Acceptance: name, date, currency, invite email/phone validators and a limits module (max amount, name/note
length, max participants, supported currencies) in `packages/domain`, returning codes, with bun tests; every
form uses them; codes added to A-012's map.

### A-030 Predicates and permissions in domain

Rules: § 1. Effort **M**. Depends on: A-004.

Acceptance: `isSettled`, `isParticipant`, `owesYou`, `countsTowardBalance`, `canEditExpense` exported from
domain and used by rows, filters, totals and badges (grep shows no local re-derivations);
`domain/permissions.ts` stub for M2 roles; figures computed before filters (bun test: search and show filter
never change a row's balance).

### A-031 One naming module

Rules: § 7. Effort **S**.

Acceptance: `expenseTitle`, `personName`, `groupLabel`, `effectLine` in one module used by lists, Activity,
share text and CSV; an unresolved participant reads "Unknown person"; bun tests.

### A-032 Share helper and external links

Rules: § 2, § 12, § 14. Effort **S**.

Acceptance: one share helper (entity id + summary) with `hasShareSheet()` fallback (copy + toast) used by the
trip summary and future balance links; one `openLinkOrToast` (Bluesky `useOpenLink` pattern) for Help,
About, licences and payment links; `safeExternalUrl()` (https + allowlisted schemes such as `upi:`) with bun
tests; `UpiPayDialog` uses them; a mailto that cannot open shows the address with Copy.

### A-033 Accessibility basics

Rules: § 18. Effort **S**.

Acceptance: one accessible-alert prop (web `role="alert"`, native announcement) on validation and sync
failure lines; targets at least 44 pt (Playwright measures key controls at 390 px); portion steppers expose
`aria-*`; charts and images have text alternatives.

### A-034 Analytics charts and formulas

Rules: § 17, § 7. Effort **M**. Depends on: A-004.

Acceptance: chart width from `onLayout` (no sideways scroll); one Svg plus one gesture surface per chart;
entrance by clip/translate, never animated SVG props; a chart point opens the filtered expense list; each
figure's formula written in ARCHITECTURE.md with a worked-example bun test; FX-converted figures labelled
"≈ rate from DATE" and excluded when the rate is missing.

### A-035 Test harness

Rules: § 19. Effort **M**.

Acceptance: a mandatory-sections helper (expense detail, group, person) run on web at 360 and 1200 px;
Playwright projects for 320, 390, 800, 1280 and 1440 px in both themes; every spec fails on a console error
or horizontal overflow; geometry checks for owner rules (title centred, one right action, footer pinned);
screenshots to gitignored `apps/client/qa/<feature>/`; every wait bounded; a bun test that every preference
key has a Settings row.

### A-036 Hermes formatting tests

Rules: § 2, § 7. Effort **S**. Depends on: A-006.

Acceptance: `formatAmount` caches `Intl.NumberFormat` per locale, currency and style; a test runs currency
formatting and Lingui plurals (en, hi) without polyfills on Hermes (or the closest available runtime, with
the gap stated); `i18n.date` caching verified or wrapped.

### A-037 Performance gates

Rules: § 17. Effort **M**. Depends on: A-035.

Acceptance: a Playwright render-count scenario (launch to People, tab round, add expense, search four
characters) comparing main and branch; Reanimated synchronous UI-props flags added after checking the
reanimated patch, with tap-to-sheet measured before and after; every `withRepeat(-1)` stops when its screen
loses focus or reduced motion is on; budgets measured and recorded in `COMPLETION_MATRIX.md`.

### A-038 Feature flags module

Rules: § 10. Effort **S**.

Acceptance: flags are named predicates in `#/env` with per-tier values and parsed `EXPO_PUBLIC_*` overrides;
a flag hides entry points, never routes; bun tests stub env per case; no commented-out features remain.

### A-039 Version footer

Rules: § 15. Effort **S**.

Acceptance: Settings > About shows a Dev/Stage badge off prod (never on prod) and leaves a slot for the
update id (filled by A-050); version still read from `expo-application` on native.

### A-040 Diagnostics screen

Rules: § 16.3. Effort **S**. Depends on: A-009.

Acceptance: Settings > Diagnostics in dev/internal builds only: outbox depth, refused ops, quarantined rows,
store size, last errors; "Share diagnostics" JSON contains no amounts, names or notes (bun test).

---

## Phase 3: sync engine and M2

### A-041 Connectivity store and sync scheduler

Rules: § 9.2, § 9.3. Effort **M**. Depends on: A-007, A-009.

Acceptance: one connectivity store from online/offline events, request outcomes and an own-origin probe (no
NetInfo), 5 s flap window, 15 s re-check while offline; one root `SyncProvider` scheduler: push on enqueue,
reconnect, foreground and every 15 s while non-empty; pull once after drain; jittered backoff with
`Retry-After` floor; per-op caps ending in "Needs attention" + one issue; ~30 s deadlines; progress resets the
streak; `syncNow()` wired to pull-to-refresh; timers re-checked on foreground. Bun tests with a fake clock.

### A-042 Fake sync server

Rules: § 9.4. Effort **L**. Depends on: A-041.

Acceptance: `packages/sync/testServer` implements push (batch, per-op outcomes, idempotent replay, 409/422
refusals) and cursor pull in-process; fault injection (no answer, 2xx HTML, truncated body, crash after
commit before ack); Playwright runs status-label, refused, conflict and offline specs against it; no UI code
knows it is fake.

### A-043 Pull path rules

Rules: § 9.4. Effort **M**. Depends on: A-005, A-042.

Acceptance: pulled entities with a pending op keep the local version and rebase (bun test: pull during a
pending edit keeps the edit; pending tombstone not resurrected); unvalidated pulls never advance the cursor;
unknown fields and kinds preserved and shown as a generic row; `null` vs `[]` preserved by serializers; a
404/410 never deletes local data; other devices' refusals are log rows.

### A-044 `packages/contracts` and Fastify sync routes

Rules: § 1, § 9.4. Effort **L**. Depends on: A-042, A-043. Needs: Postgres locally (available).

Acceptance: `apps/api` (Fastify on Bun) with batch push and cursor pull; schemas in `packages/contracts`;
`protocolVersion` and a typed too-old code; op id as idempotency key; every request names account and
group; GET never writes; the API imports `@splito/domain` and re-runs `validateExpense` and permissions;
golden fixtures generated by running real mutations through the real handler and read by both sides; CORS
preflight test for every custom header; integration tests against real Postgres; crash-after-commit fault
test.

### A-045 One HTTP client

Rules: § 9.4, § 16.3. Effort **M**. Depends on: A-044, A-019.

Acceptance: one client: content-type checked and parsed before resolving; 2xx HTML/empty/truncated = status 0;
`CALLER_ANSWERS` and `EXPECTED_ANSWERS` lists; request-shape fingerprints and the `unreachable` collapse;
no-answer issues only with proof of online; only the Splito API's 401 ends the session; spans named by route
shape; `X-Splito-Visit` and trace headers to Splito hosts only.

### A-046 Telemetry vendor wiring

Rules: § 16. Effort **M**. Depends on: A-019, A-002. Needs: owner's choice of vendor and DSN.

Acceptance: the SDK initialised only behind "Send diagnostics" and per-capability env switches (each with an
off-test); `isLocalRun` covers dev, tunnels and simulators; environments = tiers; opaque ids only; replay off;
`maxQueueSize` ~300 and the browser offline transport; noise filters; double scrubbing; hang tracking paused
under auth sheets; § 16.4 and § 16.5 tables match the code (`undocumentedIssue` at 0).

### A-047 Credential store and sessions

Rules: § 11. Effort **M**. Depends on: A-044. Needs: sign-in provider credentials.

Acceptance: `storage/credentialStore(.native).ts` (secure store `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`,
in-memory copy, serial operations, uninstall marker); web httpOnly cookie + CSRF; a 401 signs out and keeps
that account's outbox; `signOutCleanup()` list mirrored in ARCHITECTURE.md; `credentialAccess` counter stays
at its baseline; `isSafeRedirect()` for callbacks.

### A-048 `deviceId` kept out of backups

Rules: § 11. Effort **S**. Depends on: A-047.

Acceptance: `deviceId` moves to secure store `THIS_DEVICE_ONLY` (or is regenerated when a restore is
detected); ARCHITECTURE.md lists what Auto Backup and iCloud carry; decision recorded on backing up the
SQLite ledger; a test restores a DB with an unsynced outbox and pushes it safely.

### A-049 Links for M2

Rules: § 14. Effort **M**. Depends on: A-014, A-047.

Acceptance: link params sanitised by charset and length; `dead_link` friction; signed-out invite intent
resumes after sign-in; `/join/:token`, `/i/`, `/b/` matched exactly with near-miss tests, rendered outside the
shell, served with og tags and an app bounce; invite outcomes (accepted, declined, already, gone, failed)
each worded; per-tier host claims checked by a release-config script; AASA/assetlinks list only app paths;
tokens scrubbed from telemetry (test).

### A-050 OTA and `RELEASE.md`

Rules: § 2, § 15. Effort **M**. Depends on: A-046. Needs: EAS account and update channel.

Acceptance: `expo-updates` wired; checks at launch and background -> active only; no re-fetch of a waiting
update; stale errors re-checked; platform timeouts (Android 10 s, iOS 60 s); `ota.check`/`ota.launch`;
Restart flushes telemetry first; update id in the footer; `requireOptionalNativeModule` guards for later
native modules; `RELEASE.md` holds the rules and the server-first release order.

### A-051 Web resilience

Rules: § 15. Effort **M**. Depends on: A-018.

Acceptance: the web deploy (or service worker) keeps previous chunks for at least 3 days; `pageshow` with
`persisted` flushes and reloads unless work is at stake; Playwright covers both.

### A-052 Release checks

Rules: § 2, § 11, § 17, § 20. Effort **M**. Needs: Xcode and Android toolchains for Release builds.

Acceptance: a release script that refuses debug/profiler/override `EXPO_PUBLIC_` variables, checks iOS
entitlements, and records that iOS and Android Release builds passed for any change that moved the
fingerprint; `pnpm audit` triage recorded in ARCHITECTURE.md § 23.

---

## Phase 4: v2

### A-053 Attachments and receipts pipeline

Rules: § 13. Effort **L**. Depends on: A-044, A-045. Needs: object storage credentials.

Acceptance: shared limits module checked on device before signing; `pictureForUpload()` (files, re-encode,
attach on Save, delete on Discard); lifecycle function deciding when a local copy may go; picker reads under a
timeout; signed URLs judged on device elapsed time and re-signed once; one `attachment.upload` outcome per
transfer with bounded resume; bucket CORS checked in Safari; `useAttachmentState` + `AttachmentStatus`;
camera/OCR behind a lazy boundary; OCR results are drafts (A-025).
