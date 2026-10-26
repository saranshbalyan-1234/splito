# Splito — Product & Technical Design

Date: 2026-10-26
Status: Draft for owner approval
Authoritative detail: `../../../../Splito-Claude-Prompt.txt` (the handoff spec). This document sets scope, phasing, USPs and decisions on top of it. Where this document is silent, the handoff spec's rules apply. Where they conflict, this document wins.

---

## 1. Intent

Splito is an expense tracking and splitting app for iOS, Android and web/PWA. The owner wants a complete product, not a prototype: every feature listed in the handoff spec, plus the additional features and USPs agreed in conversation on 2026-10-26.

One-line pitch: **Split expenses with anyone, even offline, with no accounts needed, and group rules for who pays whom.**

### Why people pick Splito (USPs)

1. **Works with zero signal.** Every action (add, edit, delete, settle) works offline and syncs later. Nothing is ever lost.
2. **Friends don't need the app.** Add people privately. Invite them later if they want access. Share a read-only balance link with anyone.
3. **Snap a receipt, split by item.** OCR, then tap who had what. Tax, tip and discount are spread automatically. No paywall.
4. **Group payment rules.** Per-group allowed / preferred / excluded payer→recipient routes. The settle-up plan obeys them.
5. **Ask your expenses.** AI chat answers from real records with links. It never invents numbers.
6. **Honest currencies.** Never adds unlike currencies into one total. The applied rate is frozen on each transaction.
7. **Trip kitty.** A shared cash pot that pays for things, with leftover cash split back fairly.
8. **Split by nights.** Accommodation splits by the nights each person stayed.
9. **One-tap UPI pay.** Opens the user's UPI app with the amount filled in, then asks to record the payment. Splito records payments; the UPI app moves the money.

---

## 2. Goals, non-goals, anti-goals

### Goals
- Every feature in Section 4 implemented, tested, and shown honestly in a living completion matrix.
- Offline-first: no user action blocks on the network.
- Exact money: integer minor units, deterministic rounding, conservation always holds.
- Bluesky `social-app` is the real client foundation (see Section 6), not a token inspiration.
- One codebase for iOS, Android and web/PWA.

### Non-goals (for this project)
- Splito moving money itself. Live payment-provider transfers stay sandbox-only until the owner picks a provider and countries (Section 4, v3).
- Packaged desktop binaries (Electron/Tauri). Desktop means browser/PWA.
- App Store / Play Store publication. That is a separate action that needs the owner's accounts.
- Netting debts across groups, or routing direct debts through a group, without a separately approved rule.
- Itinerary/booking features for trips.

### Anti-goals (failure even if it "works")
- Showing simulated auth, OCR, AI, sync, payments or sample numbers as real.
- Labelling a local write "Synced" before the server acknowledges it.
- Any floating-point money arithmetic, or one total that mixes currencies.
- Silently last-write-wins on money. Losing or duplicating a financial operation.
- AI writing to the ledger without explicit user review.
- Requiring a Bluesky account or any AT Protocol service.
- Shipping Bluesky logos, artwork or trademarks.

---

## 3. Constraints

