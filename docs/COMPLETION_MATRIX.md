# Splito completion matrix

Updated 2026-10-27. Binding rules source: `docs/ARCHITECTURE.md` § 26 "Product & UI rules (owner decisions, binding)" (decision log rows 1-63). Feature IDs, acceptance criteria and build order: `docs/BACKLOG.md` (owner requests not yet built are its Batch 4b). Other sources: Splito-Claude-Prompt.txt (original handoff), docs/superpowers/specs/2026-10-26-splito-design.md.

Status words are the same as `docs/BACKLOG.md`: **done** (built, tested and merged on m1-foundation), **in progress** (being built, or built and tested on an unmerged branch, named; work counts as in progress until it is merged into m1-foundation), **todo** (not started). "(needs backend)" marks work that waits for the sync/auth server, which is built after the UI. Unmerged UI line = branches `ui/r1-polish-2` and `ui/preview-latest`; Batch 4 streams = branches `feat/b-*`.

| Area | Feature | ID | Status |
|---|---|---|---|
| Core rules | Exact money (bigint), all split modes, rounding, multi-currency maths | F-101 | done (domain, 68 tests) |
| Core rules | Settlement planner with allowed / preferred / excluded routes | F-102 | done (domain) |
| Storage | Offline local store (SQLite / IndexedDB), history, outbox, preferences registry | F-103, F-104 | done (sync, 40 tests) |
| Storage | Local database schema v3: a store per entity type on IndexedDB and SQLite, normalised members and parties, in-transaction balance sums, monthly aggregates and search terms (Analytics and Search never load the ledger), per-row sync status, v1 and v2 migrations, cursor-paged hot reads | F-117 | done (feat/wA-35a: Home cold open 46 ms on 1.5k expenses, 46 ms on 10k; write + UI 16 ms; Analytics open 35 / 21 ms; narrow search 16-43 ms; see BACKLOG F-117) |
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
| Expenses | Smart amount input | F-310 | in progress (built and tested on feat/b-*, unmerged) |
| Expenses | Amount entry and parsing correctness (audit C1, C2, M1, M2, M3, M7, M14, m8, m9, m13) | F-111 | done (feat/4b-33c; domain/sync/client bun tests + e2e `amountLocale.spec.ts` in de-DE and en-US with BHD; web verified, native not yet run) |
| Navigation | Web navigation and sheet robustness (audit M16, m6, m12, m26, m27, m30) and one-line Activity request rows | F-116 | done (feat/wA-33h; sync `mutations.test.ts` / `preferences.test.ts`, client `goBack.test.ts` / `form.test.ts` / `draftKey.test.ts`, e2e `webNav.spec.ts` + `links.spec.ts` + `activityRequests.spec.ts`; web verified, native not yet run) |
| Settle up | Balances and settle consistency (audit M6, M10, M11, m5, m7, m10, m16) | F-113 | done (feat/4b-33d; domain `balanceAudit.test.ts`, sync `writeoffs.test.ts`, client `form.test.ts` / `sort.test.ts` / `feed.test.ts`, e2e `balances.spec.ts` + `group.spec.ts` A07 + `demo.spec.ts`; web verified, native not yet run) |
| Settings | Timezone, date and number formats everywhere (audit M9, M17, M18, m14, m23, m24, m25, m28, m29) | F-115 | done (feat/wA-33g; client `dates.test.ts` / `feed.test.ts` / `numberFormatNative.test.ts`, sync `preferences.test.ts`, e2e `dates.spec.ts`; web verified, native only checked under Bun's polyfill run, not yet on a device); Activity row-build profile, 1,000 events, `feed.bench.test.ts`, Bun on a machine at load average ~250: before 3.4-3.7 s (domain `todayIn` built an `Intl.DateTimeFormat` per call), after 3-11 ms (one cached formatter per timezone, `buildRows` memoised in `useActivityFeed`); not profiled on Hermes) |
| Expenses | Cash rounding with visible remainder | F-402 | in progress (built and tested on feat/b-*, unmerged) |
| Settle up | Plan per group, payment rules, record repayment, UPI link and "Mark as paid?" | F-1101, F-1103 | in progress (built and tested on the unmerged UI line) |
| Settle up | Call it even: forgive or write off | F-1113 | in progress (built and tested on feat/b-*, unmerged) |
| Activity | Feed, read/unread, All / From others, actor avatar, day headers, lent/borrowed rows, swipe, hide, undo | F-1201 | in progress (built and tested on the unmerged UI line) |
| Activity | Deleted items stay in their lists, struck through, forever; Restore; Hide and Show hidden (no Recently deleted bin) | F-1203 | done on feat/wB-B3x (unmerged; pnpm check green, full web e2e 241 passed, 1 skipped (UPI test, opens an external app), the "large demo under 10 s" timing test passes alone, incl. `deletedInPlace.spec.ts` (18 tests) on phone and desktop; perf on the 10,000-expense ledger: Home cold open 46 ms (5 runs 44 to 56), write + UI 16 ms, Analytics open 18 ms, search keystroke 19 to 41 ms; large demo set 1,569 expenses: cold open 48 ms, write + UI 16 ms; native long-press not yet run) |
| Analytics | Charts + table, period / currency / group filters, Export CSV in the header overflow | F-1301 | in progress (built and tested on the unmerged UI line) |
| Settings | Every preference incl. Dim / Black dark style, accent, timezone | F-1701 | in progress (built and tested on the unmerged UI line) |
| Settings | Account section: Sign in / Create account (Bluesky LoggedOut, Login, Signup copied; honest until sync; Log out ships with F-2102) | F-225 | done (feat/wA-30b; backend submit answers "arrives with sync" until F-2102) |
| Friends | Private friends ("Add anyway (only for you)") | F-601 | in progress (built on the unmerged UI line) |
| Friends | Add friend by email or mobile, Splito directory check, consent, Requests and Invites sent | F-618 | done (feat/4b-31-33; directory answers in demo only, production says "We'll check when you're online" until F-2111) |
| Friends | Invite link and QR with use / expiry limits, manage and revoke | F-619 | done (feat/4b-31-33; links fail closed outside demo until F-2105) |
| Friends | Choose from contacts | F-602 | done (feat/4b-31-33; web verified, native picker not yet run on a device) |
| Friends | Directory lookup and friend requests on the server | F-2111 | todo (needs backend) |
| Friends | Invites and invite links on the server; link a private friend to a real account | F-2105, F-2106 | todo (needs backend) |
| Support | Feedback: drawer + footer + Settings > Support, Send feedback sheet, Your feedback, saved on device + email draft | F-226 | done (feat/wA-34; integrated on integrate/wA) |
| Support | Feedback endpoint | F-2112 | todo (needs backend) |
| Support | Help, About, licences, privacy | F-215 | todo |
| Platform | PWA: production service worker, offline shell, update toast, manifest, Install app | F-1901 | done (feat/wA-38; verified in Chrome on a production build: registers, opens offline incl. deep routes, no API cached, update toast + Reload, install prompt and iPhone steps; Safari 7-day warning has no Export action until F-2001; native iOS/Android n/a) |
| Expenses+ | Comments on expenses and repayments (local + outbox) | F-1204 | todo (Batch 4b) |
| Expenses+ | Disputes, flags and hold | F-1210 | todo |
| Expenses+ | Shared comments and disputes | F-2208 | todo (needs backend) |
| Reminders | Remind via share sheet (Person, group Balances, Settle plan), logged in Activity | F-1118 | todo (Batch 4b) |
| Reminders | Remind me (local notification for yourself) | F-1119, F-1907 | todo (Batch 4b) |
| Reminders | Reminder policy, tone, language, snooze | F-1111 | todo |
| Reminders | In-app reminders (1 per person per 3 days) and opt-in automatic reminders | F-2210 | todo (needs backend) |
| Data | JSON backup export + import / restore (Settings > Data) | F-2001 | todo (Batch 4b) |
| Data | Export centre: CSV, PDF statement, filters; Group / Person / Analytics export entries | F-2007 | todo (Batch 4b) |
| Data | Power exports (YNAB, Beancount, XLSX) | F-2004 | todo |
| AI | Ask Splito: nav item, Analytics header, Search row; DM-style chat; on-device answers with rich cards | F-2301 | todo (Batch 4b) |
| AI | Free-form answers via the backend model; AI opt-in and privacy | F-2302, F-2303 | todo (needs backend) |
| Data | Free search across expenses | F-1401 | in progress (built and tested on feat/b-*, unmerged) |
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
| Languages | Bluesky AppLanguageDropdown on the web sign-in splash, sign-up and desktop right column | F-1816 | todo (Batch 4d) |
| Best of both | Bluesky and Expensify scouting additions (`docs/scouting/2026-10-27-bluesky-expensify.md`) | F-229..F-236, F-318..F-321, F-620, F-1211, F-1212, F-1412, F-1507 | todo (Batch 4d; F-1211 Batch 13, F-1412 Batch 21) |
