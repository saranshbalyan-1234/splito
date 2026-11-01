# Splito master backlog

Updated 2026-10-27. This is the single, complete list of Splito features: everything promised in the handoff prompt, the design spec, `COMPLETION_MATRIX.md` and every owner decision in `docs/ARCHITECTURE.md` § 26 (decision log rows 1-63), plus 263 ideas from ten strategy lenses (travel, flatmates and households, couples and family, India and UPI, power users, capture and automation, social and sharing, trust and privacy, native platform, accessibility and simplicity), with duplicates merged.

**23 epics, 338 features (185 tagged `spec`: already promised in the handoff, design spec, matrix or owner rules (ARCHITECTURE § 26), some extended; 153 new), an architecture Batch 0, 33 front-end batches (Batch 4b holds the 2026-10-26/27 owner requests, Batch 4d the best-of-both scouting additions) and 6 backend batches.** Status (recounted 2026-10-29 from the Status lines of the 354 feature entries, Wave B assembled on integrate/wB): 58 done, 9 in progress, 287 todo. 47 features need the backend.

Completeness pass (2026-10-26): 32 features added after walking whole journeys (first launch, a 3-tap first expense, a 10-person trip abroad, a flat over a year, a couple, settling up, a dispute, switching phones, leaving a group, deleting the app), edge cases (refunds, partial and over-payments, currency changes, leavers, deleted and duplicate friends), accessibility, 10k-expense performance and the competitor gaps; 27 existing features got missing acceptance criteria, deps or descriptions, and 7 moved batch (F-108 to Batch 0; F-1102, F-1907, F-1605, F-705, F-1901 and F-1108 to where their deps and priority put them) so every dependency lands in an earlier batch.

Owner-request pass (2026-10-27): every owner decision in ARCHITECTURE § 26 now maps to a feature with acceptance criteria matching the binding rule, a status and a build slot ([Owner decisions to features](#owner-decisions-to-features)); 15 features added (F-222..F-226, F-618, F-619, F-1118, F-1119, F-1210, F-1711, F-1712, F-2007, F-2111, F-2112; F-1210 is the disputes half split out of F-1204) and the unbuilt requests ordered in Batch 4b.

Best-of-both pass (2026-10-27, ARCHITECTURE § 26.1, decision row 85): Bluesky and Expensify App compared feature by feature in `docs/scouting/2026-10-27-bluesky-expensify.md` (both inventories with paths, winner and reason per feature, exclusions). 18 features added, all front end (F-229..F-236, F-318..F-321, F-620, F-1211, F-1212, F-1412, F-1507, F-1816; F-1816 is Bluesky's AppLanguageDropdown on the web sign-in splash, sign-up and desktop right column), 16 of them in [Batch 4d](#batch-4d-best-of-both-bluesky-and-expensify-2026-10-27); 18 todo features amended where the other app does it better (F-211, F-214, F-219, F-312, F-501, F-502, F-504, F-516, F-709, F-1204, F-1207, F-1210, F-1402, F-1403, F-1405, F-1407, F-2202, F-2208), each marked "Best of both (2026-10-27)" with new acceptance criteria.

Sources: `../Splito-Claude-Prompt.txt`, `docs/superpowers/specs/2026-10-26-splito-design.md`, `docs/COMPLETION_MATRIX.md`, `docs/research/2026-10-26-competitors.md`, `docs/ARCHITECTURE.md` § 26 (binding owner rules; wins over this file).

## How to use this file

- Build in the order of [Build order](#build-order), one feature at a time (ARCHITECTURE § 26.1): take the next feature, finish it (built, tested, merged, screenshots, status updated here and in `COMPLETION_MATRIX.md`), then start the next. Parallel workers may split one feature, not run several. Each batch holds related features that touch different code areas (the Area column).
- Never start a feature before its Deps are done. Backend features wait for the Backend foundation batch.
- When a feature ships, change its Status here and its row in `COMPLETION_MATRIX.md` in the same change.
- Every owner request (new feature or change) becomes or updates an entry here, with acceptance criteria matching its ARCHITECTURE § 26 rule, a status and a build slot, in the same turn as its § 26 rule; add it to [Owner decisions to features](#owner-decisions-to-features). New ideas get the next free ID in the right epic and a slot in a batch after their deps.

## Conventions

- **ID** `F-EEnn`: epic `EE`, feature `nn` (F-101 is epic 1, F-1101 is epic 11).
- **`spec` tag** after the title: the feature was already promised, and where (`spec v1`, `spec 4b`, `spec: owner § 26.8` = an owner rule in ARCHITECTURE § 26, `spec: matrix`). "(extended)" means this backlog version goes further than the promise. No tag = new from the strategy ideas.
- **Effort**: S up to 1 day, M 2-4 days, L 1-2 weeks, XL more than 2 weeks, for one builder including tests.
- **Impact**: 1-10, value to users relative to the rest of this list.
- **Backend**: yes = needs the Splito server (accounts, sync, push, server storage). Third-party calls from the device (FX rate provider, place search) do not count.
- **Status**: done / in progress / todo, matching `COMPLETION_MATRIX.md` ("built" on an unmerged branch counts as in progress).
- **Prefs**: the preference-registry keys (`packages/sync/src/preferences.ts`) for every user-facing choice the feature adds. Plain `key` = account scope; `(device)` = device scope; `group:key` = per-group setting with its default in the registry as `groupDefaults.key`; `person:key` = per-friend setting with its default as `personDefaults.key`. `-` = no new choice.

## Definition of done (applies to every feature)

1. Money logic lives in `packages/domain` with bun tests; every write goes through a `packages/sync` mutation (entity + history + outbox in one transaction).
2. Bluesky first (ARCHITECTURE § 26.1): upstream Bluesky (then Expensify) searched and copied where an equivalent exists, with header and reuse row; the UI matches Bluesky pixel for pixel except the required replacements.
3. Fast and animated (ARCHITECTURE § 26.10): speed budgets measured and recorded; reduced-motion and `motion` pref honoured.
4. Every user-facing choice has a registry entry; every string goes through Lingui with en and hi.
5. Acceptance criteria below pass with recorded evidence (command, platform, result). Untested is not done.
6. Merged into main, with populated screenshots (light and Dim, phone and desktop) for any UI change (ARCHITECTURE § 26.1). Where an ARCHITECTURE § 26 rule and a criterion here disagree, § 26 wins and this file is corrected.

## Owner decisions to features

Every row of the ARCHITECTURE § 26.23 decision log (rows 1-63) and the feature(s) that carry it. Process-only decisions map to the rules of this file.

| Decision log rows | Rule | Features |
|---|---|---|
| 1, 33 keep every feature; build the list batch by batch | § 26.2 | this file (all epics, [Build order](#build-order)) |
| 2 analytics with graphs | § 26.16 | F-1301, F-1303 |
| 3 multi-language, English default | § 26.2 | F-1810, F-1811 |
| 4 user-set timezone | § 26.2 | F-1701 |
| 5, 34 speed, Bluesky smoothness, Expensify page animations | § 26.10 | F-1704, F-109, Definition of done 3 |
| 6 everything customizable | § 26.1 | F-104, F-1701, F-1703, Definition of done 4 |
| 7 Postgres | § 26.2 | F-2101 |
| 8, 13, 35 copy Bluesky and Expensify code and practice, pixel for pixel | § 26.1 | Definition of done 2 |
| 9, 12 best in class, populated previews | § 26.1 | Definition of done 6, F-218 |
| 10 full polish on every platform | § 26.2 | F-1711, F-1901, F-1902, F-1903 |
| 11 GameRun architecture where it fits | § 26.2 | ARCHITECTURE §§ 21-22 (no feature) |
| 14-16, 45, 46, 49 logo: owner butterfly, accent colour, release blocker | § 26.11, 26.22 | F-201, F-1711, F-1712 |
| 17, 18, 21, 42, 49 Bluesky shell, full-width web, FAB on phones only, Add expense flow | § 26.3, 26.6 | F-201, F-205 |
| 19, 47, 54 right column with recent transactions and recently active groups | § 26.17 | F-224 |
| 20 decide without asking; backend after UI | § 26.1, 26.2 | [Build order](#build-order) (front end first) |
| 22-24, 26, 49 header rules, avatar left, avatar opens Profile on desktop | § 26.4 | F-201 |
| 25, 28 Activity tab with badge, no bell | § 26.14 | F-202, F-1201 |
| 27, 40, 41 itemize with portions; tax, tip, discount visible with % toggle | § 26.13 | F-401 |
| 29, 30, 43, 50 sheets: X, Cancel + Save, drag to close, every phone modal a bottom drawer | § 26.8 | F-205 |
| 31, 32 overview, expanding search, filters, group balances | § 26.12 | F-206, F-207, F-208 |
| 36 Pager tabs, animated main tabs | § 26.9 | F-203 |
| 37, 39, 48 Bluesky LeftNav, centred mark, no avatar | § 26.5 | F-204 |
| 38 dark = Dim | § 26.11 | F-1701 |
| 44 sign in and log out in Settings | § 26.15 | F-225, F-2102 |
| 51, 63 record decisions; every request in this list, built one by one | § 26.1 | [How to use this file](#how-to-use-this-file), Batch 4b |
| 52 add friend by email / mobile / contacts, directory check, consent, add anyway, invite link + QR with limits | § 26.18 | F-618, F-619, F-601, F-602, F-2111, F-2105, F-2106 |
| 53 feedback section | § 26.15 | F-226, F-215, F-2112 |
| 55, 60, 62 one nav list for sidebar and drawer, Home label, Home title on desktop, drawer shows real name | § 26.3, 26.4, 26.7 | F-222 |
| 56 Dim splash | § 26.11 | F-1711 |
| 57 Ask Splito AI chat | § 26.19 | F-2301, F-2302, F-2303, F-209 |
| 58 service worker and PWA | § 26.21 | F-1901 |
| 59 comments, remind, export | § 26.20 | F-1204, F-2208, F-1118, F-1119, F-1111, F-2210, F-2001, F-2007, F-2004 |
| 61 sync-status dot on the avatar | § 26.7 | F-223, F-2103 |
| 137 push notifications on iOS, Android and web | § 26.20 | F-2201 (first backend batch) |
| 135 demo data downloaded from the backend, not bundled | § 26.1 | F-252 (backend) |
| 128 customization only where needed; Language menu switch removed | § 26.1 | F-251 |
| 153 Home = Overview + Recent transactions; People tab; Overview only on Home | § 26.3 | F-256 |
| 167 pull to refresh, header stays | § 26.9 | F-258 (Wave C) |
| 145 deep links end to end | § 26.3 | F-254 (with F-241) |
| 125 sign-in required, nothing visible signed out | § 26.15 | F-250 (Wave C), F-2101/F-2102 moved up after Wave C |
| 124 footer links on one line | § 26.5 | fixed on integrate/wB |
| 123, 142 intro slides before sign-in; guided tour after first sign-in | § 26.2 | F-249, F-253 (Wave C) |
| 120 Home layout fixes (order, no truncation, no red dots, two-line friend rows) | § 26.12 | F-248 |
| 119 disputes and holds; disputed records still count, left out of Settle up by default | § 26.20 | F-1210 (Wave C) |
| 85 best of both per feature: pull features from Expensify and Bluesky, whichever is better | § 26.1 | F-229..F-236, F-318..F-321, F-620, F-1211, F-1212, F-1412, F-1507, F-1816 (Batch 4d), amendments to F-211, F-214, F-219, F-312, F-501, F-502, F-504, F-516, F-709, F-1204, F-1207, F-1210, F-1402, F-1403, F-1405, F-1407, F-2202, F-2208; `docs/scouting/2026-10-27-bluesky-expensify.md` |

## Epics

| Epic | Name | Features | Done | In progress | Todo | Needs backend |
|---|---|---|---|---|---|---|
| E1 | [Core ledger and foundations](#e1-core-ledger-and-foundations) | 10 | 4 | 1 | 5 | 0 |
| E2 | [App shell, navigation and lists](#e2-app-shell-navigation-and-lists) | 34 | 0 | 11 | 23 | 0 |
| E3 | [Expenses and composer](#e3-expenses-and-composer) | 21 | 0 | 3 | 18 | 0 |
| E4 | [Itemize and receipt splitting](#e4-itemize-and-receipt-splitting) | 9 | 0 | 2 | 7 | 0 |
| E5 | [Capture and automation](#e5-capture-and-automation) | 22 | 0 | 0 | 22 | 0 |
| E6 | [People and groups](#e6-people-and-groups) | 20 | 0 | 5 | 15 | 0 |
| E7 | [Trips and travel](#e7-trips-and-travel) | 9 | 0 | 0 | 9 | 0 |
| E8 | [Home and household](#e8-home-and-household) | 16 | 0 | 0 | 16 | 0 |
| E9 | [Couples and family](#e9-couples-and-family) | 10 | 0 | 0 | 10 | 0 |
| E10 | [Currencies and FX](#e10-currencies-and-fx) | 11 | 1 | 0 | 10 | 0 |
| E11 | [Settle up and payments](#e11-settle-up-and-payments) | 19 | 0 | 3 | 16 | 0 |
| E12 | [Activity, history and trust](#e12-activity-history-and-trust) | 12 | 0 | 2 | 10 | 0 |
| E13 | [Analytics, reports and budgets](#e13-analytics-reports-and-budgets) | 11 | 0 | 1 | 10 | 0 |
| E14 | [Search, organisation and power tools](#e14-search-organisation-and-power-tools) | 12 | 0 | 1 | 11 | 0 |
| E15 | [Sharing and summaries](#e15-sharing-and-summaries) | 7 | 0 | 0 | 7 | 0 |
| E16 | [Privacy and security](#e16-privacy-and-security) | 10 | 0 | 0 | 10 | 0 |
| E17 | [Customization, appearance and motion](#e17-customization-appearance-and-motion) | 12 | 0 | 2 | 10 | 0 |
| E18 | [Accessibility and localization](#e18-accessibility-and-localization) | 16 | 1 | 1 | 14 | 0 |
| E19 | [Platform integrations](#e19-platform-integrations) | 13 | 1 | 1 | 11 | 0 |
| E20 | [Data portability](#e20-data-portability) | 7 | 0 | 0 | 7 | 0 |
| E21 | [Backend foundation](#e21-backend-foundation) | 12 | 0 | 1 | 11 | 12 |
| E22 | [Shared and collaborative](#e22-shared-and-collaborative) | 31 | 0 | 0 | 31 | 31 |
| E23 | [AI](#e23-ai) | 5 | 0 | 0 | 5 | 4 |

## E1 Core ledger and foundations

Pure domain and storage pieces that every other epic builds on.

### F-101 Exact money and split engine `spec v1`

bigint minor units, currency scales 0/2/3, equal / exact / percent / shares / adjust / itemize splits, multiple payers, stable tie-break rounding.

- **Effort** L · **Impact** 10 · **Backend** no · **Status** done (packages/domain, 68 tests) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. 100 split 3 ways gives 34/33/33 ordered by participant ID; property tests prove shares always sum to the total.
  2. JPY (scale 0) and KWD (scale 3) amounts parse and format exactly.
  3. validateExpense rejects any expense where paid, owed and total differ by one minor unit.

### F-102 Settlement planner with routing rules `spec v1`

Min-cost feasible flow per group per currency over allowed / preferred / excluded directed edges, direct-only mode, infeasibility explained.

- **Effort** L · **Impact** 10 · **Backend** no · **Status** done (packages/domain) · **Deps** F-101
- **Prefs** -
- **Acceptance**
  1. Acceptance A07 passes: A->C excluded, transit mode gives A->B and B->C of 100; direct-only reports infeasible with the blocking edge.
  2. No excluded edge ever appears in a plan (property test).
  3. The same input always yields the same plan.

### F-103 Offline local store, history and outbox `spec v1`

SQLite on native and IndexedDB on web behind one interface; each mutation writes entity, history row and outbox entry in one transaction; deletes are tombstones.

- **Effort** L · **Impact** 10 · **Backend** no · **Status** done (packages/sync, 40 tests) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Force-quit right after save keeps the record and its outbox row.
  2. Delete writes a tombstone; history keeps every version.
  3. The same repository test suite passes on SQLite and IndexedDB.

### F-104 Preferences registry `spec 3a`

Typed registry (key, type, default, scope device/account, group, label) drives storage, sync and the generated Settings screen; reset per key and reset all.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (packages/sync) · **Deps** F-103
- **Prefs** registry itself
- **Acceptance**
  1. An invalid value is rejected by the key's validator.
  2. Reset restores the default and writes a history row.
  3. Device-scope keys never enter the outbox.

### F-105 Pot ledger accounts

One held-funds account type used by kitty, deposit, joint account, savings goal and collection: contributions, payouts, holder, per-currency balance, never counted as spending.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-101, F-103
- **Prefs** -
- **Acceptance**
  1. Contribute 300 then pay 200 from the pot leaves 100 and moves member balances exactly.
  2. Pot movements never appear in spending totals or charts.
  3. Returning leftover allocates pro-rata to contributions with allocate() and conserves to the minor unit.

### F-106 Day-weight allocation from date ranges

Domain helper that turns member date ranges (inclusive local days, gaps allowed) plus optional room or guest weights into integer weights for allocate().

- **Effort** S · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-101
- **Prefs** -
- **Acceptance**
  1. Moving in on the 15th of a 30-day month counts 16 days.
  2. Fractional weights (1.5 / 0.5) are stored as scaled integers and the shares still sum to the total.
  3. Month-end and DST boundaries covered by bun tests.

### F-107 Deterministic generated IDs and operation dedupe

Records generated by rules get id = hash(ruleId + period); imported operations dedupe by operation ID, so two devices or two imports never double-post.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-103
- **Prefs** -
- **Acceptance**
  1. Two devices that both generate October rent end with one expense after merge.
  2. Importing the same operation bundle twice changes nothing.

### F-108 Engineering guardrails `spec 4c`

Architecture test with a per-file baseline that only goes down, one link resolver with goBack(fallback), one never-throwing telemetry module, OTA checks on launch and background-to-active only. Built as ARCHITECTURE-BACKLOG A-001, A-014 and A-019 (OTA rules with A-050 at M2), which docs/RESUME.md runs before Batch 1; this row only closes when those do. Do not build it twice.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** done (built and tested on a feat/b-* branch, unmerged) · **Deps** A-001, A-014, A-019 (ARCHITECTURE-BACKLOG)
- **Prefs** -
- **Acceptance**
  1. CI fails when a raw hex colour outside alf/, a direct RN Modal or a direct expo-haptics import is added beyond the baseline.
  2. An unknown deep link opens People.
  3. Telemetry events carry an opaque account id and never an email or name.

### F-109 Large-ledger performance at 10,000 expenses `spec A16 (extended)`

A seeded fixture (10,000 expenses, 2,000 repayments, 50 groups, 200 friends, 5 currencies, 3 years) with incremental per-person / per-group / per-currency balance projections and indexed paged queries, measured on a mid-range Android phone and on desktop web. Every later feature that scans the ledger (reports, export, backup, import) adds a timed check against this fixture.

- **Effort** L · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-103, A-016 (ARCHITECTURE-BACKLOG)
- **Prefs** -
- **Acceptance**
  1. With the fixture loaded, cold start to an interactive People list stays under 1.5 s and local save p95 under 100 ms (numbers in COMPLETION_MATRIX).
  2. Saving one expense updates balances by delta; a query-log test proves no read of the whole ledger.
  3. A 10,000-row group list scrolls at 60 fps; search keystrokes and filter Apply return in under 100 ms.

### F-110 Multi-tab web consistency `spec v1 web tab lock (extended)`

BroadcastChannel change notices so every open tab refreshes its projections after a write in another tab; one Web Lock for background work (recurring generator now, sync loop later) so two tabs never run it at once.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-103
- **Prefs** -
- **Acceptance**
  1. An expense added in tab A shows in tab B within 1 s without a reload.
  2. Exactly one tab holds the background-work lock; closing it hands the lock to another tab.
  3. Browsers without BroadcastChannel fall back to refresh on focus.

### F-117 Local database schema v2 `spec: owner § 9.8`

Per-type stores, normalised relations, indexes for every query path, in-transaction balance projection, cursor paging and versioned migrations, on IndexedDB and SQLite alike (ARCHITECTURE § 9.8).

- **Effort** L · **Impact** 10 · **Backend** no · **Status** done (feat/wA-35a, 2026-10-27; sync `storeV2Contract` on both engines, `ledgerProjection.property.test`, `migrate.test` with the large demo set, `queryPlan.test`; domain `recordEffects.test`; client `historyMerge.test`, `rowStatus.test`, architecture rule `moneyFullRead`; e2e `sync-status.spec`; perf `perf/schema-v2.spec`) · **Deps** F-103, F-227
- **Prefs** `showSyncStatus` (device, default on): the sync dot on rows
- **Measured** (web, Chrome, desktop 1440 px, median of 5; `pnpm perf schema-v2`): Home cold open (store open to Home holding its figures) 47 ms on the large demo set (1,566 expenses) and 57 ms on a 10,000-expense ledger; write plus the sidebar showing it 32 ms on both (commit itself 1 ms). At 4x CPU slowdown (a mid-range phone): cold open 163 / 202 ms, write + UI 30 / 60 ms. The path this replaced (read the whole ledger, work balances out of it) cost 17 ms / 81 ms of reading alone at 1x and 52 / 195 ms at 4x, before any render, and grows with the ledger; the new path is flat (47 -> 57 ms from 1.5k to 10k expenses). Re-measured at head on a machine under load average 27 (other builds running): cold open 71-95 ms (large set) and 74-87 ms (10k), write + UI 14 ms and 46-48 ms; every figure inside the budget, the 10k write nearest the 50 ms line. Migration of the large set (2,039 rows, 2,065 history rows, 2,065 ops): about 150 ms on IndexedDB (fake-indexeddb) and 100 ms on SQLite (bun) on an idle machine.
- **Opus review fixes (2026-10-27, schema v3)**: Activity window counts only final events; `aggregates` (cells per [currency, month, group, category, person, kind]) and `search_terms` (word / person / group / amount / month / category keys) are kept in the mutation transaction, rebuilt by `rebuildProjections`, built by an idempotent v2 -> v3 step (v2 shipped in this branch's builds, so the version moved to 3 and v1 goes straight to 3); Analytics reads whole months from `aggregates` and the period's edges from `byDate`, Search reads keys by range, the in-memory ledger mirror is deleted; `people.lastActivityAt` (People "Recent" = last change, like a group's Recent activity); activity times equal a rebuild; `remote` writes no longer claim `synced`; the v1 migration fails closed on an unknown type; IndexedDB `onblocked` / `onversionchange` say so in the UI; demo data is out of production bundles; architecture rule `moneyFullRead` also flags cursor loops over money stores.
- **Sync status reading**: `history`, `meta`, `balances`, `pair_balances`, `aggregates` and `search_terms` carry no `syncStatus` by design: history is an append-only audit trail of rows that carry their own state, `meta` is local bookkeeping, and the last four are projections derived from rows (rebuilt, never sent), so they are exactly as synced as the rows behind them. Acceptance 7 means every store that holds data a user wrote (entity and relation stores).
- **Measured at head** (web, Chrome, desktop 1440 px, median of 5; `pnpm perf schema-v2`): Home cold open 46 ms (large set, 1,566 expenses) / 46 ms (10,000); write + UI 16 / 16 ms; **Analytics open** (tab to figures, default year, busiest currency) 35 / 21 ms; **search keystroke to results** on the large set 43 / 40 / 16 ms ("udaipur", "netflix", "goa") and on 10,000 expenses 27 ms ("Bulk expense 9993", a narrow query), 27 ms ("perf write"), 68 ms ("> 90", about a thousand matches) and 484 ms ("Bulk Friend 4", about 2,500 matches: every match row loads, and the per-currency totals need them all). Budgets: Home < 150, write + UI < 50, Analytics < 150 and a narrow search < 50 are met; a search that matches thousands of rows is not (follow-up below). Migration v1 -> v3 of the large set: about 260 ms on IndexedDB (fake-indexeddb) and 140 ms on SQLite (bun).
- **Integrated onto m1-foundation (2026-10-27, integrate/wA-35a)**: Wave A's feedback (F-215) lives in its own `feedback` store per § 9.8 (key `id`, `byUpdatedAt`, `bySyncStatus`; a row nothing sends is `local`, never `pending`) and is kept by both migrations (tests in `migrate.test`: v1 -> v3 and v2 -> v3, rows, tombstone with content stripped, syncCounts, still listed, new feedback after the upgrade); Search & Ask (F-222, F-115 day formatting) reads `searchStore`.

- **Schema v4 (Wave B, B5)**: adds the `reminders` store (entity type `reminder`; columns `personId`, `groupId` ('' for none), `kind` nudge|self, `dueAt`, `repeat`; indexes `byPerson`, `byDue`, `bySyncStatus`). The v3 to v4 step creates the empty store and stamps the version on IndexedDB and SQLite; no other row changes (`migrate.test` loads a v3 fixture incl. the large demo set; `queryPlan.test` covers the new reads).
- **Search pages (the § 9.8 / § 26.10 ruling)**: the query is parsed and each word's reach counted from the keys (its own words, its groups' and people's expenses, its category). A rare query (the rarest word reaches 150 expenses or fewer) reads its candidates by key and is complete after one read. A broad one walks the expenses newest first through `byDate`, 200 rows a step, checking every word on each row; the first page (30 expenses, same day ties by creation time; people and groups, which are few, come with it) is ready after the first chunk whatever the match count. "Show more" and scrolling read the next chunk by cursor. The count and per-currency totals of a broad match are worked out after the first paint by walking the rest, cancelled by the next keystroke ("Calculating totals…", then the values; a narrow query has them at once). This walk is the one deliberate full read of the money store, in the background; it is a method call of the session, not a loop over `store.page`. Tests: `search.test` (page equals the full answer, order across chunks, totals, cancellation, overlapping steps), e2e `search.spec`.
- **Perf after paging** (web, Chrome, 1440 px, median of 5, `pnpm perf schema-v2`, idle machine): 10,000 expenses, first page: "Bulk expense 9993" 27 ms, "Bulk Friend 4" (about 2,500 matches) **19 ms** (was 484), "perf write" 26 ms, "> 90" (about 1,000 matches) **20 ms** (was 68); their totals fill in at 27 / 189 / 26 / 177 ms. Large set: "udaipur" 42, "netflix" 40, "goa" 25 ms. Home cold open 41 / 47 ms, write + UI 16 / 17 ms, Analytics open 34 / 16 ms. The perf spec asserts the 50 ms search budget on an unthrottled CPU.
- **Coordinator's minors (2026-10-27)**: a v2-shaped SQLite file with `user_version` 0 is read by its layout and upgraded; upgrade errors name their cause; the property test randomises category, text, items and renames/deletes people and groups; `moneyFullRead` flags any unbounded money read (`full-read-ok:` markers replace whole-file allowlists); `demoStaticImport` catches side-effect imports and `require`; period cells read from `byDate` use the projection's own row guard (`cellsOfEntity`); a search finds an expense by exactly the words its keys carry.
- **Follow-ups (deferred, not done here)**: profile write + UI headroom at 10,000 expenses (50 ms line is near on a loaded machine); wire the avatar dot to `syncCounts` (UI); totals of a broad search from `aggregates` where the query allows it (today they walk the rest in the background); read narrow Analytics scopes through `byGroupDate` instead of `byDate` plus filter; **sync**: a person or group row that arrives after a money row naming it (a pull in that order) starts with activity 0 until the next `rebuildProjections`, where the history gives it its time; the sync pull must apply people and groups first or call the rebuild.
- **Acceptance**
  1. Stores/tables exactly as § 9.8 (names, keys, indexes) on both engines; the old `entities` store is gone after migration.
  2. v1 -> v2 migration runs once, is idempotent, and is tested with a v1 fixture including the large demo set: every row, history entry, outbox op and balance identical before/after.
  3. Every money mutation updates `expense_parties` and `balances` in the same transaction; a property test of random operation sequences (add/edit/delete/restore/write-off/repay, many currencies) shows projection == full recomputation.
  4. Home, People, Person, Groups, Group, right column, Activity and Analytics read through indexes/projections with cursor paging; no `getAll` on a money store in hot paths (an architecture rule test enforces it).
  5. With the large demo set (and a 10,000-expense fixture) cold open of Home < 150 ms and a write + UI update < 50 ms on web (F-109 budgets), measured and recorded.
  6. The shared store contract test covers both engines.
  7. Every row in every store has `syncStatus` (local / pending / syncing / synced / failed) set atomically with its outbox op, a `bySyncStatus` index, and a per-item status marker in the UI (expense/repayment/comment/request rows and detail pages) consistent with the avatar dot (§ 9.8, decision 79).

### F-111 Amount entry and parsing correctness `spec: audit docs/audit/AUDIT-2026-10-27.md`

Fixes for logic-audit findings C1, C2, M1, M2, M3, M7, M14, m8, m9, m13 (see the report for scenario, evidence and fix per finding).

- **Effort** L · **Impact** 10 · **Backend** no · **Status** done (feat/4b-33c, 2026-10-27; domain `amountAudit.test.ts`, client `form.test.ts`, sync `search.test.ts` / `preferences.test.ts`, e2e `amountLocale.spec.ts` in de-DE and en-US with BHD) · **Deps** merge row 30
- **Prefs** -
- **Acceptance**
  1. Critical money fixes first: 3-decimal currencies (BHD, KWD, OMR) never change value when the app reads back text it wrote, in any locale; repeated or non-locale decimal marks parse correctly for 0-, 2- and 3-decimal currencies; split rows and percents accept the locale decimal mark; amount search understands the user number format; expressions allow grouping in operands and a leading minus; prototype keys are never currency codes. Each finding gets a failing test first (domain/sync bun tests and an e2e for C1/C2 in a comma locale).
  2. Every listed finding has a regression test that failed before the fix and passes after; the audit report marks it fixed with the commit.
  3. Full checks green (typecheck, lint, arch rules, domain/sync/client tests, full e2e).

### F-112 Many-currency completeness `spec: audit docs/audit/AUDIT-2026-10-27.md`

Fixes for logic-audit findings M5, M8, M12, M15, m2, m3, m21 (M13 is fixed by F-227) (see the report for scenario, evidence and fix per finding).

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (feat/wB-B2; M5 759532d, M8 4285917, M12 + m2 97e80d9, M15 cfd9d69, m3 8f8cd8a, m21 afe75f1; regression tests in `e2e/many-currency.spec.ts`, `formPick.test`, `ledger.test`, `cash.test`, `preferences.test`, `People/sort.test`, `Groups/filter.test`; cash unit is now the `split.roundTo` per-currency map) · **Deps** merge row 30
- **Prefs** `split.roundTo` (now a per-currency map, default none = 1)
- **Acceptance**
  1. Picking a group never silently changes an entered amount's currency (ask, or keep the currency); Record payment offers every currency and pre-selects the open ones; sidebar and right column show every open currency of a group; the cash-rounding unit is set per currency; compact chips never round small amounts to zero; a settled currency stays filterable; Overview currency cards open Analytics in that currency (§ 26.13).
  2. Every listed finding has a regression test that failed before the fix and passes after; the audit report marks it fixed with the commit.
  3. Full checks green (typecheck, lint, arch rules, domain/sync/client tests, full e2e).

### F-113 Balances and settle consistency `spec: audit docs/audit/AUDIT-2026-10-27.md`

Fixes for logic-audit findings M6, M10, M11, m5, m7, m10, m16 (see the report for scenario, evidence and fix per finding).

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (feat/4b-33d) · **Deps** merge row 30
- **Prefs** -
- **Acceptance**
  1. Unticking yourself never silently changes the payer; Home shows a friend's direct and group balances without netting them into "Settled" when debts stay open; Group Balances and People use the same plan (and explain infeasible rules); write-off rows name the actor correctly; cross-direction write-offs work; preferred-route costs never beat an allowed direct transfer without consent; undoing Call it even is one transaction.
  2. Every listed finding has a regression test that failed before the fix and passes after; the audit report marks it fixed with the commit.
  3. Full checks green (typecheck, lint, arch rules, domain/sync/client tests, full e2e).

### F-114 History, bin and sync integrity `spec: audit docs/audit/AUDIT-2026-10-27.md`

Fixes for logic-audit findings M4, m1, m11, m15, m17, m18, m19, m20 (see the report for scenario, evidence and fix per finding).

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wB-B3; sync `historyIntegrity.test.ts`, `activity.test.ts`, `ledgerProjection.property.test.ts`, client `demoSeed.test.ts`; m20's Include groups part left open, see the audit; m15 and m19 were already fixed by F-117 and now have regression tests) · **Deps** merge row 30
- **Prefs** -
- **Acceptance**
  1. Restore never brings back records that point to a deleted person (restore the person too, or block with an explanation); restored payments/write-offs show as "restored" in Activity; idempotent retries never return a tombstone or stale amount; search ties broken by creation time; purge outbox ops keep purgedAt; demo seed uses local dates and is idempotent; "recently active" counts deletes; People "Recent" sort uses change time, only records I am in, and honours Include groups.
  2. Every listed finding has a regression test that failed before the fix and passes after; the audit report marks it fixed with the commit.
  3. Full checks green (typecheck, lint, arch rules, domain/sync/client tests, full e2e).

### F-115 Timezone, dates and number-format preferences everywhere `spec: audit docs/audit/AUDIT-2026-10-27.md`

Fixes for logic-audit findings M9, M17, M18, m14, m23, m24, m25, m28, m29 (see the report for scenario, evidence and fix per finding).

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wA-33g, 2026-10-27; client `dates.test.ts`, `feed.test.ts`, `numberFormatNative.test.ts`, sync `preferences.test.ts`, e2e `dates.spec.ts` with a Los Angeles device and a Kolkata preference; web verified, native polyfill checked under Bun only, not yet on a device) · **Deps** merge row 30
- **Prefs** -
- **Acceptance**
  1. Payments, write-offs and Activity use the Timezone preference; native honours the Number format preference and en-IN grouping; the Date format preference applies on every screen; invalid zones are rejected; day arithmetic is DST-safe; percents and counts use Number format; the native zone picker lists all zones; "today" refreshes across midnight and on app resume.
  2. Every listed finding has a regression test that failed before the fix and passes after; the audit report marks it fixed with the commit.
  3. Full checks green (typecheck, lint, arch rules, domain/sync/client tests, full e2e).

### F-116 Web navigation and sheet robustness `spec: audit docs/audit/AUDIT-2026-10-27.md`

Fixes for logic-audit findings M16, m6, m12, m26, m27, m30 (see the report for scenario, evidence and fix per finding).

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wA-33h; sync `mutations.test.ts` / `preferences.test.ts`, client `goBack.test.ts` / `form.test.ts` / `draftKey.test.ts`, e2e `webNav.spec.ts` + `links.spec.ts` + `activityRequests.spec.ts`; web verified, native not yet run) · **Deps** merge row 30
- **Prefs** -
- **Acceptance**
  1. Back fallbacks work after a deep link or refresh on web; reset-all survives removed preferences; groups reject end before start; a drawer reopened during its exit animation shows; browser Back on a dirty sheet asks "Discard changes?"; composer drafts are per-entry and prune every removed reference.
  2. Every listed finding has a regression test that failed before the fix and passes after; the audit report marks it fixed with the commit.
  3. Full checks green (typecheck, lint, arch rules, domain/sync/client tests, full e2e).

## E2 App shell, navigation and lists

Bluesky shell and the owner's shell, header, sidebar, drawer, sheet and list rules (ARCHITECTURE §§ 26.3-26.17), plus the first-run experience.

### F-201 Bluesky shell: sidebar, bottom bar, FAB, avatar drawer, header rules, logo `spec: owner § 26.3, 26.4, 26.6, 26.11`

Bluesky's shell on every width: web fills the screen with the left sidebar and main content (plus the right column at 1300 px and up, F-224), bottom bar + FAB on phones, the avatar top-left opening Bluesky's drawer, one header rule set, and the owner's dev logo from one source file drawn in the current accent.

- **Effort** L · **Impact** 10 · **Backend** no · **Status** in progress (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Phone bottom bar = Home, Groups, Analytics, Activity plus the FAB. The FAB shows only at phone widths and only on screens whose header has no Back; it is hidden on every pushed page (Profile and Settings included), while a sheet is open, while the keyboard shows and on onboarding, is decided once in the shell from the header's left-slot state, hides on scroll down and returns on scroll up, and opens Add expense as a bottom sheet. Rail and desktop have no FAB; the sidebar pill adds expenses.
  2. Header: the avatar (`header-avatar`) on the left of top-level pages at every width and Bluesky `BackButton` with a fallback on pushed pages; on phone and rail the avatar opens the drawer, on desktop (full sidebar) it opens Profile, labelled "Open profile". The centre holds the page name; the right holds at most one action plus an optional "..." overflow, exactly per the § 26.4 table. No bell, no other header icon, no avatar dropdown, and no header carries "Cancel" or a "Save" pill. Sticky with Bluesky's bottom border; on phones it hides on scroll down.
  3. The drawer slides in from the left with Bluesky's animation; scrim tap, swipe and Escape close it; focus is trapped on web.
  4. The logo is the owner SVG from one source file and one `Logo` component, the mark only (no wordmark, no tile), drawn in `t.palette.primary_500` on light, Dim and Black (changing the accent recolours it everywhere); static assets keep `#1185fe`. The logo returns home and is inactive on home.
  5. `/notifications` redirects to `/activity`; the web page background (`html`/`body`) always follows the active theme (no black band under Dim).

### F-202 Activity as a nav destination with unread badge `spec: owner § 26.14`

Pulse icon in bottom bar, sidebar and drawer with Bluesky's unread badge; no header bell.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-201
- **Prefs** -
- **Acceptance**
  1. /notifications redirects to /activity.
  2. The badge counts unread items from others and updates without a reload.
  3. The header reads avatar | "Activity" | "Mark all read"; testIDs `tab-activity` and `screen-activity`.

### F-203 Pager tabs and animated main-tab switches `spec: owner § 26.9`

Bluesky Pager and TabBar for every in-page tab set; direction-aware slide and sliding indicator for bottom-bar and sidebar switches.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-201
- **Prefs** `motion`
- **Acceptance**
  1. Group and Activity tabs swipe between pages with the sliding underline.
  2. A main-tab switch slides in from the side of the tapped tab in about 220 ms and re-tap scrolls to top.
  3. motion = off gives instant switches and tab content is usable immediately.
  4. Every in-page tab set (Group: Expenses / Balances / Members; Activity: All / From others) uses the one Pager and TabBar copied from Bluesky `src/view/com/pager/`, never a segmented control.
  5. On a main switch the indicator springs to the new tab, the tapped icon does a spring scale pop with a haptic tap and the unread badge springs on count change; there is no swipe between main tabs and lazy tabs stay mounted after the first visit.

### F-204 Desktop LeftNav complete `spec: owner § 26.5`

Bluesky's `LeftNav` copied as closely as possible: the centred logo mark, the shared nav items and footer links (F-222), the "Add expense" pill, and the minimal rail at 800-999 px.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** in progress (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-201
- **Prefs** -
- **Acceptance**
  1. The sidebar holds only the logo mark, the shared nav items (Home, Groups, Analytics, Ask Splito, Activity, Settings), the "Add expense" pill and the footer links Feedback · Help · Privacy · About pinned at the bottom; no avatar or `ProfileCard`, no "Splito" wordmark, no recent groups or transactions (those live in the right column, F-224).
  2. The logo is the mark only, 40 px, horizontally centred in the sidebar column and vertically aligned with the content header row (same top padding and height as `Layout.Header`).
  3. Nav items are Bluesky `NavItem` exactly (24 px icon, `text_xl`, active = bold + filled icon, `rounded_full` hover, Bluesky badge/dot) with the sliding active indicator (F-203); the "Add expense" pill is Bluesky `ComposeBtn`, full width with a plus icon, and opens the Add expense popup.
  4. Widths and paddings come from `LEFT_NAV_STANDARD_WIDTH` / `LEFT_NAV_MINIMAL_WIDTH`; hairline right border; sticky full height; scrolls on its own when tall. At 800-999 px it is Bluesky's minimal rail: mark, icons only, round compose button.

### F-205 Phone bottom drawers and desktop popups: one FormSheet for every sheet, picker and prompt `spec: owner § 26.8`

On phones every modal is a bottom sheet (the owner's "drawers") that closes when dragged down; rail and desktop keep centred popups. One shared `FormSheet` on Bluesky's Dialog; prompts keep Bluesky `Prompt`'s content and buttons.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-201
- **Prefs** -
- **Acceptance**
  1. Phones: form sheets (Add expense, Edit expense, Add friend, Create group, Edit group, Members, Payment rules, Record payment), settings editors (accent, categories, timezone, ...), pickers (currency, date, category, people), filters, menus and prompts (Discard changes?, Log out?, Delete?, Reset) all present as bottom sheets, phone-width web included. Rail and desktop: a centred popup (Bluesky web Dialog, scrim, max width ~600, focus trap, Escape closes).
  2. Phone form sheet: title on the LEFT, a round close button with a Lucide `X` at the TOP RIGHT (30-32 px, `bg_contrast_50`, label "Close", testID `sheet-close`), no "Cancel" in the top bar; a footer pinned above the keyboard and the safe area with "Cancel" (`sheet-cancel`) left and the primary (`sheet-save`) right, disabled until valid; any live readout sits just above the footer. Popup: X top right, Cancel then Save bottom right. Pickers show only the X and apply a selection at once.
  3. Drag to close: a bottom sheet closes when dragged down past ~30 % of its height or flicked down, from the handle, the top bar, or the content when scrolled to the top. With unsaved changes it springs back and asks "Discard changes?" (itself a bottom sheet); X, Cancel and scrim ask the same. Dragging a prompt down is Cancel; a destructive action never runs from a drag. The threshold logic is unit-tested; drag-to-close has an e2e check where the runner supports gestures.
  4. Add expense and Edit expense are form sheets on every width (bottom sheet with drag handle, snapping to full height, keyboard-aware, on phones; the centred popup on rail and desktop), never a pushed page.
  5. Every sheet and popup animates per § 26.10 (sheet spring and scrim fade, web fade + scale 0.96 -> 1 in ~180 ms, check + haptic on save); under motion `off` they open and close with a fade only.

### F-206 Overview, expanding search and filters on Friends and Groups `spec: owner § 26.12`

Per-currency owed/owe overview cards with counts, icon-only search that expands, Filters sheet with Apply and an active dot.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-201
- **Prefs** `includeGroupsDefault`, `peopleSort`, `groupsSort`
- **Acceptance**
  1. Overview cards never sum unlike currencies.
  2. Search filters live by friend name, group name or member name, with a "No matches" state.
  3. Filters change only on Apply and drive both the cards and the list.
  4. Search (`list-search`) and Filters (`list-filters`, with a dot/count when non-default) sit on the RIGHT of the list section header ("Friends 6" / "Groups 3") and hide while the list is empty; search expands with Reanimated (reduced-motion aware) and its X collapses and clears.
  5. Friends filters: Include groups, currency, show, sort; Groups filters: type, status, currency, show, sort (Recent activity uses last change time, F-224); the Person page history obeys the same Include groups choice.

### F-207 People balances and person page `spec v1, owner § 26.12`

Direct plus included group balances per currency with each group's contribution; person page with expense and settlement history; deep link and back.

- **Effort** M · **Impact** 10 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-201
- **Prefs** `includeGroupsDefault`
- **Acceptance**
  1. A04: direct 100 plus group 50 shows 150; Include groups off shows 100 and also filters history; another currency stays separate.
  2. A person deep link opens with working back and browser history.
  3. Signs read "owes you" / "you owe".

### F-208 Group page: Expenses, Balances and Members tabs `spec: owner § 26.12`

Pager tabs Expenses / Balances / Members (F-203). Balances shows each member's net per currency, a "who owes whom" list from the direct-mode plan and Settle up; Payment rules open from the header overflow.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-201
- **Prefs** -
- **Acceptance**
  1. Balances equals groupNet per member per currency, and "who owes whom" is the pairwise direct-mode settlement plan.
  2. Settle up opens the plan for that group.
  3. The header is Settle up + overflow (Edit group, Members, Payment rules, Invite link, Export); "Add expense" lives in the body and pre-selects the group; testIDs `groups-balances`, `group-tab-balances`.

### F-209 Custom navigation `spec v3, owner § 26.19`

Choose and order the phone bottom-bar destinations (Home, Groups, Analytics, Activity, Ask Splito) with a guaranteed recovery route to Settings.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** done (Settings > Navigation takes any number of tabs, Ask Splito pinnable) · **Deps** F-201
- **Prefs** `tabs`, `homeTab`
- **Acceptance**
  1. Hiding every optional tab still leaves Settings reachable from the drawer.
  2. Order persists, syncs (account scope) and resets to default.
  3. Ask Splito can be pinned to the bottom bar; the default stays four tabs plus the FAB.

### F-210 Empty states that teach one next step

Each empty screen gets its own copy, one primary action, optional secondary, and a Lottie with static fallback.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1704
- **Prefs** -
- **Acceptance**
  1. No friends shows "Add a friend, no account needed" (plus "Import from Splitwise" once F-2003 ships).
  2. A filter with no results offers "Clear filters".
  3. Reduced motion shows the static illustration.

### F-211 60-second setup after sign-up (owner 125: sign-in is required, so this runs after Create account)

Language picker in native scripts, name and avatar, region-prefilled currency / number format / week start, land on People with one FAB coach mark. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's purpose picker (`src/pages/OnboardingPurpose/BaseOnboardingPurpose.tsx`) joins the name step as chips: "What will you use Splito for?" (Trip, Flat or home, Couple, Friends, Just me). The answer sets defaults (default split, category set, group template once F-606 ships) and the first suggested action. Steps use Bluesky's direction-aware slide and persisted step (`src/screens/Onboarding/index.tsx`, `src/state/shell/onboarding.tsx`), and onboarding ends by starting the Getting started checklist (F-231).

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1701
- **Prefs** `language`, `defaultCurrency`, `numberLocale`, `weekStart`, `onboarding.done` (device), `onboarding.purpose`
- **Acceptance**
  1. A fresh install reaches People in 3 screens or fewer with no account.
  2. Region India pre-fills INR, en-IN grouping and UPI on.
  3. Every onboarding choice is editable later in Settings.
  4. Onboarding says plainly that data lives only on this device until a backup or sign-in, with a link to backups.
  5. The purpose chips share the name screen, so criterion 1's three-screen limit holds; skipping is allowed; each purpose's defaults live in one typed map with a bun test, and changing the purpose later changes only future defaults.
  6. Killing the app mid-onboarding resumes on the same step.

### F-252 Demo data served by the backend `spec: owner § 26.1 (decision 135)`

The demo dataset and generator move to the API; Demo mode downloads a versioned snapshot into the separate demo database; the client ships no demo seed.

- **Effort** M · **Impact** 6 · **Backend** yes · **Status** todo, backend batch (after F-2101/F-2103) · **Deps** F-228a, F-2101, F-2103
- **Prefs** -
- **Acceptance**
  1. `GET /v1/demo/snapshot` (versioned, same shape as a sync pull, cacheable) returns the one dataset generated server-side through the same domain code.
  2. Turning Demo mode on downloads it into the demo database (progress shown, resumable); turning it off erases the demo database (owner 136); the real account is never read or written.
  3. Offline: turning it on says it needs a connection; once on, demo works offline until switched off.
  4. The production client bundle contains no demo seed, generator or fixtures (build check); dev/e2e keep a local seed only until this ships.
  5. demoCoverage runs against the server snapshot.

### F-251 Settings prune: only what is needed `spec: owner § 26.1 (decision 128)`

Opus audits every Settings row and registry key against decision 128 (keep only where people genuinely differ; one good default otherwise), the owner-decided settings are kept, the rest are retired with their reads, tests and copy. The "Language menu" switch is removed first (owner).

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done on integrate/wB (audit docs/audit/SETTINGS-PRUNE-2026-10-29.md; 62 registry keys -> 47: 15 retired with showSyncStatus already gone, New expenses folded into Payments, Comments added; 9 Settings pages -> 7, controls 48 -> 22; 7 merges write their key where they act) · **Deps** -
- **Prefs** retires 16 keys (`notify.expense` folded into `notify.payment`), adds `notify.comments`
- **Acceptance**
  1. A written audit (docs/audit/SETTINGS-PRUNE-<date>.md) lists every row: keep / remove / merge, with the reason; owner-decided settings (decision log) are always kept.
  2. Removed rows' keys are retired without data loss or crashes on old stored values; the "every key has a Settings row" test holds.
  3. Settings has the 7 pages of docs/audit/SETTINGS-PRUNE-2026-10-29.md; no Settings search; old section URLs (`/settings/motion`, `/settings/lists`) redirect (owner 100); a merge whose screen control does not save its key yet is gated on that control saving it first.
  4. Demo data, e2e and Lingui (--clean) updated; screenshots of Settings before and after.

### F-253 Guided tour after the first sign-in `spec: owner § 26.2 (decision 142)`

After the first sign-in and setup, a short coach-mark walkthrough over the real app (FAB / Add expense, a friend row, Groups +, Settle up, Search & Ask, Activity), one spotlight at a time with Next / Skip; Expensify FeatureTraining and Bluesky ProgressGuide patterns, Bluesky look.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** built on branch worktree-agent-a50f8ca7f9ae10c7d (unmerged, web checked, native and Android/iOS not run): exactly 3 steps (Add an expense: FAB or sidebar pill; See who owes whom: first friend row; Settle up: that row's balance, else the Groups tab), empty-state wording on Add friend when there are no friends, once per account (`onboarding.tourSeen`), replay from Settings > Support "Take the tour", never in demo mode; e2e `tour.spec.ts` at 390 and 1440; first-use tips (`tips.enabled`) dropped by owner 213 · **Deps** F-249, F-250, F-211
- **Prefs** `onboarding.tourSeen` (account, `app` group, no Settings row); `tips.enabled` not built
- **Acceptance**
  1. Runs once per account right after sign-in lands on People (there is no Home tab, owner 198); Skip ends it; Settings > Support "Take the tour" replays it.
  2. Each step keeps the real control sharp and blurs the rest of the screen (owner 143: blur + slight dim, rounded cut-out, caption beside it; web backdrop-filter, native expo-blur, plain dim under reduced transparency), focus moved to it, screen reader reads the step and "Step N of 3"), adapts to phone, rail and desktop (sidebar items on desktop).
  3. Steps that need data use empty-state wording when there is none; the tour never creates records.
  4. Never in demo mode or e2e unless its spec asks; reduced motion respected; no overlap with toasts or sheets.
  5. e2e at 390 and 1440 plus screenshots.

- **Owner 213 scope:** only what a new user must know to start (add an expense, settle up, where balances are); a few steps at most, skippable, shown once; nothing more.

### F-254 Deep links end to end `spec: owner § 26.3 (decision 145)`

Every F-241 URL opens the right screen from anywhere: iOS Universal Links, Android App Links, `splito://`, web fallback; one resolver for push, invites, QR, reminders, shares; signed-out resume, demo handling, deferred link after install.

- **Effort** M · **Impact** 9 · **Backend** partly (hosted AASA and assetlinks, deferred-link handoff) · **Status** client part built on feat/wC-F241-254 (unmerged, review round done 2026-10-30): resolver + route table test, tier claims in `app.config.ts`, demo gate, signed-out intent store (stub until F-250), deferred link stub, simulator commands in RELEASE_CHECKLIST (native not run); hosted files and the deferred hand-over wait for the backend · **Deps** F-241, F-619, F-2201 (push taps), F-250
- **Prefs** -
- **Acceptance**
  1. A route table test parses every route from `https://splito.app/...` and `splito://...` to the same screen and params; unknown paths go Home.
  2. iOS associated domains + `apple-app-site-association` and Android verified `assetlinks.json` (per tier host, § 14); simulator checks with `xcrun simctl openurl` and `adb shell am start -d` open the exact screen cold and warm.
  3. Web: pasting any URL opens that screen with its sheet/tab/picker (F-241); browser Back behaves.
  4. Signed out: intro/Continue, then resume at the target; demo mode: asks to switch back before opening real data; entity not on device: "Not on this device yet".
  5. Push, invite, QR, reminder and share links all go through the one resolver; links never perform an action.
  6. Deferred link: install from a link, first open lands on its target, no third-party SDK.

### F-255 Every tap reflects immediately `spec: owner § 26.9/26.10 (decisions 150, 151)`

Every tap changes the screen in the same or next frame; slow bodies (lists, charts, breakdowns, next tab, search results) render after via React transitions or deferred mounting; nothing queues behind a busy render.

- **Effort** M · **Impact** 10 · **Backend** no · **Status** done on web 2026-10-30 (fix/tab-taps merged; tap-latency spec, tabTaps 18/18, burst loss 0/90); iOS Safari and native not yet verified · **Deps** F-242
- **Prefs** -
- **Acceptance**
  1. Rapid taps on any tab set (bottom bar, sidebar, rail, in-page) land on the last tap; e2e at 390 and 1440.
  2. A perf/e2e check measures tap-to-first-visual-change for the main tappables (tabs, a friend row, a group row, FAB, a filter chip, a switch, Add expense Save, a sheet's X) at 390 px: under 100 ms, with CPU 4x throttled under 200 ms.
  3. Heavy bodies use startTransition / useDeferredValue or mount after the transition, with same-size skeletons; no JS long task over 50 ms between a tap and its first frame.
  4. iOS Safari and iOS native checked on the simulator; the renders gate does not regress.

### F-256 Home, People and Groups tabs; Overview only on Home `spec: owner § 26.3 (decision 153)`

Home shows the Overview and Recent transactions (F-1415); a new People tab holds requests, the invites row and the friends list with search and filters; Groups drops its Overview; nav and default bottom bar gain People.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** built on feat/wC-F256-home 2026-10-30 (web verified; native not run; numbers in COMPLETION_MATRIX) · **Deps** F-1415, F-255, F-241
- **Prefs** `tabs` default changes to Home, People, Groups, Analytics, Activity (existing users keep their own order; People is added after Home if absent)
- **Acceptance**
  1. `/` shows, in order: Overview; Requests with the invites row (only when pending); Recent transactions (See all -> Activity); Recently active people (5, by change time, net per currency, See all -> People); Recently active groups (5, balance chips, See all -> Groups); each hides when empty; no full friends list; phone header has Search & Ask only (owners 153, 154).
  2. `/people` shows the Requests and Invites sent rows (owner 175), Friends (count, search, Filters, Show settled, gear "Manage friends and invites" last, owner 177), no Overview; header Search & Ask + Add friend; `/people/:id` unchanged.
  3. `/groups` has no Overview; everything else unchanged.
  4. Nav list order Home, People, Groups, Analytics, Ask Splito, Activity, Settings; the rail and desktop sidebar always show every item in the chosen order with no More (owner 155), the phone bar shows the on items; default bar of 5 with labels; Settings > Navigation includes People; saved tabs migrate by inserting People after Home.
  5. The right column (1300 px and up) is not shown on Home, since the page holds its content; other pages keep it.
  7. Overview cards (owners 156-161): line 1 label + chip left, net large green/red right-aligned; when both directions are open, "Owed to you ₹X" and "You owe ₹Y" small on the left in normal text colours; count line left; the net is the only coloured, right-side amount; about 64-72 px tall at 390 px; 6 currencies fit in one phone screen with the header; e2e checks height and that the amount's right edge aligns with the card's.
  6. Shell-first rendering (owner 152), e2e at 390/1440, demo data covers recent transactions, Lingui en + hi, perf and renders gate.

### F-257 Main-tab slide, indicator, icon pop and re-tap scroll-to-top (§ 26.9 gap) `spec: owner § 26.9`

Found 2026-10-30 by the tap-speed work: § 26.9's direction-aware slide between main tabs (native sceneStyleInterpolator ~220 ms, web ~200 ms), the springing bottom-bar indicator, the icon pop with haptic, the badge spring and re-tap-scrolls-to-top are not built (web switches instantly; "no soft reset yet"). Build them interruptible from the start (owner 150: a new tap redirects the running slide from its current value), reduced-motion aware.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** slide built 2026-10-31 (web CSS, native 'shift'; indicator spring, badge spring and re-tap scroll-to-top still todo; icon pop came with F-1713) · **Deps** F-255
- **Prefs** -
- **Acceptance**
  1. Slide direction follows tab order; a tap mid-slide redirects from the current position; the landing tab is the last tapped (tabTaps.spec stays green).
  2. Indicator springs; icon pops; haptic tap on native; badge springs on count change; re-tap of the active tab scrolls its list to top.
  3. Reduced motion / motion off: instant switch; renders gate and tap-latency spec do not regress.

### F-258 Pull to refresh, header stays `spec: owner § 26.9 (decision 167)`

Pull down at the top of Home, People, Groups, Activity, Analytics, Person and Group to refresh; the header stays fixed and visible throughout; native RefreshControl, phone-web pull handler.

- **Effort** M · **Impact** 8 · **Backend** no (syncNow() hook ready for F-2103) · **Status** built on c-refresh (web: `usePullToRefresh` + `pullController`; native: `useRefreshControl` in `List` and `Layout.Content`; `refreshAll` = `syncNow()` (a no-op until F-2103) + 400 ms minimum spinner, none offline; `e2e/pullRefresh.spec.ts` green in Chrome touch and Playwright WebKit; native RefreshControl and real iOS Safari / Android Chrome not run) · **Deps** F-255, F-256
- **Prefs** -
- **Acceptance**
  1. Every full screen refreshes on pull at the top, header or not (owners 169, 170), built once in the shared scaffold with a test over every route; sheets and popups keep drag-to-close (§ 26.8); the spinner sits under the header; the header never moves or hides during the pull (e2e checks its top stays at 0 while pulling at 390).
  2. Native: List RefreshControl on iOS and Android (simulator checked); phone web: a pull handler on the window scroll in iOS Safari (simulator) and Android Chrome, no fight with browser overscroll, scrolling unaffected (scrollWeb.spec green).
  3. Calls syncNow() (a no-op until F-2103) and holds the spinner 400 ms; offline ends at once, no error toast. Projections are not re-run (they re-read on every commit).
  4. Nothing redraws unless data changed (owner 166); renders gate and tap-latency spec do not regress.

### F-259 Activity type filter; See all transactions lands there `spec: owner § 26.14 (decision 173)`

Activity Filters gain the type (Expenses, Payments, Comments, Groups, Friends and invites, Reminders, Disputes), remembered and in the URL; every Recent transactions "See all" opens Activity with type=transactions (group-scoped from a Group page).

- **Effort** S · **Impact** 8 · **Backend** no · **Status** built on feat/wC-F1213-F259-activity (Activity filter, `seeAllTransactionsPath`, right column wired; the Group page has no Recent transactions section yet and Home's "See all" is on the Home branch: both only call `seeAllTransactionsPath(groupId?)` with `navigationAction="push"`) · **Deps** F-1213, F-256
- **Prefs** `activity.type` (account)
- **Acceptance**
  1. Filters sheet on Activity has Type (multi-select) besides All/Me/Others; badge and empty state follow it; remembered after reload; `/activity?type=transactions` deep-links it.
  2. Home, right column and Group "See all" of Recent transactions land on Activity filtered to transactions (and to that group from a Group page), opened as a pushed page with Back to where they came from (owner 179); tapping the Activity tab still gives the plain tab.
  3. e2e at 390/1440; demo data has every type.

### F-260 Screen-specific empty-state illustrations `spec: owner § 7 (decisions 146, 172)`

Original animated illustrations (light and dark) for every empty state: search no match, filtered no match, all settled, no history, no balances, nothing to settle, no feedback, no invite links, not found, Ask empty, besides the existing people, groups, activity and analytics.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** done on `c-anim` (19 pieces, every EmptyState has its own art, one CTA and lazy JSON; merge pending) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Each empty state uses art about its own screen, original (scripts/lottie.ts style), light and dark, lazy-loaded, plays once then rests, static under reduced motion.
  2. A test fails on any `EmptyState` without an `illustration`.
  3. Same size, spacing and structure everywhere; screenshots of each.

### F-261 Avatar or name opens the person, everywhere `spec: owner § 26.3 (decision 178)`

One shared PersonLink (avatar + name) used on every screen; tapping either opens /people/:id (Me -> Profile).

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (web, `c-personlink`; native unverified), Wave C · **Deps** F-256
- **Prefs** -
- **Acceptance**
  1. Every avatar or name of a person (expense/payment detail, items, Activity actor, comments, Members, Balances, Settle plan, search/Ask results, recent people, requests/invites, right column) opens that person; Me opens Profile; removed/unknown open the read-only page or "Not on this device yet".
  2. Built as one `PersonLink` (architecture test: no screen renders `UserAvatar` with a person id outside it); nested targets inside rows that open something else; 44 px targets; hover underline on web; keyboard focusable.
  3. e2e samples each surface at 390 and 1440; no redraw regressions (renders gate).

### F-262 Person names capitalised word by word `spec: owner § 26.3 (decision 181)`

Every word of a person's full name starts with a capital, on save and on display.

- **Effort** S · **Impact** 6 · **Backend** no (the API applies the same function in M2) · **Status** done (web), Wave C; native unverified · **Deps** -
- **Prefs** -
- **Acceptance**
  1. `capitalizeName` in `packages/domain` (unit-tested: spaces, hyphens, apostrophes, "McDonald" kept, Devanagari unchanged, trims and collapses spaces).
  2. Every save path for a person's name uses it; every display of a person's name uses it (old lower-case data reads right).
  3. Group names, expense titles, emails untouched; e2e adds "saransh balyan" and sees "Saransh Balyan".

### F-263 Every page has a fixed parent for Back `spec: owner § 26.3 (decision 184)`

Back with no history goes to the page's parent (stacked), never disappears; tab copies opened from a link keep Back after a refresh via `from`.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo, Wave C (with the F-256 fix round) · **Deps** F-256
- **Prefs** -
- **Acceptance**
  1. `backFallback` covers every route (architecture test fails on a missing one); default is Home, not People.
  2. Refresh or paste /settings/appearance: Back -> Settings -> Home. Same for person, group, expense (group / friend), edit, settle, profile, friends and invites.
  3. A pushed tab copy's address carries `from`; refresh keeps Back to the origin; tapping the tab drops it. e2e at 390 and 1440, web and the native route twins.

### F-264 Breathing splash mark while loading `spec: owner § 26.11 (decision 185)`

The launch logo zooms gently in and out while content loads, on web from first paint and on native from the first JS frame.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** built on c-splash (web e2e and renders gate green; iOS simulator dev-client video; Android and a release build not yet checked), Wave C · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Web: inline CSS keyframes in `index.html` animate the mark before any script loads; it fades into the first screen; `prefers-reduced-motion` gets an opacity pulse.
  2. iOS / Android: a JS launch screen identical to the native splash (light and Dim backgrounds, size, position) takes over without a jump and animates on the UI thread until ready.
  3. Throttled network e2e sees the animation running; no layout shift at handover; simulator video on iOS.

### F-265 Compact desktop sidebar `spec: owner § 26.5 (decision 188)`

The desktop sidebar is only as wide as its content and its footer links sit right under Add expense.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** done, Wave C (branch c-sidebar) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. At 1300, 1440 and 1920 the sidebar width fits the longest item (en and hi measured, no truncation); content starts sooner.
  2. Footer links follow the Add expense pill with normal spacing; no pinned footer, no dead band.
  3. Rail (800-999) and phone unchanged (390 before/after identical); screenshots light and Dim.

### F-266 Fast everywhere: perf sweep of every screen and interaction `spec: owner § 26.10 (decision 189)`

A perf sweep spec walks every route and interaction in WebKit and Chrome at 6x CPU, and every miss is fixed at its cause.

- **Effort** L · **Impact** 10 · **Backend** no · **Status** in progress, Wave C (closes the wave) · **Deps** F-255
- **Prefs** -
- **Acceptance**
  1. `perf/sweep.spec.ts` covers every link-table route (open, close, revisit) and every interaction listed in § 26.10 owner 189, on the large demo set and the 10,000-expense fixture, in WebKit and Chrome 6x; it fails above budget.
  2. Known misses fixed: Analytics revisit (330 ms at 6x), row exit animations on popped pushed pages (Person, Group, Expense), Activity narrowed paging (F-1213 review C1).
  3. Per-screen table in COMPLETION_MATRIX taken at load under 10; the sweep is part of the merge gate from then on.
- **Progress (2026-10-31, c-perf port):** the sweep runs on the current routes (Chrome; the demo set); row exits on popped
  pages fixed (Person, Group, Friends and invites; sheets and popups too), Analytics paging landed (89bf12a). Open: WebKit and
  the 10,000-expense run, the x6 misses listed in COMPLETION_MATRIX (tab switches 236-441 ms, Friends and invites open,
  Add expense body, search typing, Activity's first fling), and making the sweep part of the merge gate.

### F-268 Disputed links open Activity filtered `spec: owner § 26.14 (decision 192)`

Every disputed amount or count opens Activity on All with Expenses, Payments and Disputes selected, group-scoped when in a group.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** in progress, Wave C · **Deps** F-1210, F-1213
- **Prefs** -
- **Acceptance**
  1. `seeDisputedPath({groupId?})` gives `/activity?tab=all&type=expenses,payments,disputes[&group=]`, pushed with Back; used by every disputed amount/count (Person, Group balances, Settle notice, friend Settle up notice, search tip).
  2. The Filters sheet shows those three types chosen; a saved Me/Others tab never narrows it.
  3. e2e from a Person page, a Group page and Settle at 390 and 1440; row badges still open the record.
  5. Owner 194: `activityPath({types, groupId, personId})` with a new `person=<id>` filter (events involving that friend; chip + Filters sheet + URL); every "see all" of past events (group history, person history, comments, reminders, payments, friend activity) opens Activity with matching filters; a group's Expenses and a friend's History stay full lists (their pages' main content) with headings linking into Activity (ruling 2026-10-31); no other screen keeps its own long history list.
  6. Owner 195: every link that can lead to Activity does; requests/invites "See all" and counts open Activity with Type = Friends and invites; request rows carry Accept / Decline and invite-sent rows Resend / Cancel in place; Friends and invites keeps only invite link, QR, contacts and manage links.
  4. Owner 193: every transactions heading, See all and count (Home, Person, Group, Analytics, right column) uses `seeAllTransactionsPath({groupId})`: All, Type = Expenses + Payments, group-scoped in a group; single rows still open the transaction.

### F-269 Group "Who can join" and consent to be added `spec: owner § 26.18 (decision 196)`

Each group has a join setting (anyone with the link / approve each join / invite only), and adding someone sends them a group request.

- **Effort** M · **Impact** 8 · **Backend** partly (real link joins and cross-device requests need F-2105; local flow and demo now) · **Status** done locally, Wave C (branch c-joins, 2026-10-31; link joins and cross-device requests stay local until F-2105; e2e `groupJoins.spec.ts`) · **Deps** F-268
- **Prefs** none: `joinPolicy` (link / approve / invite; absent = approve) is a field of the group, with history, not a preference; the old `invites.approveJoins` preference is removed
- **Acceptance**
  1. New/Edit group and the Add members sheet show "Who can join" with the three options (default approve); admins only can change it; the group page shows the current rule under Members.
  2. Invite only hides and revokes the group link; anyone-with-link joins at once; approve sends a join request that admins Approve/Decline in Activity rows.
  3. Adding a Splito friend creates a group request (Join / Decline in their Activity); they show "Invited" (greyed, not selectable) until they join; not-on-Splito people get an invite or "only for you".
  4. Demo carries every state (each policy, a pending join request, an invited member); en + hi; e2e at 390 and 1440.

### F-270 Requests and invites on their own pages, not Home `spec: owner § 26.3 (decision 197)`

Home drops its Requests section; People shows friend requests and invites, Groups shows group requests/join requests/invites, a group page its own.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** People done (F-268); Groups top section done with F-269 (c-joins, `groupJoins.spec.ts`); Home's Requests section goes with F-271 · **Deps** F-268
- **Prefs** -
- **Acceptance**
  1. Home has no requests or invites section; People's top section holds friend requests and friend invites sent; Groups' top section holds group requests, join requests and group invites sent (fills in with F-269); a group page shows its own under Members.
  2. One-line rows (§ 26.18), max 5, "See all" -> Activity (Friends and invites, group-scoped where relevant); hidden when empty.
  3. Specs that expected Home's Requests section move to People/Groups; e2e at 390 and 1440.

### F-271 Remove Home; Overview at the top of Analytics `spec: owner § 26.3 (decision 198)`

The Home tab goes; its Overview becomes the first section of Analytics; the app opens on People.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** built on c-nohome (unmerged, 2026-10-31): criteria 1-9 met on web in e2e at 390 and 1440 (`peopleTabs`, `overviewLayout`, `settingsTab`, `profilePage`, `sidebar` specs); native not run on a simulator; the Profile avatar opens the edit sheet, because the data model has no avatar image (owner 209 "changeable" is the name only); "You paid this year" is in the currency used most · **Deps** F-256
- **Prefs** start tab default `people`; `tabs` migration drops `home` and `ask` (the old default bar becomes the new one, which gains Settings, owner 206)
- **Acceptance**
  1. Tabs People, Groups, Analytics, Activity (+ Ask, Settings); no Home route or screen; `/` opens the start tab; `/?overview=` -> `/analytics?overview=`; saved `tabs`/`startTab` naming home migrate (tests).
  2. Analytics shows the Overview cards (All / Groups / Direct, owner 161 layout) above its filter row, labelled as balances now, ignoring period/currency; a card opens Analytics in that currency.
  9. Owner 209: Profile is a full page: header (changeable avatar, name, verified email and phone, "On Splito since", Edit profile), stat row linking to People / Groups / Activity Me / Analytics, Your balance (owner-161 cards, Analytics ›), Payment details (UPI, editable), Add me (QR, link, Share), Your recent activity (3, See all -> Activity Me), Log out last; sections hide when empty and load after the header; screenshots 390/1440 light and Dim.
  8. Owner 205: the Data items collapse into one "Your data" row opening `/settings/data` (Back -> Settings) with Export, Import, Move older data (when present), Reset all settings and the deleted-items note; e2e.
  7. Owner 204: Settings shows one "Support" row opening `/settings/support` (Back -> Settings) with Send feedback, Your feedback, Help, Privacy, About and the app version; the inline items leave the Settings list; footer links still open each page directly; e2e.
  6. Owners 202/203: Log out moves to the last row of Profile and is removed from Settings, the drawer footer and the sidebar (AddMissingContact keeps its own; same erase prompt, owner 186); Profile's "Settings" row is removed; e2e.
  5. Owners 201/206: the header avatar opens Profile at every width; Profile is its own page at `/profile` (Back returns where you were, else the start tab); Settings is a tab (`/settings`) in the default bottom bar (People, Groups, Analytics, Activity, Settings) and the sidebar; the phone drawer opens by left-edge swipe; e2e.
  4. Owner 200: Ask Splito leaves the shared nav list (sidebar, rail, drawer, bottom bar, Settings > Navigation, `tab-ask`); reached from the header Search & Ask icon and "/" / Cmd+K only; saved `ask` in `tabs` migrates away.
  3. Logo, Back parents (owner 184), sign-in return and every Home fallback go to the start tab; Home's "See all" links and Recent sections are gone (Activity, People, Groups cover them); specs updated; e2e at 390 and 1440.

### F-272 Sort control on People and Groups `spec: owner § 26.12 (decision 199)`

A Sort button beside Filters: Last active (default), Name, Amount, Newest; remembered and in the URL.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** built on c-nohome (unmerged, 2026-10-31): unit tests for each order (`People/sort.test`, `Groups/filter.test`), the comment projection (`historyIntegrity.test`), the preference migration (`preferences.test`); e2e at 390 and 1440 (`peopleTabs.spec`) · **Deps** -
- **Prefs** `peopleSort` (default `lastActive`), `groupsSort` (default `lastActive`)
- **Acceptance**
  1. People and Groups headers: search, Filters, Sort (and People's gear last); Sort opens a radio menu; non-default tints the button.
  2. Last active = newest change involving the friend or group (expense, payment, comment, edit), computed in the domain/sync layer, not in screens; ties by name.
  3. Sort leaves the Filters sheet; `?sort=` in the URL; old `peopleSort` values migrate; unit tests for each order; e2e at 390 and 1440.

### F-273 Paid by always shown, starting as me `spec: owner § 26.13 (decision 207)`

Every new expense shows Paid by and starts with me as the payer, from every entry point.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done (web; the code already defaulted to me, now locked by unit + e2e tests from FAB, pill, group, person, Ask, draft restore; scanned receipt and Duplicate are not built yet) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. e2e from the FAB, the sidebar pill, a group page, a person page (pre-selected friend), Ask prefill without a payer, a scanned receipt and Duplicate: Paid by visible and reads "You" at 390 and 1440.
  2. No smart default, remembered or predicted payer for a new expense; an Ask prefill naming a payer is the only exception; editing keeps the saved payer.
  3. Unit test of the form initialiser and group/person pick (`form.ts`, `formPick.ts`) for the default.

### F-274 Reuse audit and consolidation `spec: owner § 26.1 (decision 210)`

Audit the whole codebase for code that does the same job twice and merge each set into one shared piece.

- **Effort** M-L · **Impact** 8 · **Backend** no · **Status** in progress: audit done; cleanup rounds 1 and 2 built (round 2 2026-10-31: time of day, day helpers, clipboard, Include groups row, email check; leftovers listed in `docs/reuse/consolidation.md` Status), phases 1-4 still to do, Wave C · **Deps** -
- **Prefs** -
- **Acceptance**
  1. A ranked audit (files, what is duplicated, the shared piece, risk, effort) in `docs/reuse/consolidation.md`.
  2. Consolidation in small non-overlapping slices, each with tests unchanged or improved and no visible regression (screenshots 390/1440 before/after).
  3. An architecture test per consolidated piece where a pattern can be enforced (e.g. no `UserAvatar` with a person id outside PersonLink).

### F-277 Stacked pages slide on phone web (owner 227) `spec: ARCHITECTURE 26.3`

Acceptance: a push (avatar to Profile, a person, a group, an expense, a Settings section) slides in from the right at
phone width on web; the in-app Back slides the page below back in; Safari's left-edge swipe Back is not animated
again; no JS per frame and no extra React render (renders gate); no row exit clone; FAB stays put; reduced motion
instant; desktop instant. Status: built (web, Chromium at 390 and 1440, 2026-11-01; real iOS Safari and native not run). ARCHITECTURE 26.3 [Built] note, 17.1 rule, 23 lesson, COMPLETION_MATRIX "F-277".

### F-278 Profile fits one phone screen (owner 228) `spec: ARCHITECTURE 26.15`

Acceptance: at 390 x 844 the header row, the stat row and the first Settings rows are visible without
scrolling; Add me is gone from Profile; no Payment details row (owner 229: the pencil's sheet edits the UPI ID);
Log out is last, the sync note under it. Status: built (web; native not run). Tests: `profilePage.spec` (order, compact
header, one-screen at 390 x 844, Hindi at 320 px), `profileSettings.spec`, `demo.spec` Profile.

### F-276 Analytics' list is Activity (owner 226) `spec: ARCHITECTURE 26.16`

Acceptance: (1) Analytics renders no expense rows and no selection chip; its data layer no longer reads the 200-row
expense list. (2) A "See these expenses" link under the charts opens Activity (pushed, Back) with
`type=expenses&since=&until=&currency=` and `scope=` when the scope is not everything. (3) A bar opens it with that
bar's `since`/`until`, a category slice or row with `category=`, a person row with `person=`. (4) Activity reads
`since`, `until`, `currency`, `category` and `scope` (sanitised; listed in `QUERY_KEYS`), filters records by their own
date, currency, category and group, shows each as a removable chip, and the empty state and "Look further back" work
under them. (5) The scope helpers live in one shared module (`lib/scope.ts`) used by Analytics and Activity.
Note: the dates are `since` / `until`, not `from` / `to` as first written, because `from` is the origin tab of a pushed
copy (owners 179, 184; ARCHITECTURE § 23, 2026-11-01). Status: built (web checked; iOS and Android not run).

### F-275 New-user UX fixes (audit 2026-10-31) `spec: owners 212/213; docs/ux/2026-10-31-new-user-audit.md`

Fixes from the Opus new-user audit (3 blockers, 19 major, 21 minor). Rulings (assistant, 2026-10-31) where the audit and owner rules meet:

- **Log out keeps owner 186** (erase everything): the audit asked to keep data, but the owner decided erase; the prompt instead says plainly that until sync exists the data cannot come back, with the unsynced count. No change of rule.
- **Adding a friend before the backend makes a usable friend:** with no directory to check (no backend), Add friend creates a normal local friend ("only for you" rule of § 26.18), name first, email or phone optional; the request flow starts only when the directory exists. Fixes audit blocker 2.
- **Settled stays hidden by default on both lists** (owner 90): People must hide settled friends like Groups does; the all-settled empty state shows "All settled up" with "Show settled". Fixes the inconsistency behind audit blocker 3.
- **Save and Record are instant with one confirmation:** no full-sheet success animation; a quick check on the button and one toast that never covers the next screen's key content.
- **One entry for problems:** "Report a problem" opens one sheet whose first choice is Dispute or Put on hold (owner 119's two kinds kept, one way in); no "Raised by" picker unless recording for someone else.
- **Show only what works:** Settings rows and sign-in buttons for features not built (notifications, privacy controls, Google, Apple) are hidden or shown as small "Coming with sync" text, never as primary buttons.
- **Itemize picks a person on tap** (one tap = assign; a stepper for portions appears only after), charges sit behind one "Tax, tip and discounts" row, and the total is computed from items when not typed. **Done 2026-10-31 (web; native not run)**: a tap assigns or takes off, an untouched Everyone narrows to the person tapped, a portion stepper shows once two or more share an item; charges fold into one row with a one-line summary; `evaluateForm` takes the domain's items total when the amount is empty (`isTotalFromItems`, "Total from the items: X"). Specs: `expense.spec` (new: essentials, derived total, typed total wins), `charges.spec`, `amount.spec`, `many-currency.spec`, `sheets.spec`, `sheetExit.spec`; bun `form.test`, `chargeForm.test`.
- **One export:** the Analytics icon opens the same Export sheet as Settings, pre-set to the current filters. **Built 2026-10-31** (web; `ExportPreset` range/scope, `analytics-export` opens `/analytics/export`, the Analytics-only CSV writer and `exportRows` are gone; `analytics.spec.ts`, `statement.test.ts`, `exportScope.test.ts`).
- **Add expense shows essentials first:** amount, title, split with, paid by, group; focus lands on the amount; no duplicate "Add people" button; Itemize and more behind "More options". **Done 2026-10-31 (web; native not run)**: split chips (Itemize and the other modes, "Adjust" renamed "Equal + extra", now wrapping), non-equal split editors, cash rounding and Notes sit behind one "More options" row; the Split list shows only with two or more people; `split-add-people` is gone; the amount takes focus on a new expense.
- **Sign-up keeps the typed name** (bug) and stays as owners 139-143 decided.

**F-275 progress (builder, 2026-10-31, branch `worktree-agent-a7e9e4be62149a001`):** built and checked on web (native not run): (1) Add friend with no directory = a usable local friend, name first (blocker 2); (2) one "Report a problem" entry replaces Dispute and Put on hold, no "Raised by" unless "Record this for someone else" (audit F-15); (3) the sign-up name is kept (already fixed by `accountName()`; now asserted in `auth.spec`) (F-9, name part only; the shorter sign-up steps are not done); (4) Google and Apple are one muted line, not buttons (F-10); Settings rows for unbuilt features verified hidden (`NOT_BUILT`). Still open in F-275: the other items above.

- **Effort** L · **Impact** 10 · **Backend** no · **Status** in progress, Wave C (overlapping items handed to running builders; the rest after they merge) · **Deps** F-271, F-1713, F-266
- **Acceptance**
  1. Every blocker and major finding in the audit is fixed or has a recorded ruling; minors fixed or listed with a reason.
  2. Tap counts for the audit's jobs drop (table in the audit doc updated).
  3. Contrast AA (green, dark red, axes), 44 px targets, footer links and radio rows.

### F-250 Sign-in required (auth gate) `spec: owner § 26.15 (decision 125)`

Nothing of the app is visible signed out: only the welcome tour, the logged-out flow, language and legal pages. The local database opens per account only with a session; offline after sign-in; deep links resume after sign-in.

- **Effort** M · **Impact** 10 · **Backend** front end now (dev account), real with F-2102 · **Status** built on feat/wC-F249-F250-auth (unmerged, fix round 2026-10-30): front end against the dev AuthClient, web only (native not run); criteria 1, 3, 4, 6-10 met in e2e (`auth.spec.ts`, `authConfig.spec.ts`, preview checks in `e2e-pwa`); 2 only as far as intro then Continue (setup F-211 is not built, so Continue goes to Home); 5 partly (sign-in says it needs a connection; the app opens offline from the device copy of the session); Google/Apple are buttons only ("arrives with sync"); the review site is a preview build, production is refused until the auth HTTP client (F-2101/F-2102) exists · **Deps** F-225, F-249, F-2102 (production)
- **Prefs** -
- **Acceptance**
  1. Signed out, every route (including deep links and `?drawer=` URLs) shows the logged-out flow; no store is opened and no ledger data is in the DOM (e2e asserts zero store reads before sign-in).
  2. Fresh install order: tour, Create account / Sign in, setup (F-211), Home.
  3. One database per account (name or file keyed by the account id); switching accounts never shows the other's data; Log out closes the database and returns to the logged-out flow with the § 26.15 prompt.
  4. A deep link opened signed out resumes after sign-in; `/join/:token` stays public.
  5. Offline after sign-in the app opens and works; sign-in offline says it needs a connection.
  6. Dev/e2e builds show "Continue with a dev account" (labelled, local); production builds have no such path and the release script refuses to build without the auth API URL; e2e signs in through `window.__splitoTest.signIn`.
  7. Data already on the device before this change is offered once: "Move this device's data into your account" (F-2104).
  10. One Continue screen only (owners 140, 141): Apple, Google, email or phone; existing account then the user's choice of Password or Code, equal options, last choice remembered per device (owner 144), Forgot password flow; new account created in-flow: verify, only the missing details, set a password (min 8, strength shown); no Create account screen anywhere.
  9. A new account requires name, email and phone, both verified by code; an account missing either (Google/Apple, older accounts) gets a blocking "Add your phone number" / "Add your email" step after sign-in, with only Log out besides (owner 139).
  8. The Continue screen shows "Continue with Apple" and "Continue with Google" (owner 138; Apple first on iOS, Google first on Android/web, platform button styles); until F-2102 they say it arrives with sync, no fake success.

### F-249 Intro slides before sign-in `spec: owner § 26.2 (decisions 123, 142)`

First-launch tour of up to 5 slides (what Splito is and how to use it) with Skip / Next / Get started, then setup (F-211); first-use tips after it. Bluesky Pager and ProgressGuide, Expensify FeatureTraining (`src/components/FeatureTrainingModal.tsx`) and onboarding header (`src/components/OnboardingHeader.tsx`); illustrations original (never Expensify's or Bluesky's artwork).

- **Effort** M · **Impact** 8 · **Backend** no · **Status** built on feat/wC-F249-F250-auth (unmerged, fix round 2026-10-30): animated Lottie art (`pnpm lottie`), `ScreenTransition` + a touch swipe in place of the native Pager (pager-view is not shipped); `onboarding.tourSeen` is a device-storage key (the database is closed while signed out); criteria 1-4 met on web (e2e `welcome.spec.ts`, `introReplay.spec.ts`), with Skip/Get started going to Continue (setup F-211 is not built); 5 (tips) is F-253's; 6 measured (COMPLETION_MATRIX) · **Deps** F-1712 (Lottie), F-203 (Pager)
- **Prefs** `onboarding.tourSeen` (device, in the database), `tips.enabled` (on), `tips.seen` (device)
- **Acceptance**
  1. A fresh install opens the tour; slides as § 26.2 with titles and one sentence each, en and hi, no claim of sync or features not built.
  2. Skip on any slide and Get started on the last go to setup (F-211); swipe and dots move both ways; Escape skips on web; the language chip switches the tour live.
  3. Shown once per install; Settings > Help "Take the tour" replays it; demo mode and e2e builds never show it unless the tour spec asks; `/welcome/1`..`/5` deep-link to a slide.
  4. Phone full screen, rail/desktop centred card; reduced motion shows static art; screen reader reads "Step N of 5"; no overflow at 320 px in Hindi.
  5. First-use tips: one per screen at most, each once, dismissible, off with `tips.enabled`, "Reset tips" in Settings > Help.
  6. Perf: the tour's first slide renders within the § 26.10 cold-start budget; Lottie loads lazily; e2e and screenshots (light, Dim, 390, 1440).

### F-212 Simple mode

One switch for a pared-down app: larger text, equal and exact splits only, no Analytics tab, amount-who-Save composer, one Settle button per person.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-209
- **Prefs** `simpleMode`
- **Acceptance**
  1. Turning it off restores the previous layout and preferences.
  2. Expenses made in full mode still display correctly (read-only where the mode is hidden).
  3. Suggested when OS text size is above 150%.

### F-213 Handedness and reach

Left/right-handed FAB placement and mirrored swipe defaults; optional search row above the tab bar; minimum touch targets enforced.

- **Effort** S · **Impact** 4 · **Backend** no · **Status** todo · **Deps** F-201
- **Prefs** `handedness`, `bottomSearch`
- **Acceptance**
  1. Left-handed moves the FAB bottom-left and swaps swipeLeft/swipeRight defaults.
  2. The architecture test flags icon buttons below 44 pt (iOS) / 48 dp (Android) without hitSlop.

### F-214 My profile and avatars

Profile page for me (name, photo / emoji / initials avatar, home currency) and photo or emoji avatars for friends, copied from Bluesky's avatar editor and UserAvatar; images stay on the device, resized. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Bluesky's avatar creator (`src/screens/Onboarding/StepProfile/AvatarCreatorItems.tsx`, `AvatarCreatorCircle.tsx`): "Give them a face" builds an emoji-and-colour avatar for me, friends and groups, with "Upload a photo instead".

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-201, F-601
- **Prefs** -
- **Acceptance**
  1. Initials avatars get a stable colour per person that passes contrast checks.
  2. A photo avatar is resized under 100 KB with EXIF stripped and shows wherever the person appears (lists, drawer, Activity actor).
  3. Works fully offline.
  4. The avatar creator (emoji grid and the contrast-checked colour set, no Bluesky artwork) previews live and is reachable from Profile, Add friend and the group editor.

### F-215 Help, About, licences and privacy `spec: handoff 2 notices, owner § 26.3 footer`

Offline help (how balances, splits, payment rules and sync labels work), About with version, open-source licences generated from REUSE_MAP and NOTICE (MIT, OFL, Apache-2.0, ISC for Lucide), privacy policy and terms, and What's new after an update. Feedback is F-226.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-201
- **Prefs** `whatsNew.show`
- **Acceptance**
  1. A test checks every REUSE_MAP row and every bundled font and icon set appears on the Licences screen.
  2. Help works offline in en and hi; the sidebar footer and drawer Help / About / Privacy links open these pages.
  3. The privacy policy says where data lives (this device until sign-in), how to export and delete it, and covers GDPR and India DPDP rights.
  4. What's new shows once per version and can be turned off.

### F-216 Permission primers and recovery

One pre-permission sheet per permission (camera, photos, contacts, notifications, location, microphone), asked only at the moment of use, and a denied state with Open Settings plus a manual path.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-205
- **Prefs** -
- **Acceptance**
  1. No OS permission prompt appears before the user taps the feature that needs it.
  2. A denied permission shows the manual alternative (file import, type the name) and Open Settings; nothing dead-ends.
  3. Notification permission is first requested when the user turns on a reminder, never at launch.

### F-217 Tablet, landscape and foldable layouts `spec v1 responsive (extended)`

Two-pane list and detail on iPad, Android tablets and wide web (Groups + group, People + person), landscape phones, Split View / Stage Manager / foldable resizing without losing drafts, full hardware-keyboard focus.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-201, F-204
- **Prefs** `layout.twoPane` (device)
- **Acceptance**
  1. Resizing from phone to tablet width mid-edit keeps the open sheet and its draft.
  2. From 768 px a selected group shows beside the list; narrow widths fall back to push navigation with working back.
  3. Every screen passes the A-035 width matrix in portrait and landscape.

### F-218 Sample group to explore `spec: handoff 4 demo mode`

A clearly labelled sample trip a new user can open from the empty People screen, kept in its own store namespace, never synced, never counted, removable in one tap.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-603, F-210
- **Prefs** -
- **Acceptance**
  1. Every screen inside the sample shows a "Sample" badge; no sample amount reaches People, Groups, Analytics, widgets or exports.
  2. Removing the sample deletes it completely; it never enters the outbox.
  3. Uses packages/test-fixtures data only in this explicit mode.

### F-219 Contextual tips and feature discovery

One-time tips at the moment a feature helps (third typed receipt suggests scanning, a long session suggests Save and add another, a pasted SMS suggests Quick add); each feature registers its own tips; a Tips list lives in Help. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Bluesky's NUX mechanics (`src/state/queries/nuxs/definitions.ts`, `src/components/dialogs/nuxs/index.tsx`: typed tip ids with an `enabled()` rule, a completion record, a priority queue that shows one at a time) with Expensify's product-training tooltips anchored to the control they explain (`src/components/ProductTrainingContext/TOOLTIPS.ts`). Tips render as anchored tooltips or inline cards, never self-opening dialogs (ARCHITECTURE § 10).

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-211, F-215
- **Prefs** `tips.enabled`, `tips.state` (device)
- **Acceptance**
  1. At most one tip per screen visit and per day; a dismissed tip never returns.
  2. Tips can be turned off and reset in Settings.
  3. Tips are announced politely, never a blocking modal.
  4. Tip ids and their rules live in one typed definitions map; a dismissed or completed tip is recorded and never returns; the queue shows at most one tip within criterion 1's limits.
  5. An anchored tooltip follows its target on resize and rotation and becomes an inline card when the target is off-screen.

### F-220 Group expense list: month sections, "involving me" filter and sort

Sticky month headers with per-currency month totals, an "Only involving me" toggle, filters by member, payer and category, sort by date or amount; repayments show inline as distinct rows.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-208
- **Prefs** `groupList.involvingMeDefault`
- **Acceptance**
  1. "Only involving me" hides expenses where I neither paid nor have a share, and says how many are hidden.
  2. Month totals are per currency and match Analytics for that group and month.
  3. Filters sit in the body filter row (§ 26.4) in a FormSheet with Apply (§ 26.8).

### F-221 Pin and reorder friends and groups

Pin friends and groups to the top of their lists and of the right column's Recently active groups (F-224); manual order as a sort option.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-206
- **Prefs** `peoplePinned`, `groupsPinned`, `peopleSort` and `groupsSort` (add "Manual")
- **Acceptance**
  1. Pinned rows stay on top under every sort and filter and show a pin glyph with an accessible label.
  2. Manual order persists, syncs and resets.

### F-222 One navigation list for sidebar and drawer, Home label and title `spec: owner § 26.3, 26.4, 26.7`

One `navigationItems` array and one `NavFooterLinks` component feed the desktop/rail sidebar and the phone drawer, so both show Home, Groups, Analytics, Ask Splito, Activity, Settings, then Feedback · Help · Privacy · About. The home destination is "Home"; its header shows the logo on phones and the title "Home" on rail and desktop. The drawer header shows the avatar and the person's real name only.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** done (web checked in Chrome; Cmd/Ctrl+K on native hardware keyboards and native hardware-keyboard shortcuts wait for a native key-command module) · **Deps** F-201, F-204
- **Prefs** `tabs` (now takes every shared item, group Navigation)
- **Acceptance**
  1. Sidebar and drawer show the same items in the same order with the same icons and labels, rendered from one `navigationItems` array and one `NavFooterLinks` component (a unit test asserts both lists are identical). The sidebar adds only the logo and the "Add expense" pill; the drawer adds only its profile header and Sign in / Log out (F-225).
  2. Profile is never a nav item (the avatar opens it). The drawer has no Profile row, no theme toggle, no "Me" label and no "Saved on this device" text; its header shows the avatar (with the F-223 dot) and the real name, and tapping it opens Profile.
  3. The home destination is labelled "Home" with a house icon in the bottom bar, sidebar and drawer; the Home header shows the logo mark on phones and the centred title "Home" on rail and desktop.
  4. Ask Splito sits between Analytics and Activity and opens the Search & Ask drawer in Ask mode (F-2301).
  9. Settings > Navigation offers every shared sidebar item (Home, Groups, Analytics, Ask Splito, Activity, Settings) for the phone bottom bar with toggles + drag reorder, any number of tabs (decision 84), Home fixed, default Home/Groups/Analytics/Activity (Ask Splito in the bar opens the drawer in Ask mode), items not in the bar stay in the drawer, Reset restores default (`tabs` pref; § 26.3, decision 70).
  10. Search & Ask drawer: header icon on every top-level page (left of its action) opens a drag-to-close bottom drawer (phones) / centred command-palette popup (desktop) with one input, recent searches, grouped live results (People, Groups, Expenses) and an "Ask Splito" row that switches the drawer into the chat; web "/" and Cmd/Ctrl+K; no Search page or nav item, `/search` opens the drawer; Friends section search icon removed; default bottom bar Home, Groups, Analytics, Activity (§ 26.3, decision 73).
  11. Phones (native and mobile web): the header, bottom bar and FAB scroll away on scroll down and slide back on a slight scroll up, driven by Bluesky's minimal-shell handlers; top of list always shows; a tab switch or a sheet opening resets them to shown; rail/desktop headers stay sticky (§ 26.4, decision 81). A Playwright test scrolls mobile web 300 px down (hidden) and 30 px up (shown).

### F-223 Sync-status dot on the user's avatar `spec: owner § 26.7`

A Bluesky presence-style dot on the user's avatar in the drawer header and on the header avatar at every width: green synced, yellow syncing, red on this device only.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done · **Deps** F-222, F-1801
- **Prefs** -
- **Acceptance**
  1. Green = signed in, online and everything acknowledged by the server; yellow = syncing or waiting to sync (changes in the outbox, or offline with unsynced changes); red = on this device only (no account, nothing backed up). Until the backend exists the state is red; green never shows before server acknowledgement.
  2. The dot copies Bluesky's presence-dot geometry (bottom-right, ring in the background colour) on the drawer header avatar and the header avatar on phone, rail and desktop.
  3. Never colour alone: the avatar's accessibility label says "Synced" / "Syncing" / "On this device only", and long-press (native) or hover (web) shows it as a tooltip; tapping the dot area in the drawer opens Settings > Account/Sync.
  4. It replaces every other "Saved on this device" text in the shell; state changes animate (instant under reduced motion).

### F-224 Desktop right column: recent transactions and recently active groups `spec: owner § 26.17`

A fixed 320 px right column in Bluesky `RightNav` style at 1300 px and up, with the 5 newest transactions involving me and the 5 most recently active groups.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** done (built on ui/preview-latest, unmerged) · **Deps** F-201, F-603
- **Prefs** `rightColumn.sections` (show, hide and order the two sections)
- **Acceptance**
  1. Shows only at 1300 px and up: fixed 320 px, left hairline, own scroll; content fills the space between the two columns; hidden under 1300 px.
  2. "Recent transactions": the 5 newest expenses and repayments involving me, each with category tile, title and my net chip (lent / borrowed, from domain `personNet`); a row opens the expense; "See all" opens Activity.
  3. "Recently active groups": the 5 groups with the newest change (an expense or repayment added, edited or deleted in it, or the group itself edited), ordered by change time, not expense date, with balance chips; "See all" opens Groups. The Groups list "Recent activity" sort uses the same rule (test: editing an old expense moves its group to the top).

### F-225 Account section: Sign in and Log out `spec: owner § 26.15`

Settings starts with an "Account" section copied from Bluesky's Settings account section and Login/Signup screens; auth state comes from one `useSession()`. Honest until the auth backend exists.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wA-30b; Log out and the signed-in row ship with F-2102) · **Deps** F-1701, F-205
- **Prefs** -
- **Acceptance**
  1. Signed out: a "Sign in" row with the subtitle "Back up and share with friends" opens Bluesky's logged-out flow full screen over the app (closable): splash with Create account / Sign in -> Login (email or phone, password, Forgot?) or Signup (name, email or phone, password); every field is validated (replaces the earlier method-picker design, decision 65).
  2. Until F-2102 exists, submit shows the Bluesky Admonition "Sign-in arrives with sync. Your data stays safe on this device."; no fake success and no fake account.
  3. Auth state comes from one `useSession()` (Bluesky `src/state/session` pattern), signed out until the backend lands; the drawer footer shows "Sign in" (and "Log out" once signed in).
  4. The signed-in account row and the "Log out?" prompt ship with F-2102 (criteria there).
  5. The signed-out flow is Bluesky's LoggedOut/SplashScreen, screens/Login (FormContainer, LoginForm, ChooseAccountForm, ForgotPasswordForm, SetNewPasswordForm, PasswordUpdatedForm) and screens/Signup (StepInfo, step indicator, BackNextButtons) copied with only Splito replacements (§ 26.15, decision 65); header and reuse rows on every adapted file.

### F-227 Large demo dataset for testing `spec: owner § 26.1`

A year of realistic Splito use, generated deterministically, for the owner and for performance checks. Dev and e2e builds only.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done (verified on feat/wB-B2: large set 1,550 expenses, 30 friends, 12 groups, 7 currencies incl. JPY scale 0 and BHD scale 3, 9 groups and 15 payers in more than one currency, every split mode, 92 multi-payer, 133 itemised with portions, 253 notes, 365 payments, 65 write-offs, bin items; `demoLarge.test`, `e2e/demo-large.spec.ts`, rules `demoStaticImport`; the Wave B small-set additions (Goa and Lisbon in two currencies, USD, JPY, BHD, KWD) now live in the one dataset, F-228a · **Deps** F-103, F-1203, F-1113
- **Prefs** -
- **Acceptance**
  1. (Reshaped by F-228a: the set is written by Demo mode's seeding, not by a URL switch or an Add demo data button.) Demo mode writes ~30 friends, 12 groups, ~1,500 expenses in 6 currencies over 12 months (all split modes incl. itemised with portions and multiple payers), repayments, write-offs, notes, recurring rent/subscriptions and some deleted items, through the real mutations.
  2. Same seed gives the same data; adding twice does not duplicate; "Remove demo data" removes exactly what it added.
  3. Generation of the full set takes under 10 s on web and the app stays responsive (batched transactions); every screen stays within § 26.10 budgets with it loaded.
  4. Production builds contain no path to it.

### F-228a Demo mode switch with its own database `spec: owner § 26.1 (decisions 94, 95)`

Demo is a Settings > Data switch, not data added to the current account: demo mode opens its own separate local database seeded with the one demo dataset, and switching back returns to the untouched real data. Done after the Wave B merge: every e2e spec turns it on through the test hook.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** merged into integrate/wB 2026-10-29 with the Wave B demo additions (web verified, native not yet run; sync `demoLarge.test`; client `demoSeed.test` (both engines), `rules.test` `demoStaticImport`, `syncState.test`; e2e `demo-mode.spec`, `demo.spec`, every spec through `openDemo`; perf `schema-v2.spec` "demo switch") · **Deps** F-227, F-117, Wave B merged
- **Measured** (web, Chrome, 1440 px, median of 5, `pnpm perf schema-v2`, m1-foundation vs this branch on the same machine): Home cold open on the large demo set 44 vs 48 ms (the set grew from 1,499 to 1,599 expenses and 30 to 39 friends, 3 of them the private friends of the invites flow; opening the demo database adds about 2 ms), on 10,000 expenses in real mode 54 vs 53 ms; write + UI 16 vs 16 ms; switching demo mode on or off to Home holding its figures 24 / 25 ms. Re-measured after the invites data and the swap changes (1 run of `pnpm perf`, machine under load): seeding the set (first switch on, open + seed + adopt) 1,544 ms, large set Home cold open 49 ms, 10,000 expenses 48 ms, adopt to Home holding its figures on / off 24 / 29 ms after the other store is open (budget 100 ms).
- **Prefs** `demo.mode` (device, default off; stored in the real database, the switch's only footprint there)
- **Acceptance**
  1. Settings > Data > "Demo mode" switch; on: the store opens a separate database (IndexedDB name / SQLite file `splito-demo`), seeds the one demo dataset once, and every screen reads it; off: the real database comes back exactly as it was (test: real rows, prefs, history and outbox byte-identical before and after a demo session with edits).
  2. Demo mode has its own preferences, history and outbox; nothing it does reaches the real database or any sync queue; it never syncs or merges.
  3. While on, a persistent "Demo mode · Switch back" banner on every screen (Bluesky Admonition), and the avatar sync dot reads "Demo"; "Reset demo" reseeds; a reload keeps the mode.
  4. The URL switches, the `EXPO_PUBLIC_` demo variables, `demoPending` and Add/Remove demo data are removed; one dataset folds in every case the small set covered, multi-currency (§ 26.13).
  5. e2e turns demo mode on through a test-only hook calling the same switch; every spec's `openDemo` uses it; full suite green; screenshot scripts updated.
  6. Production builds ship no demo code or switch (`demoStaticImport` stays green).
  7. The one set carries the whole invites flow (requests received and declined; invites sent as Sent / Opened / Joined / Expired / Cancelled; private friends, one linked on joining; friend and group links active, unlimited, used up, expired, revoked; group links needing approval that people opened; matching Activity rows), and `demoCoverage.test` fails when any user-facing feature, these included, has no record. "Opened" is a pending invite whose personal link has a use (stand-in until F-2105; that link allows 3 uses so it does not read "Used up"), and a "join request" is a use of an approve-each-join group link (stand-in until F-2105): the model has no separate record for either until the server exists. The invites block is redone on open once its marker is older than 14 days, and its links expire after 30 to 60 days, so the states do not go stale.
  8. A store swap (on, off, reset) runs behind a blocking "Setting up the demo" dialog and, when the new store is adopted, closes open sheets and dialogs and returns to the first tab, so nothing typed under the old store lands in the new one. A start with `demo.mode` on whose database will not open logs it, turns the mode off in the real database, shows the real data and a toast. The directory and the device-key scope change only when a store is adopted. The banner is drawn once by the shell above every screen. The demo store is marked never-sync (`sendableOps`). Dev and e2e builds purge once the `demo-large-` rows older builds wrote into the real database.
  9. Owner 109: a `demoCoverage` test lists every user-facing feature and asserts the seeded demo database has a record exercising it; after the Wave B merge the dataset gains the Supper Factory bill (F-403), comment threads, reminders, inactive and hidden groups, deleted items in place (one hidden), left members and an admin handover, so every Wave B feature is visible in demo mode.

### F-228 Native hardware-keyboard shortcuts (Cmd/Ctrl+K) `spec: owner § 26.3 decision 75`

Cmd/Ctrl+K toggles the Search & Ask drawer on iPad and Android with a hardware keyboard (web already done in F-222).

- **Effort** S · **Impact** 4 · **Backend** no · **Status** todo · **Deps** F-222
- **Prefs** -
- **Acceptance**
  1. A key-command module (passes the § 2 dependency gate) delivers Cmd+K / Ctrl+K app-wide on iOS and Android; it toggles the drawer, Escape closes it.
  2. Verified on the iPad simulator and an Android emulator with a hardware keyboard.

### F-226 Feedback: Send feedback and "Your feedback" `spec: owner § 26.15`

Bluesky's placement: a "Feedback" item in the drawer and the shared footer links, and a Settings "Support" section (Send feedback, Your feedback, Help, About). Feedback is kept on the device, with an email fallback, until the backend endpoint (F-2112).

- **Effort** M · **Impact** 7 · **Backend** no · **Status** done (feat/wA-34; Feedback leads the shared footer links on the sidebar and the drawer) · **Deps** F-201, F-205
- **Prefs** `shakeToFeedback` (device, default off), `feedback.includeAppInfo` (device, default on; remembers the sheet's switch)
- **Acceptance**
  1. "Feedback" opens from the drawer and from the footer links of the sidebar and drawer; Settings has a "Support" section with Send feedback, Your feedback, Help and About; under 1300 px desktop reaches them through the drawer and Settings.
  2. "Send feedback" opens a FormSheet (bottom drawer on phones, centred popup on desktop): type chips Bug / Idea / Question / Other, a required message, an optional screenshot or photo, an "Include app info" toggle (default on: version, platform, OS, language, current screen; never amounts, names, notes or receipts) with the sheet showing exactly what is attached, and an optional reply email (prefilled once signed in).
  3. Until the backend endpoint exists, Send saves the feedback on the device (status "Saved on this device") and offers "Send by email" (a prefilled draft to `FEEDBACK_EMAIL`, a release-checklist item); opening the draft is never shown as sent. Once F-2112 ships, feedback goes through the outbox.
  4. "Your feedback" lists every sent item with its status; "Shake to send feedback" (phones, default off) opens the sheet.

### F-229 Focus mode and attention markers on Home and Groups `spec: owner § 26.1 best of both (Expensify)`

Expensify's priority mode and left-hand-nav attention markers (`src/pages/settings/Preferences/PriorityModePage.tsx`, `src/libs/SidebarUtils.ts`, `src/components/LHNOptionsList/OptionRowLHN`) on Splito's Friends and Groups lists. Each list has a mode: "Most recent" (every row, current sort) or "Focus" (only rows that are unsettled in any currency, changed since I last opened them, or pinned once F-221 ships, then a "Show all N" row). Rows with unseen changes show a bold name and Bluesky's unread dot; rows that need me carry a short text marker ("You owe", "Review"); rows with a failed sync show "Needs attention" from the per-row `syncStatus` (ARCHITECTURE § 9.8). When a list passes 20 rows Splito offers Focus once, with Undo, as Expensify does.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-206, F-1201
- **Prefs** `peopleListMode`, `groupsListMode` (most recent | focus; default most recent), `listUnseenMarkers` (default on), `listMode.focusOffered` (device)
- **Acceptance**
  1. Focus hides settled rows without unseen changes and ends with "Show all N"; switching mode keeps search and filters; overview cards still count every row (figures before filters, ARCHITECTURE § 9.6).
  2. Opening a person or group clears its unseen marker; my own changes never mark a row unseen.
  3. No marker is colour alone: each has text and an accessibility label (F-1801).
  4. The once-only Focus offer appears at 21 or more rows and never again after Undo or a manual choice.
  5. bun tests for the Focus predicate (unsettled per currency, unseen since last opened, pinned) and the unseen tracker; Playwright on phone and desktop with the large demo set (F-227).

### F-230 "For you" to-do card on Home and the right column `spec: owner § 26.1 best of both (Expensify)`

Expensify Home's "For you" section and Inbox "To-do" tab (`src/pages/home/ForYouSection`, `src/pages/inbox/sidebar/InboxTabSelector.tsx`), rebuilt as one Bluesky card at the top of Home (under the Overview) and as the first right-column section on wide web: the next things only I can do, each one tap away. Sources, each shown once its feature exists: settle with the person I owe most, per currency (F-1101); friends to remind (owe me and past the reminder policy age, F-1118, F-1111); unfinished drafts (F-320); scans and captures to review (F-503); possible duplicates (F-504); held or disputed expenses (F-1210); recurring bills due (F-306); Remind me items due (F-1119); payments to confirm (F-2207); sync items needing attention (F-2109). At most 3 rows, then "See all (N)"; each row has Snooze (1 day / 7 days). An empty list hides the card.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-207, F-1101, F-1118, F-224
- **Prefs** `home.forYou` (on), `home.forYou.sources` (every source on), `home.forYou.maxRows` (3), `rightColumn.forYou` (on)
- **Acceptance**
  1. A pure `forYouItems(store, today)` selector in `packages/sync` with bun tests per source, ordered by money at stake per currency, then age; it never sums currencies.
  2. It reads projections and indexes only (balances, `bySyncStatus`, drafts), never the whole ledger (measured with the large demo set).
  3. Every row's action opens the existing flow pre-filled (Settle, Remind share sheet, draft, Review Inbox, duplicate review); finishing it removes the row live.
  4. Per-source toggles and snoozes live in Settings > Home; the card can be hidden and reordered with the other Home cards (F-1703).
  5. Playwright: demo data shows Settle and Remind rows on phone Home and in the right column at 1440 px; a snoozed row stays hidden after reload until the snooze ends.

### F-231 Getting started checklist with milestone toasts `spec: owner § 26.1 best of both (Bluesky + Expensify)`

Bluesky's ProgressGuide (`src/state/shell/progress-guide.tsx`, `src/components/ProgressGuide/`) with Expensify's guided setup tasks (`src/libs/buildOnboardingMessages.ts`, `src/pages/home/GettingStartedSection`). A dismissible "Get started" card, first on Home and in the right column, with five tasks checked off automatically: add a friend, add your first expense, create a group or trip, add your payment handle (F-1106; skipped until it exists), settle up once. A progress bar and avatar slots fill with the friends added (Bluesky `List.tsx`); each completion shows Bluesky's milestone toast with `AnimatedCheck`. Finishing or dismissing ends it.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-201, F-1704
- **Prefs** `gettingStarted.enabled` (on), `gettingStarted.state` (device: active / done / dismissed)
- **Acceptance**
  1. Completion is derived from the store (counts), never from button taps, so an imported backup completes the tasks it satisfies.
  2. A device that already has a friend, an expense and a group when this ships never sees the card; demo builds show it only after "Show getting started again".
  3. Toasts honour reduced motion (static check) and are announced politely; the card is an inline card, never a dialog (ARCHITECTURE § 10).
  4. Settings > Help has "Show getting started again".
  5. bun test for the task derivation; Playwright fresh install completes every task and the card leaves.

### F-232 Swipe actions on friend, group and expense rows `spec: owner § 26.1 best of both (Bluesky)`

Bluesky's `GestureActionView` (`src/lib/custom-animations/GestureActionView.tsx`, used in `src/screens/Messages/components/ChatListItem.tsx`) on Home friend rows, Groups rows, a group's expense rows and Person history rows. Defaults: friend row left = Settle up, right = Remind (only when they owe me); group row left = Settle up, right = Archive (Pin once F-221 ships); expense row left = Delete (undo toast), right = Comment (Duplicate once F-309 ships). Swipes are shortcuts only: every action stays in the row menu and long-press (F-1803). Activity rows keep their own swipe prefs (F-1201).

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-206, F-208, F-1118, F-1201
- **Prefs** `swipe.enabled` (on), `swipe.friendLeft`, `swipe.friendRight`, `swipe.groupLeft`, `swipe.groupRight`, `swipe.expenseLeft`, `swipe.expenseRight` (each an action or off; mirrored by F-213 handedness)
- **Acceptance**
  1. Copied with its attribution header and reuse row; the threshold haptic uses `useHaptics` (`threshold`); gesture-handler is not imported on web, where the same actions show in the row menu and on hover.
  2. Swipe actions are siblings of the row's Pressable (ARCHITECTURE § 2); a destructive action always gets the undo toast.
  3. Every swipe action is also an accessibility action and a row-menu item.
  4. Swipes do not fight the drawer edge-swipe (Bluesky `BlockDrawerGesture`) or vertical scroll; 60 fps on 1,000 rows, profiled and recorded.
  5. iOS simulator and Android emulator runs recorded; Playwright covers the web menu fallback.

### F-233 Tap the active tab to scroll to top; pull to refresh `spec: owner § 26.9 re-tap, ARCHITECTURE § 9.3 pull-to-refresh`

Bluesky's soft reset (`emitSoftReset` in `src/view/shell/bottom-bar/BottomBar.tsx`, listeners via `src/state/events.ts`) and the refresh props of its `List` (`src/view/com/util/List.tsx`). Tapping the active bottom-bar or sidebar item scrolls that page's list to the top and shows the minimal-shell header; tapping again at the top refreshes. Pull to refresh on Home, Groups, Group, Person and Activity calls one `syncNow()` (ARCHITECTURE § 9.3): it refreshes FX rates when online and, once signed in, drains the outbox and pulls; offline or signed out it ends at once with the status label.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-201, F-203
- **Prefs** `tabReselect` (scroll to top | off; default scroll to top), `pullToRefresh` (on)
- **Acceptance**
  1. Re-tap scrolls with animation (instant under reduced motion) on every top-level page.
  2. Re-tap at the top runs the same refresh as a pull.
  3. Refresh never shows an error toast offline and never shows "Synced" before an acknowledgement (ARCHITECTURE § 9.1).
  4. Playwright: scroll Home, tap Home, the list is at offset 0; native pull checked on the iOS simulator.

### F-234 Hover cards for people and groups on web `spec: owner § 26.1 best of both (Bluesky)`

Bluesky's `ProfileHoverCard` (`src/components/ProfileHoverCard/index.web.tsx`: opens after 500 ms, closes 150 ms after leaving) on desktop web. Hovering a person or group name or avatar (lists, Activity, expense participants, right column) shows avatar, name, balance per currency with me, last activity, and Add expense / Settle up / Remind. Touch and keyboard users get no card; tapping or Enter navigates as today.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-207, F-208
- **Prefs** `hoverCards` (device, on)
- **Acceptance**
  1. Copied with Bluesky's delays; native resolves to a no-op twin.
  2. The card mounts on open only and reads balances from the projection, never the ledger.
  3. Buttons open the normal sheets pre-filled; Escape closes; screen readers skip the card (its content is on the page already).
  4. Playwright at 1440 px: hover a friend, the card shows the balance and buttons; leaving closes it.

### F-235 FAB long-press quick menu with Quick action `spec: owner § 26.1 best of both (Expensify)`

Expensify's create menu and Quick action (`src/pages/inbox/sidebar/FloatingActionButtonAndPopover.tsx`, `.../FABPopoverContent/menuItems/QuickActionMenuItem.tsx`, `src/libs/QuickActionUtils.ts`), kept off the tap: tapping the FAB still opens Add expense (§ 26.6). Long-pressing it opens a Bluesky Menu (bottom sheet on phones): Quick action "Add expense in <last group>" or "with <last person>", Scan receipt (once F-501 ships), Record payment, Create group, Invite people. On rail and desktop the same entries are in the command palette (F-1407); the sidebar pill stays Bluesky's `ComposeBtn` (§ 26.5).

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-201, F-205
- **Prefs** `fab.longPressMenu` (on), `fab.quickAction` (on), `fab.menuItems` (order and visibility)
- **Acceptance**
  1. Tap behaviour is unchanged (e2e); long-press opens the menu with the `longPress` haptic; the FAB exposes the menu as an accessibility action.
  2. Quick action names the last group or person of an expense saved on this device and opens Add expense pre-filled; it hides when there is no history or that group is archived or left.
  3. Menu items are reorderable and hideable in Settings > Navigation (same list component as F-209).
  4. Long-press checked on iOS and Android; Playwright long-press on mobile web.

### F-236 Troubleshoot: diagnostics, repair and caches `spec: owner § 26.1 best of both (Expensify + Bluesky), ARCHITECTURE § 16.3 Diagnostics`

Expensify's Troubleshoot page (`src/pages/settings/Troubleshoot/TroubleshootPage.tsx`) with Bluesky About's system log and clear image cache (`src/screens/Settings/AboutSettings.tsx`), for a local-first app whose data support cannot see. Settings > Help > Troubleshoot shows storage engine and schema version, rows per store, outbox depth per status and recent errors, with "Rebuild balances" (runs `rebuildProjections()` and reports differences), "Clear image cache", "Share diagnostics" and the app version and build.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1701, F-117
- **Prefs** -
- **Acceptance**
  1. Rebuild balances is idempotent, runs in chunks with no JS long task over 50 ms on the large demo set, and reports "No differences" or what it corrected.
  2. A bun test fails if the diagnostics JSON contains any amount, name, note, title or receipt field (ARCHITECTURE § 16.1).
  3. Clear image cache never deletes an attachment that is not uploaded or backed up (ARCHITECTURE § 13).
  4. Playwright: open Troubleshoot, rebuild, share diagnostics (download on web).

## E3 Expenses and composer

Adding, editing and entering expenses fast.

### F-301 Expense add / edit / delete / undo `spec v1`

Personal, direct and group expenses with title, amount, currency, any date (future = "upcoming"), category, payers, participants, notes; edit history; tombstone delete with undo.

- **Effort** L · **Impact** 10 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-103
- **Prefs** `defaultCurrency`, `defaultSplitMode`, `defaultPayer`
- **Acceptance**
  1. Editing keeps the prior version in history; delete is a tombstone with Undo.
  2. A future date shows the "upcoming" label.
  3. p95 local save under 100 ms recorded in COMPLETION_MATRIX.

### F-302 Split editor, inline calculator, remaining readout, persistent drafts `spec v1 + 4b`

Equal, exact, percent, shares and equal-with-adjustments; calculator in the amount field; live remaining; drafts survive close.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-301
- **Prefs** `defaultSplitMode`
- **Acceptance**
  1. Typing 1200+340 in the amount evaluates exactly to 1540.
  2. Save stays disabled until remaining is zero.
  3. Killing the app mid-entry and reopening restores the draft.

### F-303 Refunds and reversals `spec v1`

A refund linked to an expense flows back per the original split (or a chosen one); a reversal is an explicit negating entry.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. A 300 refund on a 3-way expense reduces each share by 100.
  2. Refunds never show as negative spending in reports.
  3. A refund in another currency requires an explicit rate.
  4. A refund records who received it, which may differ from the original payer, and partial refunds of one expense add up without exceeding it.

### F-304 Money-in entries (group income) `spec v1 refunds (extended)`

Income received by one member (landlord refund, cashback, sublet, sold appliance) split back to members by a rule.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. 900 received by A and split 3 ways leaves A owing B and C 300 each.
  2. Reports list it as income, never as negative spending, and keep it apart from repayments.

### F-305 Saved split templates `spec v1`

Name a split ("Flat 40/30/30"), apply in one tap, edit and delete.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-302
- **Prefs** -
- **Acceptance**
  1. Applying "40/30/30" to 1000 gives 400/300/300 exactly.
  2. A template that names a removed member warns and drops them.

### F-306 Recurring expenses: fixed, variable, estimate then true-up `spec v1`

Rules with due day (month-end clamp), skip, pause, end date, "amount changes from", participant subset; variable bills create an "enter amount" draft; estimate posts and trues up; generated on device.

- **Effort** L · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-107, F-301, F-1907
- **Prefs** `recurring.variablePrefill`, `notify.recurring`
- **Acceptance**
  1. A rule due on the 31st posts on 28 Feb or 29 Feb.
  2. A variable bill never posts until an amount is entered (prefilled with last or 3-month average).
  3. "Amount changes from 1 Jan" leaves earlier instances unchanged.
  4. Two devices generating the same period produce one record.
  5. A rule whose start date is in the past offers to back-fill the missed instances as one reviewed, undoable batch.

### F-307 Category and emoji auto-suggest `spec 4b v1`

Offline keyword map suggests a category and an emoji from the title; an override for that title is remembered.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `autoSuggestCategory`, `expenseEmoji`
- **Acceptance**
  1. "Uber to airport" suggests Transport and a taxi emoji in airplane mode.
  2. Overriding once makes the same title use the override next time.

### F-308 Guest participants `spec v1`

One-off people on a single expense without adding them as friends; promote to friend later.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. A guest appears only on that expense and its balances.
  2. Promote to friend keeps the history attached.

### F-309 Rapid entry: save and add another, duplicate, repeat last

Save and add another keeps group, payer, participants, split, currency and date; Duplicate; Repeat last in this group; session counter.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `composer.stickyFields`, `composer.advanceDate`
- **Acceptance**
  1. Save and add another clears title and amount and refocuses the amount field.
  2. The counter shows "7 added, INR 18,450" per currency.
  3. Which fields stay sticky is configurable.

### F-310 Smart amount input

Accepts locale separators, Devanagari / Arabic-Indic / Persian digits, a 000 key, k / L / cr / m suffixes and pasted "₹1,20,000.50"; ambiguous input asks.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** done (built and tested on a feat/b-* branch, unmerged) · **Deps** F-302
- **Prefs** `numberLocale`, `amount.shorthand`
- **Acceptance**
  1. "1.5L" gives 150000.00 INR and "2k" gives 2000.
  2. "१२००" gives 1200 and "1.234,56" under de-DE gives 1234.56.
  3. "1,234" in a comma-decimal locale shows a which-did-you-mean prompt.

### F-311 Amount typo and anomaly guard

Non-blocking "Did you mean 250?" when an amount is far above the usual for that title/category or looks off by a zero.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `anomalyGuard`, `anomalyGuard.multiplier`
- **Acceptance**
  1. "Coffee 2,500" with a usual 250 shows a one-tap fix.
  2. The guard never blocks Save and can be turned off.

### F-312 Attachments `spec v1`

Photos, PDFs and text on any expense: preview, open, add/remove recorded in history, configurable size and type limits, stored locally until sync. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Viewing uses Bluesky's Lightbox (`src/components/Lightbox/`: pinch zoom, swipe to dismiss, a pager across all of the expense's attachments, share and save) with Expensify's receipt actions (replace, download, PDF pages; `src/pages/media/`) and its web hover-zoom (`src/components/ReceiptHoverZoom/index.web.tsx`). Each attachment can carry a description read by screen readers (Bluesky alt text).

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `attachments.maxMB`, `attachments.types`, `attachments.hoverZoom` (device, on)
- **Acceptance**
  1. Wrong type or oversize is rejected with the reason.
  2. Adding and removing an attachment appears in history.
  3. Works fully offline.
  4. EXIF GPS is stripped on import by default (full redaction tools come with F-1608).
  5. The viewer pages through every attachment of the expense with pinch zoom and swipe to dismiss (a fade under reduced motion), with Replace, Download and Delete; PDFs page inside it.
  6. On desktop web, hovering a receipt thumbnail shows a magnified preview after 300 ms.
  7. An attachment description, when set, is its accessibility label.

### F-313 Location `spec v1`

Editable manual place; optional permission-aware automatic location; place search and optional map when online.

- **Effort** M · **Impact** 4 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `location.auto`
- **Acceptance**
  1. Permission denied falls back to manual entry.
  2. Location is captured only when the user asks.

### F-314 Three-tap add with sentence defaults

The composer opens with the amount keypad focused and context defaults: from a group, its current members, currency and default split; from a person, a direct expense with them; from People, a "With whom?" chip. One sentence chip ("Paid by you, split equally") opens the split editor; the title is optional (category or emoji stands in). Target: FAB, amount, Save.

- **Effort** M · **Impact** 10 · **Backend** no · **Status** todo · **Deps** F-302
- **Prefs** `fab.action`, `composer.titleRequired`
- **Acceptance**
  1. From a group page, FAB, typing 450 and Save records an equal split among current members paid by me in 3 taps plus digits (tap count asserted in Playwright and Maestro).
  2. From a person page the expense is direct with that person; an empty title saves as the category name.
  3. `fab.action` chooses what a FAB tap opens; options appear as their features ship (scan, quick add).

### F-315 Optional time of day on expenses

An optional local time on an expense (off by default, auto-filled for captures) that orders same-day expenses and feeds trip day views.

- **Effort** S · **Impact** 4 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `composer.showTime`, `timeFormat`
- **Acceptance**
  1. Untimed expenses sort after timed ones on the same day; the local date never shifts.
  2. Time shows in the chosen 12/24 h format and exports as its own CSV column.

### F-316 Favourite expenses: one-tap tiles

Star any expense as a favourite ("Milk 60", "Auto to office 120 with Sam"); tiles on the group page and in the composer re-create it dated today in one tap.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-309
- **Prefs** `group:favourites`
- **Acceptance**
  1. A tile tap saves at once with a success toast and Undo; long-press opens it in the composer first.
  2. A tile naming a removed member opens the composer instead of saving.
  3. Tiles can be reordered, renamed and hidden per group.

### F-317 Quick split by headcount

Split a total among N people without naming anyone: each share, rounding and a pay-me QR at once; Save later turns the seats into guests or picked friends.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-302, F-308, F-1105
- **Prefs** -
- **Acceptance**
  1. 1000 among 3 shows 334 / 333 / 333 with the same allocate() rounding as saved expenses.
  2. Nothing is stored until Save.
  3. Reachable from the composer and from the empty People screen.

### F-318 Move an expense to another group, a friend or non-group `spec: owner § 26.1 best of both (Expensify track and move)`

Expensify lets people track an expense first and share it later, and move expenses between reports (`src/pages/TrackExpensePage.tsx`, `src/libs/actions/IOU/TrackExpense.ts`, bulk "move" in `src/components/BulkActionBar/`). In Splito, "Move to…" on the expense overflow (and in bulk, F-1405) picks a group, a friend (direct) or "Just me". A preview shows the balance effect per person and currency before confirming; people not in the target are flagged and the split is re-chosen (ARCHITECTURE § 5). After saving a personal expense, the success toast offers "Share it" (Expensify's track whisper).

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-301, F-603
- **Prefs** `expense.offerShareAfterPersonal` (on)
- **Acceptance**
  1. A `moveExpense` mutation updates the expense, `expense_parties`, the balance projection, history ("moved from Goa trip to Flat") and the outbox in one transaction; Undo restores it exactly.
  2. Moving into a group where a participant is not a member asks to add them or re-split; a share is never dropped silently.
  3. The preview equals the balances after the move (bun property test over random moves).
  4. Activity shows the move for the source and the target.
  5. Playwright: move a personal expense into a group; both pages update.

### F-319 Split one expense into several `spec: owner § 26.1 best of both (Expensify split expense)`

Expensify's split expense (`src/pages/iou/DynamicSplitExpensePage.tsx`, `DynamicSplitExpenseCreateDateRangePage.tsx`, `src/libs/SplitExpenseUtils.ts`). "Split into parts" on the expense overflow turns one expense into two or more by Amount, Percentage or Date range (one part per day or month across a range, such as an annual bill into 12 months), each part with its own title, category, group or friend and split; "Make even" and a live exact remaining readout. The original is replaced by its parts in one undoable change; history links them ("split from Big Bazaar 4,820"). Itemized bills also offer "Split by items".

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-302, F-318
- **Prefs** `splitParts.defaultMode` (amount)
- **Acceptance**
  1. Domain `splitIntoParts(amount, mode, input)` with bun tests: conservation for amount, percent (basis points) and date range (by days, month-end clamp), including JPY (scale 0) and BHD (scale 3).
  2. Save stays disabled until the parts sum exactly to the original; the remaining readout follows § 26.8.
  3. One mutation tombstones the original and creates the parts with a shared `splitFromId`; Undo restores the original and removes the parts.
  4. "Split by items" makes one part per item or item group of an itemized bill (F-401).
  5. Playwright: split 4,820 into 1,200 personal and 3,620 for Flat; balances and Activity are right.

### F-320 Drafts: several unfinished expenses, Save as draft on close `spec: owner § 26.1 best of both (Bluesky drafts)`

Bluesky's composer drafts (`src/view/com/composer/drafts/DraftsButton.tsx`, `DraftsListDialog.tsx`, `DraftItem.tsx`) replace F-302's single silent draft per place. Closing a dirty Add expense shows § 26.8's "Discard changes?" prompt with three actions: Save as draft, Discard, Keep editing. A "Drafts (N)" button in the sheet's top bar lists saved drafts (title, amount, group, age; tap resumes, menu discards with "Discard draft? This draft will be permanently deleted."), and drafts appear in the For you card (F-230). Drafts never count (ARCHITECTURE § 5).

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-302, F-205
- **Prefs** `drafts.askOnClose` (on; off keeps today's silent single draft), `drafts.max` (20), `drafts.keepDays` (30)
- **Acceptance**
  1. Drafts live in device storage beside today's draft (MMKV natively, localStorage on web), never in balances, lists, search, analytics or CSV; today's per-place draft migrates to one saved draft.
  2. Closing by X, Cancel, scrim or drag offers Save as draft / Discard / Keep editing; nothing destructive runs from a drag.
  3. At the maximum, saving asks to discard the oldest; drafts older than the limit are removed with a one-line notice.
  4. Resuming restores every field, itemize portions and payers included; saving the expense deletes its draft.
  5. bun tests for the draft list and migration; Playwright: start two expenses, save both as drafts, resume and save one; the list shows one.

### F-321 Edit one field from the expense page `spec: owner § 26.1 best of both (Expensify MoneyRequestView)`

Expensify's expense view makes every field a row that opens just that field (`src/components/ReportActionItem/MoneyRequestView.tsx`, `src/libs/ModifiedExpenseMessage.ts`). Splito's expense page rows (amount, title, date, category, paid by, split, group, notes, time, attachments) open the matching editor sheet, the same editors as the composer (ARCHITECTURE § 4, editors don't write). Save writes one update with only the changed field (§ 5), and history records the change (worded "changed the date from 3 Oct to 4 Oct" once F-1202 ships, shown in the F-1204 timeline). The header's Edit still opens the full sheet.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-301, F-205
- **Prefs** -
- **Acceptance**
  1. Each row has a chevron and the label "Edit <field>"; rows are read-only on deleted expenses and on expenses locked by a checkpoint (F-1205 once built).
  2. Changing the amount or currency opens the split editor when the split would no longer balance; an unbalanced expense is never saved.
  3. The mutation payload holds only the changed field and the base version (bun test).
  4. Playwright: change the category from the expense page in two taps; the history line appears.

## E4 Itemize and receipt splitting

Splitting a bill line by line, fairly.

### F-401 Itemized bill with portions, tax, tip, service and discount `spec: owner § 26.13`

An expense is one amount or a bill of items, each with a name, an amount and who had it; tapping a chip again adds a portion; an "Everyone" shortcut; items reorder and delete. Tax, tip, service charge and discount are always visible, each with an amount / % toggle.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-302
- **Prefs** `itemizeAdjustmentModes`
- **Acceptance**
  1. Tapping a person's chip again adds a portion (x2, x3); long-press or right-click resets. Domain `SplitInput` item participants carry integer weights (a plain string = weight 1), allocated exactly with bigint `allocate` and a stable tie-break; bun tests cover conservation and 2 of 3 beers.
  2. Tax, tip, service charge and discount are visible by default and each has a segmented "<currency> | %" toggle, remembered per kind in `itemizeAdjustmentModes` (defaults: tax %, tip %, service %, discount amount). Percentages take up to 2 decimals and are stored as integer basis points.
  3. Order: discount on the items subtotal; then service charge and tax on the discounted subtotal; then tip on the discounted, pre-tax subtotal (said in the UI help text). Percent-to-money happens only in `packages/domain` (bigint, round half away from zero to the currency's minor unit), then each adjustment is spread pro rata over each person's weighted item subtotal. Bun tests include JPY (scale 0), BHD (scale 3), 18 % GST on INR, 12.5 % service and 15 % discount.
  4. The "remaining to assign" readout and the total stay exact; Save is disabled until everything is assigned.
  5. Expense detail lists every item with its people and portions, each person's resulting share, and adjustment lines ("Tax 18% - INR 216.00").

### F-402 Cash rounding with visible remainder

Round shares to 1 / 5 / 10 units per group or expense and transfers to 10 for cash payers; the leftover shows as a carried line or an explicit adjustment entry.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** done (built and tested on a feat/b-* branch, unmerged) · **Deps** F-101
- **Prefs** `split.roundTo`, `group:roundTo`, `person:prefersCash`
- **Acceptance**
  1. 1000 over 3 rounded to 1 gives 334/333/333 with no paise.
  2. Conservation holds: the remainder is shown, never lost.
  3. A friend marked "prefers cash" gets transfers rounded to 10.

### F-403 Tax classes and scoped, stacked charges `spec: owner § 26.13 (decision 86)`

One bill, different taxes per item: items carry a tax class; charges (service, tax, packing, delivery, other, discount) form an ordered list, each % or fixed, applying to all items, chosen classes or chosen items, optionally stacking on earlier charges; each charge is spread only over the people who had its items; a round-off line and a reconciliation row tie the split to the printed total. Replaces the India-only "GST-aware bill lines" item (CGST/SGST/IGST, liquor VAT, packing and round-off are now presets of this). Neither Expensify (one tax rate per expense) nor Splitwise (one overall tax/tip) handles this, so the domain logic is Splito's own (§ 26.1 best of both: Expensify's tax-rate picker UI pattern, Bluesky components).

- **Effort** L · **Impact** 9 · **Backend** no · **Status** in progress (built and verified on feat/wB-B7, integrated on integrate/wB, not yet in m1-foundation; 2026-10-29: pnpm check green, 331 domain / 236 sync / 232 client tests, Hindi 1,392 messages 0 missing; full e2e 230 tests, charges.spec at phone and desktop incl. the 2,522.00 Supper Factory bill and desktop focus return to Add charge; perf on 10,000 expenses: cold open Home 55 ms, write and UI 16 ms, search 15-25 ms, large demo add 4.2 s; Opus review minors 1-9 fixed); acc 8 waits for F-501 / F-502; the export and share-text half of acc 5 is Wave C · **Deps** F-401
- **Prefs** `bill.taxClasses` (account; default Standard, Food, Soft drinks, Alcohol, Other; add, rename, reorder, hide), `bill.chargePresets` (account; default Simple, Restaurant India, Restaurant EU, US tip), `bill.defaultPreset` (account; default Simple), `bill.serviceChargeDefault` (account; default off), `bill.roundOffSpread` (account; default pro rata to every share, or to the payer), `bill.rememberPerMerchant` (account; default on), `bill.merchantSetups` (account; 200 most recent, written by Save as preset)
- **Acceptance**
  1. Domain (bun, bigint, both directions): the owner's sample bill (The Supper Factory, 02/06/2007; food 1,611.00 in 8 lines, alcohol 400.00 in 2 lines; Service 10% all items, stacks: no; VAT 12.5% on Food, stacks on service; VAT 20% on Alcohol, stacks on service) computes 201.10 / 221.51 / 88.00, total 2,521.61, round-off +0.39 to 2,522.00 exactly; conservation holds for every person; a person with only food pays 0 of the 88.00 and 0 of the 40.00 service on alcohol.
  2. Property test over random bills (classes, scopes, stacking order, % and fixed charges, discounts, inclusive taxes, portions, JPY / INR / BHD scales): per-person shares sum exactly to the total; each charge lands only on people who had items in its scope; reordering non-stacking charges never changes the result.
  3. Itemize editor: a class chip per item (long-press / right-click to change, multi-select to set many), a Charges section with drag-to-reorder rows, each opening a sheet (name, kind, % or amount, applies to: All / classes / items, stacks on earlier charges, prices include this tax); bottom drawer on phones, centred popup on desktop; Bluesky components only.
  4. Reconciliation row "Items 2,011.00 + Service 201.10 + VAT 12.5% 221.51 + VAT 20% 88.00 + Round-off 0.39 = 2,522.00"; when an entered printed total disagrees, the gap is shown in red with "Add as round-off" (if within the currency's round-off limit) or "Check items"; Save explains, never hides, a gap.
  5. Expense detail lists items grouped by class, each charge line with its scope ("on Alcohol + service"), and per person: items, each charge share, round-off, total; the same breakdown is in export and share text.
  6. Presets apply in one tap; "Save as preset for The Supper Factory" stores the setup; next time that merchant is chosen the preset is pre-filled as a dashed suggestion (accept with one tap).
  7. Existing expenses with one overall tax/tip/service/discount load unchanged (migration test): they become the Simple preset with every charge on all items.
  8. Receipt scan (when F-scan lands) maps line markers (`*`, `#`, "A", "B") and tax lines ("VAT @12.50", "CGST 2.5%") to classes and charges for review.
  9. Full checks green (typecheck, lint, arch rules, domain/sync/client tests, e2e with this exact bill on phone and desktop, Hindi 0 missing); screenshots of editor and detail in light and Dim.

### F-404 Item memory and shared-item defaults

Remember who had what at a merchant and pre-assign as dashed suggestions; sharing items (nachos, water, pitcher) default to Everyone.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-401
- **Prefs** `itemMemory`
- **Acceptance**
  1. The next bill at the same merchant shows remembered items as suggestions to confirm.
  2. Memory can be cleared and turned off.

### F-405 Line-item cleanup

"3 x Beer 450" expands to 3 units; modifier lines fold into their parent; zero-price lines drop; tax-inclusive receipts are not taxed twice; CGST + SGST merge.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-401, F-502
- **Prefs** -
- **Acceptance**
  1. "3 x Kingfisher 450" becomes 3 units of 150 that can be portioned.
  2. A "prices include GST" receipt adds no extra tax.
  3. A table of real receipt line fixtures passes.

### F-406 Receipt math checker `spec v2 (extended)`

After OCR, check items + tax + service + tip - discounts = printed total; rank likely misread lines and offer one-tap fixes.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-502
- **Prefs** -
- **Acceptance**
  1. A mismatch shows "Off by 50.00" with ranked culprit lines.
  2. Fixes: change an item, add a difference item, treat the gap as service charge.

### F-407 Tap-the-receipt painter assignment

Assign items by picking a person as a brush and tapping or dragging over lines on the receipt photo.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-401, F-502
- **Prefs** -
- **Acceptance**
  1. Tapping a line paints it in that person's colour; a second tap adds a portion.
  2. Shared lines show striped tints; running per-person totals update live.

### F-408 Delivery and ride e-receipt splitter

Templates for Swiggy, Zomato, Blinkit, Zepto, Uber, Ola, Airbnb, Booking.com screenshots and emails; fees, coupon and tip spread by remembered rules.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-502, F-509
- **Prefs** `receipts.feeRule`, `receipts.couponRule`, `receipts.tipRule`
- **Acceptance**
  1. The coupon is spread pro-rata to item subtotals.
  2. Fees split equally by default; the rule is editable and remembered.
  3. An unknown layout falls back to the generic OCR review.

### F-409 Ticket split with partial cancellation

Parse PNR, passengers and fares from IRCTC or airline confirmations; a cancellation records the refund minus the charge.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-303, F-509
- **Prefs** `group:cancellationChargePaidBy`
- **Acceptance**
  1. Cancelling 1 of 4 passengers posts a refund entry minus the charge.
  2. By default the canceller bears the charge; the policy is configurable.

## E5 Capture and automation

Getting expenses in without typing; every automated result lands in one review queue.

### F-501 Receipt scanner `spec v2`

Native document scanners (VisionKit, ML Kit Document Scanner), camera / library / file import, crop / rotate / replace, multi-page, batch mode. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's scan flow (`src/pages/iou/request/IOURequestStartPage.tsx`, `IOURequestStepScan/components/MultiScanContext.tsx`, `MultiScanEducationalModal.tsx`): Scan is a tab at the top of the Add expense sheet (Manual | Scan) and the last tab used is remembered; batch mode shows a thumbnail strip of captures with remove, and a one-time explainer the first time it is turned on.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-312
- **Prefs** `composer.lastTab` (device), `scan.batchDefault` (off)
- **Acceptance**
  1. Camera permission denied still offers library and file import.
  2. Batch-scanning 5 receipts creates 5 drafts.
  3. Captures made offline are kept as drafts.
  4. On web, dropping files onto the window or pasting an image creates drafts.
  5. Manual / Scan use Bluesky's TabBar inside the sheet; reopening the sheet opens the last tab used.
  6. In batch mode a thumbnail strip shows every capture with remove before finishing; the explainer shows once.

### F-502 On-device OCR with review `spec v2`

Apple Vision, ML Kit and WASM Tesseract read merchant, date, currency, total, items, tax and tip into an editable review; never auto-posts. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's SmartScan pending state (`src/libs/ReceiptUtils.ts`, `src/components/PulsingView.tsx`, `src/hooks/useRestartOnReceiptFailure.ts`): reading runs in the background, the draft shows "Reading receipt…" with a shimmer on the fields being read, the user can type meanwhile (typed fields win), and a failed read offers Retry or Enter manually.

- **Effort** L · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-501, F-401
- **Prefs** -
- **Acceptance**
  1. A10: a real photo and a PDF produce an editable review.
  2. Uncertain fields are highlighted and nothing saves without confirmation.
  3. Read time under 2 s offline on the target device, recorded.
  4. Fields typed during a read are never overwritten by its result; the shimmer stops when the read ends and rests under reduced motion.
  5. A failed or timed-out read keeps the photo and the draft, with Retry and Enter manually.

### F-503 Review Inbox for automated drafts

One "To review" queue for OCR, share-in, captures, due recurring items, imports and duplicate warnings, each with confidence and a "why" line.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `inbox.swipeConfirm`
- **Acceptance**
  1. The badge on FAB / Activity equals the number of pending drafts.
  2. Swipe right saves with predicted defaults (undoable); swipe left discards.
  3. Drafts survive restart.

### F-504 Unified duplicate detection `spec v2 (extended)`

One fingerprint (receipt image hash, UTR / RRN, order ID, fuzzy amount + date + title + people) on save and after merge; warns, never blocks. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's review-duplicates and merge flows (`src/pages/TransactionDuplicate/`, `src/pages/TransactionMerge/`, `src/libs/MergeTransactionUtils.ts`): a flagged expense shows "Possible duplicate · Review"; review shows the candidates side by side with Keep all or Merge; Merge asks only about fields that differ (amount, date, title, category, payer, split, receipt), then confirms with the balance effect.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. The same dinner logged by two people offline is flagged after merge.
  2. The same UTR recorded twice is flagged.
  3. "Not a duplicate" is remembered.
  4. Merge is one mutation: the kept expense takes the chosen fields, the other is tombstoned with history linking both, and comments and attachments move to the kept one; one Undo reverts it.
  5. The merge step asks only about differing fields; identical fields are kept silently.
  6. Possible duplicates feed the For you card (F-230) and the "Possible duplicates" view (F-1403).

### F-505 Attach-to-existing matcher and missing-receipt nudge

A scanned receipt that matches an expense without attachment offers "Attach to Hotel 12,000 (Mon)?"; expenses above a threshold nudge for a receipt.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-502
- **Prefs** `receipts.missingThreshold`
- **Acceptance**
  1. Accepting attaches the image and fills items without changing who paid.
  2. The missing-receipt list honours the threshold setting.

### F-506 Receipt currency and number-format auto-detect `spec v2 (extended)`

Infer currency from symbols, ISO codes, tax labels, address, phone prefix, active trip; parse every number style.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-502
- **Prefs** -
- **Acceptance**
  1. A receipt with "MwSt" and "1.234,56" reads as EUR 1234.56.
  2. An ambiguous "$" resolves from the active trip and shows a changeable chip.

### F-507 Quick add by text v2 `spec v2`

Offline parser for amounts (k, lakh, rs), relative dates, fuzzy people and nicknames, payer, split hints, group, several expenses per line, Hinglish; live parse chips; always reviewed.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-310, F-503
- **Prefs** `quickAdd.reviewAlways`
- **Acceptance**
  1. "Dinner 1200 with Riya and Sam" makes a 3-person equal draft.
  2. "petrol 2k kal" gives 2000, yesterday, with a date chip to confirm.
  3. Table-driven bun tests cover English and Hinglish.

### F-508 Push-to-talk voice add `spec v2 (extended)`

Long-press the FAB to dictate; on-device speech recognition (en-IN, hi-IN) feeds the quick-add parser.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-507
- **Prefs** `voice.language`
- **Acceptance**
  1. Dictation works offline where the OS supports on-device recognition and falls back to the text field.
  2. The result is a draft card, never a saved expense.

### F-509 Incoming share `spec v2`

iOS share extension, Android intent and Web Share Target (file import elsewhere); direct-to-group share targets; images, PDFs, text and URLs; drafts survive login and offline.

- **Effort** L · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-503
- **Prefs** -
- **Acceptance**
  1. Sharing a photo from Photos lands as an Inbox draft.
  2. An Android sharing shortcut "Splito - Goa trip" presets the group.
  3. An unsupported browser offers file import instead.

### F-510 Paste or share text into drafts `spec 4b (extended)`

Bank SMS, UPI alerts, email text and chat lines become a checklist of parsed rows sent to the Inbox.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-507
- **Prefs** -
- **Acceptance**
  1. Common Indian bank SMS formats parse amount, payee and date.
  2. A multi-line paste gives one row per detected expense.
  3. Unparsed text stays in the title, never lost.

### F-511 Payment-screenshot split (RRN-aware) `spec 4b`

UPI app screenshots: map UPI Ref / Transaction ID / UTR to one RRN; only "Success" accepted; payee VPA matched to a friend decides expense vs settlement.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-502, F-1106, F-509
- **Prefs** -
- **Acceptance**
  1. A pending screenshot becomes a parked draft.
  2. A payment to a friend's saved VPA proposes "Record as settlement".
  3. The RRN is the duplicate key.

### F-512 Payment notification and bank SMS capture (Android, opt-in)

NotificationListener for allow-listed payment and bank apps plus opt-in SMS, parsed on device into "Split this?" drafts.

- **Effort** L · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-510, F-1106
- **Prefs** `capture.notifications`, `capture.sms`, `capture.packages`
- **Acceptance**
  1. Only allow-listed packages are read; raw text never leaves the device.
  2. A payment to a friend's VPA suggests "Record as settlement with Riya?".
  3. Play policy declaration documented; notification path works if SMS is refused.

### F-513 Wallet tap to split draft (iOS Shortcuts)

An App Intent run by the Wallet transaction automation creates an Inbox draft and an actionable local notification.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1906
- **Prefs** `capture.walletFilter`
- **Acceptance**
  1. Guided setup installs the automation in one flow.
  2. The "only during trips / only these cards" filter suppresses other taps.

### F-514 Merchant dictionary and name cleanup `spec 4b (extended)`

Bundled merchant dictionary per market and learned renames turn "UBER *TRIP HELP.UBER.COM" into "Uber" with the right category; raw string kept for audit.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-307
- **Prefs** -
- **Acceptance**
  1. Renaming a raw string once applies to every later capture of it.
  2. The raw string stays in metadata and in duplicate matching.

### F-515 Smart defaults predictor

On-device counts and recency predict group, payer, participants, split and currency from title, time, location and active trip; each prediction shows why.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `smartDefaults`
- **Acceptance**
  1. "Groceries" on a weekday predicts the flat group and its template.
  2. Tapping the sparkle shows "Why: last 6 Groceries...".
  3. Learning is per device, clearable, and can be switched off.

### F-516 Automation rules engine `spec 4b (extended)`

Ordered if/then rules (title, merchant, amount, source, card, group, weekday -> category, tags, template, payer, participants, skip Inbox); apply to past with preview and undo. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's rule suggestion (`src/components/MerchantRuleSuggestionBanner.tsx`): after the user changes a predicted field, an inline banner on the expense page offers "Always use Food for Swiggy?" with Create rule / Not now.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-305, F-503, F-1404
- **Prefs** `automation.rules`
- **Acceptance**
  1. A rule runs on manual add, quick add, OCR, share-in and import.
  2. "Apply to past" previews a diff and commits as one undoable batch.
  3. The predictor offers "Make this a rule?".
  4. The banner shows at most once per merchant and field, never as a dialog, and Not now is remembered.

### F-517 Recurring pattern detection and price-change alerts

Spot the same merchant at a regular cadence and offer a recurring rule; flag changed or missing amounts.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-306
- **Prefs** -
- **Acceptance**
  1. 3 monthly Netflix entries suggest a prefilled recurring rule.
  2. "Netflix went from 649 to 799, update the rule?" appears after a change.

### F-518 Utility bill OCR

Read billing period, due date, account number and units from utility bills to fill the variable bill, due board and proration period.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-502, F-306
- **Prefs** -
- **Acceptance**
  1. A scanned electricity bill fills amount, period and due date of the due variable bill.
  2. Uncertain fields are highlighted and nothing posts without review.

### F-519 Booking confirmation to expense with dates

Hotel, Airbnb or flight confirmations (PDF, email, screenshot) become drafts with amount, currency and check-in/out; stays prefill the nights split.

- **Effort** L · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-509, F-702
- **Prefs** -
- **Acceptance**
  1. An Airbnb PDF produces a draft with nights prefilled for present members.
  2. Only money and dates are kept, never an itinerary.

### F-520 Trip auto-detect from spending clusters

Several expenses in 48 h in a new currency or with travel merchants suggest creating a trip with them.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1405
- **Prefs** `tripDetect`
- **Acceptance**
  1. Accepting creates the trip with dates and currency and moves the chosen expenses with history.
  2. Dismissal is remembered for that cluster.

### F-521 Composer suggestions from clipboard and latest screenshot

Opening Add expense offers one chip: "Use INR 432 from clipboard" or "Split from screenshot".

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-507, F-502
- **Prefs** `composer.clipboardSuggestions`
- **Acceptance**
  1. Uses the OS paste control and limited photo access; no silent clipboard reads.
  2. The chip is dismissible and the feature can be turned off.

### F-522 Statement and CSV import with column mapper

CSV, XLSX, OFX, QIF and PDF statements with a saved column mapper; rows go to the Inbox with an Ours / Mine / Theirs swipe.

- **Effort** L · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-503, F-504
- **Prefs** `import.profiles`
- **Acceptance**
  1. A mapping saved as "HDFC credit card" is reused on the next import.
  2. Duplicates are caught by date + amount + normalised description.
  3. Parsing runs on device.

## E6 People and groups

Who is in the ledger and how groups behave.

### F-601 Private friends `spec v1, owner § 26.18`

Friends without accounts or invites, visible and usable only on your side: the "Add anyway (only for you)" path of Add friend (F-618), and the offline way to add anyone.

- **Effort** S · **Impact** 9 · **Backend** no · **Status** done · **Deps** F-103
- **Prefs** -
- **Acceptance**
  1. A friend can be added offline with only a name.
  2. Deleting a friend with ledger rows never erases history.
  3. A deleted friend shows by name with a "former friend" label on every past record stays in People, struck through, and can be restored from its page.
  4. A private friend is selectable in expenses and groups at once; when that person later joins and accepts, the private friend is linked to their account (F-2106) and history merges (F-616).

### F-602 Add friend from device contacts `spec: owner § 26.18`

"Choose from contacts" in the Add friend sheet: the native contacts picker (expo-contacts) after a permission primer; on web the Contact Picker API where the browser has it, otherwise the button is hidden. Contacts stay on the device.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done (feat/4b-31-33, 2026-10-27; web Contact Picker path in e2e `friends.spec.ts`; the native primer and expo-contacts picker are built but not yet run on a simulator) · **Deps** F-618
- **Prefs** -
- **Acceptance**
  1. Native: the button shows a pre-permission primer (the F-216 pattern, built here for contacts if F-216 has not shipped), then the system picker; a denied permission falls back to typing, with Open Settings; nothing dead-ends.
  2. Web: the button shows only where the Contact Picker API exists.
  3. A contact with several numbers or emails asks which one; only the name and the chosen phone or email are stored, nothing is uploaded.
  4. The chosen value goes through the same Splito check as a typed one (F-618); a stored phone powers wa.me reminders.

### F-603 Groups and trips `spec v1`

Name, type, currency, members, roles, trip dates; membership changes never rewrite past splits.

- **Effort** M · **Impact** 10 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-601
- **Prefs** -
- **Acceptance**
  1. A09: adding or removing a member leaves old splits unchanged.
  2. Former members keep correct access to past records locally.

### F-604 Active / inactive and show / hide groups `spec: owner § 26.12 (decisions 88, 89)`

Two controls instead of "Archive": Active / Inactive is the group's state for every member (inactive takes no new expenses but can still settle), Show / Hide is personal visibility. Balances are never hidden.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** done (feat/wB-B3; sync `groupLifecycle.test.ts` + the shared store contract on SQLite and IndexedDB, `activity.test.ts`, `preferences`; client `filter.test.ts`; e2e `groupLifecycle.spec.ts` at phone and desktop widths; web verified, native not yet run) · **Deps** F-603
- **Prefs** `groups.showInactiveFold` (account, default on), `groups.hidden` (account, default empty list of group ids)
- **Acceptance**
  1. "Make inactive" / "Make active" and "Hide group" / "Show group" in the group header overflow; state change in one transaction with history and outbox, Activity row for inactive/active; hide/show writes only the preference; Undo toast for both.
  2. Inactive: page banner "Inactive · Make active to add expenses" instead of Add expense; the FAB and Add expense sheet cannot target it; sync mutations reject add, edit, move-into and restore-into with `GROUP_INACTIVE` (bun tests, both engines).
  3. Inactive: Settle up, Record payment, Call it even and comments still work; making inactive with an open balance shows open amounts per currency and offers "Settle up first".
  4. Inactive groups appear only in the "Inactive (N)" fold at the end of the Groups list, not in recent groups or pickers.
  5. Hidden (personal): absent from my Groups list, recent groups and pickers; reachable by filter Show = Hidden, search and history links; still accepts expenses from its page if active; other members are unaffected.
  6. Balances of inactive and hidden groups still count on Home, People and the overview, with chips marked "Inactive" / "Hidden".
  7. Groups filter: Status Active / Inactive / All (default Active) and Show Shown / Hidden / All (default Shown); the old `archived` flag reads as Inactive (adapter test).
  8. e2e at phone and desktop widths: make inactive, blocked add, settle in an inactive group, make active; hide, find via filter, show.

### F-605 Group emoji and colour

Emoji and colour per group, picked with Bluesky's expo-emoji-picker or suggested from type and name.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-603
- **Prefs** -
- **Acceptance**
  1. "Goa" suggests a beach emoji; the user can override it.
  2. Emoji shows in lists, sidebar recent groups and share cards.

### F-606 Group templates

Trip, Home, Couple, Family, Family trip, Co-parenting, Wedding/event and Collection presets for type, categories, cards, rules and cadence.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-603
- **Prefs** -
- **Acceptance**
  1. A template only sets defaults; every value stays editable.
  2. The group kind union is extended without breaking existing groups.

### F-607 Households: a couple or family settles as one party

Bundle members into households with effective-dated adult/child weights; balances and the settle plan show one line per household.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-102, F-603
- **Prefs** `household.childWeight`, `group:showInsideHousehold`
- **Acceptance**
  1. "Sharma family, 2 adults + 2 kids at 0.5" gets weight 3 when splitting by heads.
  2. The settle plan routes one payment per household.
  3. A weight change from a date leaves earlier splits unchanged; items can still go to individuals.

### F-608 Dependents: kids, pets and parents who never owe

Dependents can be tagged on expenses but never carry a balance; their share rolls up to guardians by rule.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-607
- **Prefs** -
- **Acceptance**
  1. A dependent's share rolls up 50/50, by ratio, or to one guardian.
  2. The report shows "Spent on Aarav this year" by category.

### F-609 Per-category split rules for a group `spec v3 (per-group default split)`

"How we split": a rule per category, member default weights and an "include in new expenses" switch, all effective-dated.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-305
- **Prefs** `group:splitRules`, `group:memberDefaults`
- **Acceptance**
  1. Picking Rent applies room weights and shows a "House rule" chip.
  2. Overriding applies to that expense only.
  3. A rule change from a date never rewrites past expenses.

### F-610 Per-group permissions (local) `spec 4b gap 11`

"Who can..." add, edit or delete others' expenses, manage members and rules, record payments for others; enforced locally now, on the server in F-2108.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-603
- **Prefs** `group:perm.add`, `group:perm.editOthers`, `group:perm.manage`, `group:perm.recordForOthers`
- **Acceptance**
  1. Default: everyone adds; editing others is creator and admins.
  2. A blocked action says who can do it.

### F-611 Pinned group note and payment-handle directory

Admin-editable pinned note; Members tab lists each member's handles with Copy and QR.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1106
- **Prefs** -
- **Acceptance**
  1. Handles from the directory flow into summaries and pay sheets.
  2. Note edits appear in history.

### F-612 Duplicate group as template

Copy members, households, rules, currencies, categories, budget and kitty setup into a new group with no expenses.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-603
- **Prefs** -
- **Acceptance**
  1. The copy has new dates and zero expenses.
  2. The source group is unchanged.

### F-613 Safe member removal and drop-out re-split wizard

Removing a member with a balance offers settle, forgive or keep inactive; a wizard walks their expenses: still pays, refund, or re-split.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** in progress (part 1 done on feat/wB-B3: settle, forgive or keep inactive from the Members tab with a balance preview; sync `groupLifecycle.test.ts`, domain `memberExit.test.ts`, e2e `groupLifecycle.spec.ts`; the drop-out re-split wizard (criterion 2) moves to Wave C) · **Deps** F-1113
- **Prefs** -
- **Acceptance**
  1. Each choice previews every member's balance change.
  2. The wizard writes explicit revisions; history is kept.

### F-614 Presence calendar: stay dates, away days, guest nights `spec v2 nights (extended)`

Members get one or more presence ranges, away days and guest nights; new expenses default to members present on their date.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-106, F-603
- **Prefs** -
- **Acceptance**
  1. An expense on day 5 defaults to the members present on day 5.
  2. Editing a range never rewrites saved splits and offers a reviewed re-split.

### F-615 Leave or delete a group

Leave a group yourself or delete a whole group. A non-zero balance offers settle, forgive (F-1113) or stay as an inactive member; delete tombstones the group and its records, which stay in their lists struck through (F-1203); the last admin hands admin on first.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wB-B3; sync `groupLifecycle.test.ts`, e2e `groupLifecycle.spec.ts`; web verified, native not yet run; server enforcement of the leaver's read access waits for F-2108) · **Deps** F-603, F-1113, F-1203
- **Prefs** -
- **Acceptance**
  1. Deleting a group lists what goes, stays struck in Groups, opens read-only, and restores with every expense and payment intact.
  2. Leaving with a balance never drops it silently; the choice is recorded in history.
  3. The last admin cannot leave until admin is handed on; server enforcement of the leaver's read access arrives with F-2108.

### F-616 Merge duplicate friends

Merge two private people who are the same person ("Sam" and "Sam K"): preview every balance and history change, re-point records through explicit revisions, keep the old name as an alias.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-601
- **Prefs** -
- **Acceptance**
  1. Balances after the merge equal the sum of both people's balances per currency; when both were on one expense their shares combine into one.
  2. The merge is one undoable batch and appears in history.
  3. Suggestions need a matching phone or email, never a display name alone, and the user always confirms.

### F-617 Saved member subsets and a big-group picker

Named subsets inside a group ("Car 1", "Room B", "Divers") picked in one tap; the participant picker gets search, select all / none / invert and recent combinations for groups of 10 or more.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-603
- **Prefs** `group:subsets`
- **Acceptance**
  1. Picking "Room B" selects exactly its current members; a removed member is dropped with a note.
  2. Select all, none and invert work by keyboard and screen reader.
  3. The picker stays smooth with 50 members (virtualized, measured).

### F-618 Add friend by email or mobile, with a Splito check and consent `spec: owner § 26.18`

Add friend asks for an email or mobile number (one field, auto-detected) plus an optional display name, checks the account directory before inviting, and never makes anyone a friend without their consent. Front end and directory client; live lookups and requests need F-2111.

- **Effort** L · **Impact** 9 · **Backend** no · **Status** done (feat/4b-31-33, 2026-10-27; e2e `friends.spec.ts`; live lookups and sends wait for F-2111) · **Deps** F-601, F-205
- **Prefs** `privacy.findByContact`, `privacy.friendRequestsFrom`
- **Acceptance**
  1. One field detects email or mobile and validates it; phone numbers are stored in E.164 with the user's region as the default; an optional display name.
  2. As soon as the value is valid, Splito looks it up (exact match only; the answer is only "on Splito" / "not on Splito"). On Splito: primary action "Send friend request", and the person appears under People > "Invites sent" as pending with Resend and Cancel. Not on Splito: a warning banner "<value> isn't on Splito yet" with "Send invite" (SMS / email / share sheet with a personal invite link) and "Add anyway (only for you)", which creates a private friend (F-601). Offline or check unavailable: "We'll check when you're online", the request is queued in the outbox, and "Add anyway (only for you)" is still offered.
  3. They must accept: nobody becomes a friend or joins your groups without consent. Pending people show greyed with "Waiting for <name> to accept" and cannot be selected in expenses or groups; once accepted they are full friends usable anywhere (any group, any expense, settle up) and both sides see the shared history.
  4. Incoming requests show in Activity (From others, unread badge) and at the top of People ("Requests": Accept / Decline). Declining is silent to the sender, whose request stays pending until it expires after 30 days.
  5. Privacy settings "Let people find me by email / phone" (default on) and "Who can send me friend requests" (everyone / people with my link only) are registry entries with Settings rows.
  6. Demo mode ships a fake directory (seeded with requests, invites sent and invite links) so every branch can be seen; production builds use the backend directory (F-2111) and never show a fake "sent" state.

### F-619 Invite link and QR with limits `spec: owner § 26.18`

Personal and group invite links with a QR, use and expiry limits, a manage list and revoke; using a link always counts as accepting. Front end; links work across devices once F-2105 ships.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/4b-31-33, 2026-10-27; e2e `friends.spec.ts`; links are minted only in demo until F-2105, production says they need a connection) · **Deps** F-618, F-603
- **Prefs** `invites.defaultMaxUses.friend`, `invites.defaultMaxUses.group`, `invites.defaultExpiry`, `invites.approveJoins` (default for new group links; each link can override)
- **Acceptance**
  1. "Invite link / QR" is offered from the People (Home) header and the Add friend sheet; groups offer the same for joining a group (Group overflow "Invite link").
  2. Creating one sets max uses (1, 5, 25, unlimited; default 1 for friends, 25 for groups), expiry (24 hours, 7 days, 30 days, never; default 7 days) and, for groups, "approve each join" (default off); the defaults are editable in Settings.
  3. The sheet shows a scannable QR with the accent-coloured logo in the centre, the link, Copy and Share; "Manage invite links" lists active links with uses left and expiry, and Revoke.
  4. Opening a link: a person with Splito sees who invited them and Accept / Decline; without Splito, web onboarding then the same prompt. Expired, used-up or revoked links say so and add nobody.

### F-620 Themed invite QR card, Save to Photos and an in-app QR scanner `spec: owner § 26.1 best of both (Bluesky inviteFriends)`

Bluesky's invite dialog (`src/features/inviteFriends/InviteFriendsDialogInner.tsx`, `themes.ts`, `components/ThemedQrCard.tsx`, `components/ActionButtons.tsx`) for Splito's invite sheet (F-619) and Pay-me QR (F-1105): the QR sits on a themed card (six themes rebuilt from Splito's ALF tokens, no Bluesky artwork) with the person's or group's name, and the actions Share (as an image), Save to Photos (write-only permission) and Copy link with a toast. Plus Bluesky's `InviteScannerScreen.tsx`: "Scan QR" in the Invite people sheet opens the camera and accepts Splito invite links (opens the accept flow) and UPI QR codes (offers to save the handle on a friend, F-1106).

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-619
- **Prefs** `qr.theme` (default theme)
- **Acceptance**
  1. Copied with attribution headers and reuse rows; the camera sits behind a lazy boundary (ARCHITECTURE § 2); the camera permission is asked from a tap with Bluesky's explainer (F-216 later reuses it); a denied camera offers "Choose image" to read a QR from a photo.
  2. Unknown or unsafe QR content is shown as text, never opened (`safeExternalUrl`, § 11); a scanned link only navigates (§ 14).
  3. The saved image holds the QR and the name only, never an amount unless the user chose a Pay-me QR with one.
  4. iOS simulator and Android emulator runs recorded; web saves as a download and hides Scan without a camera.

### F-621 Settings > Friends and invites hub, with safe Remove friend `spec: owner § 26.18, decision 83`

One Settings page (`/settings/friends`) that manages friends and invites. Requests received (Accept / Decline) and Invites sent (Resend / Cancel) show first while any wait; Friends lists every friend (search above 10) with "Add friend" (opens the Invite people sheet) and Remove friend per row (a row menu on phones, a button on desktop); Invite links lists every active link with uses left, expiry, Revoke and "Create invite link"; below are the defaults for new links and requests. Remove friend is a soft `removedAt` on the person, never a delete.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** done (feat/wB-B6; tests: packages/sync/test/removeFriend.test.ts, e2e/friendsHub.spec.ts) · **Deps** F-618, F-619
- **Prefs** existing `privacy.*` and `invites.*`
- **Acceptance**
  1. Settings has a "Friends and invites" row and page with the sections above, using the same row components as Home and the invite sheet (`RequestRow`, `InviteLinkRow`).
  2. A friend with an open balance in any currency cannot be removed: the prompt lists the open amounts per currency and offers "Settle up" and "Call it even". Otherwise a confirmation (bottom drawer on phones) removes them.
  3. Removing keeps every past expense and payment, the name stays (marked "Removed" on the friend's page), the friend leaves pickers and lists, a toast offers Undo, and "Add back" restores them.
  4. The Person overflow "Remove friend" uses the same flow; Home's "Friends N" header has "Manage"; the invite sheet's "Manage links" opens the Invite links section.
  5. Removing someone from a shared group stays a group action (F-613).
  6. A removed friend who still has an open balance (a shared group can give one) stays on Home marked "Removed" until it is settled; removed friends take no new expense (not offered as group-member candidates or preselected), and "Add friend" offers "Add back" for them.

## E7 Trips and travel

Everything a group trip needs, from first booking to closing the books.

### F-705 Trip location ("Where?") `spec: owner § 26.12 (decision 182)`

Trip groups ask where the trip is: an optional plain-text place on New and Edit group, shown and searchable.

- **Effort** S · **Impact** 6 · **Backend** no (synced with the group in M2) · **Status** done (web), Wave C; native unverified · **Deps** -
- **Prefs** -
- **Acceptance**
  1. "Where? (optional)" shows for Trip only, beside the dates; saved as `group.location` (trimmed, null when empty) through createGroup / updateGroup with history and outbox.
  2. Group row and header read "Trip · Goa · 12-18 Mar" (parts that are missing drop out); search finds the group by its location; CSV has a Location column.
  3. Switching type away from Trip hides the field and keeps the value; demo trips have locations; en + hi; e2e at 390 and 1440.

### F-701 Trip kitty v2: multi-currency, holder hand-off, cash count `spec v2`

Several currencies in one pot, named holder with recorded hand-off, "Count the kitty" turning gaps into unrecorded spend, top-ups, card kitty, leftover return.

- **Effort** L · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-105
- **Prefs** `group:kitty.lowBalance`, `group:kitty.defaultPayer`
- **Acceptance**
  1. The kitty shows one balance per currency.
  2. "Hand kitty to Sam" is recorded and the holder shown.
  3. Counting less than expected creates an "Unrecorded spend" to split or assign.
  4. Leftover returns pro-rata per currency.

### F-702 Split by nights or days present, with room weights `spec v2`

Accommodation by nights stayed, per-day costs by days present, room weights for unequal rooms.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-614
- **Prefs** -
- **Acceptance**
  1. A stays 3 nights and B 2 nights of a 5-night villa: 60/40.
  2. Room weights 1.5 / 0.5 allocate exactly.

### F-703 Trip dashboard and day-by-day timeline with budget pace `spec v2`

Expenses grouped by trip day in the leg's timezone, day totals per currency, spent vs budget, pace per remaining day.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1304, F-704
- **Prefs** `trip.paceAlert`
- **Acceptance**
  1. Expenses before day 1 sit in "Before the trip".
  2. Day headers show totals per currency and my share.
  3. The pace line reads "JPY 8,200/day for 7 days" with an opt-in over-pace notification.

### F-704 Trip legs and travel mode

Legs with currency and IANA timezone; new expenses default from the leg of their date; a device timezone change offers to switch defaults.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-603, F-1002
- **Prefs** `travelMode`
- **Acceptance**
  1. An expense dated in leg 2 defaults to THB and Asia/Bangkok.
  2. A device timezone change offers "Default to THB?" with no location permission.
  3. Single-leg trips show no leg UI.

### F-705 Close the trip: wrap-up checklist `spec 4b gap 11`

After the end date: grace window with "anything missing?" nudge, disputes, kitty count, settle currency, share plan; then freeze, reopen logged, auto-archive at zero.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-604, F-1205, F-701, F-1007
- **Prefs** `group:closeGraceDays`
- **Acceptance**
  1. The card shows each step, skippable and remembered, and says what blocks it.
  2. Close makes the group read-only; an admin reopen is logged in history.
  3. The group auto-archives when every balance is zero.

### F-706 What this trip cost me

Private per-viewer total in home currency: my shares, my personal trip expenses and my card/ATM fees, by day and category.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1302, F-1005
- **Prefs** -
- **Acceptance**
  1. Repayments never count as spending.
  2. Each component uses its own frozen rate.

### F-707 Pre-trip bookings and refundable deposits

Flag an expense as a refundable deposit with expected amount and date; it shows "pending refund" until recorded.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-303, F-705
- **Prefs** -
- **Acceptance**
  1. The refund flows back per the original split.
  2. The wrap-up checklist blocks on unreturned deposits.

### F-708 Offline phone-to-phone exchange (QR and file)

With no signal, move pending operations between phones as an animated multi-frame QR or a signed .splito bundle (AirDrop, Quick Share); dedupe by operation ID.

- **Effort** XL · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-107
- **Prefs** -
- **Acceptance**
  1. 50 operations transfer between two phones in airplane mode.
  2. Re-importing a bundle changes nothing; conflicting edits surface as conflicts.
  3. Imported operations are labelled "from Sam, not yet synced".

### F-709 Road trip: fuel and distance split

Fuel and tolls split by the distance each person rode (or per car with its riders, using F-617 subsets), with an optional per-km allowance for the car owner; km become integer weights for allocate(). **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's distance flow (`src/pages/iou/request/step/IOURequestStepDistanceMap.tsx`, `IOURequestStepReuseRoute.tsx`): km can be typed or, once F-313's place search exists, computed from a route of reorderable stops with riders marked per leg; recent routes can be reused. Live GPS tracking and odometer photos are excluded (scouting file).

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-302, F-617
- **Prefs** `group:carRatePerKm`
- **Acceptance**
  1. Fuel 3,000 with Riya 300 km and Sam 100 km gives 2,250 / 750 exactly.
  2. A per-km allowance creates a labelled expense owed to the car owner.
  3. A route with riders per leg gives the same integer km weights as typing them; offline, typed km always work.

## E8 Home and household

Flatshares and long-running homes.

### F-801 Flat setup wizard

Five skippable screens for rent, deposit, bills, house rules and move-in dates that create all rules in one local transaction.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-606, F-306, F-609, F-802
- **Prefs** -
- **Acceptance**
  1. Finishing the wizard creates every recurring rule and category rule atomically.
  2. Every value is editable later in group settings.

### F-802 Fair rent calculator

Split rent by room area, features, income or hybrid with a live money preview; saves as Rent rule weights.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-609
- **Prefs** -
- **Acceptance**
  1. The preview uses allocate() and sums to the rent exactly.
  2. Inputs are stored so the split can be recalculated.

### F-803 Rent collector board

Per-cycle board: collected vs due, landlord due date, one row per flatmate with a pay link netted against other house balances.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-306, F-1109, F-1104
- **Prefs** `group:rentCollector`
- **Acceptance**
  1. Each cycle shows "30,000 of 45,000 collected - landlord due 5 Nov".
  2. A row's pay amount nets other balances ("15,000 - 1,200 = 13,800").
  3. Payments are normal repayments with no double count.

### F-804 Billing periods with day proration

Bills carry a period and split by inclusive days each member lived there; move-in month rent prorates.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-106, F-614
- **Prefs** `group:prorateCategories`
- **Acceptance**
  1. "Alex: 19 of 30 days" explanation shown per share.
  2. A category can opt out (e.g. fixed install fee).

### F-805 Move-out checkout wizard

Move-out date, trailing-bill holdback, deposit share, asset buyout, final balance and plan; the leaver keeps read access.

- **Effort** L · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-804, F-806, F-810, F-613
- **Prefs** -
- **Acceptance**
  1. A holdback estimate is trued up when the real bill arrives.
  2. Deposit and asset steps write explicit ledger entries.
  3. The leaver is excluded from new expenses; a final statement is shareable.

### F-806 Security deposit ledger

Deposit as a held-funds pot: contributors, holder, condition photos, refund with itemized deductions, handover to an incoming flatmate.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-105, F-312
- **Prefs** -
- **Acceptance**
  1. The deposit never counts as spending.
  2. Refund minus attributed deductions is allocated pro-rata to contributions.
  3. Handover changes ownership without touching the landlord.

### F-807 Bills due board and calendar `spec v1 upcoming (extended)`

Upcoming bills by due date with an assigned payer, "paid to provider" separate from flatmate balances, local reminders, late-fee charge, duplicate subscription check.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-306, F-1907
- **Prefs** `bills.remindDaysBefore`
- **Acceptance**
  1. "Paid to provider" is tracked separately from who owes whom.
  2. Reminders fire offline N days before the due date.
  3. "You both pay for Spotify" is flagged.

### F-808 Month close and household statement

Monthly cycle with a statement card; closing locks the month; edits need a reason recorded in history; open balances carry forward.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1205
- **Prefs** `group:cycleStartDay`
- **Acceptance**
  1. Editing a closed month requires an unlock reason, logged in history.
  2. Unsettled balances carry forward as a labelled opening line.
  3. Totals stay per currency.

### F-809 Shared shopping list to itemized expense

Offline group list with Shared / For-person tags and repeating staples; Checkout opens an itemized expense with ticked items.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-401, F-609
- **Prefs** -
- **Acceptance**
  1. Shared items follow the category rule and personal items go to the requester.
  2. Unticked items stay on the list.

### F-810 Shared asset register with buyout

Flag group purchases as assets with ownership shares and depreciation; buyout, sell or leaver-takes-it at move-out.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. Buyout pays the leaver their share of the current value.
  2. The asset stays linked to its original expense.

### F-811 Metered utility split

Split by sub-meter readings or AC hours x tonnage with a common-area remainder by rule.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-609
- **Prefs** -
- **Acceptance**
  1. Units become weights and the total still equals the bill exactly.
  2. Last cycle's end reading prefills this cycle's start.

### F-812 Household staff payroll

Monthly salary rule with leave deductions, advances recovered and credited to whoever gave them, bonuses by rule.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-306
- **Prefs** -
- **Acceptance**
  1. Leave deducts salary / days-in-month per day.
  2. An advance is recovered from the next salary and credited to its giver.

### F-813 Chore-cover payouts

One tap records a transfer from the absent member to whoever covered a chore, at a per-chore amount; labelled household transfers, not spending.

- **Effort** M · **Impact** 4 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `group:coverPay`
- **Acceptance**
  1. Cover pay never counts as spending in reports.
  2. The amount is set per chore and editable.

### F-814 Presence-aware category rules

Per category, choose whether away days and guest nights change the split (groceries yes, rent no).

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-614, F-609
- **Prefs** `group:presenceCategories`
- **Acceptance**
  1. Groceries weight by days present plus guest nights; rent ignores away days.
  2. Each share explains "Sam: 16 of 31 days, +4 guest nights".

### F-815 Household and joint pots `spec v2 kitty (extended)`

Recurring contribution targets (equal or ratio), "Paid from: Joint account" payer, low-balance top-up, carry-over or refund at period end.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-105, F-306
- **Prefs** `group:pot.contribution`, `group:pot.leftoverPolicy`
- **Acceptance**
  1. "Sam is Rs 2,000 short this month" shows against target.
  2. Expenses paid from the pot move no member-to-member debt.

### F-816 Daily quantity log: milk, tiffin and water cans

Log daily quantities with skip days against a rate; at month end the log becomes one variable bill (F-306) with the computed amount, split by the group rule.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-306
- **Prefs** -
- **Acceptance**
  1. 31 days with 3 skipped at 1.5 L x 60 gives the exact month amount and lists the skipped days.
  2. A rate change from a date applies only from that date.
  3. Nothing posts until the month's bill is confirmed.

## E9 Couples and family

Partners, kids and the wider family.

### F-901 Ours / Mine / For you chips

Three big chips: Ours (group rule), Mine (private, never synced to the group), For you (partner owes 100%), with a plain-language preview.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-609
- **Prefs** `couple.defaultChip`
- **Acceptance**
  1. A Mine expense never syncs to the group or shows to the partner.
  2. For you makes the partner owe 100%; the preview reads "Sam will owe you Rs 840".

### F-902 Income-proportional fair-share ratio `spec v1 templates (extended)`

Each partner's income stays on their device; only the derived ratio syncs, as a live, effective-dated template.

- **Effort** S · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-305
- **Prefs** `fairShare.income` (device), `fairShare.ratio`
- **Acceptance**
  1. allocate(10000, incomes) totals exactly 100.00%.
  2. Incomes never leave the device (no outbox rows).
  3. An income change affects new expenses only.

### F-903 "Us" overview card with fairness meter

Month together, net in one calm line, upcoming bills, top categories, and "you covered 58%, agreed share 62%".

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-902, F-1302
- **Prefs** -
- **Acceptance**
  1. The meter is per currency and computed from ledger data only.
  2. Tapping it opens a breakdown by month and category.

### F-904 Shared goals and savings pots

A target with deadline and per-member monthly contributions; spending from the goal pot creates no debt.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-105
- **Prefs** -
- **Acceptance**
  1. Progress shows "on track" or "2 months behind".
  2. Spending the goal draws from the pot.

### F-905 IOU loans and EMI splits

Loan records with repayment schedules kept apart from everyday balances; group purchases on EMI post monthly shares.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. People shows "Loan: Rs 35,000 left" separately.
  2. Partial repayments match instalments; EMI shows "paid 3 of 6".
  3. Loans never count as spending.

### F-906 Kids' allowance and pocket-money ledger

Recurring allowance, chore bonuses, spending and advances repaid from future allowance; kid view behind a PIN.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-608, F-306
- **Prefs** -
- **Acceptance**
  1. An advance of 200 deducts 50 from each of the next 4 allowances.
  2. The kid view is read-only behind a PIN.

### F-907 Co-parenting ledger

Two households, fixed child categories with agreed ratios and receipt-required flags, reimbursement requests, neutral wording, dated export.

- **Effort** L · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-606, F-609, F-1204
- **Prefs** -
- **Acceptance**
  1. Medical 70/30 applies automatically to Medical expenses.
  2. Approve / decline with reason works locally; shared approval arrives with F-2208.
  3. Dated PDF and CSV export for a mediator.

### F-908 Shagun / gift register

Gifts given and received per family per occasion, separate from balances.

- **Effort** M · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `gifts.suggestShagun`
- **Acceptance**
  1. Gifts never affect balances.
  2. "What did the Guptas give us?" lookup works offline.

### F-909 Wedding and event mode

Sides with a configurable ratio, functions as sub-events, vendor advance-and-balance schedules with reminders, budgets per head.

- **Effort** L · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-606, F-607, F-1304
- **Prefs** `group:sides.ratio`
- **Acceptance**
  1. One ledger with filters per side and per function.
  2. Vendor balance due dates create local reminders.

### F-910 Year-end tax pack and cost of living

Per-person yearly report: rent paid (with monthly HRA rent receipts), tuition, insurance, home-loan EMIs; plus "my cost of living" per month.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1302, F-1503
- **Prefs** `tax.locale`
- **Acceptance**
  1. Rent receipts are generated only from recorded rent payments and marked "requires landlord signature".
  2. Tax sections are configurable per locale.

## E10 Currencies and FX

Honest multi-currency, from card statements to settling abroad.

### F-1001 Currency catalog and per-currency totals `spec v1`

ISO 4217 catalog with scale, symbol and name; no API ever sums unlike currencies.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (packages/domain) · **Deps** F-101
- **Prefs** `defaultCurrency`, `enabledCurrencies` (spec v1 "configurable enabled set"; picker UI still todo in F-1701)
- **Acceptance**
  1. Every catalog currency formats with its scale.
  2. Tests prove totals stay per currency.

### F-1002 Conversion records and exchange rates `spec v1`

Rate fetch from a third-party provider when online; stored source, target, decimal rate, provider, time and rounding; labelled manual rate; stale/offline labels; frozen per transaction.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1001
- **Prefs** `fx.provider`, `fx.showConverted`
- **Acceptance**
  1. A11: repeating a calculation uses the stored rate.
  2. An offline quote is labelled stale with its timestamp.
  3. Original amounts never change.

### F-1003 Offline rate pack and re-price review `spec v1 (extended)`

Pre-fetch rates for a trip's currencies against every member's home currency; on reconnect, one review card offers to re-price offline entries.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1002
- **Prefs** -
- **Acceptance**
  1. Offline entries show "rate from Mon 3 Mar (offline)".
  2. The review previews each member's change; settled expenses are excluded.

### F-1004 Trip rate book

One agreed rate per currency per trip with a labelled source; changes are versioned with a balance preview.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1002, F-603
- **Prefs** -
- **Acceptance**
  1. New expenses default to the trip rate offline.
  2. A rate change asks "new expenses only" (default) or "re-price unsettled" and never touches settled history.

### F-1005 Card-charged amount sets the real rate `spec v1 manual rate (extended)`

Optional "charged to card" home-currency amount derives and freezes the effective rate; filled now or later; per-trip policy on who bears FX fees.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1002
- **Prefs** `group:cardFxPolicy`
- **Acceptance**
  1. JPY 4,500 charged as INR 2,512 stores the effective rate as a decimal string with source "card".
  2. A "card amount pending" chip shows until it is filled.
  3. The markup over market is shown.

### F-1006 Cash wallets and forex lots

ATM withdrawals and money-changer purchases create a cash pocket at its real rate; cash expenses use the weighted rate; reconcile the pocket.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1005
- **Prefs** `group:atmFeesShared`
- **Acceptance**
  1. "Paid from my cash" uses the pocket's weighted-average rate.
  2. "I have JPY 4,100, app expects 5,000" turns the gap into an expense.

### F-1007 Settle a trip in one currency with rate-policy preview `spec v1`

Settle in one currency or each receiver's home currency; preview each member's result under frozen, rate-book and today's rates; confirm writes explicit conversion transactions.

- **Effort** L · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1004, F-1101
- **Prefs** `group:settleCurrency`
- **Acceptance**
  1. The preview shows each person's difference between policies.
  2. Confirming writes one conversion per currency pair so the plan is one payment per pair.
  3. Settled history is never re-priced.

### F-1008 Pay back with leftover foreign cash

Record payment in a different currency than the debt; conversion and repayment written in one atomic, idempotent step.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1007
- **Prefs** -
- **Acceptance**
  1. "Covers INR 2,760 of INR 3,100 - INR 340 left" shows before saving.
  2. Several partial payments in different currencies are allowed.

### F-1009 Live home-currency hint

"~ INR 3,890 at trip rate" under the amount as you type.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1002, F-310
- **Prefs** `fx.showHomeHint`
- **Acceptance**
  1. The hint is never stored or summed into totals.
  2. The hint says which rate it uses (trip rate book or cached rate).

### F-1010 Unambiguous currency display and compact amounts

When two currencies share a symbol, show US$ / CA$ or codes; compact lakh/crore and K/M on cards and axes.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1001
- **Prefs** `currencyDisplay`, `compactAmounts`
- **Acceptance**
  1. A view with USD and CAD shows US$ and CA$.
  2. en-IN shows ₹1.2 L and ₹3.4 Cr on summary cards.

### F-1011 Change a group's or my home currency safely `spec v1 original amounts (extended)`

Changing a group's default currency or my home currency changes only new expenses and display defaults; existing records keep their currency and frozen rates. Retired ISO codes (e.g. HRK) still display and convert at the official fixed rate only when the user chooses.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1002
- **Prefs** -
- **Acceptance**
  1. Switching a trip from EUR to CHF leaves every EUR expense and balance unchanged, and a banner says what changed.
  2. Home-currency hints and converted views move to the new home currency without touching stored rates.
  3. An HRK expense shows "HRK (retired)" and converts to EUR at 7.53450 only on request, labelled as the fixed rate.

## E11 Settle up and payments

From "who owes whom" to money actually changing hands.

### F-1101 Settle up: plan, rules editor, record repayment `spec v1`

Per-group plan in direct mode obeying payment rules, rules editor, partial/full repayment with optional proof.

- **Effort** L · **Impact** 10 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-102, F-603
- **Prefs** -
- **Acceptance**
  1. The plan has a version hash and goes stale after any expense, payment, rule or membership change.
  2. A08: a partial repayment reduces the balance exactly; a duplicate operation has no effect; a plan preview changes nothing.
  3. A recorded repayment can be edited or deleted (tombstone + undo) with history, like an expense.

### F-1102 Fewest-payments toggle `spec 4b v1`

Separate exact solver for groups without rules, showing the payment count.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1101
- **Prefs** `group:fewestPayments`
- **Acceptance**
  1. Offered only when the group has no rules.
  2. Never more payments than direct mode on the fixture set; bounded run time with an explained fallback.

### F-1103 UPI pay link and "Mark as paid?" `spec v1`

upi://pay with payee VPA and amount, then ask to record the payment.

- **Effort** S · **Impact** 9 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-1101
- **Prefs** -
- **Acceptance**
  1. The link has pa, pn, am (exact, no grouping), cu=INR and tn.
  2. On return it asks "Mark as paid?" and never claims money moved.

### F-1104 UPI app chooser and fallback chain `spec v1 (extended)`

iOS lists installed UPI apps; Android uses the chooser and reads the result; "Didn't work" falls back to QR, then copy VPA and amount.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1103, F-1106
- **Prefs** `upi.lastApp`
- **Acceptance**
  1. iOS shows only UPI apps that canOpenURL reports installed.
  2. Android's returned txn reference prefills the proof.
  3. No collect requests are ever sent.

### F-1105 Pay-me QR at the table

Full-screen UPI QR with exact amount and note; swipe through each debtor; other handles render as QR links; save as an image.

- **Effort** S · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1106
- **Prefs** -
- **Acceptance**
  1. The QR scans in GPay, PhonePe and Paytm with the exact amount.
  2. Brightness goes up and the screen stays awake while shown.

### F-1106 Payment handles `spec 4b v2`

UPI VPA typed or scanned from a QR image, plus PayPal.me, Venmo, Revolut, Monzo, Wise and Cash App; several per person, one preferred.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-601
- **Prefs** -
- **Acceptance**
  1. Scanning a UPI QR parses pa and pn and asks to confirm.
  2. Handle format is validated offline and labelled "from QR" or "typed".
  3. Non-UPI links open the provider and then ask "Mark as paid?".

### F-1107 Payment-handle change warning

Show the handle large with the payee name before paying; warn if it changed in the last 14 days or was set by someone else.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1106
- **Prefs** -
- **Acceptance**
  1. A handle changed 3 days ago shows a warning before the pay link opens.
  2. Handle history is kept per person.

### F-1108 Payment method and UTR proof

Each repayment records UPI / Cash / Bank / Card and an optional 12-digit UTR.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1101
- **Prefs** -
- **Acceptance**
  1. The same UTR cannot be recorded twice.
  2. Analytics can filter by settlement method.

### F-1109 Collections: who-has-paid tracker

Ask each member for a sum (equal, weighted or per household) for a deposit, kitty, festival, society or office pool; rows show Paid / Partial / Not yet.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-105, F-1106
- **Prefs** -
- **Acceptance**
  1. Each payment posts a real repayment to the organiser or pot.
  2. "Nudge unpaid only" drafts messages for those not yet paid.
  3. A "Collection" group type shows spending from the pool transparently.

### F-1110 Next-to-pay suggestion

"Next to pay: Sam (-EUR 84)" names who is furthest behind; optional default payer "whoever is behind"; per-category take-turns meter.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1101
- **Prefs** `group:nextToPay`, `group:defaultPayer`
- **Acceptance**
  1. The suggestion respects payment rules (and households once F-607 ships).
  2. Tapping it opens Add expense with that payer.

### F-1111 Reminder drafts that do not annoy `spec v2`

Builds on Remind (F-1118): a per-friend policy (tone, minimum amount, minimum age, cap per week, max total), drafts in the friend's language with the QR card, snooze to salary day.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1118, F-1106
- **Prefs** `reminders.defaultTone`, `person:reminderPolicy`, `person:messageLanguage`
- **Acceptance**
  1. The per-friend cap (default one reminder per person per 7 days, never looser than § 26.20's one in-app reminder per 3 days) is enforced.
  2. A Hindi-language friend gets a Hindi draft while the UI stays English.
  3. Opening a draft is never claimed as sending.

### F-1112 Settle-up day for the group

A group settle date (trip end + 1, monthly for homes) with one local notification carrying the exact plan.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1907
- **Prefs** `group:settleDay`
- **Acceptance**
  1. The group page shows "Settle up in 2 days".
  2. An .ics event can be shared.

### F-1113 Call it even: forgive or write off

An explicit write-off ledger entry with a note, never a fake repayment or a deletion.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done (built and tested on a feat/b-* branch, unmerged) · **Deps** F-101
- **Prefs** `forgive.threshold`
- **Acceptance**
  1. The write-off is undoable and shows in Activity and history.
  2. Write-offs never count as spending.
  3. Optional auto-forgive below a threshold at month close.

### F-1114 "Everyone settles with the organiser" preset

One toggle writes allowed edges between members and the organiser into the rules engine.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1101
- **Prefs** -
- **Acceptance**
  1. The plan explains "4 payments, all to Raj".
  2. Undo restores the previous rules.

### F-1115 Transit routing with consent `spec v2`

Multi-hop plans only through members marked as consenting; otherwise direct-only with an explanation.

- **Effort** M · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1101
- **Prefs** `group:transitConsent`
- **Acceptance**
  1. Without consent, the plan falls back to direct and says why.
  2. The selected mode is shown in the plan.

### F-1116 Settlement statement

One-page PDF or image when a group or pair reaches zero: paid, share and net per currency, every payment, "All settled on".

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1503
- **Prefs** -
- **Acceptance**
  1. The statement is saved as an attachment to the settle checkpoint.
  2. Shareable as PDF or image through the share sheet.

### F-1117 Settle up with a person across groups

From a person page, record one real transfer and split it into linked repayment records per context (direct and each group, per currency) with a visible, editable allocation (oldest first by default). Balances are never netted across groups (spec non-goal); overpaying leaves a visible reverse balance.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1101, F-207
- **Prefs** `settle.allocationOrder`
- **Acceptance**
  1. Paying Riya 1,500 when she is owed 1,000 in Goa and 800 direct creates linked repayments of 1,000 (Goa) and 500 (direct) in one atomic, idempotent step.
  2. If I am owed in one group and owe in another, the sheet shows two separate settlements and never offsets them.
  3. Paying more than owed warns first and records the excess as Riya owing me.
  4. One undo removes every linked record.

### F-1118 Remind: a friendly reminder through the share sheet `spec: owner § 26.20`

"Remind" on the Person page (header overflow), on each debtor row in group Balances and in the Settle plan: a friendly message with the amount per currency and the UPI / payment link, opened in the share sheet (WhatsApp, SMS, email). In-app delivery comes with F-2210.

- **Effort** S · **Impact** 9 · **Backend** no · **Status** done (feat/wB-B5, 2026-10-27; `lib/remind/message.test`, `owed.test`, sync `reminders.test`, e2e `remind.spec` Person, group Balances and Settle plan; native share sheet not run on a device) · **Deps** F-1103, F-207, F-208
- **Prefs** -
- **Acceptance**
  1. "Remind" appears in the Person overflow, on each debtor row in group Balances and in the Settle plan, never for someone who owes nothing.
  2. The message is friendly, lists the amount per currency (never summed across currencies) and the UPI link (F-1103) or the friend's payment link when known; its text builder is the one F-1501 reuses. It opens the share sheet, using wa.me when the friend's phone is known.
  3. Opening the share sheet is never shown as sent; every reminder is logged in Activity ("You reminded Riya · INR 450").
  4. Once the friend is on Splito and the backend exists, the same action also sends an in-app reminder (F-2210), at most one per person per 3 days.

### F-1119 Remind me `spec: owner § 26.20`

"Remind me" next to Remind schedules a local notification for yourself about a balance (date and time, optional repeat). Nothing is sent to anyone.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done (feat/wB-B5, 2026-10-27; sync `reminders.test` incl. `nextOccurrence`, `lib/remind/when.test`, `lib/notifications/plan.test`, e2e `remind.spec` primer, list, edit, cancel, due while open; native scheduling not run on a device) · **Deps** F-1118, F-1907
- **Prefs** -
- **Acceptance**
  1. Picking a date and time and a repeat (none, daily, weekly, monthly) schedules a local notification that fires offline and opens the person or group.
  2. It notifies only me; the reminder is listed on the person page where it can be edited or cancelled, and is logged in Activity.
  3. Notification permission is asked only at this moment, with a primer (F-216 pattern), never at launch.

## E12 Activity, history and trust

Nothing changes silently; every change is visible and reversible.

### F-1201 Activity feed `spec v1, owner § 26.14`

Read/unread, All / From others, actor avatar, day headers, "you lent / you borrowed", row menu, swipe, hide, undo.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-103
- **Prefs** `swipeLeft`, `swipeRight`
- **Acceptance**
  1. The row avatar is the actor, never the participants.
  2. Hide changes the personal feed only; the audit history is untouched.
  3. Every swipe has a button and keyboard alternative.

### F-1202 Readable change history and "your share changed" `spec v1 (extended)`

An expense History tab with plain diffs per version; an Activity row whenever an edit changes my share.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-103
- **Prefs** -
- **Acceptance**
  1. "Riya changed amount 1,200 -> 1,500 and removed Sam" shows with time.
  2. An edit that changes my share creates an Activity row with old and new share.

### F-1203 Deleted items stay in place, forever `spec: owner § 26.14 (decisions 98, 103)`

No Recently deleted bin. A deleted expense, payment, write-off, comment, group or friend stays in its own list, struck through with a clock and "Deleted <time>", never purged and never counted; it opens read-only with Restore. Replaces the bin (and decision 102's per-item purge).

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wB-B3x; sync `deletedInPlace.test.ts`, `migrate.test.ts` v3 to v4, client `ledgerQueries.test.ts`, `groups/filter.test.ts`, architecture rule `hardDelete`, e2e `deletedInPlace.spec.ts`; web verified, native not yet run) · **Deps** F-114, F-615
- **Prefs** `lists.hiddenItems` (account, set of ids, default empty); `history.binDays` removed (migration drops it)
- **Acceptance**
  1. The Recently deleted screen, route (`/settings/recently-deleted` redirects to Settings > Data with a short note), Settings row, purge code (`purgeDeleted`, auto-purge, "Delete forever", days-left lines) and `history.binDays` are removed; no code path hard-deletes a record (architecture rule test).
  2. Deleted records render in place in the group Expenses tab, person history, Activity, search results, Groups list and People list, in date order, with decision 98's look; their amounts are excluded from every balance, total, chart, export total and settle plan (projection tests unchanged: tombstones already contribute nothing).
  3. A deleted group stays in the Groups list (struck, chip "Deleted"), its page opens read-only with its records struck and a Restore action; restoring a group restores exactly the records deleted with it (existing deletedWithGroup logic).
  4. A deleted expense/payment opens read-only with history and Restore (same guards: missing person or group, GROUP_INACTIVE); Undo toasts still work.
  5. Deleted items always show. Each deleted row (row "..." menu, right-click on web, long-press on native) and page has "Hide" (personal, per item, Undo) writing `lists.hiddenItems`; one "Show hidden" filter (default off) on People, Groups, the Group Expenses tab and Person history reveals hidden items (with "Unhide") and also hidden groups (replaces the Groups "Visibility" filter); no global hide-all-deleted switch (decisions 104, 105).
  6. deletePerson no longer counts "bin items"; a person named on any record (deleted or not) is kept as a struck friend rather than removed from records.
  7. e2e: delete an expense, it stays struck in the group list with clock and time and balances drop it; restore from its page; delete a group, it stays struck in Groups, opens read-only, restores; Hide one deleted expense, it disappears; "Show hidden" brings it back with Unhide. Phone and desktop.

### F-1204 Comments on expenses and repayments `spec v2, owner § 26.20`

A comment thread at the bottom of every expense and repayment detail, using Bluesky's reply rows and the Bluesky DM composer bar. Local and in the outbox now; shared once sync exists (F-2208). Disputes are F-1210. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** The expense page shows one timeline, as Expensify does (`src/pages/inbox/report/ReportActionsList.tsx`, `src/libs/ModifiedExpenseMessage.ts`): comments interleaved with F-1202 history lines ("Riya changed the amount from 1,200 to 1,250") under Bluesky DM date dividers (Today / Yesterday, `src/components/dms/DateDivider.tsx`). Long-press or right-click opens Bluesky's ContextMenu (`src/components/ContextMenu/`) with Expensify's actions (Copy, Edit, Delete, React, Copy link); on web, Up arrow in an empty composer edits my last comment.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** in progress (built and tested on feat/wB-B4, unmerged; acceptance 4 with F-2208) · **Deps** F-301, F-1201
- **Prefs** `comments.showHistory` (on)
- **Acceptance**
  1. Every expense and repayment detail ends with a thread (Bluesky reply rows) and a composer bar above the keyboard (Bluesky DM composer) with emoji and @mention of the expense's participants.
  2. I can edit and delete only my own comments; edits and deletes keep history (tombstones); every write is a `packages/sync` mutation with an outbox row.
  3. Expense rows show a comment count.
  4. New comments from others show in Activity as unread (From others) once sync delivers them (F-2208). (Not built here: no sync yet, and `activity.ts` is not touched.)
  5. History lines and comments merge in time order from the comments `byTarget` and history `byEntity` indexes, never a full scan; the preference hides history lines.
  6. The context menu offers only the actions allowed on that comment (no Edit or Delete on others'); each action also has a keyboard and screen-reader path.
  7. On web, Up arrow in the empty composer edits my last comment and Escape cancels.

### F-1205 Settle-up checkpoints `spec 4b gap 11`

Reaching zero records a checkpoint; backdated edits post a visible "Adjustment after settle-up"; "Settle so far" scopes a plan to a date.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1101
- **Prefs** -
- **Acceptance**
  1. A backdated edit after a checkpoint needs one-tap acknowledgement.
  2. "Settle so far" produces a plan for balances up to the chosen date.

### F-1206 Ledger fingerprint and balance code

A short code from a SHA-256 hash chain over ordered history so members can compare ledgers.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-103
- **Prefs** -
- **Acceptance**
  1. Identical ledgers on two devices give the same code.
  2. A mismatch opens "Find the difference".

### F-1207 Reactions on activity items (local) `spec v3`

Bluesky-style reaction palette on Activity rows; shared reactions arrive with F-2209. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Reactions also go on comments and expenses (Expensify `src/components/Reactions/`), with Bluesky's DM reaction picker and "who reacted" dialog (`src/components/dms/EmojiReactionPicker.tsx`, `ReactionsDialog.tsx`); on web, hovering a comment shows quick reactions (Expensify `MiniReportActionContextMenu`).

- **Effort** S · **Impact** 4 · **Backend** no · **Status** todo · **Deps** F-1201
- **Prefs** `reactions.set`
- **Acceptance**
  1. The reaction set is customizable.
  2. Reactions never change the ledger.
  3. Comments and expenses show reaction counts; tapping a count opens who reacted.
  4. On web, hovering a comment shows up to 4 quick reactions from the customizable set.

### F-1208 "All square" moment

When a person or group reaches zero in every currency: a one-time seal animation, success haptic and announcement, then a close/archive prompt for groups.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1704
- **Prefs** `celebrations`
- **Acceptance**
  1. Plays once per settle; reduced motion shows a static seal.
  2. Screen readers hear "You and Riya are all square".

### F-1209 Explain this balance

Tap any balance to see a line-by-line running total per currency since the last zero point: each share, payment, refund and write-off with its group, ending at the number shown. The first stop in any dispute.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-207, F-1501
- **Prefs** -
- **Acceptance**
  1. The final running total equals the displayed balance in every currency (property test over random ledgers).
  2. The Include groups choice applies; each line opens its record.
  3. Shareable as text with only that pair's lines.

### F-248 Home layout fixes from the owner's screenshot `spec: owner § 26.12 (decision 120)`

Overview first; requests, recent transactions, then Friends; Invites sent move to the Friends and invites page with a compact "N invites waiting" row on Home; overview labels and amounts never truncated, cards even; no red per-row dots; friend rows two lines; Friends search back.

- **Effort** S · **Impact** 9 · **Backend** no · **Status** done on feat/wB-post-home (e2e `homeLayout.spec.ts`; screenshots in `apps/client/qa/home/`) · **Deps** F-621 (B6), F-245
- **Prefs** -
- **Acceptance**
  1. Home order is Overview, incoming requests, Recent transactions (when F-1415 lands), Friends; "Invites sent" rows appear only on the Friends and invites page; Home shows "N invites waiting ›" when N > 0.
  2. At 320, 390, 600, 800 and 1440 px no overview label or amount is ellipsized or clipped (e2e checks scrollWidth <= clientWidth for every label and amount), and every card in a row has the same height.
  3. No coloured per-row dot on friend, request or invite rows.
  4. At 390 px a friend row is at most two lines: name with up to two group chips and "+N", one net per currency on the right (max 3, then "+N"); the last row is not under the FAB.
  5. Friends header shows search and Filters (F-1414).
  6. Screenshots of Home in light and Dim at 390 and 1440 px with the demo data.

### F-1210 Disputes and holds `spec v2 (extended), owner § 26.20 (decision 119)`

Dispute or hold an expense, one item of a bill, a repayment or a write-off, with a structured reason and an optional proposed fix; the adder, payer or an admin answers (accept = one-tap fix as a normal edit, reject with reason), the raiser can withdraw or reopen once. A disputed record keeps counting in balances (with an "of which disputed" line and a badge) and is left out of the Settle up plan by default. Full rule: ARCHITECTURE § 26.20 "Disputes and holds". **Best of both (2026-10-27):** Expensify's hold (`src/pages/iou/DynamicHoldReasonPage.tsx`, `src/libs/actions/IOU/Hold.ts`, `ProcessMoneyReportHoldMenu.tsx`) is the hold half, with its one-time explainer.

- **Effort** L · **Impact** 8 · **Backend** no (two-sided with F-2208) · **Status** built on `feat/wC-F1210-disputes` (2026-10-30; client, local, both engines), with follow-ups below · **Deps** F-1204, F-230, F-1205 (for acceptance 9)
- **Prefs** `group:settleIncludeDisputed` (off)
- **Acceptance**
  1. Raise from the row menu, the detail page, an itemized item's portion and a repayment/write-off; reason chips as § 26.20, note required for Other, proposed fix for amount, share, payer and duplicate; one open dispute per person per record.
  2. `disputes` store with `byTarget` and `byStatus`; raise, hold, release, accept, reject, withdraw and reopen are sync mutations with history and an outbox op; `canDispute` / `canResolveDispute` in `domain/permissions.ts` with bun tests (raiser cannot resolve except withdraw; adder, payer or admin resolve; reopen once; after a reopen only a group admin answers, and outside a group the adder or payer still answers and a second reopen is refused, ruling 187).
  3. Balances, totals, overview, charts and exports still count a disputed or held record exactly as recorded (property test: balances identical with and without open disputes).
  4. Every balance surface shows a per-currency "of which disputed" line from a projection kept in the balance transaction (no scan); rows and detail show "Disputed" / "On hold" badges with icon and text.
  5. Settle up leaves disputed and held amounts out of the plan by default, states the left-out amount per currency, and "Include disputed" (remembered per group) puts them back; the plan hash changes on raise, accept, release (F-1101).
  6. Accept applies the proposed fix in one tap as a normal edit (history "changed the amount from ... to ..."); editing a disputed record asks "Does this resolve <name>'s dispute?"; deleting the record closes it as Gone.
  7. Raise and answer post system lines in the comment thread; Activity rows for raised, answered, reopened, released; For you card "Needs your answer"; Disputed filter on lists, Activity and Search (`status: disputed`); CSV dispute column; a 3-day nudge on the For you card only.
  8. Before the backend, "raised by" picks a participant (default me, "recorded by you").
  9. Accepting a dispute on a record before a settle-up checkpoint shows "Adjustment after settle-up" (with F-1205).
  10. Demo data has disputes and holds in every state (open, accepted, rejected, withdrawn, reopened, gone) in at least two currencies; demoCoverage lists them; e2e (no external hand-offs, owner 118) and the perf gate on the 10k fixture pass.

**Built (2026-10-30), acceptance 1-8 and 10:** see ARCHITECTURE § 26.20 "[Built] (F-1210)". **Follow-ups, not built:**
  - **F-230 For you card:** "Needs your answer" (open disputes on records I may answer, via `useOpenDisputes()` in `state/disputes.ts`) and the 3-day nudge on that card only. The card does not exist yet and Home is being redesigned by another builder.
  - **Home overview cards:** the "of which disputed" line on the per-currency overview cards (another builder owns them). Person and Group balances have it; `disputed_balances` already holds the figures per person, group and currency.
  - **Acceptance 9, "Adjustment after settle-up":** needs F-1205 checkpoints.
  - **Disputed filter in the address** (F-241): "Disputed only" on a group and a person is page state today.
  - **Two-sided disputes** wait for F-2208 (sync); until then "raised by" records for a chosen participant, "recorded by you".

### F-1211 Group discussion thread `spec: owner § 26.1 best of both (Expensify group chats, Bluesky group chats)`

Both apps let a group talk (Expensify `src/pages/NewChatPage/`, rooms and trip rooms; Bluesky `src/screens/Messages/`). Splito keeps it light: an optional "Discussion" Pager tab on the group page, after Members, using F-1204's comment rows and composer, for plans and questions not tied to one expense ("who has the hotel booking?"). An expense or payment linked in a message shows as a compact card. **Off by default** so the group tabs stay § 26.12's Expenses / Balances / Members unless the user turns it on. Local and in the outbox now; shared with F-2208.

- **Effort** M · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1204, F-208
- **Prefs** `group:discussionTab` (default off)
- **Acceptance**
  1. Group comments reuse the `comments` store with `targetType` group and the `byTarget` index (ARCHITECTURE § 9.8), with F-1204's edit, delete and tombstone rules.
  2. The tab mounts lazily; discussion comments from others count in Activity once synced.
  3. Turning the tab off keeps the comments; turning it on shows them again.
  4. Playwright: post, edit and delete a group comment; Activity shows it.

### F-1212 Grouped Activity rows, filter pills, new-items pill and mute `spec: owner § 26.1 best of both (Bluesky notifications)`

Bluesky's notifications screen (`src/screens/Notifications/components/NotificationItem/Item/`, `src/state/queries/notifications/grouped/`, `components/TabPills.tsx`, `components/RefreshPill.tsx`, `src/state/cache/thread-mutes.tsx`) on Splito's Activity. Consecutive items of the same kind in the same group within a window are grouped ("Riya and 2 others added 5 expenses in Goa trip · you borrowed ₹1,240 · €18") with an expandable avatar stack. Under § 26.14's All / Me / Others tabs sit scrollable filter pills: Expenses, Payments, Comments, Requests (arrows on web). A session seen-snapshot keeps new items tinted for the visit they arrived in; items that arrive while scrolled show an "N new" pill instead of moving the list. The row menu gains "Mute <group or person> in Activity" with Undo and a Muted list in Settings.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1201
- **Prefs** `activity.grouping` (on), `activity.groupWindowMinutes` (60), `activity.filters` (pills shown and their order), `activity.muted` (list)
- **Acceptance**
  1. A pure `groupActivity(items)` in `components/activity/feed.ts` with bun tests: same kind, same group and inside the window only; my effect is totalled per currency, never across currencies; expanding lists every item.
  2. A grouped row's effect equals the sum of its items per currency.
  3. Muting removes items from Activity and its unread badge only; balances, lists and history are untouched; Settings lists and unmutes.
  4. The "N new" pill shows only when scrolled away from the top; tapping it scrolls up and clears it.
  5. Playwright with the large demo set: a 6-expense burst shows as one row and expands.

## E13 Analytics, reports and budgets

Exact numbers from the ledger, never illustrative.

### F-1213 Activity tabs All / Me / Others `spec: owner § 26.14 (decision 92)`

Replace Activity's "All" / "From others" tabs with "All" / "Me" / "Others".

- **Effort** S · **Impact** 6 · **Backend** no · **Status** built on feat/wC-F1213-F259-activity (owner 92; `activity.tabs` order not built, the three tabs are fixed) · **Deps** F-1201
- **Prefs** `activity.tab` (account, default All; remembered per decision 90), `activity.tabs` (which of the three show and their order)
- **Acceptance**
  1. Bluesky Pager tabs All / Me / Others on Activity; Me lists only items whose actor is me, Others only items by other people, All both; each paged by cursor (§ 9.8).
  2. The unread badge and "Mark all read" count only Others (my own actions are never unread).
  3. The chosen tab survives reload; F-1212's filter pills and grouping apply inside each tab.
  4. e2e at phone and desktop widths with the demo set; Hindi 0 missing.

### F-1301 Basic analytics `spec v1, owner § 26.16`

Spending over time, by category, per person and group, paid vs share, filters, CSV.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** in progress (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. One chart per currency, never mixed.
  2. CSV export matches the on-screen filter.
  3. Charts and a table view, filtered by period, currency and group; the chart / table toggle sits in that filter row, never in the header. The header holds Ask Splito (F-2301) and Export (the shared Export sheet, F-275). A converted view labels the rate used.
  9. Scope is one chip + one "Show expenses from" checklist sheet (All, Non-group expenses, each group); no separate group dropdown or "Include groups" toggle; By-group chart taps narrow the scope; last scope remembered per device (§ 26.16, decision 67).

### F-1302 My Spending measure everywhere `spec v1 (extended)`

One measure switch (My share, Paid by me, Group total, Net effect) for every chart, total, budget, search and export; a My Spending view.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1301
- **Prefs** `analytics.measure`
- **Acceptance**
  1. Repayments and write-offs never count as spending.
  2. A12: a seeded ledger matches hand-computed totals in every measure.

### F-1303 Full reports `spec v2`

Week, month, year and custom periods, balance trend, tap a segment to see its expenses, table view, one filter state for list, totals, charts and CSV.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1302
- **Prefs** -
- **Acceptance**
  1. Period boundaries are cut in the viewer's timezone and an expense's local date never shifts.
  2. Tapping a chart segment lists exactly its expenses.
  3. A table view exists for every chart.

### F-1304 Budgets `spec v2 trip budget (extended)`

Personal, household and trip budgets per category or overall (per tag once F-1404 ships); weekly, monthly, pay-cycle or trip period; rollover; pace per day; local alerts.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1302, F-1305, F-1907
- **Prefs** `budgets.alertAt`, `budgets.measure`
- **Acceptance**
  1. "INR 310/day left for 9 days" pace shown.
  2. Alerts fire at 80% and 100% as local notifications.
  3. Budgets are per currency.

### F-1305 Period presets

Fiscal year with a start month (April under en-IN/hi), pay-cycle month, rolling 7/30/90 days, trip dates.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1301
- **Prefs** `fiscalYearStart`, `payCycleDay`
- **Acceptance**
  1. Reports, budgets, search and exports use the same presets.
  2. Under en-IN and hi the fiscal year defaults to April-March.

### F-1306 Deterministic insights `spec v2`

A "What changed" card from real data only: above-average categories, biggest mover, new recurring charges, unusual expenses.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1303
- **Prefs** -
- **Acceptance**
  1. Every line links to the expenses behind it.
  2. Shows nothing when data is insufficient; no AI involved.

### F-1307 Receivables ageing and net position

"Owed to me" per currency in 0-30 / 31-90 / 90+ day buckets, average days to repay, net position over time.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1301
- **Prefs** -
- **Acceptance**
  1. The oldest unpaid item shows first with a one-tap reminder.
  2. Buckets are per currency and match the ledger.

### F-1308 Subscriptions dashboard and 30-day forecast

Every recurring item with monthly-equivalent share, next due date and annual total; 30-day forecast of recurring, future-dated and expected repayments.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-306
- **Prefs** -
- **Acceptance**
  1. The forecast sums per currency only.
  2. Price changes show on the dashboard.

### F-1309 Custom report builder `spec v3 cards (extended)`

Pick rows, columns, measure and filters; show as table, bar, line or donut; save as a customizable Analytics card.

- **Effort** L · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1303, F-1703
- **Prefs** -
- **Acceptance**
  1. A saved report reappears as a card that can be hidden, reordered and renamed.
  2. It exports to CSV and XLSX.

### F-1310 Reimbursable and work expense claims

Mark an expense or my share as reimbursable by an employer; Pending -> Submitted -> Reimbursed; claim PDF with receipts.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1302, F-1503
- **Prefs** -
- **Acceptance**
  1. Reimbursed amounts come off My Spending.
  2. Claims never touch group balances.

### F-1311 Payment accounts and reconciliation

Optional "paid from" account on my payments; reconcile against a statement; lock personal records before a date.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1302
- **Prefs** `paymentAccounts`
- **Acceptance**
  1. Reconcile shows cleared total vs statement total.
  2. Unlocking a locked period asks for confirmation.

## E14 Search, organisation and power tools

Find anything fast; change many things at once.

### F-1401 Free search across expenses `spec 4b v1`

Search titles, notes, people, groups and amounts, offline and indexed.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** done (built and tested on a feat/b-* branch, unmerged) · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. Results show totals per currency.
  2. No full-ledger scan per keystroke (measured).
  3. Once F-2301 ships, the top result row is "Ask Splito about '<query>'".

### F-1402 Advanced search operators `spec v2 saved views (extended)`

amount>500, category:, tag:, with:, paid:me, group:, before:/after:, has:receipt, is:unsettled; chips build the same query on mobile. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's search autocomplete (`src/components/Search/SearchAutocompleteList.tsx`, `src/libs/SearchAutocompleteUtils.ts`): typing in the Search & Ask input suggests operator keys and then their values (categories, people, groups, currencies), and operators can be negated (`-category:food`).

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1401
- **Prefs** -
- **Acceptance**
  1. "amount>500 category:food with:riya is:unsettled" returns the right set.
  2. A query can be saved as a view or budget target.
  3. Typing "cat" suggests `category:` and then matching categories; Tab or Enter accepts, and phones get tappable suggestions.
  4. A negated operator returns exactly the complement set (bun test).

### F-1403 Saved views `spec v2`

Built-in This month, a trip, Outstanding, Missing receipts, plus user views. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's suggested searches and save flow (`src/pages/Search/SearchTypeMenuWide.tsx`, `SearchSavePage.tsx`, `SavedSearchList.tsx`): built-in views also include Unsettled with me, On hold, Possible duplicates and Drafts, and any search in the Search & Ask drawer can be kept with "Save search".

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1401
- **Prefs** `savedViews`
- **Acceptance**
  1. The same filter state drives list, totals, charts and CSV.
  2. Views can be created, renamed, reordered and deleted.
  3. "Save search" in the drawer stores the current query as a named view; built-in views can be hidden but not deleted.

### F-1404 Tags and occasion tags

Multi-label #tags typed inline with autocomplete; rename, merge, recolour, archive; festival tags suggested from a bundled date table.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. "Cab 450 #work #goa" saves two tags.
  2. A "Diwali 2026 vs last year" card compares by category.

### F-1405 Bulk select and edit

Multi-select on every list (long-press, checkbox, shift-click, select all matching); change category, tags, date, group, template; delete; export. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's selection mode (`src/components/BulkActionBar/`, `src/libs/actions/MobileSelectionMode.ts`): long-press enters selection mode on phones with a bottom action bar (Move F-318, Merge two F-504, Duplicate, Hold F-1210, Category, Delete, Export), a count, Select all matching and Cancel; web uses checkboxes and Shift-click.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. Moving to a group where a participant is not a member is blocked with an explanation.
  2. One undo reverts the whole batch.
  3. Selection mode hides the FAB and the header shows the count; Back or Escape leaves it with nothing changed.
  4. Actions that do not fit the selection are disabled with the reason (Merge needs exactly two).

### F-1406 Category hierarchy and per-group sets `spec v1 categories (extended)`

Two-level categories that roll up; merge with remap; per-group visible sets; import/export.

- **Effort** M · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1701
- **Prefs** `categories`, `group:categorySet`
- **Acceptance**
  1. Merging remaps past expenses as one undoable batch.
  2. Reports and budgets roll child categories up to the parent.

### F-1407 Command palette and keyboard shortcuts

Cmd/Ctrl+K fuzzy palette for people, groups, expenses, settings and actions; N, /, G-then-key, J/K, E, ? cheat sheet; skip link and visible focus. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Bluesky's `n` (new expense) and `/` with its rule that hotkeys are off while a dialog or the drawer is open (`src/lib/hotkeys/index.tsx`), plus Expensify's Cmd/Ctrl+J shortcuts dialog, Shift+Esc mark all read, Cmd/Ctrl+Enter to save the open sheet and Up arrow to edit the last comment (`CONST.KEYBOARD_SHORTCUTS`, `src/pages/settings/DynamicKeyboardShortcutsPage.tsx`).

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1401
- **Prefs** `shortcuts`
- **Acceptance**
  1. Every action reachable from the palette.
  2. Shortcuts are remappable and listed on "?".
  3. N, /, Cmd/Ctrl+J and Shift+Esc work on web and with hardware keyboards (F-228) and never fire while typing in a field; Cmd/Ctrl+Enter saves the open sheet when Save is enabled.

### F-1408 Spreadsheet grid view (web)

Table of any filtered list with inline edits through normal mutations, keyboard navigation and paste from Sheets/Excel as drafts.

- **Effort** L · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1405, F-522
- **Prefs** `grid.columns`
- **Acceptance**
  1. An invalid cell edit is rejected by validateExpense.
  2. Pasted rows become drafts in the Inbox.

### F-1409 Full-text receipt search

Index OCR text and line items locally (FTS5 on native, inverted index on web).

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-502, F-1401
- **Prefs** -
- **Acceptance**
  1. Searching "sunscreen" finds the receipt and highlights the line.
  2. The index updates on save and search works offline.

### F-1410 Private overlay and private notes

My own category, tags and note on a shared expense, visible only to me and never part of the group ledger.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** -
- **Acceptance**
  1. The overlay syncs with my account only and never conflicts with the group record.
  2. My Spending uses my overlay category.

### F-1411 Custom fields

User-defined text, number, date, select and checkbox fields, global or per group, searchable and exportable.

- **Effort** M · **Impact** 4 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `customFields`
- **Acceptance**
  1. field:project=acme search works.
  2. Custom fields export as columns.

### F-1412 Pin saved views and groups as Home tabs `spec: owner § 26.1 best of both (Bluesky saved feeds)`

Bluesky's pinned feeds become its home tabs (`src/screens/SavedFeeds.tsx`, `src/view/com/pager/`). In Splito a saved view (F-1403) or a group can be pinned as an extra Home tab beside "Friends" (Bluesky TabBar over Home's list). With no pins Home is exactly § 26.3's Overview and friends list. Settings > Home tabs lists pins with drag to reorder (Bluesky `DraggableList`) and unpin; pin from a group's overflow or a saved view's menu.

- **Effort** M · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1403, F-203
- **Prefs** `home.pinnedTabs` (ordered list, default empty)
- **Acceptance**
  1. No pins renders today's Home exactly (existing e2e unchanged).
  2. A pinned group shows that group's expense list with its balances; a pinned view shows its filtered list and per-currency totals.
  3. Tabs swipe with the Pager and mount lazily; reordering animates with a haptic.
  4. An archived or deleted group, or a deleted view, leaves the pins with a note.

## E15 Sharing and summaries

Get the numbers to people who do not have the app.

### F-1413 Hide settled by default; every choice stored in the database `spec: owner § 26.12 (decision 90)`

Settled friends and groups are hidden by default with a "Show settled" filter switch, and every choice the user makes is a database preference that survives reload. Queued by the owner for later ("store and pick later"); not in Wave B.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** partly done (wave B post-shell: criterion 1, plus Sort / Include groups / groups Sort saved on Apply; criteria 2-5 todo) · **Deps** F-117
- **Prefs** `people.showSettled` (account, default off), `groups.showSettled` (account, default off), plus a preference for every filter and sort field on People, Groups, Analytics, Activity and Search (account scope unless device-specific)
- **Acceptance**
  1. Home / People and Groups hide fully settled rows by default; the filter sheet has "Show settled" (off); the counts line still shows "N settled"; balances and overview totals are unchanged.
  2. Every filter, sort, scope and toggle on People, Groups, Analytics, Activity and Search reads from and writes to the preferences store; after a reload or app restart the same view comes back (e2e on web and a native run).
  3. Device-scope preferences live in the local database's preferences store (not synced), migrated once from MMKV / localStorage with a test; secrets stay in the OS secure store; a theme boot mirror is allowed but the database wins on conflict.
  4. An architecture rule test fails when a screen keeps a user-visible filter/sort choice only in component state.
  5. Settings > Reset restores every one of these to its default.

### F-1414 Search on the Friends list `spec: owner § 26.12 (decision 91)`

Restore the Friends list's own search (removed by F-222) next to its filters on Home / People, in addition to the Search & Ask drawer. Queued by the owner; build only when the owner says so.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-222
- **Prefs** -
- **Acceptance**
  1. A search icon in the Friends section header expands into Bluesky's SearchInput (Reanimated, reduced-motion aware) with an X that collapses and clears.
  2. Live filter by friend name (and nickname, folded case and accents), combined with the active filters and Show settled; "No matches for '...'" empty state.
  3. The query is cleared on leaving the screen; Search & Ask is unchanged.
  4. e2e at phone and desktop widths; Hindi 0 missing.

### F-1415 Recent transactions on Home and Group pages `spec: owner § 26.17 (decision 97)`

A "Recent transactions" section in the Home body (all expenses and repayments involving me, across friends and groups) and on every Group page (that group's only). Queued by the owner; build only when the owner says so.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** Home part built with F-256 (5 newest, See all -> Activity, fixed count and position); the Group-page section and the three preferences below are still todo · **Deps** F-117
- **Prefs** `home.recentTransactions` (account, default on), `group.recentTransactions` (account, default on), `recentTransactions.count` (account, default 5, 3-10), position via the existing Home section order
- **Acceptance**
  1. Home shows the newest N expenses and repayments involving me (category tile, title, my net chip per currency, never summed); "See all" opens Activity.
  2. A Group page shows the newest N of that group only, above the Expenses / Balances / Members tabs; "See all" opens its Expenses tab.
  3. Reads are cursor-paged index reads (`byDate`, `byGroupDate`; § 9.8), live-updating on writes.
  4. Hidden by its preference; count and Home position respected; the right column is unchanged.
  5. e2e at phone and desktop widths with the demo set; Hindi 0 missing.

### F-240 UX audit fixes (2026-10-28) `spec: docs/audit/UX-AUDIT-2026-10-28.md`

Fix every finding of the 2026-10-28 UX audit marked "F-240" (1 critical, 6 major, 15 minor); findings 2, 3, 22 are in Wave B (B1, B6) and 9 waits for the owner's red-dot call. Queued for Wave C, first after F-228a.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** Wave B merged
- **Prefs** -
- **Acceptance**
  1. Every F-240 row in the audit is fixed, each with a regression test (unit or e2e) that fails before the fix, and the audit table marks it fixed with the commit.
  2. Critical #1: the FAB is mounted once in the shell from the header left-slot state; no screen mounts its own; e2e shows it on empty Home, Groups, Analytics and Activity at phone width and never on pushed pages.
  3. Contrast (#7): every money and chart text token passes WCAG AA (4.5:1 body, 3:1 large) in light and Dim, checked by an automated contrast test over the theme tokens.
  4. Web hit areas (#6): every icon button is at least 44 x 44 px on web (e2e geometry check at 390 px).
  5. Full checks green; screenshots of every changed screen, phone and desktop, light and Dim.

### F-241 Every tab, sheet and popup addressable by URL `spec: owner § 26.3 (decision 100)`

Copy any URL and land on the same screen: pages, in-page tabs, sheets and popups, and the list state that matters are all routes (web path/query, native deep link), following Expensify's route-per-modal model on Bluesky's navigator. Queued right after the Wave B merge and F-228a.

- **Effort** L · **Impact** 9 · **Backend** no · **Status** built on feat/wC-F241-254 (unmerged), web verified (e2e `deeplinks.spec.ts` at 390 and 1440); native opens the page then the sheet through a queue, not run · **Deps** Wave B merged, F-228a
- **Prefs** -
- **Acceptance**
  1. A route table in `routes.ts` covers every page, tab (e.g. `/groups/:id/balances`, `/activity/others`), sheet (e.g. `/expense/new?group=:id`, `/people/:id/record-payment`, `/groups/:id/settle`, `/settings/regional/timezone`, `/search?q=&mode=ask`), every drawer (side drawer `?drawer=menu`, Search & Ask), pickers inside sheets as sub-routes (e.g. `/expense/new/currency`; decision 101) and list state as query params (filters, sort, showSettled, scope, period, currency); a test asserts every sheet and tab component has a route.
  2. Opening a sheet or tab pushes its URL; closing pops it; browser Back closes the top sheet; Forward reopens it.
  3. Pasting or refreshing any of these URLs (web) or opening the deep link (native) shows the parent page with the sheet/tab on top and the draft restored; an entity missing on this device shows "Not on this device yet".
  4. Confirmation prompts and "..." menus are not addressable; no URL performs or arms an action (test: a sheet URL never writes).
  5. List state in the URL and the database preferences (F-1413) agree: the URL wins when present, otherwise the saved preference.
  6. e2e: for every route in the table, load it cold at phone and desktop widths and assert the right screen, tab or sheet is open.

- **Assistant rulings, 2026-10-29** (made while reviewing the build; the owner has not seen them, change on request): (1) **Tab switches replace the history entry** (`/groups/:id/balances`, `/activity/others`): Back never steps through tab taps, and the heavy page is not mounted twice. This is the reading of acceptance 2 for tabs; sheets and pickers do push. (2) **A pasted sheet-plus-picker URL is one history entry**: the browser's Back leaves to the previous site, while the in-app X steps back one level (picker to sheet to page).
- **Deferred:** "Not on this device yet" for an entity a link names but the device has not pulled (acceptance 3, § 14) waits for sync (F-2103). Until then a sheet whose target is missing is dropped and the page shows its own not-found state; a page's own "isn't on this device" empty state is unchanged.
- **Native, until the in-sheet picker hand-over lands (fix/ios-wB):** a link to a picker opens its parent sheet only, and nothing opens over a composer (Add / Edit expense, New group); a phone keeps sheets as dialog state, with the link's sheet held for its page.

### F-242 why-did-you-render and the wasted-render gate `spec: owner § 17, § 26.10 (decision 108)`

Add `@welldone-software/why-did-you-render` to dev builds and a Playwright render scenario that fails on any avoidable re-render, then fix every report it finds. Runs first among the post-merge items so later work is held to it.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** in progress (feat/wC-F242: gate, fixes and numbers in `docs/COMPLETION_MATRIX.md`; done once merged) · **Deps** Wave B merged
- **Prefs** -
- **Acceptance**
  1. why-did-you-render is loaded only in dev builds (web and native) from the client entry, version verified against React 19.3 + React Compiler (or the documented fallback), tracking all components and hooks; production and e2e-timing bundles contain none of it (bundle check).
  2. A dev-build Playwright scenario (launch -> Home, tab round, open/close Add expense, type 10 characters, scroll 1,000 rows, Search & Ask + one question) collects every report and per-component render counts; it fails on any report or a count above the recorded baseline; baseline stored in the repo.
  3. Every report found on the merged Wave B app is fixed at the root (stable props, memoised rows, narrow selectors, stable context, equal snapshots kept), each with a before/after count in `docs/COMPLETION_MATRIX.md`.
  4. The scenario is part of every merge's checks (decision 107).

### F-243 Toasts at the top right with a close button `spec: owner § 26.8 (decision 110)`

Move every toast to the top right (rail/desktop; top full-width on phones) and give each a close X. Done in the Wave B assemble step (small, one component).

- **Effort** S · **Impact** 6 · **Backend** no · **Status** done (wave B post-shell) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Web sonner `position="top-right"` with offset below the header; native toasts slide in from the top below the safe area; phone web top full width.
  2. Every toast shows a round X ("Dismiss", 44 px hit area) next to its action; swipe up/aside dismisses on phones; max 3 stacked, newest on top.
  3. Auto-hide unchanged except toasts that must be acted on (update toast) stay until dismissed.
  4. Toasts never cover the header's actions or the FAB; reduced motion respected; e2e at 390 and 1440 px checks position and the X.

### F-244 Unsynced data drawn lighter `spec: owner § 9.8 (decision 111)`

Replace the per-row red sync dot with a lighter, AA-safe text style for every record not yet synced; full strength once the server acknowledges.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done (wave B post-shell) · **Deps** F-117
- **Prefs** -
- **Acceptance**
  1. One `useSyncTone(row)` (or row prop) maps syncStatus local/pending/syncing to the `text_contrast_medium` tone for titles, amounts, chips and meta on every list row, card, chip and detail page; synced = full strength; failed = full strength + "Needs attention".
  2. Contrast test: the lighter tone passes WCAG AA in light and Dim for body and large text.
  3. The per-row red dot and duplicate "Saved on this device" text are removed (UX audit #9); the avatar aggregate dot stays.
  4. The tone fades to full strength on acknowledgement (Reanimated, reduced-motion aware); accessibility label adds "Not synced yet".
  5. e2e: a local row has the lighter colour; a row flipped to synced via the e2e test hook shows full strength.

### F-245 Overview currency cards as separate, balanced boxes `spec: owner § 26.12 (decision 113)`

On Home/People and Groups, each currency card is its own box of equal size in a grid whose columns keep rows even for any number of currencies. Queued by the owner ("don't fix, just remember to fix").

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done on feat/wB-post-home (unit `overviewGrid.test.ts`, e2e `homeLayout.spec.ts`) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Each currency card has its own border, radius and padding with a gap between cards; no shared outer box with dividers.
  2. Column rule: phone 1 (2 when the card fits); rail/desktop max 3: 1 -> 1, 2 -> 2, 3 -> 3, 4 -> 2x2, 5 -> 3+2, 6 -> 3x2, 7+ -> 3 per row; a short last row keeps the card width, left-aligned, never stretched.
  3. Cards in a row share the tallest height, content top-aligned; amounts never wrap mid-number.
  4. The counts line sits below the grid as plain text.
  5. Adapts to every screen size (decision 114): columns from the measured content width (min 240 px card, max 3) then the balanced rule; re-lays out live on resize, rotation, rail/sidebar and right-column changes.
  6. e2e geometry at 320, 390, 600, 860, 1100, 1440 and 2560 px with 1 to 6 currencies, plus a live resize (equal widths, no stretched card, no overflow); light and Dim screenshots.

### F-246 Search that understands every field `spec: owner § 26.19 (decision 116)`

Search & Ask understands people, places, amounts, category, type, group, dates, currency, payer and status, and combines them logically, with removable facet chips.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** built on c-search, unmerged (2026-10-31): every field below is a term kind and every query is resolved from the keys (ARCHITECTURE 9.8, 17.1, 26.19); chips, matched-field rows, a Payments section, English and Hindi, a 90-query table, per-field tests on both engines, an oracle test against the rows, speed at 5,000 and 10,000, e2e at 390 and 1440, Hindi 0 missing. Not built: invites and friend requests are not searched; the Claude-powered parser is F-247. · **Deps** F-117, F-222
- **Prefs** -
- **Acceptance**
  1. `search_terms` indexes every field: title, notes, item names, group name and trip location, people (paid by / with), category, type (expense, payment, write-off, comment, group, friend, invite), currency, date (day, month, year), status (settled, owed, deleted, hidden, inactive), amount keys per currency.
  2. A query parser recognises facets (names with fuzzy matching, "paid by", "with", amount comparisons and ranges incl. "1 lakh", "1k", "around", periods incl. month names and "last month", categories, types, groups, currencies, statuses) in English and Hindi; AND across facets, OR within one; the rest is free text.
  3. Each recognised facet shows as a removable chip in the search box; removing one re-runs the search; results grouped with per-currency totals, paged within § 26.10 budgets on the 10k fixture.
  4. A table test of 60+ queries (e.g. "food or travel in Goa over 500", "paid by Riya last month", "deleted payments", "EUR between 10 and 50", "Netflix") with expected facets and results.
  5. e2e at phone and desktop widths; Hindi 0 missing.

### F-247 Claude-powered search and Ask with the owner's key `spec: owner § 26.19 (decision 115)`

Use Claude to turn free-form questions into structured queries the on-device engine runs; money is always computed on the device. The key lives in the OS secure store via Settings until the backend proxy exists.

- **Effort** M · **Impact** 8 · **Backend** no (backend proxy later) · **Status** todo, backend batch 1 (Claude key server-side via the API proxy, not in the app) · **Deps** F-246, F-2301
- **Prefs** `ai.enabled` (account, default off until a key or sign-in exists), `ai.model` (device; default the latest fast Claude model for query understanding)
- **Acceptance**
  1. The key is read from the git-ignored `.env.local` (`ANTHROPIC_API_KEY`, decision 117) only by a dev-only local AI proxy (`scripts/ai-proxy`, started with the dev/preview server, bound to localhost, origin-checked); the app calls the proxy, never Anthropic directly; never an `EXPO_PUBLIC_*` variable; a test scans the built web bundle, backups and logs for `sk-ant-` and fails if found.
  2. A question goes to Claude with a tool schema (intent, people, groups, categories, types, amount ranges per currency, periods, text terms) plus only the names needed to resolve it; the response is validated and run by the on-device engine; Claude never returns or computes amounts shown to the user.
  3. First use shows exactly what is sent; offline, no key or an API error falls back to the on-device parser with no fake answer.
  4. Latency: answer within 1.5 s p50 on a normal connection with a streaming "Thinking…" state; cancel on new keystroke; cost guard (max tokens, one call per question).
  5. When the backend exists, calls switch to the backend proxy and the per-device key path is removed (tracked in the backend batch).
  6. Model ids and API usage follow the current Claude API docs (latest models) at build time.

### F-267 Fix the `tab, 50 ms, tab` tap-latency red `spec: owner § 26.9 (decisions 150-152), found in the F-250 perf run`

`perf/tapLatency.spec.ts` "tab, 50 ms, tab" at CPU x1 fails the 100 ms budget (188 to 244 ms, one long task of 134 to 143 ms; once "result never showed" on `/activity`): a tap on Analytics, then a tap on Activity 50 ms later. It is not from F-250: pristine `bf82d1d` (the base of that branch), built and run in a clean worktree on the same machine, fails identically (189 ms, long task 143 ms). Likely the first Analytics mount (a long task) landing between the two taps.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo, found 2026-10-30 · **Deps** F-255
- **Prefs** -
- **Acceptance**
  1. Find the long task (Chrome trace at CPU x1) and split or defer it so the second tap is shown within 100 ms and no JS task over 50 ms runs between the taps.
  2. `pnpm perf` is green at CPU x1 and x4, three runs in a row, on a machine under load 10.
  3. The result is recorded in `docs/COMPLETION_MATRIX.md` with the trace's main cause.

### F-1501 Text summaries for WhatsApp `spec 4b v1`

Whole-group or "only their part" summaries with WhatsApp markup, sent via wa.me in the recipient's language.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1101
- **Prefs** `person:messageLanguage`
- **Acceptance**
  1. "Only their part" contains only that person's lines and total.
  2. Uses the friend's phone when known, the share sheet otherwise.

### F-1502 Shareable image cards `spec v2 summary (extended)`

On-device image for any balance, plan, expense or summary, with per-creditor UPI QR, hide-amounts and theme options.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1105
- **Prefs** `share.footer`, `share.theme`
- **Acceptance**
  1. Cards render offline.
  2. "Hide amounts" shows percentages only.

### F-1503 Trip summary PDF `spec v2`

PDF with totals per currency, per-person paid vs share and the plan.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1101
- **Prefs** -
- **Acceptance**
  1. Totals match the ledger and are per currency.
  2. Generated on device and works offline.

### F-1504 Trip recap story and Year in Review

Swipeable recap at trip end and an annual review built on device from real data.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1502, F-1302
- **Prefs** -
- **Acceptance**
  1. Every stat taps through to its expenses.
  2. A "hide amounts" option exists.

### F-1505 Share privacy presets

One rule set for every outbound share: only the recipient's lines (default), hide items, notes, other balances.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1501
- **Prefs** `share.privacyPreset`
- **Acceptance**
  1. The default preset hides other members' balances on every share type.
  2. A preview shows exactly what the recipient will see.

### F-1506 Serverless balance link `spec v2 balance link (no-server version)`

A link whose #fragment holds a compressed, optionally encrypted snapshot that the static PWA renders; needs only static hosting of the PWA, and the Splito server never sees the data.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1505, F-1901
- **Prefs** -
- **Acceptance**
  1. The friend sees their lines, total, pay buttons and an "as of" stamp without signup.
  2. Network logs show no fragment data sent to any server.
  3. Shows only the recipient's lines by default.

### F-1507 Expense image card (e-receipt) `spec: owner § 26.1 best of both (Expensify e-receipts)`

Expensify draws an e-receipt for expenses without a photo (`src/components/EReceipt.tsx`, `DistanceEReceipt.tsx`). Splito's "Share as image" on the expense or repayment overflow renders one card: title, date, total, who paid, each person's share (or only the chosen recipient's), group, an optional UPI pay QR for what that person owes (F-1105), and the Splito mark, handed to the share helper. Optionally the same card is the thumbnail of expenses without a receipt.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-301
- **Prefs** `eReceipt.showAllShares` (on), `eReceipt.includePayQr` (on when I have a UPI handle), `eReceipt.asThumbnail` (off)
- **Acceptance**
  1. Amounts go through `formatAmount` per currency; the card renders off-screen with one renderer shared with F-1502 (a new capture dependency passes the ARCHITECTURE § 2 gate); works offline.
  2. With "show all shares" off, a "For" picker chooses the recipient and only their share shows.
  3. The image never holds notes, receipts or anyone else's payment handle.
  4. Checked on iOS, Android and web (download).

## E16 Privacy and security

Local protection that works without an account.

### F-1601 App lock with step-up actions `spec v1`

Off / lock the app / lock sensitive actions only; PIN, auto-lock, failed-attempt backoff, biometrics with fallback, encrypted native storage.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1701
- **Prefs** `lock.mode`, `lock.timeout` (device)
- **Acceptance**
  1. "Sensitive only" asks for PIN or biometrics before export, delete-for-everyone and pay links.
  2. Web limits are documented honestly; PIN is not called encryption.
  3. On iOS the first launch after a reinstall clears stale Keychain lock and PIN entries (Keychain survives uninstall).

### F-1602 PIN recovery kit `spec v1 (extended)`

A recovery code (words or QR) when setting a lock without an account.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1601
- **Prefs** -
- **Acceptance**
  1. The code resets a forgotten PIN.
  2. The setup screen states plainly what is lost without it.

### F-1603 Hide amounts (discreet mode)

Eye toggle masks every amount app-wide, keeping signs and colours; optional on launch.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `hideAmounts` (device), `hideAmounts.onLaunch`
- **Acceptance**
  1. Masking covers lists, cards, charts axes and share previews.
  2. Screen readers announce "amount hidden".

### F-1604 App-switcher privacy and screenshot blocking

Cat logo over the background in the app switcher; optional screenshot block.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `privacyScreen`, `blockScreenshots`
- **Acceptance**
  1. The app-switcher snapshot shows no balances when enabled.
  2. On web/PWA content is hidden while the tab is hidden, if enabled.

### F-1605 Notification privacy levels

Full, partial or minimal notification text; partial by default when lock or hide amounts is on.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1907
- **Prefs** `notify.detail`
- **Acceptance**
  1. Applies to every local notification now and push later.
  2. Defaults to partial when app lock or Hide amounts is on.

### F-1606 Hand-off mode

Pin the app to one group's Add expense and list so a friend can add; leaving needs PIN or biometrics.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1601
- **Prefs** -
- **Acceptance**
  1. Other groups, People, settings, payments and exports are hidden.
  2. Expenses added are tagged "added on Saransh's phone by hand-off".

### F-1607 Privacy and data safety center `spec v1 PWA storage (extended)`

One screen: unsynced count, last backup, storage persistence, encryption status per platform in plain words.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-2001
- **Prefs** -
- **Acceptance**
  1. Shows navigator.storage.persisted and offers Export when storage is not persistent.
  2. Counts update after each sync or backup.

### F-1608 Receipt privacy: EXIF strip and auto-redact

Strip EXIF unless location is kept; detect card numbers, phones and emails and offer one-tap masking.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-502
- **Prefs** `receipts.stripExif`, `receipts.autoRedact`
- **Acceptance**
  1. Shared copies carry the redaction; the original stays local if kept.
  2. EXIF GPS is stripped by default before storing.

### F-1609 Hidden personal expenses and groups

A "hidden" flag that removes personal expenses or groups from lists until unlocked.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1601
- **Prefs** -
- **Acceptance**
  1. Hidden items are excluded from lists and widgets until unlock.
  2. PIN or biometrics reveals them; the hidden flag is device scope.

### F-1610 Erase this device `spec v1 (extended)`

Offline erase of local data with an export offer and an unsynced-work warning.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-2001
- **Prefs** -
- **Acceptance**
  1. Removes the local database, preferences and attachments.
  2. Shows the number of unsynced changes before erasing.

## E17 Customization, appearance and motion

Everything customizable, everything smooth.

### F-1701 Settings for every preference `spec 3a, owner § 26.1, 26.2, 26.11`

Theme, accent with Apply, text size, density, motion, haptics, tabs, defaults, categories, language, timezone, formats, lists, notifications.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (built and tested on ui/r1-polish-2 / ui/preview-latest, unmerged) · **Deps** F-104
- **Prefs** every registry key
- **Acceptance**
  1. Each setting has Reset to default; Reset all works.
  2. Account-scope settings sync; device-scope stay local.
  3. A search field finds any setting by label or synonym (en and hi), and changed-from-default settings are marked.
  4. Appearance has "Dark mode style: Dim / Black" (`darkTheme`, default Dim) and an accent picker (default Bluesky blue `#006AFF`, Splito emerald optional); Regional has the timezone, and each expense keeps its local date and IANA tz.

### F-1702 Black-and-white theme and background overrides `spec v3`

B&W theme and advanced background overrides kept separate from the accent.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1701
- **Prefs** `theme`, `backgroundOverride`
- **Acceptance**
  1. All screens pass contrast checks in B&W.
  2. Background overrides reset independently of the accent.

### F-1703 Card customization `spec v3`

Hide, reorder, rename, resize and tint cards on People, group overview, Analytics and trip dashboard.

- **Effort** L · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1701
- **Prefs** `cards.people`, `cards.group`, `cards.analytics`, `cards.trip`
- **Acceptance**
  1. Changes persist, sync and reset.
  2. Dialog and form internals are not customizable.

### F-1704 Motion: Lottie, animated balances, success check, list animations `spec v1, owner § 26.10`

Page illustrations, count-up balances, skeletons, success check, list enter/exit/reorder, all UI-thread.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** in progress (built on ui/brand, wiring) · **Deps** F-201
- **Prefs** `motion`, `haptics`
- **Acceptance**
  1. Reduced motion and motion = off give static fallbacks.
  2. No dropped frames on 1,000-row lists (profiled, numbers recorded).

### F-1705 Haptic vocabulary `spec v1 haptics (extended)`

One table mapping intents to haptics, e.g. a rigid tick when remaining hits zero.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `haptics`
- **Acceptance**
  1. Every haptic call goes through useHaptics() by intent.
  2. Turning the haptics pref off silences every haptic.

### F-1713 Animated icons and Expensify-style moments `spec: owner § 26.10 (decision 96)`

Animate icons where the motion carries meaning, and add Expensify-style success, empty-state and celebration animations, all on the UI thread with static fallbacks. Queued for Wave C.

- **Effort** L · **Impact** 7 · **Backend** no · **Status** in progress (`c-anim`: the `AnimatedIcon` primitive with fill morph, tick, draw, lid, pulse, rotate wired; twinkle and plus-to-X skipped by owner 213; Expensify-style moments, `motion.iconAnimations` / `motion.celebrations` and the 1,000-row profile not built) · **Deps** F-1704
- **Prefs** `motion` (existing: full / reduced / off), `motion.iconAnimations` (account, default on), `motion.celebrations` (account, default on)
- **Acceptance**
  1. An `AnimatedIcon` primitive (react-native-svg animated props + Reanimated, Lucide geometry only) with variants: fill morph (bottom bar, sidebar, drawer selected state), draw (check on Save / Settle / Accept), lid (trash on Delete), pulse (sync dot while syncing), rotate (FAB plus to X, chevrons on expand), twinkle (Search & Ask sparkles on open), tick (Activity icon when a new item arrives).
  2. Expensify-style moments: "All settled" success animation when a balance or group reaches zero, a celebratory animation on the first expense and on settling a whole trip, animated empty states on every list (static fallback), spring page and sheet transitions matching Bluesky.
  3. Reduced motion or `motion` = off shows the final static frame; `motion.iconAnimations` / `motion.celebrations` off disable each family.
  4. Profiled: no dropped frames on a 1,000-row list scroll with animated icons visible; each animation under 400 ms and never blocks input; bundle growth recorded.
  5. Animations inventory in docs/reuse/motion.md naming the Bluesky or Expensify source pattern for each; e2e checks the static fallback under reduced motion.

### F-1706 Living cat mascot for sync states

The header cat blinks on refresh, perks on sync ack, sleeps offline, raises a paw on conflict.

- **Effort** M · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1704
- **Prefs** `mascotAnimations`
- **Acceptance**
  1. Every state also has a text and accessibility label.
  2. Reduced motion shows static states.

### F-1707 Alternate app icons

Cat icon variants via Bluesky's AppIconSettings plumbing.

- **Effort** M · **Impact** 4 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `appIcon`
- **Acceptance**
  1. Works in dev/release builds and hides in Expo Go.
  2. The chosen icon persists across restarts.

### F-1708 Balance wording style per group

Ledger style ("You owe Sam") or calm style ("Sam is ahead by"), numbers unchanged.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `group:balanceWording`
- **Acceptance**
  1. Couple and Family templates default to calm.
  2. Numbers and signs are identical in both styles.

### F-1709 Lite mode `spec v1 performance (extended)`

Turns off Lottie, blur and avatars, compresses receipts to about 200 KB, lazy-renders charts; default on 3 GB RAM or less.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `liteMode` (device)
- **Acceptance**
  1. Measured on an Android Go-class device and recorded.
  2. On by default with 3 GB RAM or less and can be turned off.

### F-1710 Tabular numerals and font option

tabular-nums on all money; Inter, System or Atkinson Hyperlegible.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `fontFamily`
- **Acceptance**
  1. AnimatedAmount no longer jitters (digits keep width).
  2. The font choice applies app-wide through setFontFamily and persists.

### F-1711 Dim splash and brand kit on every platform `spec: owner § 26.2, 26.11`

Splash, icons and favicon from the brand kit on iOS, Android and web/PWA; in dark mode the splash uses the Dim background, never pure black.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** in progress (done on web; native splash criteria 2-3 need a simulator run) · **Deps** F-201
- **Prefs** -
- **Acceptance**
  1. The native splash `dark.backgroundColor` and the web launch screen take ALF Dim's background token with the logo centred; light mode keeps the light background (brand kit generated by `apps/client/scripts/brand.ts`).
  2. No pure-black frame appears between the splash and the first screen in Dim (checked on iOS and web).
  3. iOS, Android and web/PWA show the splash, app icon and favicon from the brand kit, with a light and Dim screenshot per platform.

### F-1712 Original Splito mark before public release `spec: owner § 26.22`

The owner's butterfly is a dev-only mark (Bluesky's trademark). An original mark replaces it in the one logo source file before any public release.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1711
- **Prefs** -
- **Acceptance**
  1. An original mark replaces the butterfly in the one source file and the `Logo` component; the brand kit (favicon, app icons, splash, PWA icons) is regenerated.
  2. A release-build check fails while the dev SVG is bundled; the `docs/RELEASE_CHECKLIST.md` item closes only then.
  3. No public web deploy, TestFlight / App Store or Play Store build ships the butterfly.

## E18 Accessibility and localization

Usable by everyone, in their language.

### F-1801 Money direction never shown by colour alone

Every balance has a word, an arrow and a sign; palettes: default, colour-blind safe, monochrome.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** done (built and tested on a feat/b-* branch, unmerged) · **Deps** -
- **Prefs** `moneyPalette`
- **Acceptance**
  1. Balances read correctly in grayscale screenshots.
  2. The monochrome palette shows direction by arrow and weight only.

### F-1802 Screen-reader money sentences

Each row is one accessible element whose label is a domain-built sentence with the currency spoken by name.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** todo · **Deps** F-1001
- **Prefs** -
- **Acceptance**
  1. VoiceOver reads "Riya owes you 450 Indian rupees, from 2 groups".
  2. en and hi sentences covered by tests.

### F-1803 Accessibility actions for every swipe and long-press `spec v1`

accessibilityActions on swipeable rows mirror the swipe prefs; web maps to the row menu.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1201
- **Prefs** `swipeLeft`, `swipeRight`
- **Acceptance**
  1. The VoiceOver rotor offers Mark read, Hide, Delete, Undo, Settle up.
  2. On web every action is in the row menu and reachable by keyboard.

### F-1804 Accessible portion editor and spoken remaining

Portion chips become adjustable; remaining is a polite, throttled live region.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-401
- **Prefs** -
- **Acceptance**
  1. Swipe up on a chip adds a portion and announces it.
  2. Percent and shares fields get steppers with spoken values.

### F-1805 Dynamic Type to 200% with reflow

Follow the OS scale up to AX5 / 200% with layouts that reflow; money never truncates.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `textScale` (adds "system")
- **Acceptance**
  1. At 200% no amount is truncated on People, Group or Expense.
  2. At large scales bottom-bar labels collapse to icons with long-press tooltips.

### F-1806 Increase-contrast mode

Token set for OS high contrast or user choice: AAA text, thicker borders, no blur.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `contrast`
- **Acceptance**
  1. Follows prefers-contrast and iOS Increase Contrast.
  2. An automated check confirms AAA text contrast for the token set.

### F-1807 Undo toasts that wait for assistive tech

With a screen reader or large text, undo toasts stay until dismissed and are announced.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Every undo is also reachable from the Activity row menu.
  2. Focus returns to where the deleted row was.

### F-1808 Contrast-guarded accent and category colours

Live contrast check on accent and category colour pickers with "use nearest accessible shade".

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1701
- **Prefs** -
- **Acceptance**
  1. Colours below 3:1 (UI) or 4.5:1 (text) get the nudge.
  2. Button text switches to black or white automatically.

### F-1809 Read my balances aloud

On-device text-to-speech summary of balances in the app language.

- **Effort** S · **Impact** 4 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Works offline and stops on tap.
  2. Speaks in the app language.

### F-1810 English and Hindi `spec 5, owner § 26.2`

Lingui strings with Hindi at launch; Indian number grouping under hi and en-IN.

- **Effort** M · **Impact** 9 · **Backend** no · **Status** done (en + hi complete) · **Deps** -
- **Prefs** `language`
- **Acceptance**
  1. Missing translations fall back to English.
  2. Amounts use Indian grouping (₹1,00,000) under hi and en-IN.

### F-1811 Hinglish and more Indian languages `spec v3`

Hinglish, then Bengali, Marathi, Telugu, Tamil and more with subsetted Noto fonts; picker in native scripts; per-friend message language.

- **Effort** L · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1810
- **Prefs** `language`, `nativeDigits`, `person:messageLanguage`
- **Acceptance**
  1. Each language passes a pseudo-locale and truncation check.
  2. A friend's message language is independent of the UI language.

### F-1812 Locale-correct plurals, dates, sorting and search

ICU plurals, unambiguous relative dates, Intl.Collator sorting, accent-insensitive search.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Hindi "कल" is always paired with a date.
  2. Sorting uses Intl.Collator per locale and search ignores accents and case.

### F-1813 RTL done properly `spec 5`

Bidi isolation of names and amounts, mirrored flows and arrows, pseudo-locales in CI.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** -
- **Acceptance**
  1. "أحمد owes you ₹450" renders in the right order.
  2. An RTL pseudo-locale run in CI catches unmirrored icons and arrows.

### F-1814 Self-describing charts `spec v2`

Pattern fills, direct labels and a domain-generated summary sentence per chart.

- **Effort** M · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1301
- **Prefs** -
- **Acceptance**
  1. Every chart has a summary sentence equal to the table view's data.
  2. Charts stay readable in grayscale (pattern fills, direct labels).

### F-1815 Accessibility CI and release audit `spec A13 (extended)`

axe-core on every route in Playwright (both themes, 320-1440 px), React Native accessibility lint, and a scripted VoiceOver / TalkBack / keyboard-only pass per release with results recorded.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** A-035 (ARCHITECTURE-BACKLOG)
- **Prefs** -
- **Acceptance**
  1. CI fails on any new serious or critical axe violation against a baseline that only goes down.
  2. Each release records a VoiceOver, TalkBack and keyboard-only run of add expense, settle up and filters.

### F-1816 App language dropdown on the web splash, sign-up and the desktop right column `spec: owner § 26.1 best of both (Bluesky AppLanguageDropdown), § 26.2 multi-language`

Bluesky's `src/components/AppLanguageDropdown.tsx` (no props): a ghost button with a globe icon (Lucide `Globe`), the current language's name and a chevron, `tiny` on web and `small` on native, built on Bluesky's `Select` (dropdown on web, sheet on native). Splito renders it where Bluesky does, mapped to Splito's screens:

1. **Web sign-in splash:** right end of the footer of `screens/LoggedOut/SplashScreen.web.tsx` (Bluesky `src/view/com/auth/SplashScreen.web.tsx:186`). The native splash stays without it, as in Bluesky.
2. **Sign-up:** the footer row under every sign-up step, beside "Having trouble?" (`screens/Signup/index.tsx`; Bluesky `src/screens/Signup/index.tsx:226`), on every platform.
3. **Desktop right column:** a footer row at the bottom of `view/shell/desktop/RightNav.tsx` (Bluesky `src/view/shell/desktop/RightNav.tsx:152`). Bluesky shows it there only when signed out at tablet width; Splito shows it at every session state on wide web, because Splito is used signed out.

Bluesky's fourth placement, the logged-out `NavSignupCard` in the LeftNav and drawer, is not copied: Splito's sidebar and drawer already carry Sign in (§ 26.3). Choosing a language writes the existing `language` preference (the same value as Settings > Language and onboarding, F-1810, F-211), activates its Lingui catalog without a reload (Bluesky `dynamicActivate`) and sets `document.documentElement.lang` on web. Options come from the one supported-language list, each labelled in its own script plus English ("हिन्दी – Hindi"), so languages added by F-1811 appear automatically.

- **Effort** S · **Impact** 7 · **Backend** no · **Status** done (feat/wB-B2; `components/AppLanguageDropdown`, `components/Select`, `locale/languages.ts`, mounts in the web splash, Signup and RightNav; `e2e/language.spec.ts`; adds `@radix-ui/react-select` 2.2.6) · **Deps** F-1810, F-225, F-224
- **Prefs** `language` (existing, no new value); the `rightColumn.languageDropdown` switch was removed (owner 128)
- **Acceptance**
  1. Copied from Bluesky with the attribution header; the reuse row names Bluesky's version (won) and Expensify's (a Preferences page only, `src/pages/settings/Preferences/`).
  2. Rendered in exactly the three places above.
  3. Choosing Hindi on the web splash shows the splash, sign-up and the app in Hindi with Indian grouping, with no flash or reload; the choice survives a restart and equals Settings > Language.
  4. Accessible: label "App language, current: English"; keyboard operable on web; on native a sheet with the current option checked (not colour alone).
  5. Playwright: web splash -> Hindi -> Create account shows Hindi sign-up; at 1440 px the right-column dropdown switches the sidebar labels; native sign-up checked on the iOS simulator.

## E19 Platform integrations

Native surfaces and the PWA.

### F-1901 PWA: service worker, offline shell, updates and install `spec v1, owner § 26.21`

A production-only service worker with an offline app shell, a Bluesky-style update toast, a web manifest and install; plus manifest shortcuts, badge and a .splito file handler.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wA-38; criterion 5's Export action waits for F-2001, the warning offers Add to Home Screen) · **Deps** F-201
- **Prefs** `pwa.installHintDismissed` (device)
- **Acceptance**
  1. The service worker registers only in production web builds (off in dev and e2e). It precaches the hashed app shell and assets, serves fonts and images stale-while-revalidate, and falls back to the cached shell for navigations, so the app opens offline (A16: refreshing a deep route offline works).
  2. API responses are never cached (data lives in IndexedDB); a test asserts no API route reaches the cache.
  3. A new version installs in the background and shows the toast "New version available · Reload"; it never reloads on its own while a sheet has unsaved input, and an update with a pending outbox loses nothing.
  4. The manifest has name, short name, brand-kit icons, the Dim dark background and standalone display. The browser install prompt is captured once and offered as "Install app" in Settings plus a one-time dismissible hint; iOS shows "Add to Home Screen" instructions.
  5. Safari users not running the installed PWA see a one-time warning that Safari may erase site data after 7 days without a visit, with Install and Export actions.

### F-1902 iOS simulator dev build `spec: matrix`

Dev client build with Bluesky build settings and Intl polyfills.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (runs on iPhone 18 Pro simulator) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. App launches to People on the simulator.
  2. Build settings and polyfills are recorded in REUSE_MAP.

### F-1903 Android build and emulator run `spec: matrix`

Java on PATH, dev client build, emulator run.

- **Effort** S · **Impact** 8 · **Backend** no · **Status** done (built and tested on a feat/b-* branch, unmerged) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. The add-expense and settle-up smoke flow passes on the Android emulator.
  2. The build steps are added to the AGENTS.md command list.

### F-1904 Extension data bridge

After each mutation write a small redacted snapshot to the iOS App Group / Android SharedPreferences (Bluesky SharedPrefs module).

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** -
- **Acceptance**
  1. Per-currency totals are never summed in the snapshot.
  2. The snapshot respects Hide amounts.

### F-1905 Home and lock-screen widgets `spec v3`

Small, medium and large widgets with per-currency balances, top people/groups and Add buttons.

- **Effort** L · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1904
- **Prefs** `widget.content`
- **Acceptance**
  1. Widgets update after a local mutation without opening the app.
  2. Totals are never summed across currencies and respect Hide amounts.

### F-1906 App Intents, Siri, Shortcuts and Android App Actions

Add expense, What does X owe me, Show group balance, Settle up with, Scan receipt; splito:// add URL on web.

- **Effort** L · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-1904, F-503
- **Prefs** `intents.saveWithoutReview`
- **Acceptance**
  1. "Split 600 cab with Sam" creates an Inbox draft unless the user opted into direct save.
  2. Every intent works offline.

### F-1907 Local scheduled notifications

expo-notifications local scheduling for recurring due, settle nudges, digests and budgets; no server.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** done (feat/wB-B5, 2026-10-27; `lib/notifications/plan.test`, e2e `remind.spec` Settings and due-while-open; OS scheduling in airplane mode needs a device run; web fires only while open, said in the UI) · **Deps** -
- **Prefs** `notify.recurring`, `notify.reminders`, `notify.digest`
- **Acceptance**
  1. Notifications fire in airplane mode.
  2. Each type has its own toggle.

- **Built (Wave B, B5)**: `lib/notifications/` on expo-notifications: native arms OS notifications (date, daily, weekly, monthly triggers; a one-shot stands in when a repeat's first time is more than one period away and is swapped when Splito next opens), so they fire in airplane mode; the web build checks every 15 s while open, shows a toast (or a browser notification when the tab is hidden), and shows what came due while closed as a toast on the next open. Only `notify.reminders` has a Settings row; `notify.recurring` and `notify.digest` exist in the registry and are honoured by the module but have no row until recurring expenses (F-306) and the digest exist (a switch that changes nothing would be a placeholder). All three are device-scope. OS notification ids live in device storage, never synced.

### F-1908 Home-screen icon quick actions `spec v3`

Add expense, Scan receipt, Settle up and two dynamic recent groups on long-press.

- **Effort** S · **Impact** 6 · **Backend** no · **Status** todo · **Deps** -
- **Prefs** `quickActions`
- **Acceptance**
  1. Order and pinned group are customizable.
  2. The dynamic entries follow the two most recent groups.

### F-1909 Quick add from Control Center, Action Button and Quick Settings

iOS ControlWidget and Android TileService open the composer with the keypad focused.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-1906
- **Prefs** -
- **Acceptance**
  1. Long-press opens the last-used group.
  2. Works when the app is not running.

### F-1910 Live Activity for a trip day

Lock-screen / Dynamic Island card with today's spend, my balance per currency, kitty and budget left.

- **Effort** L · **Impact** 6 · **Backend** no · **Status** todo · **Deps** F-1904, F-703
- **Prefs** -
- **Acceptance**
  1. Updates locally on every mutation with no push.
  2. Ends automatically after the trip end date.

### F-1911 Spotlight and launcher search indexing

People, groups and recent expenses indexed for system search.

- **Effort** M · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-1906
- **Prefs** `spotlight.showAmounts`
- **Acceptance**
  1. Amounts are hidden from system search by default.
  2. A result opens the right screen through the link resolver.

### F-1912 Apple Watch and Wear OS companion

Complication with owed/owe per currency and a quick add that lands in the Inbox.

- **Effort** XL · **Impact** 4 · **Backend** no · **Status** todo · **Deps** F-1904, F-503
- **Prefs** -
- **Acceptance**
  1. Watch entries need no network and arrive as drafts.
  2. The complication shows totals per currency, never summed.

### F-1913 Store review prompt at happy moments

Native review API only after a positive moment (all square, fifth saved expense), at most once per 120 days.

- **Effort** S · **Impact** 3 · **Backend** no · **Status** todo · **Deps** F-1208
- **Prefs** `reviewPrompt`
- **Acceptance**
  1. Never shown in a session that had an error, a conflict or a failed save.
  2. Can be turned off; never shown on web.

## E20 Data portability

Your data in and out, safely.

### F-2001 JSON backup export and import `spec v2, owner § 26.20`

Full JSON backup from Settings > Data > Export and restore from Settings > Data > Import: versioned JSON with schema validation, migration, dedupe, preview, merge/replace and rollback on failure; generated on the device.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wB-B6; tests: packages/sync/test/backup.test.ts) · **Deps** F-103, F-1701
- **Prefs** -
- **Acceptance**
  1. A12: round-trip preserves IDs, currencies and splits.
  2. A corrupt file is rejected atomically with nothing applied.
  3. Settings > Data has Export (full JSON backup) and Import; Import shows a preview of what will change and asks merge or replace before applying.
  4. Safety rules (Opus review): a file person row with this device's me id, or a remap that would fold two people into one, is refused (BACKUP_CORRUPT); only live people and groups satisfy a reference; a restore adds no expense to an inactive group (GROUP_INACTIVE, decision 89) while payments may still land; device-scoped preferences and live invite links never travel in a file; a lower or missing schemaVersion is refused until row migrations exist.
  5. Replace asks for a copy of this device first ("Save a copy of this device first", skippable only on a second confirm) and the restore toast offers Undo from an in-memory pre-restore backup for the session.
- **Server note:** the `backup.import` and `backup.remove` outbox ops are new op types; review how the server applies them (idempotence, base versions, tombstones) when the backend arrives.

### F-2002 Encrypted and automatic backups

Optional passphrase (AES-256-GCM, key derived on device), weekly/monthly auto-backup to a chosen folder, health reminders.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-2001, F-1907
- **Prefs** `backup.schedule`, `backup.folder`, `backup.encrypt`
- **Acceptance**
  1. A wrong passphrase fails without partial import.
  2. A missed backup triggers a reminder.

### F-2003 Splitwise importer `spec 4b v2`

Import Splitwise exports (and Tricount / Settle Up / Splid via mapper profiles) with people matching and duplicate checks.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-504
- **Prefs** -
- **Acceptance**
  1. An imported group's balances match the source export.
  2. Re-importing the same export creates no duplicates.

### F-2004 Power exports `spec v2 CSV (extended)`

Extends the export centre (F-2007): current filter across all groups; wide (paid + share columns), tidy, YNAB/Actual, Beancount/hledger; CSV, XLSX, PDF; formula-safe.

- **Effort** M · **Impact** 7 · **Backend** no · **Status** todo · **Deps** F-2007, F-1302
- **Prefs** `export.layout`
- **Acceptance**
  1. Cells starting with = + - @ are escaped.
  2. Columns are labelled with currency.

### F-2005 Move to a new phone without an account

Guided transfer of the whole local ledger, attachments and account-scope preferences to a new phone by a .splito file (AirDrop, Quick Share, cable or a cloud folder), plus OS backup integration (iCloud device backup, Android Auto Backup) with secrets and deviceId excluded.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** todo · **Deps** F-2001
- **Prefs** -
- **Acceptance**
  1. After transfer both phones show the same record counts and per-currency totals, checked before the old phone offers to erase.
  2. A restored or transferred install gets a new deviceId, so operations are never duplicated (A-048).
  3. Lock PIN and tokens never transfer; the new phone asks for its own.

### F-2006 Storage manager

Space used by receipts, attachments and history per group; compress old images, clear caches. Offloading synced originals (keeping thumbnails) is added when F-2107 ships.

- **Effort** S · **Impact** 5 · **Backend** no · **Status** todo · **Deps** F-312
- **Prefs** `storage.compressAfterDays`
- **Acceptance**
  1. Space per group and per type matches the files on disk.
  2. Compressing keeps the receipt readable and records the change in history.
  3. Nothing unsynced or the only copy is ever deleted.

### F-2007 Export centre: CSV and PDF statements `spec: owner § 26.20`

Settings > Data > Export (CSV, PDF statement, full JSON backup via F-2001) with filters, plus Group overflow "Export", Person overflow "Export statement" and the Analytics header's Export (the same sheet). Generated on the device.

- **Effort** M · **Impact** 8 · **Backend** no · **Status** done (feat/wB-B6; tests: packages/domain/test/statement.test.ts, src/data/exportLedger.test.ts, src/lib/export/statementFormat.test.ts, e2e/backup.spec.ts; native PDF/share not run on a device) · **Deps** F-1301, F-2001
- **Prefs** -
- **Acceptance**
  1. Settings > Data > Export offers CSV, PDF statement and full JSON backup, with filters for date range, group, person and currency.
  2. Group overflow "Export", Person overflow "Export statement" and the Analytics header Export open the same export pre-filtered to that group, that person, or the current Analytics filter.
  3. Exports are generated on the device and work offline; amounts are exact and labelled per currency, never summed across currencies; CSV cells starting with = + - @ are escaped.
  4. The PDF statement lists every expense and repayment in range with a running balance per currency that matches the on-screen balance.

## E21 Backend foundation

Fastify on Bun + Postgres. Everything shared waits for this.

### F-2101 API service `spec 9, owner § 26.2`

Fastify on pinned Bun, Postgres migrations, versioned contracts, structured errors, health/readiness, graceful shutdown.

- **Effort** L · **Impact** 10 · **Backend** yes · **Status** in progress (fan2/api paused, 13 open review findings) · **Deps** -
- **Prefs** -
- **Acceptance**
  1. The 13 fan2/api review findings are closed.
  2. Integration tests run against real Postgres under Bun.

### F-2102 Sign-in and sessions `spec v1, owner § 26.15`

Email OTP, mobile OTP, Google and Apple; refresh and revoke; OTP throttling; secure token storage; web httpOnly cookie + CSRF.

- **Effort** L · **Impact** 10 · **Backend** yes · **Status** todo · **Deps** F-2101
- **Prefs** -
- **Acceptance**
  1. A15: session expiry and revoke verified; OTP throttled.
  2. No secrets in the client bundle or logs.
  3. Google (Google Sign-In native, Google Identity Services web) and Apple (expo-apple-authentication native, Sign in with Apple JS web) work on iOS, Android and web; the server verifies ID tokens, links by verified email only, supports Apple's hidden relay email, and new social accounts go through setup (owner 138).
  3c. Sign-up requires both email and phone, each verified by OTP; the API refuses to finish an account without both and returns `CONTACT_REQUIRED` with which one is missing, used by the blocking step (owner 139).
  3b. One account can add and remove sign-in methods (email, phone, Google, Apple) and change its email or phone; the last method cannot be removed.
  4. Signed in, Settings > Account shows an account row (avatar, name, email/phone, sync status) and a destructive "Log out" row opening "Log out?", which warns when the outbox holds unsynced changes ("N changes haven't synced yet") and offers "Keep this device's data" / "Erase this device's data"; logout never silently deletes unsynced outbox rows (§ 26.15).

### F-2103 Sync push/pull and conflicts `spec v1`

Bounded push with server idempotency, opaque-cursor pull with tombstones, snapshot rehydrate, structured conflicts, honest status labels, web tab lock.

- **Effort** XL · **Impact** 10 · **Backend** yes · **Status** todo · **Deps** F-2102, F-103
- **Prefs** -
- **Acceptance**
  1. A05: offline create/edit/delete, kill, reconnect; the second device sees each change exactly once, including crash injection.
  2. A06: simultaneous edits raise an actionable conflict; no money lost.
  3. "Synced" shows only after server acknowledgement; user switch never exposes another account's data.
  4. A client older than the server's minimum contract version shows "Update required", keeps its outbox and resumes after updating.
  5. First sync of the F-109 fixture finishes in under 60 s on a mid-range phone with progress shown and the app usable throughout.
  6. Sync state drives the avatar dot (F-223): green only after acknowledgement, yellow while the outbox is not empty.

### F-2104 Move local data into an account `spec v1`

Explicit, atomic migration of offline data into a new account.

- **Effort** M · **Impact** 9 · **Backend** yes · **Status** todo · **Deps** F-2103
- **Prefs** -
- **Acceptance**
  1. A failed migration leaves local data intact.
  2. Every migrated record reaches the server exactly once.

### F-2105 Invites and invite links `spec v1, owner § 26.18`

Server side of F-619 and F-618's "Send invite": personal and group invite links and QR codes with max uses, expiry, revoke, role and the group approval queue; using a link counts as consent; email/SMS drafts.

- **Effort** M · **Impact** 9 · **Backend** yes · **Status** todo · **Deps** F-2103
- **Prefs** `group:invite.defaultRole`
- **Acceptance**
  1. A09: expired or revoked invites fail; repeated acceptance is idempotent.
  2. Opening a draft is never shown as sent.
  3. Max uses and expiry are enforced server-side; "approve each join" puts group joins in the approval queue.

### F-2106 Link a private friend to a real account `spec v1`

Identity confirmation and preview before linking; never by display name.

- **Effort** M · **Impact** 8 · **Backend** yes · **Status** todo · **Deps** F-2105
- **Prefs** -
- **Acceptance**
  1. A09: linking causes no duplicates or ownership leaks.
  2. Cancelling the preview changes nothing.
  3. Accepting an invite to a group that holds a private person for me offers "This is me: Sam" through the same confirm flow.

### F-2107 Attachment upload `spec v1`

Private object storage, dependency-aware transfer queue, server type/content validation, progress, retry, cancel.

- **Effort** M · **Impact** 8 · **Backend** yes · **Status** todo · **Deps** F-2103, F-312
- **Prefs** -
- **Acceptance**
  1. An interrupted upload resumes without duplicating the attachment.
  2. Receipt text is redacted from routine logs.

### F-2108 Server permissions and history visibility `spec 4b gap 11`

Server-enforced group permissions and roles (incl. teen / dependent visibility); new members see all or only-since-join history; former members see up to their leave date.

- **Effort** M · **Impact** 8 · **Backend** yes · **Status** todo · **Deps** F-2103, F-610
- **Prefs** `group:history.visibleToNew`
- **Acceptance**
  1. A removed account cannot read or write disallowed data (A09).
  2. Visibility choice shows on the invite preview and is enforced per cursor.

### F-2109 Needs attention: conflicts and refused changes `spec v1 (handoff 8)`

One screen for every operation the server refused or that conflicts: side-by-side versions with each member's balance effect, Keep mine (rebased as a new revision), Take theirs, or Edit; dependent operations shown waiting; writes blocked by removal from a group kept recoverable (move to personal, export or discard).

- **Effort** M · **Impact** 9 · **Backend** yes · **Status** todo · **Deps** F-2103
- **Prefs** -
- **Acceptance**
  1. A06: a conflicting edit to the same expense shows both versions and no option loses money.
  2. Resolving a parent operation releases its waiting dependents in order.
  3. Writes made after removal from a group are never dropped silently.

### F-2110 Production operations `spec 9 (extended)`

Deploy pipeline per tier, Postgres point-in-time backups with a monthly restore drill, object-storage versioning, uptime and error alerts, per-account and per-IP rate limits, incident runbook.

- **Effort** M · **Impact** 9 · **Backend** yes · **Status** todo · **Deps** F-2101
- **Prefs** -
- **Acceptance**
  1. A restore drill rebuilds a tier to a stated point in time and the recovery time is recorded.
  2. Rate limits return structured retryable errors and the client backs off.
  3. Secrets come from a secret store and a CI scan proves none reach logs.

### F-2111 Account directory and friend requests `spec: owner § 26.18`

Server lookup of an exact email or phone ("on Splito" / "not on Splito" only) and friend requests that become friendships only when the other person accepts. Backend for F-618.

- **Effort** M · **Impact** 9 · **Backend** yes · **Status** todo · **Deps** F-2102, F-2103
- **Prefs** `privacy.findByContact`, `privacy.friendRequestsFrom` (enforced here)
- **Acceptance**
  1. Lookup is exact match only, rate-limited per account and IP, and reveals nothing but on / not on Splito; someone with "Let people find me" off reads as not on Splito.
  2. A request becomes a friendship only on accept; decline is silent to the sender; unanswered requests expire after 30 days; "people with my link only" refuses requests that did not come through a link.
  3. Requests queued offline are checked and sent from the outbox on reconnect; repeated sends and accepts are idempotent.
  4. Accepting links a matching private friend through F-2106's confirm flow.

### F-2112 Feedback endpoint `spec: owner § 26.15`

Receives feedback from the outbox (F-226) and reports its status back to "Your feedback".

- **Effort** S · **Impact** 5 · **Backend** yes · **Status** todo · **Deps** F-2103, F-226
- **Prefs** -
- **Acceptance**
  1. Feedback saved on the device before sign-in is sent through the outbox after sign-in, exactly once.
  2. The server stores only what the sheet showed as attached (no amounts, names, notes or receipts).
  3. Status changes (received, answered) appear in "Your feedback".

## E22 Shared and collaborative

Features that need other people's devices or a server.

### F-2201 Push notifications on iOS, Android and web `spec v1, owner § 26.20 (decision 137)`

Real push on every platform: APNs and FCM through expo-notifications, Web Push (VAPID) in the PWA service worker. Types follow Settings > Notifications (owner 131): Payments (expense with me, payment to/from me, edit or delete that changes my share), Comments (comment, @mention), Invites (request, accepted), disputes (F-1210). Bluesky's NSE rewrites text, threads per group and adds safe actions.

- **Effort** L · **Impact** 9 · **Backend** yes · **Status** todo, first backend batch (right after F-2101..F-2103) · **Deps** F-2101, F-2102, F-2103, F-1901
- **Prefs** `notify.payment`, `notify.comments`, `notify.invite` (existing; no new settings, owner 128)
- **Acceptance**
  1. Push arrives on an iOS device, an Android device and a closed-tab Chrome/Edge/Firefox PWA (Safari where supported) for each type, and not when its switch is off.
  2. Permission only from a tap after a primer; refusal shows a state with a Settings link; never asked at launch.
  3. Text in the recipient's language; lock-screen content follows F-1605 privacy levels; per-group threads; actions limited to Open / Mark read.
  4. Tapping opens the exact screen by URL (owner 100), including when the app was killed; signed out, it goes to sign-in and resumes (owner 125).
  5. The payload is a hint: the app pulls, never writes the payload to the store; duplicates and out-of-order pushes show once.
  6. Tokens per device and account, refreshed on schedule, deleted on log out and on the server when invalid; one push issue per launch at most (§ 25).
  7. e2e/Maestro checks on simulators and the web service worker; no test hands anything to a real app (owner 118).

### F-2202 Notification digest, mute and "only if it affects me"

Instant, daily, weekly or off per group; bursts batched; minimum balance change filter; quiet hours. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Bluesky's per-type settings (`src/screens/Settings/NotificationSettings/`): each type (new expense, edit affecting me, comment, mention, payment, reminder, friend request) has separate push and in-app toggles; plus Expensify's per-group mode (`src/pages/settings/Report/DynamicNotificationPreferencePage.tsx`: Instantly, Daily digest, Mute) in the group overflow.

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2201
- **Prefs** `group:notifyMode`, `notify.minBalanceChange`, `quietHours`, `notify.types`
- **Acceptance**
  1. Four quick expenses arrive as one batched notification.
  2. Quiet hours delay delivery and never drop it.
  3. Every type has push and in-app toggles; in-app off keeps the item in Activity but out of the badge.
  4. Mute in a group's overflow equals notify mode off and shows a muted icon on the group row.

### F-2203 Hardened read-only balance link `spec v2`

Server-hosted link showing only the viewer's lines with optional code, expiry, single/multi use and access log.

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2103
- **Prefs** `balanceLink.expiryDays`
- **Acceptance**
  1. Revoking stops access immediately; tenant isolation tested.
  2. An expired link shows a clear expired page.

### F-2204 Personal guest links `spec 4b v2`

One link per member to add expenses, claim items, see lines and tap "I've paid" in the browser; changes tagged "via link"; revoke and undo all its changes.

- **Effort** L · **Impact** 9 · **Backend** yes · **Status** todo · **Deps** F-2105, F-2108
- **Prefs** -
- **Acceptance**
  1. A guest can edit only what they created through that link.
  2. "Revoke link and undo all" reverses its operations atomically.

### F-2205 Guest-to-member upgrade `spec v1 linking (extended)`

A guest who installs the app lands in the group as themselves with history, claims and drafts.

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2204, F-2106
- **Prefs** -
- **Acceptance**
  1. No duplicate person is created.
  2. History, pending claims and drafts are present after the upgrade.

### F-2206 Live table mode `spec 4b v2`

Everyone claims their own receipt items from a table QR and sees their running total live.

- **Effort** L · **Impact** 8 · **Backend** yes · **Status** todo · **Deps** F-2204, F-401
- **Prefs** -
- **Acceptance**
  1. Unclaimed items are highlighted; totals include pro-rata tax and tip.
  2. Two people claiming the last portion at once never double-assign it.

### F-2207 Two-sided payment confirmation

"I've paid" claims and payee "Got it" / "Not received", with auto-confirm after N days.

- **Effort** M · **Impact** 8 · **Backend** yes · **Status** todo · **Deps** F-2103
- **Prefs** `group:pendingReducesBalance`, `group:autoConfirmDays`
- **Acceptance**
  1. Pending payments show separately from confirmed money.
  2. The auto-confirm period is set per group.

### F-2208 Shared comments, disputes and comments 2.0 `spec v2, owner § 26.20`

Comments (F-1204) and disputes (F-1210) sync to members; comments from others arrive in Activity as unread; quick replies, mentions, receipt requests. **Best of both (2026-10-27, docs/scouting/2026-10-27-bluesky-expensify.md):** Expensify's unread marker line and Bluesky's new-messages pill (`src/components/UnreadActionIndicator.tsx`, `src/components/dms/NewMessagesPill.tsx`); comments send through Bluesky's pending queue (`src/state/messages/convo/agent.ts`) with Sending / Failed · Retry on each comment.

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2201, F-1204, F-1210
- **Prefs** -
- **Acceptance**
  1. A mention notifies only that member.
  2. Resolved disputes collapse in the thread and stay in history.
  3. A comment written offline reaches every participant after sync and shows in their Activity as unread.
  4. Opening a thread marks the first unread comment with a "New" line; an "N new comments" pill appears only when new comments arrive below the fold.
  5. A failed comment stays visible with Retry and Delete and never duplicates on retry (op id).

### F-2209 Shared reactions and "Say thanks" `spec v3`

Reactions attached to records so every participant sees them; a thanks quick action after a payment.

- **Effort** S · **Impact** 5 · **Backend** yes · **Status** todo · **Deps** F-2103, F-1207
- **Prefs** `reactions.set`
- **Acceptance**
  1. Reactions never change the ledger.
  2. Every participant sees the same reactions after sync.

### F-2210 In-app and automatic reminders `spec 4b v2, owner § 26.20`

Server delivery for Remind (F-1118) when the friend is on Splito, plus opt-in automatic reminders that follow the per-friend policy (F-1111).

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2201, F-1118, F-1111
- **Prefs** `person:reminderPolicy`
- **Acceptance**
  1. Remind on a friend who is on Splito also sends an in-app reminder; at most one in-app reminder per person per 3 days, enforced server-side, and the UI says when the next one is allowed.
  2. Automatic reminders are off by default; their cap and quiet hours are enforced server-side.
  3. Every reminder sent is listed on the person page and logged in Activity.

### F-2211 Gift pool / chip-in link

One link where contributors without accounts see their amount, pay and tap "I've paid".

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2204, F-1109
- **Prefs** -
- **Acceptance**
  1. The organiser sees progress and confirms receipts.
  2. Only unpaid contributors get nudges.

### F-2212 Devices, sessions and lost-phone wipe `spec v1`

List devices; sign out or sign out and wipe after pushing unsynced work; new sign-in alerts.

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2102, F-2103
- **Prefs** -
- **Acceptance**
  1. Wipe never loses an unsynced money record.
  2. Signing a device out revokes its session on the server.

### F-2213 Delete account with preview `spec 10`

Preview what is deleted vs kept as "Former member" in shared groups, then delete.

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2102, F-2103, F-2108
- **Prefs** -
- **Acceptance**
  1. Shared group amounts remain balanced after deletion.
  2. Personal data and attachments are removed and a confirmation is shown.

### F-2214 Background sync and widget refresh `spec v1`

BGTask / WorkManager / Background Sync flush the outbox and refresh widgets.

- **Effort** M · **Impact** 6 · **Backend** yes · **Status** todo · **Deps** F-2103, F-1904
- **Prefs** -
- **Acceptance**
  1. Best effort only; never claimed as guaranteed delivery.
  2. The widget snapshot refreshes after a background pull.

### F-2215 Passkey sign-in

Passkeys as primary login with OTP fallback.

- **Effort** M · **Impact** 5 · **Backend** yes · **Status** todo · **Deps** F-2102
- **Prefs** -
- **Acceptance**
  1. Passkeys are listed and revocable.
  2. OTP sign-in stays available as a fallback.

### F-2216 Rich link previews

Invite, guest and recap links unfurl as branded cards without amounts unless opted in.

- **Effort** S · **Impact** 6 · **Backend** yes · **Status** todo · **Deps** F-2105
- **Prefs** -
- **Acceptance**
  1. Fragment links show a generic card.
  2. Amounts never appear in previews unless the sender opts in.

### F-2217 "Friends already on Splito" matching

Opt-in salted-hash contact matching that suggests links via the confirm flow.

- **Effort** M · **Impact** 5 · **Backend** yes · **Status** todo · **Deps** F-2106, F-602
- **Prefs** `contacts.matching`
- **Acceptance**
  1. Never merges automatically; non-users are never revealed.
  2. Withdrawing permission deletes the uploaded hashes.

### F-2218 App Clip for guest links and invites

Bluesky BlueskyClip target adapted: add expense, claim items, see balance without install.

- **Effort** L · **Impact** 6 · **Backend** yes · **Status** todo · **Deps** F-2204
- **Prefs** -
- **Acceptance**
  1. "Get Splito" overlay hands off to the full app.
  2. The clip works without the full app installed.

### F-2219 Email-forward receipts

Private inbound address per account and per group; forwarded receipts parsed server-side into the Inbox.

- **Effort** L · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2103, F-503
- **Prefs** -
- **Acceptance**
  1. Only verified sender addresses are accepted; aliases can be rotated.
  2. Receipt text is redacted from server logs.

### F-2220 Big-purchase proposals

Propose a purchase over a threshold; members approve or decline; approved becomes an expense among approvers.

- **Effort** M · **Impact** 5 · **Backend** yes · **Status** todo · **Deps** F-2103
- **Prefs** `group:proposalThreshold`
- **Acceptance**
  1. Votes stay on the resulting expense.
  2. Members who decline are left out of the split by default.

### F-2221 Surprise expenses

Hidden from one person until a reveal date, withheld by the server from their pull.

- **Effort** M · **Impact** 6 · **Backend** yes · **Status** todo · **Deps** F-2103, F-2108
- **Prefs** -
- **Acceptance**
  1. The hidden person's sync, balances and exports exclude it until reveal.
  2. A server test proves the record is withheld, not just hidden in the UI.

### F-2222 Roaming data saver

On expensive connections sync small operations and hold attachments until Wi-Fi.

- **Effort** S · **Impact** 6 · **Backend** yes · **Status** todo · **Deps** F-2107
- **Prefs** `sync.wifiOnlyAttachments`
- **Acceptance**
  1. Status shows "3 receipts (4.2 MB) waiting for Wi-Fi" with Upload now.
  2. "Upload now" overrides the hold.

### F-2223 Send money via provider (sandbox) `spec v3`

Provider adapter with sandbox integration and tests, labelled "sandbox" everywhere; live needs the owner's provider choice.

- **Effort** L · **Impact** 5 · **Backend** yes · **Status** todo · **Deps** F-2103
- **Prefs** -
- **Acceptance**
  1. No screen calls a sandbox transfer real money.
  2. The adapter interface is tested against the sandbox only.

### F-2224 Cosmetic unlocks

Icons, palettes and celebration skins unlocked by invites or by use; nothing functional is gated.

- **Effort** M · **Impact** 5 · **Backend** yes · **Status** todo · **Deps** F-2105, F-1707
- **Prefs** -
- **Acceptance**
  1. Every cosmetic is also unlockable without inviting anyone.
  2. No feature is gated behind a cosmetic.

### F-2225 Apple / Google Wallet pass

A pass per trip with balance and a join QR, relevant on trip dates.

- **Effort** L · **Impact** 4 · **Backend** yes · **Status** todo · **Deps** F-2105
- **Prefs** -
- **Acceptance**
  1. Balance updates arrive through pass updates.
  2. The pass surfaces on the lock screen during the trip dates.

### F-2226 iMessage app extension

Interactive Splito cards in iMessage threads that update in place.

- **Effort** L · **Impact** 3 · **Backend** yes · **Status** todo · **Deps** F-2218
- **Prefs** -
- **Acceptance**
  1. Tapping a card opens the App Clip or app.
  2. The card updates in place as members act.

### F-2227 End-to-end encrypted groups (opt-in)

Group operations encrypted on device with a group key; the server orders ciphertext only.

- **Effort** XL · **Impact** 5 · **Backend** yes · **Status** todo · **Deps** F-2103
- **Prefs** `group:e2ee`
- **Acceptance**
  1. Trade-offs (no server AI, no server PDF) are shown before enabling.
  2. The database holds only ciphertext for the group (verified).

### F-2228 Public API and webhooks

Personal access tokens with scopes; read API for balances and expenses; writes through the same mutation, idempotency and change-log path as the app; signed webhooks for new expenses and payments.

- **Effort** L · **Impact** 3 · **Backend** yes · **Status** todo · **Deps** F-2102, F-2108
- **Prefs** -
- **Acceptance**
  1. API writes create the same change-log entries as app writes (no divergent path).
  2. Tokens are scoped, revocable and rate limited; webhooks are signed and retried with backoff.

### F-2229 Account switcher `spec v1 user switch (extended)`

Bluesky's account switcher adapted: several Splito accounts on one device, each with its own isolated local database, outbox and lock.

- **Effort** M · **Impact** 4 · **Backend** yes · **Status** todo · **Deps** F-2102, F-2103
- **Prefs** -
- **Acceptance**
  1. Switching never shows another account's data, drafts or notifications (A15 isolation test).
  2. The inactive account's unsynced work waits safely and is never mixed into the active outbox.

### F-2230 Splitwise one-tap import via API `spec 4b importer (extended)`

Connect Splitwise once (OAuth held by the Splito server, subject to Splitwise's API terms [?]) and import every friend, group, expense and payment with people matching and a preview.

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2003, F-2101
- **Prefs** -
- **Acceptance**
  1. Imported balances match Splitwise's for every group and friend.
  2. Re-running imports only new records; the Splitwise token is deleted after import.

### F-2231 Bank transaction feed (opt-in)

Account Aggregator (India) or Plaid / Tink style feeds turn card and bank transactions into Inbox drafts with Ours / Mine / Theirs. Blocked until the owner picks a provider and countries.

- **Effort** XL · **Impact** 6 · **Backend** yes · **Status** todo · **Deps** F-2103, F-522
- **Prefs** `bankFeed.accounts`
- **Acceptance**
  1. Consent is revocable in one tap and stored transactions are deleted on revoke.
  2. Feed items never post without review and dedupe against manual entries (F-504).

## E23 AI

Answers from real records, never invented numbers.

### F-2301 Ask Splito: chat screen and on-device answers `spec v2, owner § 26.19`

One AI entry point, "Ask Splito" (Lucide sparkles): a nav item between Analytics and Activity, the Analytics header action, and an "Ask Splito about '<query>'" row in Search. The chat screen copies Bluesky's DM conversation; questions over your own data are answered on the device by a deterministic engine.

- **Effort** L · **Impact** 8 · **Backend** no · **Status** done (web checked in Chrome and e2e; the iOS/Android composer and sheet are the same Dialog/FlatListFooter code and wait for a device pass) · **Deps** F-1301, F-222, F-1401
- **Prefs** -
- **Acceptance**
  1. Placement: the shared sidebar / drawer item between Analytics and Activity (opens the Search & Ask drawer in Ask mode), the Sparkles Search & Ask button already in every top-level header including Analytics (§ 26.19: no second Analytics button), and an "Ask Splito: '<query>'" row at the top of Search results; phones keep four bottom-bar tabs (F-209 can pin it).
  2. The chat screen copies Bluesky's DM conversation screen (message list, composer bar above the keyboard, day separators). The empty state shows suggestion chips ("How much did I spend on food this month?", "Who owes me the most?", "Split last night's dinner 3 ways", "Show my Goa trip spending by day"). Closing and reopening keeps history and the draft (A14).
  3. A deterministic engine in `lib/ask` answers totals, who owes whom, spend by category / person / group / period and trends with `@splito/domain` (exact money, never summing currencies), labelled "answered on this device"; "What does Riya owe me?" equals the People balance. Nothing leaves the device for these answers.
  4. Answers can carry rich cards: an inline chart (the Analytics chart components), a small table, a balance card, or an action card ("Add this expense", "Record payment", "Remind Riya") that opens the normal sheet pre-filled; nothing is written without that confirmation.
  5. Questions the engine cannot answer get "I can answer this once you sign in" with the closest supported suggestion; never a fake answer.

### F-2302 Server model with scoped tools `spec v2, owner § 26.19`

Free-form questions go through the backend to an AI model (Claude, latest model): server-side model adapter, scoped read tools over the ledger, streaming, retry, cancel; proposed edits need review.

- **Effort** L · **Impact** 9 · **Backend** yes · **Status** todo · **Deps** F-2103, F-2301
- **Prefs** -
- **Acceptance**
  1. A14: an online answer equals the deterministic ledger result with record references.
  2. A prompt-injected receipt cannot reach another group or write without review.
  3. Stays behind a feature flag, off for users, until F-2303 consent, exclusion and retention controls ship (handoff 10).

### F-2303 AI privacy controls `spec: owner § 26.19`

Off until opted in; per-group "never send"; pseudonyms before model calls; "what was sent" viewer; retention.

- **Effort** M · **Impact** 6 · **Backend** yes · **Status** todo · **Deps** F-2302
- **Prefs** `ai.enabled`, `group:ai.exclude`, `ai.retentionDays`
- **Acceptance**
  1. An excluded group's records never appear in a model request (test).
  2. The "what was sent" viewer shows the exact records for each answer.
  3. "Ask Splito uses AI" (`ai.enabled`) is off until the user signs in and opts in; the first use shows exactly what data will be sent; on-device answers send nothing.

### F-2304 Cloud OCR re-read `spec v2`

"Read again with AI" sends the image when online and opted in, showing a per-field diff to accept.

- **Effort** M · **Impact** 7 · **Backend** yes · **Status** todo · **Deps** F-2302, F-502
- **Prefs** `ocr.cloudReread`
- **Acceptance**
  1. Nothing changes without accepting the diff.
  2. Runs only when online and opted in.

### F-2305 AI-improved quick add `spec v2`

When online, the model refines the local parse; the result is still a draft for review.

- **Effort** S · **Impact** 6 · **Backend** yes · **Status** todo · **Deps** F-2302, F-507
- **Prefs** -
- **Acceptance**
  1. Offline behaviour is unchanged.
  2. The refined result is still a draft that needs review.

## Build order

Front-end features (Backend = no) come first, in batches, after the architecture prerequisites in Batch 0. Batches 1-3 finish the work already in progress (docs/RESUME.md) and, unlike later batches, contain dependency chains, so inside them follow the Deps column (Batch 1: F-201 first; Batch 2: F-301 -> F-302 -> F-401 and F-601 -> F-603 -> F-1101 -> F-1103); after that, batches are ordered by impact per effort (S=1, M=2, L=3, XL=5) while respecting dependencies. Inside a batch every feature touches a different area. Since 2026-10-26 (ARCHITECTURE § 26.1) features are built one at a time in pick order (the "#" column), each finished (built, tested, merged, screenshots, status updated here and in `COMPLETION_MATRIX.md`) before the next starts; parallel workers may split one feature, not run several. Owner requests not yet built are in Batch 4b, right after Batch 4.

### Front end

### Batch 0: Architecture prerequisites

Not feature work: ARCHITECTURE-BACKLOG A-001..A-010 run first (docs/RESUME.md). F-108 lives here so it is not built twice.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 1 | F-108 | Engineering guardrails | CI architecture test (A-001, A-014, A-019) | M | 6 | A-001, A-014, A-019 |

### Batch 1: Finish M1 shell and lists

Merge ui/preview-shell-fix into ui/polish-2 (docs/RESUME.md step 1).

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 2 | F-201 | Bluesky shell: sidebar, bottom bar, FAB, avatar drawer, header rules, logo | navigation shell, LeftNav, drawer | L | 10 | - |
| 3 | F-202 | Activity as a nav destination with unread badge | nav item + badge | S | 8 | F-201 |
| 4 | F-205 | Phone bottom drawers and desktop popups: one FormSheet for every sheet, picker and prompt | components/FormSheet | M | 8 | F-201 |
| 5 | F-206 | Overview, expanding search and filters on Friends and Groups | People and Groups list screens | M | 9 | F-201 |
| 6 | F-207 | People balances and person page | Person screen, People selectors | M | 10 | F-201 |
| 7 | F-1201 | Activity feed | Activity screen rows | M | 9 | F-103 |

### Batch 2: Finish M1 money flows

In-progress expense, group and settle work.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 8 | F-301 | Expense add / edit / delete / undo | AddExpense screen | L | 10 | F-103 |
| 9 | F-302 | Split editor, inline calculator, remaining readout, persistent drafts | split editor component | M | 9 | F-301 |
| 10 | F-401 | Itemized bill with portions, tax, tip, service and discount | itemize editor component | M | 9 | F-302 |
| 11 | F-601 | Private friends | Add friend sheet | S | 9 | F-103 |
| 12 | F-603 | Groups and trips | Create/Edit group sheet | M | 10 | F-601 |
| 13 | F-208 | Group page: Expenses, Balances and Members tabs | Group screen tabs | M | 9 | F-201 |
| 14 | F-1101 | Settle up: plan, rules editor, record repayment | Settle screen + rules editor | L | 10 | F-102, F-603 |
| 15 | F-1103 | UPI pay link and "Mark as paid?" | lib/upi | S | 9 | F-1101 |

### Batch 3: Finish M1 polish

Owner rules § 26.5, 26.9, 26.10 and 26.17 and the remaining in-progress settings.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 16 | F-1301 | Basic analytics | Analytics screen | M | 8 | F-301 |
| 17 | F-1701 | Settings for every preference | Settings screens | M | 9 | F-104 |
| 18 | F-209 | Custom navigation | tabs pref + nav | S | 6 | F-201 |
| 19 | F-1704 | Motion: Lottie, animated balances, success check, list animations | motion components | M | 8 | F-201 |
| 20 | F-203 | Pager tabs and animated main-tab switches | pager component | M | 7 | F-201 |
| 21 | F-204 | Desktop LeftNav complete | desktop LeftNav | M | 7 | F-201 |
| 22 | F-224 | Desktop right column: recent transactions and recently active groups | desktop RightNav | M | 7 | F-201, F-603 |

### Batch 4: Money quick wins

Small, high-impact, independent.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 23 | F-310 | Smart amount input | composer amount field | S | 8 | F-302 |
| 24 | F-402 | Cash rounding with visible remainder | domain allocate rounding | S | 8 | F-101 |
| 25 | F-1801 | Money direction never shown by colour alone | balance display components | S | 8 | - |
| 26 | F-1203 | Deleted items stay in place | struck rows, Restore, Hide and Show hidden | M | 8 | F-114, F-615 |
| 27 | F-1113 | Call it even: forgive or write off | write-off ledger kind + person action | S | 7 | F-101 |
| 28 | F-1401 | Free search across expenses | expense search index | S | 8 | F-301 |
| 29 | F-1903 | Android build and emulator run | Android build config | S | 8 | - |

### Batch 4c: Logic-audit fixes (2026-10-27)

From the whole-app logic audit (`docs/audit/AUDIT-2026-10-27.md`: 50 confirmed findings, 2 critical, 18 major, 30 minor). Built right after row 33 (friend invites), before the rest of Batch 4b, money first. One feature at a time (§ 26.1).

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 33c | F-111 | Amount entry and parsing correctness (both criticals) | domain currency/calc, composer, settle, search | L | 10 | row 30 |
| 33d | F-113 | Balances and settle consistency | People/Home balances, Settle, write-offs | M | 9 | F-111 |
| 35 | F-222 | One navigation list for sidebar and drawer, Home label and title | navigationItems + NavFooterLinks, drawer header | S | 8 | F-201, F-204 |
| 35a | F-117 | Local database schema v2 (§ 9.8) | packages/sync stores, migrations, projections | L | 10 | F-227 |
| 45 | F-2301 | Ask Splito: chat screen and on-device answers | screens/Ask, lib/ask | L | 8 | F-1301, F-222, F-1401 |
| 45a | F-228 | Native hardware-keyboard Cmd/Ctrl+K | key-command module | S | 4 | F-222 |
| 33e | F-112 | Many-currency completeness | composer, Record payment, sidebar, rounding | M | 9 | F-111, F-227 |
| 33f | F-114 | History, bin and sync integrity | sync mutations, bin, activity, search | M | 8 | F-113 |
| 33g | F-115 | Timezone, dates and number formats everywhere | locale, activity, payments | M | 8 | F-114 |
| 33h | F-116 | Web navigation and sheet robustness | routes, Dialog/drawer, FormSheet, drafts | M | 8 | F-115 |
| 33i | F-604, F-613, F-615 | Archive group, safe member removal, leave group (audit m4) | sync mutations + Group screens | M | 8 | F-116 |

### Batch 4b: Owner requests (2026-10-26/27)

Every owner request from ARCHITECTURE § 26 (decision log rows 47-63) that was not built yet, in the owner's order. ARCHITECTURE § 26.1 applies strictly here: one feature at a time, top to bottom; each is built, tested, merged into m1-foundation, screenshotted (light and Dim, phone and desktop) and marked done here and in `COMPLETION_MATRIX.md` before the next starts; parallel workers may split one feature, never run two. The merge row comes first: nothing else starts until every built branch is merged. Backend parts of these requests sit in the backend batches (F-2111, F-2105, F-2112, F-2208, F-2210, F-2302, F-2303).

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 30 | - | ~~Merge UI line + Batch 4 + drawers into m1-foundation~~ done 2026-10-27 (d397576) | git: ui/r1-polish-2, ui/preview-latest (incl. phone bottom drawers), feat/b-* into m1-foundation; full test + e2e run | M | 10 | Batches 0-4 built |
| 30a | F-227 | Large demo dataset for testing | data/demoLarge.ts, Settings > Data (dev only) | S | 7 | merge row 30 |
| 31 | F-618 | Add friend by email or mobile, with a Splito check and consent | Add friend sheet, People requests, directory client (finish feat/friend-invites) | L | 9 | F-601, F-205 |
| 32 | F-619 | Invite link and QR with limits | screens/Invites (finish feat/friend-invites) | M | 8 | F-618, F-603 |
| 33 | F-602 | Add friend from device contacts | contacts picker (finish feat/friend-invites) | S | 7 | F-618 |
| 33b | F-1301 | Analytics scope: one chip + checklist sheet (§ 26.16) | screens/Analytics FilterBar + useReport | S | 8 | merge row 30 |
| 33a | F-225 | Sign in / Create account: Bluesky LoggedOut, Login and Signup screens copied (§ 26.15) | screens/Login, screens/Signup, view/com/auth | M | 7 | merge row 30 |
| 34 | F-226 | Feedback: Send feedback and "Your feedback" | Settings Support + feedback sheet (finish feat/feedback) | M | 7 | F-201, F-205 |
| 36 | F-223 | Sync-status dot on the user's avatar | avatar dot + session/outbox state | S | 7 | F-222, F-1801 |
| 37 | F-1711 | Dim splash and brand kit on every platform | splash config + brand kit | S | 5 | F-201 |
| 38 | F-1901 | PWA: service worker, offline shell, updates and install | apps/client/web, export post-step | M | 8 | F-201 |
| 39 | F-1204 | Comments on expenses and repayments | components/comments | M | 8 | F-301, F-1201 |
| 40 | F-1118 | Remind: a friendly reminder through the share sheet | lib/remind + share text | S | 9 | F-1103, F-207, F-208 |
| 41 | F-1907 | Local scheduled notifications | local notifications module | M | 7 | - |
| 42 | F-1119 | Remind me | remind-me scheduler | S | 7 | F-1118, F-1907 |
| 43 | F-2001 | JSON backup export and import | lib/export backup + Settings > Data | M | 8 | F-103, F-1701 |
| 44 | F-2007 | Export centre: CSV and PDF statements | lib/export CSV / PDF + overflow entries | M | 8 | F-1301, F-2001 |

### Batch 4d: Best of both, Bluesky and Expensify (2026-10-27)

From the best-of-both scouting (ARCHITECTURE § 26.1, decision row 85; `docs/scouting/2026-10-27-bluesky-expensify.md`). All front end, after Batch 4b and before Batch 5 (client-only work before backend). The language dropdown comes first; the rest by impact per effort. F-319 waits for F-318 in the same batch; F-230 and F-231 share Home and the right column, so they are built one after the other, not in parallel. Each reuse row names both apps' versions and why one won.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 44a | F-1816 | App language dropdown on the web splash, sign-up and the desktop right column | components/AppLanguageDropdown + splash, sign-up and RightNav footers | S | 7 | F-1810, F-225, F-224 |
| 44b | F-235 | FAB long-press quick menu with Quick action | AddExpenseFAB menu | S | 7 | F-201, F-205 |
| 44c | F-318 | Move an expense to another group, a friend or non-group | moveExpense mutation + Move sheet | S | 7 | F-301, F-603 |
| 44d | F-320 | Drafts: several unfinished expenses, Save as draft on close | composer drafts list | S | 7 | F-302, F-205 |
| 44e | F-231 | Getting started checklist with milestone toasts | Home / right-column guide card | S | 7 | F-201, F-1704 |
| 44f | F-321 | Edit one field from the expense page | expense page field rows | S | 6 | F-301, F-205 |
| 44g | F-1507 | Expense image card (e-receipt) | e-receipt card renderer | S | 6 | F-301 |
| 44h | F-230 | "For you" to-do card on Home and the right column | forYouItems selector + Home / right-column card | M | 8 | F-207, F-1101, F-1118, F-224 |
| 44i | F-229 | Focus mode and attention markers on Home and Groups | list mode + row markers | M | 7 | F-206, F-1201 |
| 44j | F-232 | Swipe actions on friend, group and expense rows | GestureActionView rows | M | 7 | F-206, F-208, F-1118, F-1201 |
| 44k | F-319 | Split one expense into several | domain splitIntoParts + parts sheet | M | 7 | F-302, F-318 |
| 44l | F-620 | Themed invite QR card, Save to Photos and an in-app QR scanner | features/inviteFriends | M | 6 | F-619 |
| 44m | F-1212 | Grouped Activity rows, filter pills, new-items pill and mute | activity feed grouping + pills | M | 6 | F-1201 |
| 44n | F-233 | Tap the active tab to scroll to top; pull to refresh | shell soft reset + List refresh | S | 5 | F-201, F-203 |
| 44o | F-234 | Hover cards for people and groups on web | ProfileHoverCard (web) | S | 5 | F-207, F-208 |
| 44p | F-236 | Troubleshoot: diagnostics, repair and caches | Settings > Help > Troubleshoot | S | 5 | F-1701, F-117 |

### Batch 5: First impressions and scale

The 10-second first expense, 10k-expense speed, sign-in screens, and the screens every real user meets (offline web moved to Batch 4b).

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 46 | F-314 | Three-tap add with sentence defaults | composer defaults + sentence chip | M | 10 | F-302 |
| 47 | F-109 | Large-ledger performance at 10,000 expenses | projections + perf fixture | L | 9 | F-103, A-016 |
| 48 | F-215 | Help, About, licences and privacy | Help / About / Licences screens | M | 7 | F-201 |
| 49 | F-214 | My profile and avatars | profile screen + avatars | M | 7 | F-201, F-601 |
| 50 | F-220 | Group expense list: month sections, "involving me" filter and sort | group Expenses tab list | S | 7 | F-208 |
| 51 | F-110 | Multi-tab web consistency | cross-tab channel + web lock | S | 7 | F-103 |
| 52 | F-216 | Permission primers and recovery | permission primer sheets | S | 6 | F-205 |
| 53 | F-225 | Account section: Sign in and Log out | Settings Account + sign-in screens | M | 8 | F-1701, F-205 |
| 54 | F-1712 | Original Splito mark before public release | logo source + brand kit | S | 6 | F-1711 |

### Batch 6: Get paid

Payment handles and the first settle helpers.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 55 | F-1106 | Payment handles | person payment handles | M | 8 | F-601 |
| 56 | F-1117 | Settle up with a person across groups | person settle sheet | M | 9 | F-1101, F-207 |
| 57 | F-1110 | Next-to-pay suggestion | group header next-to-pay selector | S | 7 | F-1101 |
| 58 | F-1501 | Text summaries for WhatsApp | share text builder | S | 8 | F-1101 |
| 59 | F-1114 | "Everyone settles with the organiser" preset | payment rules editor preset | S | 6 | F-1101 |
| 60 | F-1102 | Fewest-payments toggle | fewest-payments solver | M | 7 | F-1101 |
| 61 | F-107 | Deterministic generated IDs and operation dedupe | sync generated IDs | S | 7 | F-103 |
| 62 | F-106 | Day-weight allocation from date ranges | domain day weights | S | 8 | F-101 |

### Batch 7: Pay and entry speed

QR, UPI handoff and faster entry.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 63 | F-1105 | Pay-me QR at the table | Get-paid QR screen | S | 9 | F-1106 |
| 64 | F-1104 | UPI app chooser and fallback chain | native UPI module + pay sheet | M | 9 | F-1103, F-1106 |
| 65 | F-305 | Saved split templates | split templates | S | 7 | F-302 |
| 66 | F-309 | Rapid entry: save and add another, duplicate, repeat last | composer footer actions | S | 7 | F-301 |
| 67 | F-1603 | Hide amounts (discreet mode) | amount formatter context | S | 7 | - |
| 68 | F-1202 | Readable change history and "your share changed" | expense History tab | M | 9 | F-103 |
| 69 | F-210 | Empty states that teach one next step | empty states | S | 6 | F-1704 |

### Batch 8: Rules and recurring

Group rules, recurring engine, FX base.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 70 | F-306 | Recurring expenses: fixed, variable, estimate then true-up | recurring rules + generator | L | 9 | F-107, F-301, F-1907 |
| 71 | F-609 | Per-category split rules for a group | group settings: How we split | M | 9 | F-305 |
| 72 | F-902 | Income-proportional fair-share ratio | fair-share template | S | 9 | F-305 |
| 73 | F-1107 | Payment-handle change warning | pay-link guard | S | 8 | F-1106 |
| 74 | F-307 | Category and emoji auto-suggest | category field suggestions | S | 7 | F-301 |
| 75 | F-1302 | My Spending measure everywhere | analytics measure | M | 9 | F-1301 |
| 76 | F-316 | Favourite expenses: one-tap tiles | favourite tiles | S | 7 | F-309 |
| 77 | F-1002 | Conversion records and exchange rates | FX rates module | M | 9 | F-1001 |

### Batch 9: Inbox and pots

The review queue, duplicates and pot accounts.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 78 | F-503 | Review Inbox for automated drafts | Inbox screen + FAB badge | M | 9 | F-301 |
| 79 | F-504 | Unified duplicate detection | duplicate fingerprint engine | M | 9 | F-301 |
| 80 | F-312 | Attachments | attachments | M | 7 | F-301 |
| 81 | F-1111 | Reminder drafts that do not annoy | reminder drafts | M | 9 | F-1118, F-1106 |
| 82 | F-1005 | Card-charged amount sets the real rate | card-charged fields | M | 9 | F-1002 |
| 83 | F-105 | Pot ledger accounts | domain pot accounts | M | 8 | F-101, F-103 |
| 84 | F-1802 | Screen-reader money sentences | a11y money sentences | M | 9 | F-1001 |
| 85 | F-1305 | Period presets | period presets | S | 5 | F-1301 |

### Batch 10: Households and groups

Parties, presence, couples and trust basics.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 86 | F-607 | Households: a couple or family settles as one party | households (members + settle) | M | 9 | F-102, F-603 |
| 87 | F-614 | Presence calendar: stay dates, away days, guest nights | presence calendar | M | 8 | F-106, F-603 |
| 88 | F-901 | Ours / Mine / For you chips | composer ownership chips | S | 8 | F-609 |
| 89 | F-1210 | Disputes, flags and hold | expense disputes + hold | M | 7 | F-1204 |
| 90 | F-1205 | Settle-up checkpoints | settle checkpoints | M | 8 | F-1101 |
| 91 | F-1109 | Collections: who-has-paid tracker | collections screen | M | 8 | F-105, F-1106 |
| 92 | F-211 | 60-second zero-signup onboarding | onboarding flow | M | 8 | F-1701 |
| 93 | F-606 | Group templates | group templates | S | 7 | F-603 |

### Batch 11: Trips I

Kitty, nights and trip money.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 94 | F-701 | Trip kitty v2: multi-currency, holder hand-off, cash count | kitty screens | L | 9 | F-105 |
| 95 | F-702 | Split by nights or days present, with room weights | nights/days split mode | M | 8 | F-614 |
| 96 | F-1003 | Offline rate pack and re-price review | FX cache | S | 7 | F-1002 |
| 97 | F-1004 | Trip rate book | trip rate book | M | 8 | F-1002, F-603 |
| 98 | F-604 | Archive groups | archive | S | 6 | F-603 |
| 99 | F-1304 | Budgets | budgets engine + screen | M | 8 | F-1302, F-1305, F-1907 |
| 100 | F-1601 | App lock with step-up actions | app lock | M | 8 | F-1701 |
| 101 | F-1605 | Notification privacy levels | notification privacy | S | 5 | F-1907 |

### Batch 12: Home I

Proration, bills and pots for flats.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 102 | F-804 | Billing periods with day proration | billing period proration | M | 9 | F-106, F-614 |
| 103 | F-802 | Fair rent calculator | rent calculator sheet | S | 7 | F-609 |
| 104 | F-807 | Bills due board and calendar | bills due board | M | 8 | F-306, F-1907 |
| 105 | F-815 | Household and joint pots | household pots | M | 8 | F-105, F-306 |
| 106 | F-903 | "Us" overview card with fairness meter | Us overview card | M | 8 | F-902, F-1302 |
| 107 | F-1006 | Cash wallets and forex lots | cash wallets | M | 8 | F-1005 |
| 108 | F-308 | Guest participants | guest participants | S | 6 | F-301 |

### Batch 13: Lifecycle and trust

Disputes, leaving, duplicates, switching phones.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 109 | F-1209 | Explain this balance | balance explainer screen | S | 8 | F-207, F-1501 |
| 110 | F-615 | Leave or delete a group | group leave / delete flow | M | 8 | F-603, F-1113, F-1203 |
| 111 | F-2005 | Move to a new phone without an account | phone transfer flow | M | 8 | F-2001 |
| 112 | F-616 | Merge duplicate friends | friend merge | M | 7 | F-601 |
| 113 | F-617 | Saved member subsets and a big-group picker | member subsets + participant picker | S | 7 | F-603 |
| 114 | F-1108 | Payment method and UTR proof | Record payment sheet | S | 6 | F-1101 |
| 115 | F-1011 | Change a group's or my home currency safely | currency change flow | S | 6 | F-1002 |
| 116 | F-2006 | Storage manager | storage manager screen | S | 5 | F-312 |
| 116a | F-1211 | Group discussion thread | group Discussion tab (off by default) | M | 5 | F-1204, F-208 |

### Batch 14: Trips II: settling in one currency

Settle currency, legs, reports, refunds.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 117 | F-1007 | Settle a trip in one currency with rate-policy preview | settle-in-one-currency flow | L | 9 | F-1004, F-1101 |
| 118 | F-704 | Trip legs and travel mode | trip legs | M | 8 | F-603, F-1002 |
| 119 | F-317 | Quick split by headcount | headcount quick split | S | 7 | F-302, F-308, F-1105 |
| 120 | F-1208 | "All square" moment | all-square celebration | S | 6 | F-1704 |
| 121 | F-1303 | Full reports | reports | M | 8 | F-1302 |
| 122 | F-1607 | Privacy and data safety center | privacy center screen | S | 7 | F-2001 |
| 123 | F-303 | Refunds and reversals | refunds | M | 7 | F-301 |
| 124 | F-605 | Group emoji and colour | group emoji | S | 6 | F-603 |

### Batch 15: Capture I

Scanner, quick add and the predictor.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 125 | F-501 | Receipt scanner | scanner module | M | 8 | F-312 |
| 126 | F-403 | GST-aware Indian bill lines | itemize tax lines | M | 8 | F-401 |
| 127 | F-507 | Quick add by text v2 | quick-add parser + chips | M | 8 | F-310, F-503 |
| 128 | F-515 | Smart defaults predictor | defaults predictor | M | 9 | F-301 |
| 129 | F-803 | Rent collector board | rent collector board | M | 9 | F-306, F-1109, F-1104 |
| 130 | F-1010 | Unambiguous currency display and compact amounts | currency formatter | S | 6 | F-1001 |
| 131 | F-1805 | Dynamic Type to 200% with reflow | dynamic type reflow | M | 8 | - |

### Batch 16: Capture II: OCR

On-device OCR, closing a trip and trip spend views.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 132 | F-502 | On-device OCR with review | OCR engines + review | L | 9 | F-501, F-401 |
| 133 | F-705 | Close the trip: wrap-up checklist | trip wrap-up card | M | 9 | F-604, F-1205, F-701, F-1007 |
| 134 | F-1008 | Pay back with leftover foreign cash | cross-currency repayment | S | 7 | F-1007 |
| 135 | F-706 | What this trip cost me | trip cost view | M | 8 | F-1302, F-1005 |
| 136 | F-808 | Month close and household statement | month close | M | 8 | F-1205 |
| 137 | F-1009 | Live home-currency hint | amount hint | S | 7 | F-1002, F-310 |
| 138 | F-1502 | Shareable image cards | image card renderer | M | 7 | F-1105 |

### Batch 17: Receipt intelligence

Make OCR results trustworthy.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 139 | F-406 | Receipt math checker | OCR math checker | S | 8 | F-502 |
| 140 | F-405 | Line-item cleanup | line normaliser | M | 8 | F-401, F-502 |
| 141 | F-506 | Receipt currency and number-format auto-detect | currency detector | S | 7 | F-502 |
| 142 | F-505 | Attach-to-existing matcher and missing-receipt nudge | receipt matcher | S | 7 | F-502 |
| 143 | F-509 | Incoming share | share extension / intent | L | 7 | F-503 |
| 144 | F-1306 | Deterministic insights | insights card | S | 5 | F-1303 |
| 145 | F-1803 | Accessibility actions for every swipe and long-press | row a11y actions | S | 7 | F-1201 |
| 146 | F-612 | Duplicate group as template | duplicate group | S | 5 | F-603 |

### Batch 18: Itemize power

Faster, smarter item assignment.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 147 | F-407 | Tap-the-receipt painter assignment | painter view | M | 8 | F-401, F-502 |
| 148 | F-404 | Item memory and shared-item defaults | item memory | S | 6 | F-401 |
| 149 | F-408 | Delivery and ride e-receipt splitter | e-receipt templates | M | 8 | F-502, F-509 |
| 150 | F-510 | Paste or share text into drafts | text-to-draft parser | M | 7 | F-507 |
| 151 | F-1804 | Accessible portion editor and spoken remaining | portion chip a11y | S | 7 | F-401 |
| 152 | F-1602 | PIN recovery kit | PIN recovery | S | 6 | F-1601 |
| 153 | F-1307 | Receivables ageing and net position | receivables panel | S | 6 | F-1301 |
| 154 | F-611 | Pinned group note and payment-handle directory | pinned note + handles directory | S | 5 | F-1106 |

### Batch 19: Households II and family

Dependents, loans, cards and the native bridge.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 155 | F-608 | Dependents: kids, pets and parents who never owe | dependents | M | 8 | F-607 |
| 156 | F-814 | Presence-aware category rules | presence category rules | M | 7 | F-614, F-609 |
| 157 | F-905 | IOU loans and EMI splits | loans | M | 7 | F-301 |
| 158 | F-613 | Safe member removal and drop-out re-split wizard | member removal wizard | M | 7 | F-1113 |
| 159 | F-1206 | Ledger fingerprint and balance code | balance code | M | 6 | F-103 |
| 160 | F-1703 | Card customization | card customization | L | 7 | F-1701 |
| 161 | F-1904 | Extension data bridge | extension data bridge | M | 7 | - |
| 162 | F-1112 | Settle-up day for the group | settle-up day | S | 7 | F-1907 |

### Batch 20: Organise and export

Tags, bulk edit, views, PWA.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 163 | F-1404 | Tags and occasion tags | tags | M | 7 | F-301 |
| 164 | F-1405 | Bulk select and edit | bulk select | M | 8 | F-301 |
| 165 | F-1403 | Saved views | saved views | S | 6 | F-1401 |
| 166 | F-1308 | Subscriptions dashboard and 30-day forecast | subscriptions dashboard | S | 6 | F-306 |
| 167 | F-517 | Recurring pattern detection and price-change alerts | recurring pattern detection | S | 7 | F-306 |
| 168 | F-2004 | Power exports | exports | M | 7 | F-2007, F-1302 |
| 169 | F-221 | Pin and reorder friends and groups | list pinning | S | 5 | F-206 |
| 170 | F-610 | Per-group permissions (local) | group permissions | M | 8 | F-603 |

### Batch 21: Automation and widgets

Rules engine, search operators, widgets.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 171 | F-516 | Automation rules engine | rules engine | M | 7 | F-305, F-503, F-1404 |
| 172 | F-1402 | Advanced search operators | search operators | M | 7 | F-1401 |
| 172a | F-1412 | Pin saved views and groups as Home tabs | Home pinned tabs | M | 5 | F-1403, F-203 |
| 173 | F-1505 | Share privacy presets | share privacy presets | S | 6 | F-1501 |
| 174 | F-1905 | Home and lock-screen widgets | widgets | L | 8 | F-1904 |
| 175 | F-806 | Security deposit ledger | deposit ledger | M | 8 | F-105, F-312 |
| 176 | F-2002 | Encrypted and automatic backups | encrypted backups | M | 8 | F-2001, F-1907 |
| 177 | F-1702 | Black-and-white theme and background overrides | B&W theme | S | 5 | F-1701 |
| 178 | F-219 | Contextual tips and feature discovery | tips registry | S | 6 | F-211, F-215 |

### Batch 22: Sharing and links

Serverless balance link, PDF, intents.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 179 | F-1506 | Serverless balance link | balance link page | M | 9 | F-1505, F-1901 |
| 180 | F-1503 | Trip summary PDF | trip PDF | M | 6 | F-1101 |
| 181 | F-511 | Payment-screenshot split (RRN-aware) | payment screenshot parser | M | 7 | F-502, F-1106, F-509 |
| 182 | F-1906 | App Intents, Siri, Shortcuts and Android App Actions | App Intents | L | 8 | F-1904, F-503 |
| 183 | F-809 | Shared shopping list to itemized expense | shopping list | M | 7 | F-401, F-609 |
| 184 | F-2003 | Splitwise importer | Splitwise importer | M | 7 | F-504 |
| 185 | F-1710 | Tabular numerals and font option | font + tabular nums | S | 6 | - |
| 186 | F-709 | Road trip: fuel and distance split | distance split | S | 5 | F-302, F-617 |

### Batch 23: Statements and personal views

PDF-based outputs and privacy.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 187 | F-1116 | Settlement statement | settlement statement | S | 5 | F-1503 |
| 188 | F-910 | Year-end tax pack and cost of living | tax pack | M | 6 | F-1302, F-1503 |
| 189 | F-1310 | Reimbursable and work expense claims | reimbursable claims | M | 6 | F-1302, F-1503 |
| 190 | F-1504 | Trip recap story and Year in Review | recap story | M | 6 | F-1502, F-1302 |
| 191 | F-1410 | Private overlay and private notes | private overlay | M | 6 | F-301 |
| 192 | F-1604 | App-switcher privacy and screenshot blocking | app-switcher privacy | S | 6 | - |
| 193 | F-1908 | Home-screen icon quick actions | icon quick actions | S | 6 | - |
| 194 | F-816 | Daily quantity log: milk, tiffin and water cans | quantity log | S | 5 | F-306 |

### Batch 24: Trip extras

Timeline, deposits, tickets, income.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 195 | F-703 | Trip dashboard and day-by-day timeline with budget pace | trip timeline | M | 7 | F-1304, F-704 |
| 196 | F-707 | Pre-trip bookings and refundable deposits | refundable deposits | M | 7 | F-303, F-705 |
| 197 | F-409 | Ticket split with partial cancellation | ticket split | M | 6 | F-303, F-509 |
| 198 | F-520 | Trip auto-detect from spending clusters | trip auto-detect | S | 6 | F-1405 |
| 199 | F-1909 | Quick add from Control Center, Action Button and Quick Settings | Control Center / QS tile | M | 7 | F-1906 |
| 200 | F-1806 | Increase-contrast mode | increase contrast | M | 6 | - |
| 201 | F-304 | Money-in entries (group income) | money-in entries | S | 5 | F-301 |
| 202 | F-810 | Shared asset register with buyout | asset register | M | 6 | F-301 |

### Batch 25: Home III

Flat wizard, move-out and utilities.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 203 | F-801 | Flat setup wizard | flat setup wizard | M | 8 | F-606, F-306, F-609, F-802 |
| 204 | F-805 | Move-out checkout wizard | move-out wizard | L | 9 | F-804, F-806, F-810, F-613 |
| 205 | F-811 | Metered utility split | metered split | M | 6 | F-609 |
| 206 | F-812 | Household staff payroll | staff payroll | M | 6 | F-306 |
| 207 | F-518 | Utility bill OCR | utility bill OCR | M | 6 | F-502, F-306 |
| 208 | F-1309 | Custom report builder | report builder | L | 6 | F-1303, F-1703 |
| 209 | F-1813 | RTL done properly | RTL | M | 6 | - |
| 210 | F-519 | Booking confirmation to expense with dates | booking confirmation parser | L | 6 | F-509, F-702 |

### Batch 26: Family and events

Goals, allowance, co-parenting, weddings.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 211 | F-904 | Shared goals and savings pots | goals | M | 6 | F-105 |
| 212 | F-906 | Kids' allowance and pocket-money ledger | allowance | M | 6 | F-608, F-306 |
| 213 | F-907 | Co-parenting ledger | co-parenting | L | 6 | F-606, F-609, F-1204 |
| 214 | F-909 | Wedding and event mode | wedding mode | L | 6 | F-606, F-607, F-1304 |
| 215 | F-908 | Shagun / gift register | gift register | M | 5 | F-301 |
| 216 | F-1311 | Payment accounts and reconciliation | payment accounts | M | 6 | F-1302 |
| 217 | F-1910 | Live Activity for a trip day | Live Activity | L | 6 | F-1904, F-703 |
| 218 | F-1913 | Store review prompt at happy moments | review prompt | S | 3 | F-1208 |

### Batch 27: Capture everywhere

Voice, notifications, Wallet, statements.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 219 | F-508 | Push-to-talk voice add | voice add | M | 7 | F-507 |
| 220 | F-512 | Payment notification and bank SMS capture (Android, opt-in) | Android capture service | L | 8 | F-510, F-1106 |
| 221 | F-513 | Wallet tap to split draft (iOS Shortcuts) | Wallet intent | M | 7 | F-1906 |
| 222 | F-514 | Merchant dictionary and name cleanup | merchant dictionary | M | 6 | F-307 |
| 223 | F-521 | Composer suggestions from clipboard and latest screenshot | clipboard chip | S | 6 | F-507, F-502 |
| 224 | F-522 | Statement and CSV import with column mapper | statement importer | L | 8 | F-503, F-504 |
| 225 | F-1409 | Full-text receipt search | receipt FTS | S | 6 | F-502, F-1401 |
| 226 | F-315 | Optional time of day on expenses | expense time field | S | 4 | F-301 |

### Batch 28: Accessibility and locale

Inclusive by default.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 227 | F-1807 | Undo toasts that wait for assistive tech | undo toasts | S | 6 | - |
| 228 | F-1808 | Contrast-guarded accent and category colours | contrast guard | S | 5 | F-1701 |
| 229 | F-1812 | Locale-correct plurals, dates, sorting and search | plurals and collation | S | 6 | - |
| 230 | F-1814 | Self-describing charts | chart summaries | M | 6 | F-1301 |
| 231 | F-1811 | Hinglish and more Indian languages | more languages | L | 7 | F-1810 |
| 232 | F-1809 | Read my balances aloud | read aloud | S | 4 | - |
| 233 | F-1705 | Haptic vocabulary | haptic table | S | 5 | - |
| 234 | F-1815 | Accessibility CI and release audit | axe + a11y lint in CI | M | 7 | A-035 |

### Batch 29: Customization and polish

Optional modes and personality.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 235 | F-212 | Simple mode | simple mode | M | 6 | F-209 |
| 236 | F-213 | Handedness and reach | handedness | S | 4 | F-201 |
| 237 | F-1706 | Living cat mascot for sync states | cat mascot | M | 5 | F-1704 |
| 238 | F-1707 | Alternate app icons | alternate icons | M | 4 | - |
| 239 | F-1708 | Balance wording style per group | balance wording | S | 5 | - |
| 240 | F-1709 | Lite mode | lite mode | M | 6 | - |
| 241 | F-217 | Tablet, landscape and foldable layouts | two-pane layouts | M | 6 | F-201, F-204 |
| 242 | F-218 | Sample group to explore | sample namespace | S | 5 | F-603, F-210 |

### Batch 30: Power user and privacy

Keyboard, grid, fields, privacy extras.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 243 | F-1407 | Command palette and keyboard shortcuts | command palette | M | 6 | F-1401 |
| 244 | F-1408 | Spreadsheet grid view (web) | grid view | L | 5 | F-1405, F-522 |
| 245 | F-1406 | Category hierarchy and per-group sets | category hierarchy | M | 5 | F-1701 |
| 246 | F-1411 | Custom fields | custom fields | M | 4 | F-301 |
| 247 | F-311 | Amount typo and anomaly guard | composer anomaly guard | S | 6 | F-301 |
| 248 | F-1606 | Hand-off mode | hand-off mode | S | 6 | F-1601 |
| 249 | F-1609 | Hidden personal expenses and groups | hidden items | S | 5 | F-1601 |
| 250 | F-1608 | Receipt privacy: EXIF strip and auto-redact | receipt redaction | M | 6 | F-502 |

### Batch 31: Long tail

Low impact-per-effort items.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 251 | F-708 | Offline phone-to-phone exchange (QR and file) | QR / file exchange | XL | 7 | F-107 |
| 252 | F-1115 | Transit routing with consent | transit routing | M | 5 | F-1101 |
| 253 | F-1207 | Reactions on activity items (local) | local reactions | S | 4 | F-1201 |
| 254 | F-813 | Chore-cover payouts | chore cover pay | M | 4 | F-301 |
| 255 | F-1610 | Erase this device | erase device | S | 6 | F-2001 |
| 256 | F-1911 | Spotlight and launcher search indexing | Spotlight indexing | M | 5 | F-1906 |
| 257 | F-313 | Location | location | M | 4 | F-301 |
| 258 | F-1912 | Apple Watch and Wear OS companion | watch companion | XL | 4 | F-1904, F-503 |

### Backend (after Backend foundation)

Starts once the front-end batches that hold their front-end deps are done. Backend batch 1 is the foundation: API service, auth, sync, invites, and the operations that keep real users' data safe.

Shared expenses are the core of the product, so the foundation need not wait for all front-end batches: F-2101 to F-2105 depend only on F-103 and touch apps/api and the sync client, not screens, so a separate builder may start them alongside front-end Batch 4 or later. F-2107 still waits for F-312 and F-2108 for F-610; no backend feature ships to users before F-2110.

### Backend batch 1: Backend foundation (auth, sync, invites)

Sequential inside: F-2101 -> F-2102 -> F-2103, then the rest in parallel.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 259 | F-2101 | API service | apps/api | L | 10 | - |
| 260 | F-2110 | Production operations | deploy, backups, alerts, rate limits | M | 9 | F-2101 |
| 261 | F-2102 | Sign-in and sessions | auth routes + client credential store | L | 10 | F-2101 |
| 262 | F-2103 | Sync push/pull and conflicts | sync routes + client sync loop | XL | 10 | F-2102, F-103 |
| 263 | F-2104 | Move local data into an account | migration flow | M | 9 | F-2103 |
| 264 | F-2105 | Invites and invite links | invites | M | 9 | F-2103 |
| 265 | F-2111 | Account directory and friend requests | directory + friend requests API | M | 9 | F-2102, F-2103 |
| 266 | F-2107 | Attachment upload | attachments service | M | 8 | F-2103, F-312 |
| 267 | F-2108 | Server permissions and history visibility | authorization layer | M | 8 | F-2103, F-610 |

### Backend batch 2: Shared basics

First things people feel once sync exists.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 268 | F-2109 | Needs attention: conflicts and refused changes | conflict resolution screen | M | 9 | F-2103 |
| 269 | F-2106 | Link a private friend to a real account | person linking | M | 8 | F-2105 |
| 270 | F-2201 | Push notifications with actions | push + NSE | L | 8 | F-2103 |
| 271 | F-2207 | Two-sided payment confirmation | payment claims | M | 8 | F-2103 |
| 272 | F-2203 | Hardened read-only balance link | balance link service | M | 7 | F-2103 |
| 273 | F-2204 | Personal guest links | guest links | L | 9 | F-2105, F-2108 |
| 274 | F-2302 | Server model with scoped tools (flagged off until F-2303) | AI model adapter | L | 9 | F-2103, F-2301 |
| 275 | F-2212 | Devices, sessions and lost-phone wipe | devices screen | M | 7 | F-2102, F-2103 |
| 276 | F-2112 | Feedback endpoint | feedback API | S | 5 | F-2103, F-226 |

### Backend batch 3: Collaboration

Built on push, guest links and the model.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 277 | F-2202 | Notification digest, mute and "only if it affects me" | notification digest | M | 7 | F-2201 |
| 278 | F-2208 | Shared comments, disputes and comments 2.0 | shared comments | M | 7 | F-2201, F-1204, F-1210 |
| 279 | F-2205 | Guest-to-member upgrade | guest upgrade | M | 7 | F-2204, F-2106 |
| 280 | F-2206 | Live table mode | live table | L | 8 | F-2204, F-401 |
| 281 | F-2303 | AI privacy controls | AI privacy | M | 6 | F-2302 |
| 282 | F-2304 | Cloud OCR re-read | cloud OCR | M | 7 | F-2302, F-502 |
| 283 | F-2216 | Rich link previews | link previews | S | 6 | F-2105 |
| 284 | F-2213 | Delete account with preview | account deletion | M | 7 | F-2102, F-2103, F-2108 |

### Backend batch 4: Reach

Reminders, pools and background work.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 285 | F-2210 | In-app and automatic reminders | automatic reminders | M | 6 | F-2201, F-1118, F-1111 |
| 286 | F-2211 | Gift pool / chip-in link | gift pool | M | 7 | F-2204, F-1109 |
| 287 | F-2209 | Shared reactions and "Say thanks" | shared reactions | S | 5 | F-2103, F-1207 |
| 288 | F-2214 | Background sync and widget refresh | background sync | M | 6 | F-2103, F-1904 |
| 289 | F-2222 | Roaming data saver | roaming saver | S | 6 | F-2107 |
| 290 | F-2305 | AI-improved quick add | AI quick add | S | 6 | F-2302, F-507 |
| 291 | F-2215 | Passkey sign-in | passkeys | M | 5 | F-2102 |
| 292 | F-2230 | Splitwise one-tap import via API | Splitwise OAuth importer | M | 7 | F-2003, F-2101 |

### Backend batch 5: Advanced shared

Lower impact-per-effort shared features.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 293 | F-2219 | Email-forward receipts | email inbound | L | 7 | F-2103, F-503 |
| 294 | F-2218 | App Clip for guest links and invites | App Clip | L | 6 | F-2204 |
| 295 | F-2221 | Surprise expenses | surprise expenses | M | 6 | F-2103, F-2108 |
| 296 | F-2220 | Big-purchase proposals | proposals | M | 5 | F-2103 |
| 297 | F-2217 | "Friends already on Splito" matching | contact matching | M | 5 | F-2106, F-602 |
| 298 | F-2223 | Send money via provider (sandbox) | provider sandbox | L | 5 | F-2103 |
| 299 | F-2229 | Account switcher | account switcher | M | 4 | F-2102, F-2103 |

### Backend batch 6: Extras

Lowest priority.

| # | ID | Feature | Area | Effort | Impact | Deps |
|---|---|---|---|---|---|---|
| 300 | F-2224 | Cosmetic unlocks | cosmetics | M | 5 | F-2105, F-1707 |
| 301 | F-2225 | Apple / Google Wallet pass | Wallet pass | L | 4 | F-2105 |
| 302 | F-2226 | iMessage app extension | iMessage extension | L | 3 | F-2218 |
| 303 | F-2227 | End-to-end encrypted groups (opt-in) | E2E groups | XL | 5 | F-2103 |
| 304 | F-2231 | Bank transaction feed (opt-in) | bank feed (needs provider) | XL | 6 | F-2103, F-522 |
| 305 | F-2228 | Public API and webhooks | public API | L | 3 | F-2102, F-2108 |

## Main merges

Ideas proposed by several lenses that became one feature:

| Feature | Merged ideas |
|---|---|
| F-607 | couples/households settle as one (travel), couple sub-unit in a flat (household), household units (couples), family units with adult-child weights (India) |
| F-1109 | collect from everyone (travel), family occasion collection (couples), festival/society/office pools (India), bill collection tracker (social) |
| F-1105 | show QR to get paid (India), pay-me QR at the table (social), pay-me UPI QR (platform) |
| F-1104 | UPI pay sheet with fallback chain (India), smarter UPI handoff (platform), spec UPI link |
| F-1110 | next to pay (travel), whose turn to buy (household), who pays next (couples) |
| F-1113 | call it even (couples), let it go (social), forgive and write-off entries (trust) |
| F-1005 | card-charged amount (travel), card FX (power), what my bank charged (capture) |
| F-1006 | ATM cash wallet (travel), forex lot rates (India) |
| F-701 | kitty 2.0 (travel), cash-custodian kitty (India), spec trip kitty |
| F-306 | spec recurring, smart recurring bills (household), variable-amount recurring (capture) |
| F-609 | per-category rules in a home group (household), per-category split rules (couples), spec v3 per-group default split |
| F-807 | bills due board (household), bills calendar with assigned payer (couples) |
| F-808 / F-1112 | month close (household), settle-up cadence (couples), settle-up day (social) |
| F-815 | household pot (household), joint pots (couples) |
| F-304 | money-in entries (household), shared income and refunds (couples) |
| F-1304 | spec trip budget, monthly household budgets (household), recurring household budget (couples), budgets on my share (power) |
| F-1302 | My Spending ledger (power), We spent vs My share (couples) |
| F-1111 | polite nudges (India), reminders that do not annoy (social), reminders in the friend's language (accessibility), spec reminders |
| F-1502 | trip wrap-up card (travel), WhatsApp summary card with QR (India), shareable image cards (social), summary card with UPI QR (platform) |
| F-1504 | Year in Review (power), Trip Recap story (social) |
| F-501 / F-502 | native scanner and hybrid OCR (capture), native scanner with on-device OCR (platform), spec receipt capture |
| F-503 | Review Inbox (capture), "To split" inbox (power) |
| F-507 | Hinglish quick add (India), quick-add parser v2 (capture), spec quick add |
| F-310 | big-denomination entry (travel), lakh/crore input (India), locale digits and separators (accessibility) |
| F-512 | bank SMS / UPI capture (India), Android payment-notification capture (capture, platform) |
| F-516 | rules engine (power), user-editable automation rules (capture) |
| F-522 | statement import with Ours/Mine/Theirs (couples), universal CSV import (power), paste or import statements (capture) |
| F-408 | food-delivery order split (India), delivery and ride e-receipt splitter (capture) |
| F-1906 | automation hooks (power), Siri and Shortcuts (capture), App Intents and App Actions (platform) |
| F-1407 | keyboard-first web (power), keyboard shortcuts and palette (platform), shortcuts sheet (accessibility) |
| F-1603 | hide amounts privacy mode (trust), privacy guard (platform), discreet mode (accessibility) |
| F-1205 | settle-so-far checkpoints (travel), settle-up checkpoints and close trip (trust) |
| F-708 | phone-to-phone QR (travel), trek mode merge (India), offline group handoff by file (social) |
| F-1811 | regional languages (India), Hinglish and next Indian languages (accessibility), spec more languages |
| F-2207 | two-sided payment confirmation (social), payee confirms (trust) |
| F-602 | device contacts picker (platform), contacts stay on device (trust) |
| F-1608 | auto-redact shared receipts (capture), receipt and attachment privacy (trust) |
| F-1410 | private overlay (power), private notes (trust) |