- **Client:** Expo + React Native + TypeScript; React Native Web for web/PWA.
- **Server:** Fastify on Bun, TypeScript. Postgres. Private object storage (S3-compatible; MinIO locally).
- **Upstream:** `bluesky-social/social-app` pinned at `4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (2026-10-24). Root license MIT. `ASSETS.md` excludes artwork, the icon system, trademarks and `assets/images/`; `NOTICE.md` lists Material Icons (Apache-2.0), Inter (OFL), Noto (OFL) and country-flag-icons (MIT). Copied code keeps the MIT notice. Splito ships its own icons and artwork.
- **Upstream tooling stays where needed.** Bluesky uses pnpm, Metro and Lingui; keep them on the client. Bun is required for the API runtime only.
- **No existing Splito source.** Nothing to migrate. If the owner supplies an old archive later, audit it before rewriting.
- **Environment:** builds and tests run on the owner's Mac (node 26.8.1, bun 1.4.2, docker, psql available). iOS device/signing and Play signing are not available yet. Document those blockers; never claim verification.

---

## 3a. Principle: everything customizable (owner, 2026-10-26)

The owner asked for "every single thing to be customizable". Interpretation (assistant's call, owner to confirm): **every user-facing choice the app makes has a setting with a sensible default**, and every visual surface that shows a collection (cards, tabs, lists, charts) can be shown, hidden, reordered and restyled. Dialog and form internals stay fixed, because rearranging an input form breaks validation and accessibility.

- One typed **preferences registry** (key, type, default, scope `device` or `account`, group, label) drives storage, sync and an auto-generated Settings screen. Adding a setting costs one registry entry.
- Preferences persist locally and sync across devices (account scope) from v1. Every setting has "Reset to default", plus a global "Reset all".
- Customizable from v1:
  - **Appearance:** theme, accent, text size, list density
  - **Motion:** animations on/off/reduced, haptics on/off
  - **Defaults:** home tab, tab order and visibility (with recovery route), default currency, default split mode, default payer
  - **Categories:** add, rename, recolour, re-icon and reorder expense categories
  - **Regional:** week start, timezone, language, date format, number format
  - **Lists:** People sort order and Include-groups default, Activity swipe-action assignment (left/right)
  - **Notifications:** on/off per type
- Customizable from v2/v3: home cards, group overview cards and analytics cards (hide, reorder, rename, resize, tint); chart type per analytics card; saved views; background overrides; per-group defaults (currency, split mode, settle rules).

## 4. Feature scope by phase

Each phase ships a runnable app. Arithmetic, authorization, migrations and offline queue durability are never postponed to a later phase.

### v1 — Core

**App shell & navigation**
- Destinations: People (default home, no redundant title), Groups, Activity, Profile.
- Logo returns home and is inactive on home.
- Mobile: central + button. Desktop: + at the bottom of the sidebar.
- Person detail is a real page with deep link, back and browser history.
- Responsive phone/tablet/desktop layouts. Native stack transitions, safe areas, keyboard handling.

**People**
- Balances per person = direct + included group balances, separated by currency, with each group's contribution shown.
- "Include groups" toggle inside the filter UI, on by default, controls both totals and history. Filters use Apply.
- Person page: expense history and settlement history with clear sign ("owes you" / "you owe").
- Add friends privately without accounts or invites. Guest participants for one-off expenses.

**Expenses**
- Personal, direct and group expenses. Fields: title, amount, currency, date, category, payers, participants, shares, notes, location (manual), attachments (basic), audit metadata.
- Split modes: equal, exact, percentage, shares/weights, item-by-item.
- Multiple payers. Sum paid = sum owed = total, enforced exactly.
- Deterministic rounding with stable tie-break by participant ID (100 / 3 → 34, 33, 33).
- Currency minor-unit scales 0, 2 and 3 handled.
- Refunds/reversals with explicit ledger semantics.
- Edit history. Delete = synced tombstone/reversal. Undo.
- Recurring expenses (rent, subscriptions), generated on schedule, reviewable.
- Saved split templates ("Flat 40/30/30").
- Unrestricted dates. Future-dated expenses allowed and labelled "upcoming".

**Groups / trips**
- Name, type, currency, members, roles. Trip start/end dates.
- Membership changes never rewrite past splits. Former members keep correct access to past records.
- Archive groups (hidden, kept).

**Settlements**
- "Who you settle with" rules live only inside a group: per directed edge allowed / preferred / excluded. Explicit allow-list restricts edges. No rules = all member edges allowed. Excluded is never turned into a preference. Defaults are explained in UI.
- Plan solver: min-cost feasible flow on the authorized edge graph, integer capacities, per group per currency. Preferred edges get lower cost. Deterministic tie-break. No promise of fewest transfers.
- Direct-only mode in v1. Infeasible plans explain why.
- Plan preview with version/hash. Goes stale after any expense, payment, rule or membership change.
- Record repayment (partial/full): payer, payee, currency, amount, date, note, optional proof. Atomic and idempotent. A plan is never a repayment.
- UPI pay link: opens the UPI app with payee VPA and amount (`upi://pay`), then asks "Mark as paid?". Splito never claims the money moved.

