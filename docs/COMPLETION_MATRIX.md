# Splito completion matrix

Updated 2026-10-27. Binding rules source: `docs/ARCHITECTURE.md` § 26 "Product & UI rules (owner decisions, binding)" (decision log rows 1-63). Feature IDs, acceptance criteria and build order: `docs/BACKLOG.md` (owner requests not yet built are its Batch 4b). Other sources: Splito-Claude-Prompt.txt (original handoff), docs/superpowers/specs/2026-10-26-splito-design.md.

Status words are the same as `docs/BACKLOG.md`: **done** (built, tested and merged on main), **in progress** (being built, or built and tested on an unmerged branch, named; work counts as in progress until it is merged into main), **todo** (not started). "(needs backend)" marks work that waits for the sync/auth server, which is built after the UI. Unmerged UI line = branches `ui/r1-polish-2` and `ui/preview-latest`; Batch 4 streams = branches `feat/b-*`.

| Area | Feature | ID | Status |
|---|---|---|---|
| Core rules | Exact money (bigint), all split modes, rounding, multi-currency maths | F-101 | done (domain, 68 tests) |
| Core rules | Settlement planner with allowed / preferred / excluded routes | F-102 | done (domain) |
| Storage | Offline local store (SQLite / IndexedDB), history, outbox, preferences registry | F-103, F-104 | done (sync, 40 tests) |
| Storage | Local database schema v4 (v3 plus the `reminders` store; a deleted expense keeps its party rows and search terms; `history.binDays` dropped; one combined v2/v3 to v4 migration, `migrateToV4`): a store per entity type on IndexedDB and SQLite, normalised members and parties, in-transaction balance sums, monthly aggregates and search terms (Analytics and Search never load the ledger), per-row sync status, v1 and v2 migrations, cursor-paged hot reads | F-117 | done (feat/wA-35a: Home cold open 46 ms on 1.5k expenses, 46 ms on 10k; write + UI 16 ms; Analytics open 35 / 21 ms; narrow search 16-43 ms; see BACKLOG F-117) |
| Navigation | Every page, in-page tab, sheet, popup, picker inside a sheet, the side drawer and Search & Ask has a URL (`/people/:id/record-payment`, `/expense/new/currency`, `/groups/:id/balances`, `?drawer=menu`, `/search?q=&mode=ask`); list state in the address (filters, sort, Show settled, Analytics period / currency / scope); browser Back closes the top sheet; one resolver for https, `splito://`, push, invite, reminder, Ask and Search links; per-tier host claims in `app.config.ts`; demo mode asks before real data; signed-out intent and deferred link are stubs | F-241, F-254 (client) | in progress (built on feat/wC-F241-254, unmerged, main merged 2026-10-30; `pnpm check` green (client 618+ tests, about 130 of them new: route table, sheet table ledger, pending-sheet queue, tier claims, Analytics params, link store); full web e2e 468 tests at 2 workers, 467 pass and the one miss (`comments.spec` Tab-to-menu focus) passes 3 of 3 alone; `deeplinks.spec.ts` 70+ tests at 390 and 1440; perf quiet-machine (load under 10) base vs this branch: Home cold open 59 vs 54 ms, 10,000 expenses 53 vs 52 ms, write + UI 16 vs 16 ms, Analytics 21 vs 22 ms, 500-expense save 29 vs 30 ms, demo switch on/off 32/31 vs 31/27 ms, Ask open 13-16 vs 15-18 ms (one extra navigation state change per open); renders gate: tabs, addExpense, type, closeAdd and scroll within baseline, ask 888 updates vs main's own 828 (baseline 733; main already fails that phase); web verified, native and the simulator checks not run; hosted AASA / assetlinks and the deferred hand-over need the backend) |
| Storage | Demo mode: Settings > Data switch onto a separate local database (`splito-demo`) holding the one demo dataset, banner and "Demo" sync dot while on, Reset demo; real database untouched (dev/e2e builds only) | F-228a | merged into integrate/wB 2026-10-29, web verified, native not yet run. Wave B assemble (owner 109): the one dataset now also holds the Supper Factory bill (items in food and alcohol classes, stacked service and VAT, round-off +0.39 to 2,522.00) and its saved merchant setup, comment threads (one edited, one deleted, one on a payment), Remind and Remind me rows, a deleted group, friend, expense, payment and write-off in place plus one hidden by hand, an inactive and a hidden group, members who left with an admin handed to me, a removed friend, a settled group and friend, and JPY, BHD, KWD and USD beside rupees and euros in Goa and Lisbon; `demoCoverage.test` has 24 more lines for them (comments, reminders, backup round trip, Ask-ready balances). Checks: `pnpm check` green (packages 350 + 354, client 486 tests), e2e 318 specs (last full run 317 pass, the one miss fixed and rerun alone 8/8), lingui en + hi 1,810 messages 0 missing. Perf 2026-10-29 web Chrome, `pnpm perf`: seeding the demo set (first switch on) 1,422 ms, first on 43 ms, on 31 ms, off 33 ms; large demo set (1,615 expenses) Home cold open 56 ms, write + UI 15 ms, Analytics 35 ms, search 21-42 ms; 10,000 expenses Home cold open 49 ms, write + UI 16 ms, Analytics 22 ms, Ask open 14 ms / answer 26 ms; 500-expense save 13 ms. Earlier on feat/demo-mode: (web verified, native not yet run. Client `demoSeed.test` on IndexedDB and SQLite, `demoCoverage.test` (every feature incl. the invites flow in every state, and again 30 days later), e2e `demo-mode.spec` (banner on every screen, swap under an open sheet) + `friends.spec`, 222 e2e. Perf 2026-10-29 web Chrome, `pnpm perf`: seeding the demo set (open, seed a year, adopt: the first switch on) 1,544 ms, click to banner 1,347 ms in e2e; adopt to Home holding its figures, switch on / off 24 / 29 ms (first one 38 ms); large demo set (1,594 expenses) Home cold open 49 ms, write + UI 16 ms, Analytics 39 ms, search 24-41 ms; 10,000 expenses Home cold open 48 ms, write + UI 16 ms, Analytics 13 ms; 500-expense save 11 ms) |
| Engineering | Guardrails: CI architecture test | F-108 | in progress (built and tested on feat/b-*, unmerged) |
| Integration | Merge the UI line + Batch 4 streams + phone bottom drawers into m1-foundation | Batch 4b row 30 | todo (first item of Batch 4b) |
| Shell | Bluesky sidebar / bottom bar / FAB (phones only, no-Back screens) / drawer / header rules / owner logo in the accent colour | F-201 | in progress (built and tested on the unmerged UI line) |
| Shell | Activity in bottom bar + sidebar + drawer (pulse icon, unread badge), no header bell | F-202 | in progress (built and tested on the unmerged UI line) |
| Shell | Pager tabs and animated main-tab switches | F-203 | in progress (built and tested on the unmerged UI line) |
| Shell | Desktop LeftNav: centred mark, nav items, Add expense pill, footer links, rail | F-204 | in progress (built and tested on the unmerged UI line) |
| Shell | Desktop right column: 5 recent transactions + 5 recently active groups (by last change time) | F-224 | in progress (built on ui/preview-latest, unmerged) |
| Shell | One nav list for sidebar and drawer; "Home" label; desktop/rail Home title; drawer shows real name only | F-222 | done (Search & Ask drawer, Settings > Navigation; web e2e) |
| Shell | Sync-status dot on the user's avatar (green / yellow / red, with text label) | F-223 | done (red until the backend; web e2e; native not run) |
| Branding | Dim splash in dark mode; brand kit on iOS, Android, web | F-1711 | done (config and web launch screen; native splash not run on a device) |
| Branding | Original Splito mark replaces the dev butterfly (release blocker) | F-1712 | todo |
| Sheets | Every phone modal (forms, pickers, filters, menus, prompts) is a bottom drawer with drag to close; desktop popups with X top-right, Cancel + Save bottom-right | F-205 | in progress (built and tested on the unmerged UI line) |
| Lists | Overview, expanding search and filters on Friends and Groups | F-206 | in progress (built and tested on the unmerged UI line) |
| People | Balances per currency, group breakdown, person page, Include groups filter | F-207 | in progress (built and tested on the unmerged UI line) |
| Groups | Group page with Expenses / Balances / Members tabs; payment rules in the overflow | F-208 | in progress (built and tested on the unmerged UI line) |
| Groups | Groups and trips (create, edit, members) | F-603 | in progress (built and tested on the unmerged UI line) |
| Expenses | Add / edit / delete / undo, all split modes, multiple payers, calculator, currencies, any date, categories | F-301, F-302 | in progress (built and tested on the unmerged UI line) |
| Expenses | Itemize: portions, Everyone, tax / tip / service / discount visible with amount / % toggle | F-401 | in progress (built and tested on the unmerged UI line) |
| Expenses | Tax classes and scoped, stacked charges (the owner's Supper Factory bill: 201.10 / 221.51 / 88.00, round-off 0.39), presets, per-merchant memory | F-403 | built, web verified, unmerged (feat/wB-B7; pnpm check green: 331 domain / 236 sync / 232 client tests; full e2e 230 tests incl. `charges.spec.ts` at phone and desktop and the 2,522.00 bill; 10k-expense perf: Home cold open 55 ms, write 16 ms, search under 25 ms; native not yet run; acc 8 receipt markers wait for F-501 / F-502, export and share text for Wave C) |
| Expenses | Smart amount input | F-310 | in progress (built and tested on feat/b-*, unmerged) |
| Expenses | Amount entry and parsing correctness (audit C1, C2, M1, M2, M3, M7, M14, m8, m9, m13) | F-111 | done (feat/4b-33c; domain/sync/client bun tests + e2e `amountLocale.spec.ts` in de-DE and en-US with BHD; web verified, native not yet run) |
| Navigation | Web navigation and sheet robustness (audit M16, m6, m12, m26, m27, m30) and one-line Activity request rows | F-116 | done (feat/wA-33h; sync `mutations.test.ts` / `preferences.test.ts`, client `goBack.test.ts` / `form.test.ts` / `draftKey.test.ts`, e2e `webNav.spec.ts` + `links.spec.ts` + `activityRequests.spec.ts`; web verified, native not yet run) |
| Settle up | Balances and settle consistency (audit M6, M10, M11, m5, m7, m10, m16) | F-113 | done (feat/4b-33d; domain `balanceAudit.test.ts`, sync `writeoffs.test.ts`, client `form.test.ts` / `sort.test.ts` / `feed.test.ts`, e2e `balances.spec.ts` + `group.spec.ts` A07 + `demo.spec.ts`; web verified, native not yet run) |
| Money | Many-currency completeness (audit M5, M8, M12, M15, m2, m3, m21; demo M13) | F-112, F-227 | done (feat/wB-B2; `e2e/many-currency.spec.ts`, domain `cash.test`, sync `preferences.test`, client `formPick.test` / `ledger.test` / `sort.test` / `filter.test`; web verified, native not yet run) |
| Settings | Timezone, date and number formats everywhere (audit M9, M17, M18, m14, m23, m24, m25, m28, m29) | F-115 | done (feat/wA-33g; client `dates.test.ts` / `feed.test.ts` / `numberFormatNative.test.ts`, sync `preferences.test.ts`, e2e `dates.spec.ts`; web verified, native only checked under Bun's polyfill run, not yet on a device); Activity row-build profile, 1,000 events, `feed.bench.test.ts`, Bun on a machine at load average ~250: before 3.4-3.7 s (domain `todayIn` built an `Intl.DateTimeFormat` per call), after 3-11 ms (one cached formatter per timezone, `buildRows` memoised in `useActivityFeed`); not profiled on Hermes) |
| Expenses | Cash rounding with visible remainder | F-402 | in progress (built and tested on feat/b-*, unmerged) |
| Settle up | Plan per group, payment rules, record repayment, UPI link and "Mark as paid?" | F-1101, F-1103 | in progress (built and tested on the unmerged UI line) |
| Settle up | Call it even: forgive or write off | F-1113 | in progress (built and tested on feat/b-*, unmerged) |
| Activity | Feed, read/unread, All / From others, actor avatar, day headers, lent/borrowed rows, swipe, hide, undo | F-1201 | in progress (built and tested on the unmerged UI line) |
| Activity | Deleted items stay in their lists, struck through, forever; Restore; Hide and Show hidden (no Recently deleted bin) | F-1203 | done on feat/wB-B3x (unmerged; pnpm check green, full web e2e 241 passed, 1 skipped (UPI test, opens an external app), the "large demo under 10 s" timing test passes alone, incl. `deletedInPlace.spec.ts` (18 tests) on phone and desktop; perf on the 10,000-expense ledger: Home cold open 46 ms (5 runs 44 to 56), write + UI 16 ms, Analytics open 18 ms, search keystroke 19 to 41 ms; large demo set 1,569 expenses: cold open 48 ms, write + UI 16 ms; native long-press not yet run) |
| Analytics | Charts + table, period / currency / group filters, Export CSV in the header overflow | F-1301 | in progress (built and tested on the unmerged UI line) |
| Settings | Prune to 7 pages, 47 registry keys (16 retired, `notify.expense` folded into Payments, Comments added), 7 merges write their key where they act, switches for every on/off setting, no demo banner, " - Demo" in header titles | F-251 | done on integrate/wB 2026-10-29 (sync `preferences.test` incl. retired-key and notify-fold tests; e2e `settings`, `friends`, `remind`, `demo-mode`, `many-currency`; web verified, native not run). Perf `pnpm perf` web Chrome vs the earlier row: large demo set (1,615 expenses) Home cold open 55 ms (was 56), write + UI 16 ms (16), Analytics 36 ms (35); 10,000 expenses cold open 50 ms (49), write + UI 16 ms (16), Analytics 22 ms (22); 500-expense save 13 ms (13). No regression over 10%. Screenshots: apps/client/qa/settings/ |
| Settings | Every preference incl. Dim / Black dark style, accent, timezone | F-1701 | in progress (built and tested on the unmerged UI line) |
| Settings | Account section: Sign in / Create account (Bluesky LoggedOut, Login, Signup copied; honest until sync; Log out ships with F-2102) | F-225 | done (feat/wA-30b; backend submit answers "arrives with sync" until F-2102) |
| Friends | Private friends ("Add anyway (only for you)") | F-601 | in progress (built on the unmerged UI line) |
| Friends | Add friend by email or mobile, Splito directory check, consent, Requests and Invites sent | F-618 | done (feat/4b-31-33; directory answers in demo only, production says "We'll check when you're online" until F-2111) |
| Friends | Invite link and QR with use / expiry limits, manage and revoke | F-619 | done (feat/4b-31-33; links fail closed outside demo until F-2105) |
| Friends | Settings > Friends and invites hub, safe Remove friend | F-621 | done (feat/wB-B6) |
| Friends | Choose from contacts | F-602 | done (feat/4b-31-33; web verified, native picker not yet run on a device) |
| Friends | Directory lookup and friend requests on the server | F-2111 | todo (needs backend) |
| Friends | Invites and invite links on the server; link a private friend to a real account | F-2105, F-2106 | todo (needs backend) |
| Support | Feedback: drawer + footer + Settings > Support, Send feedback sheet, Your feedback, saved on device + email draft | F-226 | done (feat/wA-34; integrated on integrate/wA) |
| Support | Feedback endpoint | F-2112 | todo (needs backend) |
| Support | Help, About, licences, privacy | F-215 | todo |
| Platform | PWA: production service worker, offline shell, update toast, manifest, Install app | F-1901 | done (feat/wA-38; verified in Chrome on a production build: registers, opens offline incl. deep routes, no API cached, update toast + Reload, install prompt and iPhone steps; Safari 7-day warning has no Export action until F-2001; native iOS/Android n/a) |
| Expenses+ | Disputes and holds (owner 119): raise, hold, release, accept (one-tap fix), reject, withdraw, reopen; badges, "of which disputed", Settle up leaves them out, Disputed filter, Search `status: disputed`, CSV column | F-1210 | built on feat/wC-F1210-disputes, unmerged (2026-10-30; local, both engines; For you card "Needs your answer", the Home overview line and "Adjustment after settle-up" are follow-ups, BACKLOG F-1210). `pnpm check` green apart from `search.test.ts` "every query under 50 ms", which fails only at load above 20 (324 ms at load 25, 22 ms when quiet; the search code is untouched). Checks: domain 13 permission tests + 9 `disputed.test.ts`, sync 36 `disputes.test.ts` on SQLite and IndexedDB, the property test (disputes on their own random stream; a twin run without them gives identical balances, pairs and aggregates; disputed sums equal a recomputation), v4 -> v5 migration on both engines incl. the large set, 13 `demoCoverage` lines; Playwright `disputes.spec.ts` 24/24 at 390 and 1440; full web e2e 511 tests at 2 workers: 506 first run, the 5 misses were 4 from this change (the CSV's extra column, a row-menu testID that collided with Hide) and one existing race (`ask.spec` goes to `/` right after a pref write; passes alone), all fixed or shown to pass alone. Perf (load 16, this branch): 10,000 expenses Home cold open 28 ms, write + UI 16 ms, Analytics open 44 ms, Ask open 32 / answer 27 ms; large demo set cold open 37 ms, write + UI 15 ms; tap latency tabs 11-65 ms, FAB 40 ms (x1) / 105 ms (x4). Each money write adds one indexed read of the record's open disputes. Renders gate re-recorded: scroll phase +Strong/TriangleAlert (the Activity feed now holds the demo's dispute rows: 11 new rows with a triangle badge), ask phase +8 Text (one more search tip). Add expense stays at baseline (the resolve question mounts only for a disputed expense; the dispute reads skip when there is no expense id). Web verified; native and simulators not run |
| Expenses+ | Comments on expenses and repayments (local + outbox) | F-1204 | in progress (built and tested on feat/wB-B4, unmerged; acceptance 4 with F-2208; others' comments in Activity wait for F-2208). Review minors fixed 2026-10-29: sync 242 tests (`comments.test.ts` 11, edit on a deleted target refused), client 224 tests, full web e2e 226/226 with the UPI pay test left out (it clicks a UPI link; machine at load ~30 made `demo-large` miss its 10 s bound once, 3.2 s alone), `comments.spec.ts` 8 incl. Tab to the row menu and Shift+F10 / ContextMenu at 390 px; perf (500 expenses, one save): pref 1 read / 1 commit / 363 renders / 15 ms, expense 7 reads / 2 commits / 73 renders / 18 ms; large demo set (1,569 expenses): cold open 53 ms, write+UI 15 ms; 10,000 expenses: cold open 49 ms, write+UI 16 ms, search 13-27 ms per keystroke; web verified, native not run |
| Expenses+ | Disputes, flags and hold | F-1210 | todo |
| Expenses+ | Shared comments and disputes | F-2208 | todo (needs backend) |
| Reminders | Remind via share sheet (Person, group Balances, Settle plan), logged in Activity | F-1118 | done (feat/wB-B5; Person, group Balances, Settle plan; e2e `remind.spec`) |
| Reminders | Remind me (local notification for yourself) | F-1119, F-1907 | done (feat/wB-B5; native OS scheduling not run on a device; web fires only while open) |
| Reminders | Reminder policy, tone, language, snooze | F-1111 | todo |
| Reminders | In-app reminders (1 per person per 3 days) and opt-in automatic reminders | F-2210 | todo (needs backend) |
| Data | JSON backup export + import / restore (Settings > Data) | F-2001 | done (feat/wB-B6) |
| Data | Export centre: CSV, PDF statement, filters; Group / Person / Analytics export entries | F-2007 | done (feat/wB-B6) |
| Data | Power exports (YNAB, Beancount, XLSX) | F-2004 | todo |
| AI | Ask Splito: nav item, Sparkles Search & Ask button, Search row; DM-style chat; on-device answers (English and Hindi) with rich cards | F-2301 | done (web e2e; native pass pending) |
| AI | Free-form answers via the backend model; AI opt-in and privacy | F-2302, F-2303 | todo (needs backend) |
| Data | Free search across expenses | F-1401 | in progress (built and tested on feat/b-*, unmerged) |
| Data | Search understands every field: title, notes, items, people (names, contacts, UPI), group and trip place, category, amounts and ranges (`1k`, lakh, between, around), dates and periods, currency, payer, status (settled, owed, disputed, deleted, hidden, inactive), types, comments, payments and write-offs; English and Hindi; removable facet chips; the matched field named on each result | F-246 | built on c-search, unmerged (2026-10-31, main merged). Answered from index keys, not rows (ARCHITECTURE 9.8, 17.1). Checks: sync `search.test.ts` + `searchFields.test.ts` (every field on SQLite and IndexedDB) + `searchOracle.test.ts` (keys equal the rows, order and totals, 1,200 random expenses) + `searchQuery.test.ts` (90-query table) + `searchMatch.test.ts`; `search.spec.ts` 13/13 at 390 and 1440 with `disputes.spec` Disputed filter and `tripLocation.spec` 4/4; lingui en + hi 1,959 messages 0 missing; lint, typecheck and `lessonsGate` green. NO USABLE SPEED RUN: the machine sat at load 70-90 all session. Unusable numbers (load 75-81, median of 3, `openSearch` = people, groups, payments, count, totals and first page): worst query 5,000 expenses 337 ms wall / 14.7 ms cpu, 10,000 expenses 517 ms wall / 41.8 ms cpu; before the change, whole answers at 5,000 cost 61-80 ms cpu per broad query at load 17-22. Renders gate: ask phase 1,020 mounts + 851 updates against baseline 1,018 + 944 (within); the scroll phase reports Activity components (`TimeElapsed`, `DeletedMeta`, `RequestAction`, `OutgoingRow`) above baseline at load 75, untouched by this change. Web verified, native not run |
| Accessibility | Money direction never shown by colour alone | F-1801 | in progress (built and tested on feat/b-*, unmerged) |
| Motion | Lottie illustrations, animated balances, success check, list animations | F-1704 | in progress (built on ui/brand, wiring) |
| Expenses+ | Recurring expenses (rent, subscriptions) | F-306 | todo |
| Expenses+ | Saved split templates | F-305 | todo |
| Expenses+ | Guest participants (one-off people) | F-308 | todo |
| Expenses+ | Quick add by typing ("Dinner 1200 with Riya and Sam") | F-507 | todo |
| Expenses+ | Receipt capture: camera / photo / file, on-device OCR, review before saving | F-501, F-502 | todo |
| Expenses+ | Attachments (photos, PDFs) | F-312 | todo |
| Expenses+ | Location: manual place, optional automatic | F-313 | todo |
| Groups+ | Active / inactive and show / hide groups (decision 89) | F-604 | done (feat/wB-B3; sync `groupLifecycle.test.ts` + store contract on both engines, client `filter.test.ts`, e2e `groupLifecycle.spec.ts` phone + desktop; web verified, native not yet run) |
| Groups+ | Leave a group, delete a group (restores whole), hand over admin | F-615 | done (feat/wB-B3; sync `groupLifecycle.test.ts`, e2e `groupLifecycle.spec.ts`; web verified) |
| Activity | Tabs All / Me / Others, Type filter (Expenses, Payments, Comments, Groups, Friends and invites, Reminders, Disputes), `?type=transactions`, `?group=`, comments in the feed, "See all" of Recent transactions (Home, right column) lands as a pushed copy (`from=<tab>`, owner 184) | F-1213, F-259 | built on feat/wC-F1213-F259-activity, merged with F-256 and F-1210, web verified, unmerged. Touched specs (activity, activityFilters, deeplinks, shell, homeTabs, disputes) 240 run, all green after the merge fixes. Scale: 10,000 expenses walk to a 10,000-event window in 346 ms (SQLite) / 1,193 ms (IndexedDB), a new expense costs 8 / 13 ms (`activityScale.test`; before 23.6 s and 72 ms); an empty Disputes type answers in 338-540 ms under load 25-40. Renders baseline re-recorded as the median of 3 runs on the merged branch (launch 304 updates, tabs 3,557, scroll 31,876; the gate passes twice in a row); perf `tapLatency` earlier x1 Activity tab 15 ms, x4 61 ms; native not yet run |
| Groups+ | Safe member removal: settle, forgive or keep inactive, with a balance preview | F-613 part 1 | done (feat/wB-B3; domain `memberExit.test.ts`, sync `groupLifecycle.test.ts`, e2e); re-split wizard is Wave C |
| Groups+ | History, bin and sync integrity (audit M4, m1, m11, m15, m17, m18, m19, m20) | F-114 | done (feat/wB-B3; sync `historyIntegrity.test.ts`; m20 Include groups part open) |
| Groups+ | Trip kitty (shared cash pot) | F-701 | todo |
| Groups+ | Split accommodation by nights stayed | F-702 | todo |
| Groups+ | Trip budget (total + per category) | F-1304 | todo |
| Groups+ | "Fewest payments" toggle for groups without rules | F-1102 | todo |
| Data | Saved views (This month, a trip, Outstanding, Missing receipts) | F-1403 | todo |
| Data | Trip summary PDF, share summary via WhatsApp | F-1503, F-1501 | todo |
| Data | Splitwise importer | F-2003 | todo |
| Payments | Payment links beyond UPI (PayPal.me, Venmo, Revolut, Wise, ...) | F-1106 | todo |
| Payments | Send money through a payment provider | F-2223 | todo (needs backend + provider choice) |
| Customization | Card hide / reorder / rename / resize / tint; black-and-white theme | F-1703, F-1702 | todo |
| Platform | Home-screen widgets and quick-add shortcut | F-1905 | todo (native build) |
| Platform | Share a receipt into Splito from other apps | F-509 | todo (native build) |
| Platform | iOS simulator dev build (iPhone 18 Pro) | F-1902 | done (runs; Bluesky build settings + Intl polyfills) |
| Platform | Android build and emulator run | F-1903 | in progress (built and tested on feat/b-*, unmerged) |
| Account | API service (Fastify on Bun, Postgres) | F-2101 | in progress (fan2/api paused, 13 open review findings) |
| Account | Sign-in (email / mobile OTP, Google, Apple), sessions, Log out prompt | F-2102 | todo (needs backend) |
| Account | Sync across devices, conflicts (drives the green / yellow avatar dot) | F-2103 | todo (needs backend) |
| Account | Read-only balance link for friends without the app, editable guest links | F-2203, F-2204 | todo (needs backend) |
| Account | Push notifications | F-2201 | todo (needs backend) |
| Security | PIN lock, biometrics, encrypted storage | F-1601 | todo |
| Languages | English and Hindi complete; more languages | F-1810, F-1811 | done for en/hi (F-1810); more languages todo (F-1811) |
| Languages | Bluesky AppLanguageDropdown on the web sign-in splash, sign-up and desktop right column | F-1816 | done (feat/wB-B2; native sign-up on the iOS simulator not run: see report) |
| Best of both | Bluesky and Expensify scouting additions (`docs/scouting/2026-10-27-bluesky-expensify.md`) | F-229..F-236, F-318..F-321, F-620, F-1211, F-1212, F-1412, F-1507 | todo (Batch 4d; F-1211 Batch 13, F-1412 Batch 21) |
| Process | Wave B assembled on integrate/wB: B5, B3x, B2, B7, B4, B6, B1 merged in order, one combined schema v4, one external hand-off gate (`openExternal`, `shareSheet`; architecture rule `externalHandOff`) | - | in progress (integrate/wB, 2026-10-29; not yet in m1-foundation). `pnpm check` green after each merge and at the end (domain, sync, client incl. architecture rules). Full web e2e at the end: 303 tests, 0 skipped (the UPI pay and Remind specs now run against the recorded hand-offs `__splitoTest.externalUrls` / `sharedTexts`); under load 6 specs failed once and pass alone (ask six-tab bar, comments Tab to menu, UPI poll, search recents, sync-status op state, shell unread badge = a real data change, test relaxed to `<=`), and the "large demo under 10 s" timing test failed once and passes alone. Perf on the 10,000-expense ledger vs m1-foundation, same machine, alternating runs (median of 5): Home cold open 49-56 ms vs 47-52 ms (+4 to +8%), write + UI 16 ms vs 16 ms, Analytics open 13-21 ms vs 14-16 ms, search keystroke 11-25 ms; 500-expense save 1 pref read / 7-8 expense reads, 73 expense renders (same); Ask Splito on 10k: open 15 ms, answer 23-40 ms. All inside the § 26.10 budgets and under the 10% regression gate. Native not run. |

## Merge gate and wasted renders (F-242, owner 108 and decision 107)

**Merge gate, every slot and every wave assemble:** `pnpm check`; the e2e build and full `pnpm --filter @splito/client e2e`;
`pnpm --filter @splito/client perf` (budgets and the 10 % rule against m1-foundation, same machine, alternating runs);
and `pnpm --filter @splito/client renders` (below). The renders run fails on any wasted-render report from our code
that `apps/client/e2e-renders/baseline.json` does not hold, and on a mount or update count above the baseline by more
than 10 % + 1, per phase and per component. After an intended change, `RENDERS_BASELINE=write pnpm --filter
@splito/client renders` rewrites the baseline; the diff of that file is the review. Numbers go here.

Status: **in progress** (feat/wC-F242, 2026-10-29; done when merged). Library: `@welldone-software/why-did-you-render`
10.0.1, dev only (decision record `docs/reuse/renders.md`). The scenario uses the large demo (1,615 expenses, ~1,040
Activity rows scrolled), not the 10,000-expense fixture: the perf spec stays the 10k gate. Web only; no native run.

Scenario renders, desktop 1440 px, Metro dev server (React dev mode, so more than a production build), components
being shown + components re-rendered; wasted-render reports from our code. Before = m1-foundation 53a0ec6 + the gate,
no fixes; after = this branch.

| Phase | Before | After |
|---|---|---|
| Launch to Home (cold, demo restored) | 3,652 + 448 | 3,652 + 447 |
| Tab round (Groups, Activity, Analytics, People) | 21,577 + 5,977 | 21,577 + 5,977 |
| Open Add expense | 444 + 361 | 444 + 211 |
| Type 10 characters in the title | 0 + 2,241 (224 per keystroke) | 0 + 771 (77 per keystroke) |
| Close Add expense | 75 + 387 | 75 + 237 |
| Scroll Activity to 1,000+ rows | 50,343 + 37,909 | 50,343 + 37,888 |
| Search & Ask, one question | 1,066 + 706 | 1,066 + 706 |
| Wasted-render reports from our code | 19 | 4 |
| Reports inside react-native-web, svg, lucide, radix, react-navigation (counted, not failed) | ~5,100 | ~4,700 |

What was wasted and how it was fixed (at the root):

| Where | Cause | Fix |
|---|---|---|
| `components/split/ExpenseComposer.tsx` | The React Compiler skipped the whole form (a computed key in a destructuring pattern; a `try`/`catch` around a conditional), so every keystroke re-created and re-rendered every row, button and dialog | `Object.fromEntries` filter; the write moved to `persistExpense`, which returns its failure |
| `screens/AddExpense.tsx` | Compiler skipped `AddExpenseForm` (a function used before its declaration) | Declaration moved above its use |
| `components/Button.tsx` | One `{pressed, hovered, focused}` state object set to an equal value on every hover/focus event, which also re-made the context `ButtonIcon` and `ButtonText` read (18 reports) | Three booleans; the context changes only when a flag does |
| `components/Dialog/drawer.web.tsx` | `visualViewport` events set a new `{bottom, height}` for the same numbers (Dialog `Outer`, `Inner`) | Keep the object when the numbers are equal |
| `components/Portal.tsx` | `remove` of an id that was not there still built a new outlet | Return early |
| `features/searchAsk/SearchAskProvider.tsx` | `setInitial` with an equal `{query, mode}` | Keep the object when equal |

Residual, in the baseline: 4 reports at one occurrence each. A `Portal` whose owner re-renders re-appends equal
elements (`Provider`/`Portal`/`Outlet`), and one `View` whose owner is not reported. The store hooks (§ 9.6) returned
no new snapshot for an equal answer in this scenario: every `useSyncExternalStore` report was a real change.

Found, not fixed (outside the scenario's reports, each a separate item): the compiler still skips these components
(`docs/reuse/renders.md`; the A-017 bail-out census is not built): `Menu/index.tsx`, `FormSheet/Screen.tsx`,
`SearchAsk/AskComposer.tsx`, `AskChat`, `AskAnswer`, `StoreProvider`, `List.web.tsx` (`ListImpl`, imperative handle with
getters), `FABInner`, `PeopleDialog`, `RequestsSection`, `CommentRow`, `RulesEditor`, `ItemRow`, and the sheets with
`try`/`finally`. Each Activity row mounts ~50 components for its Radix menu (1,011 `Popper` mounts for 1,000 rows); the
row is a mount cost, not a re-render, so the gate counts it and does not fail it. Typing still re-renders ~77
components per keystroke (the form, its split rows and two dialogs take the whole `form`).

Checks on this branch: `pnpm check` green (domain 350, sync 354, client 493 tests, 5 skipped); full web e2e 331 passed,
1 failed once under 4 workers (`ask.spec.ts` "pinned bar tab", passes alone) after `bundle.spec.ts` was added; perf on
the 10,000-expense ledger, median of 5, same machine, alternating with an m1-foundation build: Home cold open 66 ms vs
66-69 ms, write + UI 32 ms vs 48 ms (noisy, 15-16 ms best case on both), Analytics open 34 vs 27 ms, search keystroke
20-29 ms, Ask open 13 ms and answer 28 ms; 500-expense save 18 expense reads and 1 expense render on both. The perf
spec's 10,000-expense Ask typing assertion (chat input keeps every character) failed under machine load on both builds
and passes alone.


## Tap latency and shell first (owners 150, 151, 152; branch fix/tab-taps)

Root cause of the dropped tab taps: `useDedupe(250)` on tab presses. The native `BottomBar` shared one dedupe across
every tab (any tap within 250 ms of another, whatever the tab, was dropped); on phone web each `Link` had its own, so
A, B, A within 250 ms dropped the second A and the landing tab was not the last one tapped. `navigate` is idempotent,
so `useNavigationDeduped().navigate` and the bottom bar no longer dedupe. e2e `tabTaps.spec.ts` (18 tests: 6 and 10
taps 50 ms apart, bursts 20 ms and 0 ms apart, bottom bar at 390 touch, sidebar at 1440, rail at 900, Group and
Activity tabs including the list behind them, no tab widening the page, full and reduced motion): 5 of 14 failed before
the fix, all pass now (three runs in a row).

Second cause, found with the 0-10 ms burst (a hand cannot do it, but it exposed this): the Analytics loading skeleton
(`SummaryPlaceholder`) had three fixed 120 px columns plus gaps, 417 px wide on a 390 px screen. For the frames the
skeleton was on screen the layout viewport widened to 417, and the fixed bottom bar, laid out against it, sat 57 px
below the fold, so a tap on a tab hit the page behind. Columns are shares of the row now. A burst of six taps 0-10 ms
apart lost its last tap in 10 of 30 bursts before (4 of 30 on the phase-1 build), 0 of 90 after (two runs of 40 and 50). `html, body {
overflow-x: clip }` was tried as a second guard and broke window scrolling (`scrollWeb.spec.ts`), so it is not used.

Tap to first visual change (`perf/tapLatency.spec.ts`, 390 px touch, large demo ledger, app reloaded per run, median of
3, DOM-change time via MutationObserver, quiet machine with load under 6; headless Chrome, so a 10 ms result is one
frame). Before = the phase-1 build; after = this branch. Milliseconds from touchstart to the result in the DOM.

| Tap | Before x1 | After x1 | Before x4 CPU | After x4 CPU |
|---|---|---|---|---|
| Tab: Groups / Analytics / Activity | 18 / 20 / 54 | 19 / 18 / 18 | 36 / 41 / 160 | 35 / 47 / 40 |
| Friend row, group row | 21, 14 | 20, 37 | 36, 34 | 71, 61 |
| FAB (Add expense opens) | 44 | 40 | 86 | 88 |
| Open filters sheet | 35 | 35 | 47 | 61 |
| Filter chip, switch | 11, 10 | 14, 10 | 13, 14 | 16, 13 |
| Add expense Save | 33 | 36 | 46 | 51 |
| Tab, 50 ms, next tab (second tap latency) | 175 (118 ms long task) | 36 | 169 | 59 |
| Sheet X (exit slide begins) | 39 | 45 | 45 | 37 |
| Longest JS task after Activity first visit, x4 | 188-202 | 0 | | |

Every tap is under the 100 ms (x1) and 200 ms (x4) budgets. The gains are where a heavy body used to sit in front of the
next tap (Activity tab 54 to 18 ms, 160 to 40 ms at x4; second tap 175 to 36 ms, 169 to 59 ms at x4). The friend and group rows at x4 are
about 30 ms slower after (header and a frame of waiting before the rows mount) and stay well inside the budget.
On a machine at load 20 to 140 the same runs read 100-500 ms for both builds; numbers taken under load are not used.

Renders gate (`pnpm --filter @splito/client renders`, 10 % + 1 over `baseline.json`). Totals against main's baseline:
launch updates 448 to 403, tabs updates 5,977 to 4,418, addExpense updates 211 to 164, closeAdd 237 to 183, scroll 37,876
to 38,0xx (the same rows; SubtleHover below), ask 733 to 798-866 (see below), type 771 to 782. Every per-component
increase, with its cause:
- `Deferred` (update 7 launch, 13 tabs, 17 scroll; mount 4 tabs), `SheetBody` (update 11 while typing in the composer):
  new wrapper components of this branch, one cheap render per screen body or composer keystroke; they replace the
  skeleton and placeholder renders that disappeared (`PersonRowPlaceholder`, `Shimmer`, `BalanceSummaryPlaceholder`,
  `FriendsHeader`, `AddExpenseFAB` and `DesktopLeftNav` updates all fell).
- `Block` mount 7 to 10 (tabs): the Analytics chart placeholder holds the chart's height for the two frames before the
  charts mount (`Deferred sameSize`).
- addExpense mounts `View` 72 to 105, `Text` 55 to 66: the composer's skeleton body stands in for the one frame the
  heavy body waits (`deferBody`), so the sheet shell opens at once and nothing flashes.
- Present on pristine main (checked in a clean worktree of main at 088b270; not from this branch): `Icon(CircleCheck)`
  18 to 24 (tabs), `Icon(Banknote)` 45 to 53, `Icon(Handshake)` 7 to 14, `Rect` 45 to 53, `Strong` 2 to 5 (scroll).
  They are Activity row furniture (a check on a live row, Banknote for payments, Handshake for settle-up and "call it
  even" rows, bold text in row notes): more of those rows fall in the scrolled window since main's activity and history
  row work (F-251/F-1203 merges and the unsynced-row styling, f4b3979); not bisected to one commit.
- `SubtleHover` update 35 to 43 (scroll) and the whole `ask` phase (733 to 798-866; `View` 175 to 220): main's baseline
  was already stale at those (earlier merges plus the links work); both are timing-noisy between runs (the ask answer
  streams in chunks, the scroll count follows scroll timing), so they are recorded at the highest value seen in 8 runs.
Eight consecutive runs after recording: 8 of 8 pass.

## Sign-in required and the intro (F-249, F-250; branch feat/wC-F249-F250-auth, web only, measured 2026-10-30)

Machine load was 18-66 for most runs (other builders), so timings are upper bounds; the perf rule is "under ~20".

| Check | Result |
|---|---|
| `pnpm check` (lint, typecheck, package and client tests incl. architecture rules) | green; client tests 639 pass (new: `password.test.ts`, `authConfig.test.ts`) |
| Lingui | en 1790 / hi 1790, 0 missing (about 80 new strings, Hindi written for each) |
| Full e2e (`e2e:build --clear`, `--workers=2`, port 8267) | 540 tests: 536 passed on the first run, the 4 that failed (3 in `language.spec.ts`, 1 in `shell.spec.ts` drawer rows) were specs of the old Sign in / Create account screens and are rewritten; re-run green. New: `welcome.spec.ts` (11), `introReplay.spec.ts` (2), `auth.spec.ts` (37), `authConfig.spec.ts` (3), `authShots.spec.ts` (6) |
| `e2e:pwa` (production build, signed out) | 7 passed, 1 skipped (the update toast needs a signed-in session; production has no dev sign-in). New: no dev sign-in in the production export (`bundle.spec.ts`), Continue says "arrives with sync" and holds no dev button, no database, no `__splitoTest` |
| Perf (`pnpm perf`, CPU x1 and x4) | save 500 expenses: pref 1 read / 29 ms, expense 18 reads / 13 ms, 0 long tasks; 10,000 expenses: Home cold open 101 ms, write 32 ms, Analytics 44 ms, Ask 17 ms open / 27 ms answer; demo switch on/off 23 / 34 ms; every tap under 100 ms at x1 (Groups 20, Analytics 24, Activity 21, FAB 39, sheet 40, Save 45) and under 200 ms at x4 (FAB 107, sheet 83, Save 78). One red: `tab, 50 ms, tab` at x1 (188 to 244 ms, one long task of 134 to 143 ms), the same on pristine `bf82d1d` built and run in a clean worktree on the same loaded machine (189 ms, long task 143 ms), so it is not from this branch |
| Renders gate | 1 passed, baseline unchanged. First run read `mount:Outer` 18 vs 14 (the two always-mounted prompts, Log out and the legacy offer); both now mount their dialog only when needed (Log out on its first request, the offer when old data exists), which brings the count back |

Cost of the gate: signed out no store is opened (`indexedDB.databases()` is empty on every signed-out address, asserted); signed in, launch adds one `indexedDB.databases()` check for the old database (once per install, then the flag stops it) and no store reads.

### F-249 / F-250 fix round (2026-10-30, after the Opus review; web only; machine load 30-75 from other builders)

Run on the touched specs only, by the coordinator's process change (the full suite runs once on merged main). A full e2e run of this branch just before the owner 186 change finished at 548 of 550 (the two reds were `demo-mode` specs that main's capitalised names broke and an `ask` spec racing a preference write; both fixed in the specs).

| Check | Result |
|---|---|
| Lint, typecheck, client unit tests | green (647 tests; new: `dev.test.ts` tokens, `password.test.ts`, `public.test.ts`, `authConfig.test.ts`, `pwa.test.ts` noindex) |
| Lingui | en 1800 / hi 1800, 0 missing |
| `welcome`, `auth` (43), `authConfig`, `introReplay`, `language`, `shell` drawer, `ask` pinned tab, `friends`, `demo-mode` | 92 passed; `auth` log-out tests rewritten for owner 186 (erase, demo DB, retry, resume) pass; one red: `demo-mode.spec.ts:26` "seeds the demo database in under 10 s" took 11.1 s at load 32 (a timing budget; the seed itself is unchanged) |
| `e2e:pwa` on the preview build | 8 passed, 0 skipped: preview export has the dev sign-in and no e2e hooks, offline signed in, the update toast, `noindex`, the preview note |
| Renders gate | red, and not from this change: the `tabs` phase doubles (`ChartCard` 5 to 10, `Path` 26 to 48, `Svg` 10 to 14, `UITextView` 239 to 462), i.e. the Analytics tab renders its body twice since main's Analytics-filters merge; the same gate was green on this branch before that merge (`mount:Outer` fixed earlier). Main has re-recorded its baseline since; the number to check is the merged one |
| Perf | not re-run (outside the touched specs); last numbers above |

Renders gate, fix/ios-safari-taps, re-recorded after merging main's Home / People tabs, fix round 2 (tabs stay mounted, owners 166 / 168; the phases now start after an explicit "demo loaded" signal, the
app's `splito:home-ready` mark plus one second without a commit; baseline re-recorded at the median of 3 runs, 3 consecutive passes after). Against the baseline of this branch's parent: tabs updates 4,418 to about 3,400 (it used to vary 1,916 to 3,440 between runs, the large
demo's background loading landing inside or outside the phase; 3,401 to 3,402 in 3 runs after the merge with main's Home / People), scroll mounts 50,113 to 42,810 (the parked Activity is re-used, not
rebuilt), launch 403 to 398. Switching Home > Groups > Home on a phone, both visited: 303 renders per switch to 71, all of them the
bar and the navigator, and none of PeopleScreen / PersonRow / BalanceSummary / SummaryCard / ListToolsHeader / ListImpl / GroupsScreen /
GroupRow (`renders.spec` "switching back to a visited tab re-renders none of its content"). Every per-component increase, with its cause:
- `VisibleTreeEffects` (update 2 to 10 tabs, 17 scroll; mount 3): the list's "in the visible tree" flag now lives in its own component,
  which is what re-renders when a tab is hidden or shown; `ListImpl` and every row used to re-render there instead (RowImpl 48 per round).
- `NavigationProvider` / `SceneView` / `Screen` / `Background` / `AnimatedHeaderHeightProvider` (update +2 to +4 per phase): the
  navigator's shell for the parked tabs (they are rendered hidden by the stack view, and its memo is defeated by `buildHref`); no screen
  content in them. The one new report, `View < ? [props: children, style]` (1), is that `Screen` / `Background` pair.
- `OpenedProvider` (update 11 while typing in the composer): a pass-through that re-renders with the composer, one cheap render per keystroke;
  it replaces `opened` state in the composer's shell (which re-rendered the whole sheet and was a new wasted render).
- addExpense updates 164 to 178, closeAdd 183 to 196: the same navigator shell, and `SheetBody` +3 (it now waits for the real end of the rise).
- `update:DesktopLeftNav` 0 to 3 (launch), `BarChart` / `LineChart` 0 to 3 (tabs): the first visit's deferred body now mounts a frame later, so
  the chart lands inside the phase of the tab it belongs to; `ask` (see above) is the same timing-noisy phase as before, highest value recorded.
Native (`transitionEnd`, the bottom sheet's state event) was not run on a device or simulator in this change.
## Home, People and Groups tabs (F-256, F-1415; owners 153-161, 175-177, 179; branch feat/wC-F256-home)

Home (`/`): compact Overview (scope All / Groups / Direct), Requests and Invites sent rows, Recent transactions,
Recently active people and groups; People (`/people`): the same request rows, the Friends list (search, Filters, gear);
Groups: no Overview. Tab ids `home | people | ...` with the saved `tabs` read-time migration; every item on the rail
and desktop sidebar (no More); the right column hidden on Home; bottom-bar labels up to 5 tabs; a main screen opened
from a link is a pushed page with Back. Web verified; native not run (the `Pushed<Tab>` twins and the Lucide glyphs
need a simulator check).

Checks, 2026-10-30, machine load under 6 for the perf runs (e2e at load 5-135 from other builders):
- `pnpm check` green; client bun tests 646+, sync `preferences.test.ts` (legacy `tabs` shapes), domain `ledger.test.ts` (scope).
- e2e build `--clear`, full e2e `--workers=2`: see the report (new `homeTabs.spec.ts`, rewritten `homeLayout.spec.ts`; ~35 specs updated for the new Home).
- Renders gate re-recorded (`RENDERS_BASELINE=write`). Home is lighter than the old friends-list Home at launch (launch
  mounts 3,580 -> 2,063, updates 403 -> 293); the tab round now also mounts the People list and Home's own lists
  (tabs mounts 21,440 -> 24,133, updates 4,418 -> 3,532); scroll 50,113 -> 42,805 mounts; add/close/type/ask unchanged
  within noise. Reviewed increases: (1) `tabs` mounts, from People now being mounted on top of Home on the same round;
  (2) three wasted-render reports x1 (`HeaderAvatar`, `AddExpenseFAB`, `ActivityScreen`, hook `useContext`): the pushed-copy
  check reads the route context, which changes once on focus; they re-render with equal output, once per launch.
- Tap to first visual change (`perf/tapLatency.spec.ts`, 390 px, large demo, median of 3, load under 6), x1 / x4 CPU: tab People
  20 / 32, Home 35 / 165, Groups 22 / 45, Analytics 17 / 39, Activity 13 / 33; friend row 17 / 35; group row 15 / 47;
  FAB 21 / 51; open sheet 28 / 73; Save 37 / 47; tab 50 ms tab 32 / 54. Budgets 100 / 200 met; Home at x4 (165) is the
  slowest (it draws the Overview and three lists), below the 200 budget.
- Perf `schema-v2` (Home now shows recent transactions in its body): large demo set (1,590 expenses) Home cold open 27 ms (was 25),
  write + UI 16 ms; 10,000 expenses cold open 25 ms (24), write + UI 16-32 ms (16), Analytics 43 ms (44), search 20-25 ms; Ask open 35 ms, answer 30 ms.
- Screenshots: apps/client/qa/home2/ (Home, People, Groups; light and Dim; 390 and 1440; demo on).

### F-261 PersonLink (c-personlink, 2026-10-31)

Renders gate re-recorded on purpose (median of three, machine at load 30-80, mount counts are not timing dependent): the scroll phase (1,000 Activity rows) mounts about 364 `PersonLink` and `Link`, and `Pressable` 2,218 to about 2,950 (one actor-avatar link per row); launch 10 and Ask 19 more `PersonLink`. No wasted-render report was added. People rows and Members pass `isInsideLink` and mount nothing extra.

Activity scroll at 6x CPU (large demo, 60 wheel steps), long tasks over 50 ms, with / without the actor-avatar links: 54 and 53 against 46 and 42 (total 9.3 s and 10.3 s against 10.5 s and 9.2 s; largest 592 and 835 ms against 963 and 728 ms); machine load 37-57, two runs each. No clear difference in time; the same over-50 ms tasks occur without any links.
## Animated icons and empty-state art (F-1713, F-260; owners 96, 172, 210, 213; branch c-anim, web, measured 2026-10-31)

- Web first-load JS (`expo export -p web`, e2e build; the `index`, `__common` and runtime scripts): 7,305,880 B before, 7,021,333 B after
  (-284,547 B, -3.9 %); gzip 1,545,216 B before, 1,495,320 B after. Lazy: 415 KB raw in 53 chunks (`lottie-web` 168 KB plus 52 animation files: 19 empty
  states, the 5 intro slides, loading and success, light and dark).
- Animations are UI-thread only (Reanimated shared values); each icon motion is 180-380 ms; the sync dot loops only while syncing and rests on blur or reduced motion.
- Not profiled: the 1,000-row list scroll with animated icons visible (F-1713 acceptance 4). Native (iOS, Android) was not run for the art: the once-and-rest play on
  `lottie-react-native` (`play(0, staticFrame)`) and the lid/tick motion are untested on a device.
- Tests: `e2e/emptyArt.spec.ts` (every empty state at 390 and 1440 shows its own art and a button; reduced motion holds one frame, light and dark; one art plays once and rests),
  `architecture/emptyStateArt.test.ts`, `activityEmptyArt` in `feed.test.ts`.
- Renders gate (`e2e-renders/baseline.json`, re-recorded as the median of three runs, machine load about 75 so only counts are used): launch 2,090 -> 2,127 mounts, tabs 468 -> 500 updates
  (mounts 69 -> 75), scroll 43,735 -> 43,740 mounts, ask 944 -> 957 updates, other phases unchanged. Reviewed causes: the new `MorphIcon` wrapper (7 icons mount, 8 update on the tab
  round) and its `Animated.View` (+7 mounts, +8 updates), the Activity tick glyph (`AnimatedIcon`, `Layer`, `Nodes`, `AnimatedPath`: 3 mounts), and two `View`/`Circle` mounts
  from the ContactRound and Users glyphs. No new wasted-render report. A first version that kept both the outline and filled glyph mounted cost 624 tab updates and one new
  wasted `Rect` report, so only the glyph in use is mounted.

## Guided tour after the first sign-in (F-253; web only, measured 2026-10-31, machine load 20 from other builders)

| Check | Result |
|---|---|
| Lint, typecheck | green |
| Client unit tests | new: `lib/tour/steps.test.ts` (6, which steps show for phone, desktop, settled friend, new account, nothing on screen), `lib/tour/layout.test.ts` (7, cut-out, card placement, 320 px width, hole path); architecture rules pass for the new files (the one red, `personAvatarOutsideLink` on `screens/Profile`, is on the integration branch before this change) |
| Lingui | en 2041 / hi 2041, 0 missing (10 new strings, Hindi written for each) |
| `e2e/tour.spec.ts` at 390 and 1440 | 12 tests: a new account is toured once (3 steps, Done ends it, no tour after a reload), Skip ends it, with a friend the steps sit on the FAB or pill / first row / balance, Escape skips and the dim blocks the control under it, Settings > Support "Take the tour" replays it on People, never in demo mode (no row either) |
| Neighbouring specs (load 20, so timings are upper bounds) | `shell` "sidebar holds the mark, the nav, Add expense" and "the FAB is on every top-level page" pass (they cover the controls the tour registers). Not green here, and not from this change (the tour never runs unarmed): `shell` "detail pages" (the demo group has 6 members, the spec says 5, from the F-269 demo data), `shell` "badge counts unread" (Activity rows not found), `shell` "on desktop the header stays put", `sidebar` 1440 (demo switch over the 30 s test limit at load 20); not bisected against a build of the integration branch alone |
| Cost | an account that has seen the tour: one `getPref` at launch, `TourHost` renders null; a tour that runs: one overlay in the portal, a measure per step (and one 350 ms settle look), no timers after it ends; no store subscription, no re-render of the controls it points at (ref callbacks register in a module map) |

Not run: iOS and Android (the native dim has no blur because `expo-blur` is not a dependency; `measureInWindow` coordinates on Android edge-to-edge and the announcement on VoiceOver / TalkBack are unchecked), the renders gate (its Metro port 8191 is outside this builder's range).
## F-266 perf sweep, c-perf port (owner 189; branch c-perf-port on `claude/repo-status-other-chat-xmr0l3` at 28f88d3, web, measured 2026-10-31)

`perf/sweep.spec.ts` (from c-perf, on the current routes: no Home, Settings a tab, the avatar opens Profile, the drawer by
its address, Support and Your data pages). Chromium (`channel: 'chrome'`), 390 x 844, touch, large demo, accessibility tree
off, 4 laps per run (first lap = open, median of laps 2-4 = revisit), median of three runs per cell, base and after builds
interleaved, 1-minute load 0.3-4.4 (x1) and 0.4-1.2 (x6). Cells: feedback / content / longest block, ms from `pointerdown`.
Base = 28f88d3 (`e2e:build`), after = this branch. Run: `PERF_DIST=<dist> E2E_PORT=8262 SWEEP_DATA=demo SWEEP_CPU=6
SWEEP_ONLY='^(tabs|Person|...)$' pnpm perf --project=sweep-chrome -g "demo data"`.

| Interaction | x1 base | x1 after | x6 base | x6 after | Rows cloned on leave |
|---|---|---|---|---|---|
| Person: Back (revisit) | 124 / 124 / 95 | 40 / 40 / 0 | 1,046 / 1,046 / 792 | 279 / 279 / 145 | 60 -> 0 |
| Group: Back (revisit) | 64 / 64 / 0 | 37 / 37 / 0 | 402 / 402 / 0 | 171 / 172 / 0 | 20 -> 0 |
| Friends and invites: Back (revisit) | 264 / 264 / 235 | 38 / 38 / 0 | 2,077 / 2,077 / 0 | 209 / 209 / 135 | 106 -> 0 |
| Friends and invites: open (revisit) | 220 / 220 / 181 | 148 / 148 / 123 | 1,486 / 1,486 / 0 | 1,097 / 1,097 / 0 | |
| Add friend: close (revisit) | 50 | 51 | 294 | 301 | 2 -> 0 |
| Person: open (revisit) | 48 / 112 / 0 | 40 / 116 / 0 | 304 / 875 / 188 | 260 / 784 / 202 | |
| Group: open (revisit) | 55 / 113 / 0 | 33 / 73 / 0 | 266 / 617 / 205 | 252 / 618 / 175 | |
| Add expense: open (revisit) | 59 / 485 / 0 | 54 / 484 / 0 | 364 / 953 / 167 | 306 / 881 / 145 | |
| People filters sheet: open (revisit) | 70 / 70 / 0 | 69 / 69 / 0 | 498 / 498 / 239 | 453 / 453 / 254 | |
| Search & Ask: open (revisit) | 72 / 72 / 0 | 72 / 72 / 0 | 524 / 526 / 240 | 399 / 399 / 181 | |
| Profile: open (revisit) | 38 | 34 | 200 / 200 / 123 | 186 / 186 / 0 | |
| Drawer: open (revisit) | 30 | 24 | 206 / 206 / 171 | 210 / 210 / 162 | |
| Activity: fling scroll, worst frame (first / revisit) | 143 / 18 | 141 / 18 | 1,254 / 54 | 1,146 / 39 | |
| People search, 16 keys, worst key-to-echo (revisit) | 75 | 75 | 1,152 | 1,139 | |
| First load to the start tab's rows (revisit) | 190 / 375 | 171 / 345 | 1,138 / 3,472 | 1,135 / 3,501 | |

Main tabs, revisit (tab highlight / content), x6: the sweep's tab round was taken again on the final code (cached breakpoint
answers), 6 base and 3 after runs interleaved at load 0.7-1.5: Groups 259 / 287 -> 270 / 322, Analytics 403 / 452 -> 441 / 491,
Activity 344 / 369 -> 360 / 396, Settings 239 / 262 -> 236 / 261, People 308 / 342 -> 314 / 340. Base Analytics ranged 356-488
over its 6 runs; the after runs (421-444) sit inside that range, so no change is claimed either way. At x1 every tab is
45-72 ms highlight and under 80 ms content on a revisit in both builds. The first build of this branch (breakpoints read
`MediaQueryList.matches` in render) read Analytics 439-484: reading the answer from the listener instead is in 17.1.

Demo mode on (seed a year, `demo-mode.spec` "under 10 s", alone): 9,058 ms base -> 8,029 ms after (median of three; held
people and group activity writes), and the app stays usable behind the pill meanwhile. With two workers it read 13.4 s (the
spec's 10 s bound is a timing test; run it alone).

Still over budget at x6 (owner 189 sweep, not fixed here): every main-tab switch (236-441 ms highlight, budget 100), Friends
and invites open (1.1 s, its 45-row list mounts in one task), Add expense body (881 ms), People search typing (1.1 s worst key,
one long task per keystroke), Activity's first fling (1.1 s, the first page of rows mounting). At x1 the remaining misses are
Friends and invites open (148 ms), the first Analytics visit (317 ms content) and the Add expense body (484 ms, under its
500 ms moving-surface budget).

Renders gate (`pnpm --filter @splito/client renders`, Metro dev, three runs each): identical counts on base and after,
launch 3,632+308, tabs 75+474, addExpense 501+179, type 0+793, closeAdd 76+193, scroll 32,971+17,629, ask 1,095+824-851,
7 wasted reports. A first version with a `<ScreenExitScope>` wrapper added 6-11 updates per phase (the wrapper re-rendered
with every screen), so the scope is a hook plus a bare provider. The gate is red on base as well, for two reasons that
predate this branch: the scroll phase stops at 806 Activity rows (the positive control wants 1,000) and `baseline.json` is
from before People became the start tab (launch 3,632 against 2,110). Not re-recorded here (counts are unchanged by this
branch); the counts above came from a local run with the scroll target lowered to 806.

Not verified: WebKit (not installed in this container), iOS and Android (native paths unchanged: the Reanimated patch and
the exit scope touch web code only; `LayoutAnimationConfig skipExiting` still does the native job).

## People search and Activity's first fling (F-266 sweep misses, owner 189; web, measured 2026-10-31)

`perf/listWork.spec.ts` (new): Chromium, 390 x 844, touch, large demo (42 friends), CPU x6, accessibility tree off. Base =
`claude/repo-status-other-chat-xmr0l3` as merged into this branch, after = this branch, both `e2e:build`, three runs each
interleaved, 1-minute load 2.3-9.9 (one base run started at 12.6 and fell to 9.9). The counts do not depend on load and
are what the spec gates; the timings are the method's medians. Run: `E2E_PORT=8933 pnpm perf listWork` (`PERF_DIST` for
another build).

| People search, "rahul sharma 120" (16 keys) | Base (3 runs) | After (3 runs) |
|---|---|---|
| React renders per key | 210.6 (every run) | 59.0 / 64.0 / 65.5 |
| Person rows re-rendered (whole search) | 83 | 2 / 4 / 4 |
| Rows cloned out by Reanimated's exit | 46 | 0 |
| Worst key-to-echo, ms (median) | 1,299 / 987 / 560 (987) | 98 / 248 / 89 (98) |
| Median key-to-echo, ms | 124 / 74 / 79 | 38 / 45 / 60 |
| Longest task, ms (median) | 630 / 536 / 513 (536) | 58 / 227 / 69 (69) |

| Activity, first fling (adds 27 rows) | Base | After |
|---|---|---|
| React renders | 3,475 | 2,475 |
| Worst frame gap, ms (median) | 763 / 773 / 884 (773) | 178 / 154 / 40 (154) |
| Longest task, ms (median) | 721 / 721 / 822 (721) | 170 / 152 / 229 (170) |

Still over budget: the Activity page's commit (27 rows in one commit, about 150-230 ms at x6). Growing a page six rows per
commit measured 53-86 ms (load 11) but slowed reading far back, so it was dropped (ARCHITECTURE 17.1, 23); cheaper rows
(about 92 renders each) are the next step. Causes and fixes in ARCHITECTURE 17.1 and 23.

Renders gate not re-recorded here (port 8191 is shared, and the gate is red on base for the 806-row scroll and the
pre-People baseline: the c-perf note above). Its scroll phase will count fewer renders (no closed menus: about 1,000
fewer mounts and the popper chain's after-mount updates per 27 rows), so the next re-record should take that.
