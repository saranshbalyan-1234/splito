# Splito completion matrix

Updated 2026-10-26 (evening). Sources: Splito-Claude-Prompt.txt (original handoff), docs/superpowers/specs/2026-10-26-splito-design.md, AGENTS.md "Latest owner UI decisions" 1-9. Status words: **done** (built and tested, merged on m1-foundation), **built** (built and tested on an unmerged branch), **in progress** (being built now), **wave 2** (front-end work, next run), **needs backend** (blocked on sync/auth server, built after the UI), **not started**.

| Area | Feature | Status |
|---|---|---|
| Core rules | Exact money (bigint), all split modes, rounding, multi-currency maths | done (domain, 68 tests) |
| Core rules | Settlement planner with allowed / preferred / excluded routes | done (domain) |
| Storage | Offline local store (SQLite / IndexedDB), history, outbox, preferences registry | done (sync, 40 tests) |
| Shell | Bluesky sidebar / bottom bar / FAB / drawer / header rules / cat logo / brand kit | built (preview branch, iOS + web verified) |
| Shell | Activity in bottom bar + sidebar + drawer (pulse icon, unread badge), no header bell | built (preview, web + iOS verified) |
| Shell | Avatar top-left opens Bluesky drawer (profile header, all menu items, dark theme, help/about) | built (preview, web + iOS verified) |
| Shell | Header rules: left avatar/back, centred title, one action on the right | built (preview) |
| Shell | Add expense: Bluesky "New Post" pill on desktop, floating + on phones | built (preview) |
| Lists | Overview section on Friends and Groups (per-currency owed/owe cards, counts) | next merge (rule 9) |
| Lists | Search icon that expands into a search field, on Friends and Groups | next merge (rule 9) |
| Lists | Filters on Friends (include groups, currency, owed/owe/settled, sort) and Groups (type, active/archived, currency, owed/owe/settled, sort) | next merge (rules 8-9) |
| Expenses | Add / edit / delete / undo, equal / exact / percent / shares / adjust / itemize, multiple payers, calculator, currencies, any date, categories | in progress (feature branch) |
| Expenses | Item portions (2 of 3 beers), Everyone shortcut, items on detail page | next merge (rule 5) |
| Sheets | Every sheet: X top-right, Cancel + Save at the bottom; web = centred popup with X top-right, Cancel + Save bottom-right; pickers X only; discard prompt | next merge (rule 7) |
| People | Balances per currency, group breakdown, person page, Include groups filter | in progress |
| People | Filters sheet (include groups, currency, owes/owed/settled, sort) | in progress (rule 8) |
| Groups | Group page with Expenses / Balances / Members / Rules tabs | built (main build) |
| Settle up | Plan per group (direct / via others), who-pays-whom rules, record payment, UPI link | in progress |
| Activity | Feed, read/unread, all / from others, row menu, swipe, hide, undo | built (feature branch); actor avatar + day headers + lent/borrowed rows next merge (rule 6) |
| Analytics | Charts by time / category / person / group, paid vs share, filters, CSV export | in progress |
| Settings | Every preference: theme, accent, text size, density, motion, haptics, tabs, defaults, categories, language (en / hi), timezone, formats, lists, notifications | in progress |
| Expenses+ | Recurring expenses (rent, subscriptions) | wave 2 |
| Expenses+ | Saved split templates | wave 2 |
| Expenses+ | Guest participants (one-off people) | wave 2 |
| Expenses+ | Quick add by typing ("Dinner 1200 with Riya and Sam") | wave 2 |
| Expenses+ | Comments and disputes on an expense | wave 2 (local; shared once backend exists) |
| Expenses+ | Receipt capture: camera / photo / file, on-device OCR, review before saving | wave 2 |
| Expenses+ | Attachments (photos, PDFs) | wave 2 |
| Expenses+ | Location: manual place, optional automatic | wave 2 |
| Groups+ | Archive groups | wave 2 |
| Groups+ | Trip kitty (shared cash pot) | wave 2 |
| Groups+ | Split accommodation by nights stayed | wave 2 |
| Groups+ | Trip budget (total + per category) | wave 2 |
| Groups+ | "Fewest payments" toggle for groups without rules | wave 2 |
| Data | Free search across expenses | wave 2 |
| Data | Saved views (This month, a trip, Outstanding, Missing receipts) | wave 2 |
| Data | JSON backup export + import / restore | wave 2 |
| Data | Trip summary PDF, share summary via WhatsApp | wave 2 |
| Data | Splitwise importer | wave 2 |
| Payments | Payment links beyond UPI (PayPal.me, Venmo, Revolut, Wise, ...) | wave 2 |
| Payments | Send money through a payment provider | needs backend + provider choice |
| Motion | Lottie illustrations, animated balances, success check, list animations | built (brand branch), wiring in progress |
| Customization | Card hide / reorder / rename / resize / tint on home, group and analytics cards; black-and-white theme | wave 2 |
| Platform | Home-screen widgets and quick-add shortcut | wave 2 (native build) |
| Platform | Share a receipt into Splito from other apps | wave 2 (native build) |
| Platform | PWA install, offline shell, update handling | wave 2 |
| Platform | iOS simulator dev build (iPhone 18 Pro) | done (runs; Bluesky build settings + Intl polyfills) |
| Platform | Android emulator run | not started (needs Java on PATH) |
| Account | Sign-in (email / mobile OTP, Google, Apple), sessions | needs backend |
| Account | Sync across devices, conflicts | needs backend (server started on fan2/api, paused) |
| Account | Invites by link / QR, link private friend to real account | needs backend |
| Account | Read-only balance link for friends without the app, editable guest links | needs backend |
| Account | Reminders (manual drafts in wave 2; automatic ones need backend) | wave 2 / needs backend |
| Account | Push notifications | needs backend |
| AI | AI chat answering from your records | needs backend (server-side model) |
| Security | PIN lock, biometrics, encrypted storage | wave 2 |
| Languages | Hindi complete; more languages | done for en/hi; more = wave 2 |