**Currencies**
- Maintained ISO 4217 catalog with minor-unit scale, symbol and name. Configurable enabled set.
- Original amounts never change. Never sum unlike currencies.
- Conversion stores source, target, decimal rate, provider, timestamp and rounding policy. Stale/offline rates are labelled. Manual rate allowed and labelled. Rate frozen per transaction.
- Cross-currency settlement requires an explicit, reviewed conversion transaction.

**Activity**
- Feed of expense, membership and settlement changes. Read/unread, swipe actions, hide, undo.
- Personal feed visibility is separate from the immutable audit history.
- Touch, keyboard and visible-button alternatives for every swipe.

**Analytics (basic)**
- Spending over time (bar), by category (donut), per group, paid vs your share.
- One chart per currency, or converted with the rate labelled.
- Built on `react-native-svg` (already in the upstream tree).

**Sync & offline**
- Local durable store: SQLite on native, IndexedDB on web, behind one repository interface.
- Every mutation writes the entity/ledger change and the outbox entry in one local transaction before showing success.
- Device-generated IDs. Optimistic UI.
- `POST /v1/sync/push` (bounded batches, server idempotency per account) and `POST /v1/sync/pull` (opaque cursor, ordered changes, tombstones). Cursor-expiry snapshot rehydrate.
- Server-authoritative monotonic revisions. Stale financial edits produce a structured conflict for the user to resolve. Preference fields merge by documented rules. Tombstones beat stale edits.
- Status labels: Saved on this device / Waiting for connection / Syncing / Synced / Needs attention.
- Retry with exponential backoff and jitter. Sync runs on foreground, connectivity change and after mutations. Web tabs coordinate with a lock.
- Logout/user switch never exposes another account's local data.

**Accounts & security**
- Login: email OTP, mobile OTP, Google, Apple. Session refresh and revocation.
- Private offline use before signup. Explicit, atomic migration of local data into the account.
- Link a private person to a real account: identity confirmation, preview, no duplicates, never by display name alone.
- Invites: link and QR, with server-side accept, expiry and revoke. Email/SMS drafts.
- PIN lock, auto-lock, failed-attempt handling, native biometrics with fallback, encrypted native storage. Tokens in platform-secure storage; web uses httpOnly cookie + CSRF. Web limits documented honestly.
- Push notifications: new group expense, payment recorded, invite accepted.

**Settings & appearance**
- Themes: light and blackish dark. Accent picker with Apply.
- Language: English default, Hindi at launch (see Section 5).
- Timezone: follows device by default, can be pinned. Week start day.

**Motion & feel (owner: "smooth like Bluesky", "animations on pages like Expensify")**
- Bluesky-grade smoothness: native stack transitions, Reanimated 60/120 fps on the UI thread, interactive bottom sheets, swipe-back, gesture-driven swipe actions, keyboard-aware forms, selective haptics. Reuse upstream's Reanimated/Gesture Handler setup and animation helpers.
- Expensify-style page illustrations: each main page (People empty state, Groups, Activity, Profile/Settings sections, Analytics) has an animated Lottie header or empty-state illustration.
- List items animate in, out and on reorder (Reanimated layout animations). Balances count up/down when they change.
- Skeleton shimmer while local data loads. Success animation on expense saved and on settle-up recorded.
- Every animation has a static fallback under reduced motion. Lottie never drives core navigation.
- All Lottie files are original Splito artwork or assets with a recorded license. Expensify's and Bluesky's artwork is not copied.
- Budget: no dropped frames on a mid-range Android device during navigation and list scroll; measured and recorded.

**PWA**
- Manifest, icons, installable, offline app shell, update handling. Never cache private API responses. Request persistent storage; warn before destructive resets.

### v2 — Smart features

- **Receipt capture & OCR:** camera, photo library and file import. Crop, rotate, replace, multi-page. OCR → review merchant, date, currency, total, line items, tax, tip → assign → confirm. Never auto-posts. Duplicate-receipt warning. Multiple attachments, configurable size/type limits, progress, retry, cancel.
- **Incoming share:** native share extension (iOS) / intent (Android) using upstream `Share-with-Bluesky` and `expo-receive-android-intents` modules as the base; Web Share Target on supported PWAs; file import elsewhere. Drafts survive login and offline.
- **AI chat:** floating window on desktop (page stays usable), bottom sheet on mobile. History and drafts persist. Streaming, retry, cancel. Server-side model adapter; keys never on the client. Scoped read tools over the ledger and deterministic money functions. Answers cite records, dates and currencies. Proposed edits require review. Prompt-injection and cross-account defences. Offline: deterministic local answers, labelled honestly.
- **Quick add by text/voice:** "Dinner 1200 with Riya and Sam" → draft for review. A local parser works offline; the AI improves it online.
- **Full analytics & reports:** weekly, monthly, yearly and custom periods. Category, person, group and currency filters. Balance trend over time. Trip dashboard (spent vs budget, per person, per day, per category). Monthly insights from real data only. Tap a chart segment to see its expenses. Table view for screen readers. The same filter state drives list, totals, charts and CSV. Repayments never count as spending.
- **Exports:** formula-safe CSV, trip summary PDF.
- **Backup:** versioned JSON export and import with schema validation, migration, duplicate detection, preview, merge/replace choice and rollback. Attachments either included or referenced (documented).
- **Saved searches/views:** This month, a trip, Outstanding balances, Missing receipts, plus user-defined views.
- **Location:** permission-aware automatic location, place search, optional map.
- **Trip kitty:** a shared pot as a ledger account. Members contribute; the kitty pays expenses; leftover cash is returned pro-rata to contributions. Kitty balance is visible.
- **Split by nights:** accommodation split weighted by each member's nights, derived from per-member trip date ranges (editable).
- **Balance link:** read-only, revocable, expiring link showing one person's balance and its line items. No signup needed.
- **Reminders:** gentle nudge drafts via WhatsApp/SMS/email that include the balance link.
- **Comments & disputes:** a comment thread per expense. Flag "I wasn't there" / "wrong amount"; the creator resolves it.
- **Trip budget:** total and per-category budget, spent vs remaining.
- **Transit routing:** multi-hop settlement plans, only when transit members are allowed and have agreed. Otherwise direct-only.

### v3 — Polish & power

- **Black-and-white theme.** Advanced background overrides kept separate from the accent.
- **Custom navigation:** choose and order destinations, with a guaranteed recovery route to settings.
- **Card customization:** hide, reorder, rename, resize and tint on every card surface (People home summary cards, group overview cards, analytics cards, trip dashboard). Dialog/form internals stay fixed (see 3a).
- **Reactions** on activity items.
- **Widgets & shortcuts:** iOS/Android home-screen balance widget and quick-add shortcut. Needs a dev/release build.
- **More languages** as translations land.
- **Send money via provider:** adapter interface plus sandbox integration and tests. Labelled "sandbox" everywhere. Going live is blocked on the owner choosing a provider and countries.

Preferences (theme, nav, cards, language, timezone) persist locally and sync across devices in every phase where they exist.

---

## 4b. Additions from the competitor teardown (2026-10-26)

Source: `docs/research/2026-10-26-competitors.md`. Owner asked for the best app on features, looks and simplicity; these close gaps against Splitwise, Tricount, Settle Up, Splid, Spliit and others. Phase placement is the assistant's call.

- **v1:** free search (Splitwise paywalls it); "equal with adjustments" split, inline calculator in the amount field, live "remaining" readout, drafts that survive close; offline category auto-suggest from the title; "fewest payments" toggle for groups without rules, showing the payment count (separate exact solver; min-cost flow stays for constrained groups); trip summary shared over WhatsApp.
- **v2:** editable guest links (friends add expenses from a link without an account, picking "who are you"); guests claim their own receipt items from a shared link; payment handles beyond UPI (PayPal.me, Venmo, Revolut, Monzo, Wise, Cash App) as links that open the provider, recorded by the user afterwards; opt-in automatic reminders; split from a payment screenshot (UPI/bank) shared into the app; Splitwise importer.
- **Free forever:** everything Splitwise paywalls (unlimited expenses, receipt scanning, itemization, currency conversion, search, charts, export, no ads). Monetization, if ever, is the owner's call ("one person pays for the whole group" draws the fewest complaints).

## 4c. Architecture rules adopted from GameRun (2026-10-26)

Source: `docs/research/2026-10-26-gamerun-architecture-takeaways.md`. Adopted: keep `docs/ARCHITECTURE.md` current in the same change; enforce checkable rules with an architecture test whose per-file baseline only goes down (raw hex colours outside `alf/`, direct RN `Modal`, direct `expo-haptics`, new files under `src/view/`, token access outside the credential store); platform differences only behind `.web`/`.native` pairs; one credential-store module (secure store, serialized operations, a 401 never deletes unsynced outbox rows); one never-throwing telemetry module with outcome + duration metrics and an opaque account id (no email/name, replay masked); OTA checks on launch and background-to-active only; one link resolver with unknown paths opening home and `goBack(fallback)` everywhere. Rejected: GameRun's "You're offline" banner (Splito uses sync status labels), `localStorage` web tokens (Splito uses httpOnly cookie + CSRF), `createStyles` and its own dialog/copy systems (ALF, Bluesky Dialog and Lingui win).

## 5. Decisions made in conversation

| Decision | Source |
|---|---|
| Keep every feature from the handoff spec, including ones the assistant initially proposed cutting | Owner |
| Add the USP and everyday features in Sections 1 and 4 | Owner (asked the assistant to propose more; accepted) |
| Analytics with graphs is required | Owner |
| Multi-language support is required | Owner |
| User-settable timezone is required | Owner |
| English is the default language | Owner |
| Smooth like Bluesky; page animations like Expensify (Lottie moved from v3 to v1) | Owner |
| Owner said "start the implementation" — design treated as approved | Owner |
| Everything customizable; preferences registry from v1 (scope interpretation in 3a is the assistant's call) | Owner |
| Copy Bluesky AND Expensify code, structure, standards and speed practices (both MIT) | Owner |
| UI is Bluesky's design copied pixel for pixel; only required replacements (routes, data, logo, licensed icon glyphs, copy, social-only code) | Owner |
| Bluesky blue palette is the default theme; Splito emerald becomes an optional accent | Owner ("same Bluesky design") |
| Splito logo is an original split-butterfly, visibly different from Bluesky's mark | Owner asked for a butterfly; the split design is the assistant's call |
| Phones keep the spec's central + inside Bluesky's bottom bar | Assistant's call (spec vs pixel-copy conflict) |
| Bluesky's licensed Central icon glyphs replaced by Lucide; buying a Central licence would make icons pixel-exact | Assistant's call (licence) |
| Hindi is the second launch language | Assistant's call |
| Phase placement (v1/v2/v3) of each feature | Assistant's call; owner did not object |
| Indian number grouping (₹1,00,000) under Hindi and en-IN locales | Assistant's call |

### Localization & time detail
- Lingui (reused from upstream) for strings. Splito strings are new, so translations are new; upstream translations are not reused.
- `Intl` for numbers, currency and dates by locale. RTL layout supported (Arabic/Urdu ready, not launched).
- Missing translations fall back to English.
- Each expense stores its local date and IANA timezone. Trips may set their own timezone. Reports cut periods in the viewer's chosen timezone; an expense's local date never shifts.

---

## 6. Architecture (assistant's calls unless noted)

### Repository layout
```
splito/
  apps/client          Expo app (fork-adaptation of Bluesky social-app shell)
  apps/api             Fastify on Bun
  packages/domain      Pure money, split, ledger, settlement, FX rules (no UI, no network)
  packages/contracts   Versioned request/response schemas (zod/TypeBox), error codes
  packages/sync        Outbox, cursor, conflict handling shared by client and API
  packages/test-fixtures  Demo/test data, never loaded in live mode
  docs/                REUSE_MAP.md, COMPLETION_MATRIX.md, ADRs, specs
```
- pnpm workspace (matching upstream). The API runs and is tested with Bun.

### Bluesky reuse strategy
- **Fork-adaptation, not wholesale fork.** Bluesky's `src/` is deeply tied to AT Protocol (agent, session, feeds, moderation, lexicons). Keeping it would obstruct Splito. Extract the cohesive cross-platform infrastructure into `apps/client`: navigation setup, `alf` design-system tokens/themes, `components/` primitives (dialogs, menus, buttons, text fields, toggles), bottom-sheet module, gesture/keyboard handling, platform adapters (`*.web.tsx` / `*.native.tsx` pattern), error boundaries, Lingui i18n setup, Expo config/plugins, Metro/Babel config, and the share-intent modules for v2.
- Remove: AT Protocol, feeds, posts, moderation, chat-DM, Bluesky identity, assets and trademarks.
- `docs/REUSE_MAP.md` records every upstream path, the pinned SHA, destination path, modifications, license obligations and validation. Upstream dependency versions are checked at the pinned revision, not assumed.

### Data
- Money: integer minor units (`bigint` in Postgres; string over JSON when above 2^53 − 1; bounded in validation). Every financial record stores its currency.
- FX rates: decimal strings, stored separately from money.
- Ledger: double-entry style entries per expense/repayment/conversion/kitty movement, so balances are always derived, never stored as editable totals.
- Minimum entities: as listed in handoff spec Section 9, plus recurring rule, split template, kitty, comment/dispute, balance link, reminder, push token, budget, saved view.

### Settlement solver
- Per group per currency. Min-cost flow with integer capacities, preferred edges cheaper, deterministic ordering by member ID. Direct-only mode restricts to debtor→creditor edges. Transit mode (v2) allows multi-hop edges only through consenting members. Reports infeasibility with the blocking constraints.

---

## 7. Testing & evidence

- Handoff spec acceptance groups A01–A17 are the bar. Each run records the command, platform and result.
- Property tests for split conservation and permutation invariance (fast-check).
- API integration tests against real Postgres under Bun.
- Sync fault injection: crash after server commit before acknowledgement, and before the local cursor commit.
- End-to-end: web via Playwright; native via Maestro where a simulator/emulator is available.
- New features add tests: kitty conservation, nights-weighted split, recurring generation across DST/month ends, balance-link revocation and tenant isolation, UPI link format, timezone period boundaries, locale formatting (en, hi).
- `docs/COMPLETION_MATRIX.md`: every feature is marked implemented / tested / partial / blocked / not started, with evidence links. Untested ≠ done.

---

## 8. Left to the builder

- Exact Fastify plugins, Postgres driver and schema-validation library, provided they run under the pinned Bun.
- OCR engine (on-device ML Kit/Vision vs server-side) and AI model provider, behind adapters with honest disabled states when credentials are missing.
- FX rate provider.
- Push provider (Expo Notifications is the default).
- Chart composition on top of `react-native-svg`.
- Visual identity details (logo, palette, illustration style), original to Splito.

## 9. Needs the owner later (not blocking v1)

- Credentials: Google/Apple sign-in, OTP SMS/email provider, AI model key, OCR (if server-side), FX provider, push, object storage.
- Apple developer account and device for iOS builds; Play signing.
- Live payment provider and countries (v3).
