# Splito architecture

How Splito is built, and the rules every change follows. This is the app's memory: when you are about to
change something, read the section first, and update it in the same change.

- Binding order when rules disagree: owner decisions in `AGENTS.md` > design spec
  (`docs/superpowers/specs/2026-10-26-splito-design.md`) > Bluesky's code and conventions > this document's
  rules taken from GameRun.
- Most rules here come from GameRun's `gamerun-expo/expo-app/ARCHITECTURE.md` (all 2,041 lines read on
  2026-10-26: 407 patterns, 277 adopted, 104 adapted, 12 in conflict, 14 skipped; see § 21 and § 22). The
  first cut is `docs/research/2026-10-26-gamerun-architecture-takeaways.md`, and spec § 4c is the summary.
- The work list that brings the code in line with this document is `docs/ARCHITECTURE-BACKLOG.md` (ids `A-0xx`).

**Status tags** were checked against branch `ui/polish-2` at `f510c2d` (the newest client code; the main
checkout's `m1-foundation` holds the M1 packages and docs only):

| Tag | Meaning |
|---|---|
| **[Built]** | The code does this today on `ui/polish-2`. |
| **[Partial]** | Some of it exists; the gap is named. |
| **[Planned]** | Not built. The milestone (M1 local-only, M2 server, v2/v3 features) and backlog id follow. |

Nothing in this document claims a server, telemetry vendor, OTA channel or credential store exists: none of
them do yet.

---

## 0. Keeping this document current

1. **A change updates this document in the same PR** when it: changes the architecture or a boundary; adds
   a store read, mutation, outbox op type or (M2) server route; adds or changes a rule; adds a shared
   component, a platform twin or a dependency; changes telemetry; or teaches a lesson the next change needs
   (a root cause, a library quirk, an approach that failed). A PR that leaves this document out of date is
   incomplete. Reason: GameRun's doc stayed useful only because the PR that changed the code changed the doc.
2. **Format: rule first, then the reason, then where it lives.** One rule lives in one place; other places
   link to it. A rule every change must follow also gets a one-line summary in `AGENTS.md`.
3. **Every feature entry ends with four lines** (write "None" when there is nothing; never leave one out):
   - *Reads/writes*: store queries, mutations, outbox op types, (M2) routes.
   - *Cost*: store reads per screen, writes and outbox rows per mutation, server requests, new subscriptions
     or re-renders, timers, dependencies, bundle size, new telemetry.
   - *Telemetry*: metrics and issues added (and a row in § 16's tables).
   - *Checks*: bun test and Playwright spec names, and how iOS, Android and web were each checked, with
     "not yet" where that is true.
   Add *Known limits* and *Not built (why)* lines where they apply. The cost line is what makes the 100 ms
   save budget reviewable.
4. **The same Cost and "Not verified" lines go in every PR description and report.**
5. **Lessons are dated** (`2026-10-26, PR #n: ...`) and go in § 23. A workaround for a library bug names the
   upstream issue and affected versions, and has a test that fails when the workaround stops applying.
6. **Copy never claims what is not built** (no "synced across devices", reminders or push before they
   ship). When copy and code disagree, a warning line here blocks the release.
7. **Telemetry names are a contract**: a metric name or attribute value set changes only with a dated note in
   § 16.
8. **Status tags stay true.** Mark a rule [Built] only after checking the code.

---

## 1. Modules and boundaries

| Module | Holds | Status |
|---|---|---|
| `packages/domain` | Money (`bigint` minor units), currencies, `parseAmount`/`formatAmount`, `allocate`, `computeShares`, `validateExpense`, ledger, settlement solver, reports/CSV, dates. Pure TS: no UI, no IO. | [Built] |
| `packages/sync` | `Store` contract with SQLite (`sqlStore`) and IndexedDB (`idbStore`) engines, mutations (entity + history + outbox in one transaction), preferences registry, selectors, activity feed, codec. | [Built] (no network) |
| `apps/client` | Expo app adapted from Bluesky `social-app@4e4ad9c`: ALF, components, shell, screens, `data/` wiring. | [Built] |
| `apps/api` | Fastify on Bun + Postgres: auth, sync push/pull, invites, links. | [Planned M2] |
| `packages/contracts` | Versioned request/response schemas and error codes shared by client and API. | [Planned M2] |

Rules:

- **Dependency direction:** `screens/`, `features/` -> `data/` -> `@splito/sync` -> `@splito/domain`.
  `alf/`, `components/` and `lib/` never import `screens/`, `features/` or `data/`. Sibling `features/*`
  never import each other: a cross-feature hop is a route plus params, or shared `data/`. Enforced by
  A-002. [Planned]
- **Money rules live only in `packages/domain`.** Screens and components never add, subtract, compare-to-sum
  or allocate money, and never sum unlike currencies. Reason: one place to test exactness. [Partial] Today
  money arithmetic also lives in `components/split/form.ts`, `components/people/ledger.ts`,
  `components/groups/net.ts` and `screens/People/sort.ts`; A-001 freezes it and A-004 moves it.
- **`packages/domain` is imported, never ported**, by the client and (M2) the API. If a rule must exist twice
  (say a SQL aggregate of balances on the server), a parity test runs both on the same fixtures and the
  constants live in one module.
- **One predicate per business rule** (`isSettled`, `isParticipant`, `owesYou`, `countsTowardBalance`,
  `canEditExpense`, M2 `canEditGroup`) exported from domain and used by rows, filters, totals, badges,
  notifications, payloads and the server. No screen re-derives one. Roles and permissions live in
  `domain/permissions.ts`; the server re-checks every op. [Planned] (A-030)
- **Validators live once in domain and return codes, not strings** (amount, currency, date, name, invite
  email/phone, limits such as max amount, name/note length, participants). Every form and the API use them;
  the client maps codes to Lingui (§ 7). [Partial] `validateExpense` and its codes exist; the rest is A-029.
- **Every write is a `packages/sync` mutation** (one transaction: entity + history + outbox). [Built]
- **All persistence goes through `@splito/sync`.** No `expo-sqlite`, `indexedDB` or module-level cache of
  synced data elsewhere (enforced by A-002). [Built] for the ledger (`data/store.ts`, `store.web.ts` only
  open engines).
- **Components only render.** Data and derived figures come from `data/` hooks or a co-located `useX.ts`;
  helpers live in `lib/` or domain. Shared display components (`ExpenseRow`, `BalanceCard`, avatars) take
  plain data props; only screens and `data/` hooks read the store, and a component that must read for
  itself skips that read when a value is injected.
- **A screen's derived view is a pure model** (`screens/X/model.ts`: sections shown, labels,
  loading/empty/error decision, row view-models) with a bun `model.test.ts`. [Partial] `screens/People/sort.ts`
  and `components/activity/feed.ts` follow this.
- **The screen decides its sections; sections read their own data.** People and Groups choose among
  Overview, List and Empty; Overview, list and filters each subscribe to their own query, so a balance
  change re-renders only what it affects.
- **One component per pattern.** A duplicate is a bug: extend the canonical one, migrate callers, delete the
  copy. Canonical table:

  | Need | Component |
  |---|---|
  | Button, icon button | `#/components/Button` (never restyle its height, radius or direction; use size/variant/color/shape) |
  | Dialog, sheet, form sheet | `#/components/Dialog` + `#/components/FormSheet` |
  | Confirm / discard | `#/components/Prompt` |
  | Menu, overflow | `#/components/Menu` |
  | Toast, undo | `#/components/Toast` |
  | Long list | `#/view/com/util/List` |
  | In-page tabs | Bluesky Pager + `TabBar` (owner rule 12) [Partial: `components/TabBar.tsx`, no Pager yet] |
  | Search input | `#/components/forms/SearchInput` |
  | Text field | `#/components/forms/TextField` (no raw `TextInput`, A-002) |
  | Empty state | `#/view/com/util/EmptyState` |
  | People chooser | one component, item shape and labels injected, for participants, itemize chips, Create group and Members [Planned] |

- **Extending a shared or Bluesky component is an optional prop whose absence keeps upstream behaviour**,
  noted in the file header and the reuse row. Never fork a component for one caller. A design preview is
  labelled as a preview in the PR, never as approval.
- **No barrel files** for components; import from the file.
- **Kinds are typed maps.** Split modes, currencies, locales, activity kinds and preferences are
  `Record<Kind, ...>` with `satisfies`; switches end in `assertNever`, never `default:`. Checklists for
  "Adding a split mode" and "Adding a locale" live in § 24.
- **Dead paths are deleted with their props, tests and copy** in the same change (`lingui extract --clean`).
- **No new files under `src/view/`.** It holds only the Bluesky utilities already there (23 files today;
  A-001 freezes the list).

---

## 2. Platform adapters (one codebase)

- **A platform difference lives behind a `.web` / `.native` (or `.ios` / `.android`) pair in shared code,
  never inline.** Feature code may branch on a *capability* (share sheet, haptics, camera, OTA), never on a
  *style*. A split file comes as a full set, so no platform resolves to nothing (platformGap counter,
  A-002). [Built] pattern in use (`data/store(.web)`, `exportCsv(.web)`, `env/index(.web)`).
- **Every PR says how iOS, Android and web were each checked.**
- **A capability the platform lacks is a planned fallback, never a failure**: no Web Share API -> copy the
  link and toast; no camera -> file picker; no haptics -> silent. Each leaves a breadcrumb, never an issue.
  Share buttons call `hasShareSheet()` in `lib/`. [Partial] Analytics export uses `Share` natively and a
  download on web; the shared helper is A-032.
- **Hermes is not a browser.** A dependency that builds `TextDecoder`, `Intl.*`, `BigInt` or `crypto`
  objects at module scope is checked in a Hermes release build before merging. `formatAmount` currency styles
  and Lingui plurals (Hindi included) are tested without polyfills (A-036). Timestamps are parsed only
  through domain `parseInstant()` / `parseServerStamp()`; never `new Date(string)` on non-ISO input.
  Financial dates stay `YYYY-MM-DD` + IANA tz and are never parsed as `Date`.
- **Native modules:** a new native module (camera, ML Kit OCR, share extension, secure store, background
  task) merges only after iOS and Android Release builds, and the PR notes that the fingerprint moved (store
  build, not OTA). Once OTA is live, JS that calls a native module or a newer method checks it exists
  (`requireOptionalNativeModule` + dynamic import + JS fallback), so an update on an older binary degrades
  silently; "device can't" is a breadcrumb, "it broke" is one issue per launch. Before excluding a package
  from autolinking, check what depends on it.
- **Native-heavy features never load at launch.** Camera and OCR live behind a lazy boundary with a
  capability check; one file imports the camera library; no permission is asked at launch. A heavy SDK
  provider mounts in the route that needs it, never in `App.tsx`.
- **Web-twin tests:** client unit tests of `.web` modules are named `*.web.test.ts(x)` and resolve `.web`
  first, as Metro does. All other tests resolve as native.
- **Yoga and react-native-web quirks:** in rows sized by their children (chips, dropdown triggers, the
  currency pill) use `a.flex_grow` + `a.flex_shrink` + `{minWidth: 0}`, not `a.flex_1`, and push trailing
  icons with `marginLeft: 'auto'` (flex:1 is a 0 basis on iOS/Android while web looks fine). No percentage
  heights inside wrapping or scrolling containers. A flexed text cell on web needs `minWidth: 0` to
  ellipsize. On web, grow targets with padding, not `hitSlop`. Row menus and swipe actions are siblings of
  the row's Pressable, never nested inside it. Adjustable controls (portion stepper, sliders) use `aria-*`.

---

## 3. Responsive shell and navigation (Bluesky)

The shell is Bluesky's, per owner rules 1-4, 12 and 13 in `AGENTS.md` (drawer from the top-left avatar,
header slots, Activity as a destination, LeftNav, FAB, animated tab switches). [Built] in `view/shell/`,
`components/Layout/`, `navigation/Navigation.tsx`.

- **One `navigationItems` array feeds the bottom bar, the web sidebar and the drawer**, and a test pins owner
  rule 3's order. Nav items never hide or reorder while data loads; only badges (Activity unread) appear
  once data is there. [Planned] (A-027)
- **Every Back control calls `goBack(navigation, fallbackRoute)`**, so a page opened from a deep link or a
  refresh still has somewhere to go. [Partial] `Layout.Header.BackButton` falls back to People; screens call
  `navigation.goBack()` behind `canGoBack()` with no fallback. One helper with per-route fallbacks is A-014.
- **The header renders at once; the body after the transition.** One `lib` helper wraps React Navigation's
  `transitionEnd`; features never add timers or `InteractionManager` for this. Decorative motion (list
  enter, chart draw, skeleton shimmer) starts only after the transition and only while visible.
- **Band checks use Bluesky's `useBreakpoints()`.** `useWindowDimensions` is only for measured layout
  (`screens/People/index.tsx` uses it today; review in A-028). No second phone/desktop rule.
- **Animated bottom tabs must land at rest:** after a switch the focused tab's style is the identity. An e2e
  test taps four tabs within 300 ms and asserts the last is visible (A-027).
- **The FAB has one suppression rule list**: hidden on Settings and its sections, Profile, onboarding, any
  screen with a pinned footer, and while the keyboard shows; decided by the focused screen, not by mount.
  Tab lists pad their bottom by the FAB clearance.
- **No navigation writes on mount.** Defaults (Analytics period/currency, list filters, Group tab) are read
  when the param is absent; params are written only on a tap or Apply (A-002 counter: `setParams` in
  `useEffect`). Focus is an event (`useFocusEffect`), not state, in new hooks.
- **Root contexts stay still.** `StoreProvider` exposes only stable `{store, ctx}` [Built]. Sync status,
  drawer state and unread count are separate contexts or selectors. State resets happen inside the
  provider, never by changing a `key` that remounts the tree.
- **Never put a virtualised list inside the page scroll.** Group and Person put the overview, header and tab
  bar in the List's `ListHeaderComponent`.
- **The data-screen "ready" marker** fires once, after the transition, only while the screen is focused.

---

## 4. Dialogs and FormSheet

Every form sheet uses owner rule 7's layout through `components/FormSheet.tsx` (title left, round X top
right, Cancel + primary pinned at the bottom on phones; centred modal with footer bottom right on web).
[Built] header and footer.

- **Never render React Native `Modal` directly** (a transparent Modal still swallows taps on iOS). [Built]:
  zero uses; A-001 keeps it that way.
- **A closed dialog renders and reads nothing.** Store subscriptions for a sheet live in an inner body
  component that mounts only while open (or closing); things that must outlive the close (save in flight,
  undo toast, telemetry) live in the caller's hook. Content stays frozen through the exit animation. Row
  menus and overflow menus mount their dialog body only while open. [Partial] Bluesky's Dialog unmounts
  content; the body/shell split is A-022.
- **Run post-close work inside `control.close(() => ...)`** (Bluesky footgun). [Built] in `AGENTS.md`.
- **One native modal at a time.** A FormSheet that opens a picker (currency, date, category, people) never
  presents a second native modal over the sheet on iOS: either push the picker inside the sheet, or hand
  over (`control.close(() => picker.open())`, keep form state, restore scroll). Check each on the iOS
  simulator (A-023).
- **Never reset a dialog by changing its key** (iOS can drop the re-present). Multi-step sheets (Add expense
  to Itemize, Settle steps) reset through state and scroll.
- **A full-screen flow is a route, not a dialog.** A FormSheet closes when navigation leaves its screen; the
  draft is kept (§ 5).
- **Keyboard:** sheet bodies set `keyboardDismissMode="on-drag"`; decimal-pad amount fields get a Done
  toolbar (`react-native-keyboard-controller` `KeyboardToolbar`); nested lists set `nestedScrollEnabled` on
  Android; narrow mobile web opts into a `useKeyboardViewport.web` (visualViewport) so the footer sits above
  the on-screen keyboard. [Planned] (A-023)
- **Focus on web:** focus returns to the opener with `focus({preventScroll: true})` (verify Bluesky's Radix
  FocusScope does; patch if not). Tab/Shift+Tab stay inside, Escape closes (A-035 checks this).
- **Footer geometry:** bottom padding `max(safe-area bottom, a.pb_lg)`; controls side by side share one
  height; footer buttons share the row and ellipsize, never wrap (checked at 320 px in the longest locale).
- **Save is disabled until valid (owner rule 7), and the reason is always visible** just above the footer
  ("Pick who paid", "EUR 3 left to assign"). Field errors appear after the first blur or a save attempt.
- **The primary button never swaps under the finger:** success sheets and toasts show their call-to-action
  only once its target is known.
- **Editors don't write.** A FormSheet editor (category, payment rule, member) takes value + `onDone`; the
  caller runs the mutation, so one editor serves create and edit.
- **Long pickers are virtualised**: currency (~160), timezone (~400) and category use
  `Dialog.InnerFlatList` as the only scroller, fixed row height, `getItemLayout`, `numberOfLines={1}`; never
  `.map()` inside `Dialog.ScrollableInner`. (A-026)
- **Selection in sheets resets when its subject changes** (group or person). Expanding an item row never
  selects it. Participant and member pickers offer a tri-state "Select all" over the filtered list plus
  Clear; changing payer or split mode keeps picks unless the new mode makes them invalid.
- **Root overlays have one order** in one `layers` constant in `alf/` (sync chip, toasts on top, FAB,
  drawer scrim). On Android an overlay sets both `zIndex` (touch) and `elevation` (drawing) from it; a test
  keeps toasts on top. [Planned] (A-028)

---

## 5. Forms, input and drafts

- **A field never rewrites what was typed** to fit a limit. It filters only characters the field can never
  hold and otherwise says what is wrong.
- **Error timing:** only an over-limit error (too many decimals, above max) shows while typing; the rest
  show on blur or Save. A paste or autofill is judged at once. The amount field never shows an error
  mid-entry (`12.`). An error under a field is not repeated in the form message. Untouched forms show no
  required markers.
- **Edit forms keep Save off until a value differs** from the stored entity (an edit taken back is no
  change).
- **Placeholders are never values.** The amount field shows the currency code or "Amount", never `0.00`;
  a test bans digits in placeholders (A-013).
- **`parseAmount` accepts plain decimals only** (`,` or `.` as the decimal separator, no hex, exponent,
  Infinity), and the field keeps the typed string. Amount inputs use `decimal-pad` (or
  numbers-and-punctuation on iOS where a refund may be negative) and commit on blur or unmount. [Built]
  `parseAmount` reads decimal commas; strictness test is A-024.
- **Dependent inputs drop when their parent changes** and are re-checked at submit: changing the group drops
  participants not in it and resets the split; changing currency clears FX; split-mode values and item
  portions drop when the mode changes. Person and Group screens key their local state on the entity id.
- **Updates come from current state**: composer and itemize state use a reducer or functional `setState`.
  A mutation reads the entity's current row inside its transaction, never the props the screen rendered.
- **Defaults come from one pure resolver** in domain (currency: group, then last used, then preference,
  then locale; payer; split mode), applied at read (`withGroupDefaults(draft, group)`); only fields the
  person touched are stored. A remembered default only prefills; Save's enabled state and the mutation both
  call `validateExpense`.
- **Drafts survive close.** [Built] `components/split/drafts.ts` keeps one Add expense draft per place
  (MMKV natively, localStorage on web), cleared on Save or Discard. Rules to finish (A-025): restore only
  into untouched fields after storage is ready; write 500 ms after typing settles and at once on AppState
  background / `pagehide`; never restore an invalid partial amount; a committed mutation is never debounced.
  Wizard steps (onboarding, Create group) keep their draft per step so Back loses nothing.
- **Drafts never count.** OCR, quick-add and shared-in drafts stay out of balances, lists, analytics, CSV
  and search until confirmed: one `isDraft` filter in `packages/sync` selectors, with a test over every
  balance/list selector. [Planned v2]
- **Late reads never overwrite the person's edits.** An open edit sheet follows live updates until the first
  keystroke, then holds its draft; on Save, a changed base version shows "Changed on another device" with
  keep mine / take theirs.
- **Updates send only changed fields** plus the base version; omitted means unchanged, explicit `null` means
  clear; unknown optional values are omitted, never sent as `0` or `''`. Create is the only full write.
- **Server field errors map back to the field** (M2): one `refusalMessage()` maps Fastify/Ajv
  `instancePath` to the field's Lingui label; sync rows show "Not synced: <field>".
- **User-written text is shown as written** (titles, notes, names from other members): rendered raw, never
  through Lingui `t`, trimmed, and searchable.
- **The date picker** clamps the day on a month change (31 Jan -> 28/29 Feb), stays open while navigating,
  and judges "future" by the expense's local day in its tz. Today comes from `useToday(tz)` (§ 10).

---

## 6. Theming (ALF)

ALF from Bluesky, Bluesky blue default, accent preference. [Built] `alf/`, `swatches.test.ts`.

- **Components use semantic roles only** (`t.atoms.*`, `t.palette.*`), never hex/rgba literals or a static
  colour export. A missing colour becomes a new token in every theme (light, dim/dark, later
  black-and-white). [Partial] 12 files outside `alf/` hold raw colours today (avatars, brand mark, icons,
  draggable list); A-001 freezes them, A-028 removes them.
- **Pure colour builders (charts, SVG) take the theme colours as a parameter.**
- **The accent builds the ALF theme memoised on the accent string and scheme**, never on an object from a
  store read. The accent picker refuses colours under 3:1 against their surface and says so; text on an
  accent fill is chosen by contrast with the fill.
- **Selection is never shown by colour alone**: a check glyph plus `accessibilityState.selected`.
- **Amounts in lists and tables use `fontVariant: ['tabular-nums']`** and right alignment.
- **Suppress a web focus ring only on controls that draw their own focus**, using the full reset.
- **Preferences that change paint (theme, accent, text size, locale) are read synchronously before first
  paint**, so there is no theme or language flash. [Partial] device-scope copies live in MMKV
  (`state/preferences/mirror.tsx`); account-scope ones load with the store (A-020).

---

## 7. Copy (Lingui)

All user-facing strings go through Lingui; English default, Hindi second, English fallback. [Built]
`locale/locales/{en,hi}`.

- **Every blocked, empty or rejected state maps a code to a Lingui message**: one map per area
  (`locale/domainReasons.ts`, M2 `locale/serverReasons.ts`) from `@splito/domain` codes (`INVALID_AMOUNT`,
  `PAYERS_MISMATCH`, `UNASSIGNED_ITEM`, `UNKNOWN_CURRENCY`, ...) with a generic fallback. Raw server or
  validation text is never shown. A PR that adds a code adds its copy; a test fails on a code without a
  message. An unknown code shows the generic line, logs the code, and keeps the form filled. [Partial]
  (A-012)
- **Honesty:** "Synced" appears only in the sync-status component's messages. FX-, OCR- and AI-derived
  values carry "Estimated rate" / "From receipt" until confirmed; converted totals carry "≈" and "rate from
  DATE"; a receipt field that was not read stays empty. A bun test scans the source catalog (A-013).
- **No "coming soon"** and no placeholder UI. A section with no data returns `null`; list screens use
  Bluesky's empty state. Empty states always use the empty-state component with a glyph, never bare text.
- **Never invent data:** no name splitting, no currency or category inferred for a record; show `-`. A figure
  that was not read is `...` while loading and `-` when unknown, never `0`. A total that needs a missing FX
  rate is unknown, never a partial sum; an expense with no rate is left out of converted totals and counted
  as excluded.
- **Names are decided in one place** (`expenseTitle`, `personName`, `groupLabel`, `effectLine`) and used by
  lists, Activity, notifications, share text and CSV. An unresolved participant is "Unknown person", never
  "You". Display normalisation never writes back. [Planned] (A-031)
- **Formatting:** amounts only through `formatAmount` (which caches `Intl.NumberFormat` per locale, currency
  and style); dates through `i18n.date` (verify it caches). A bun test checks
  `parseAmount(formatAmount(x)) === x` for exponents 0, 2 and 3 in every supported locale, including Indian
  grouping (A-006). No `toLocale*` outside the format modules (A-002).
- **Debug-only strings stay plain.**

---

## 8. Launch splash

[Partial] The native splash comes from the `expo-splash-screen` plugin (auto-hide) and web shows a static
mark in `public/index.html`. `StoreProvider` opens the store before rendering the shell. Not built (A-020):

- The splash holds until fonts, preferences and the local store are open and the first People/Groups
  queries have resolved, capped at 8 s; after the cap the app shows anyway.
- The store open and the first queries start at module import in the client entry, not in a provider
  effect (skipped on a web static render).
- A failed preference or store read during launch falls back and opens the app; it never extends the
  splash. A timeout while the page or app was hidden is not an issue.
- Launch work nothing waits on (first pull, FX refresh, OCR prefetch, telemetry flush) starts after the first
  screen settles.
- Each launch records `app.splash` with `outcome` (ready / timeout / store_error).

---

## 9. Offline-first and sync

Reads always come from the local store; writes commit locally, then sync. Offline is the normal state, not
an error: there is **no offline banner** (conflict with GameRun, § 21), only status labels.

### 9.1 Status labels

The spec's labels are `Saved on this device`, `Waiting for connection`, `Syncing`, `Synced`,
`Needs attention`. **Never show "Synced" before the server acknowledges.**

- [Partial] `packages/sync/src/selectors.ts` defines `SyncStatus` and `syncStatus()` (pending op ->
  "Saved on this device"); the client hard-codes "Saved on this device" in `HeaderAvatar`, `Profile`,
  `AboutSettings` and Expense history.
- [Planned] (A-009) **One pure `followSync()` in `packages/sync`** computes both the per-entity state and the
  app label so they never disagree: "Saved on this device" while the oldest op is under 30 s old and
  online; waiting with a count once older; offline with a count at once when offline; "Needs attention"
  when any op is refused or in conflict; a brief all-saved state after a drain. All surfaces (drawer
  header, LeftNav ProfileCard, Settings, per-row status, web tab title prefix "● 3 unsynced - ") are sinks
  of that one follower.
- A status line reserves its height, so rows never jump.
- **Loops rest.** The sync indicator never loops while waiting or offline (static icon + text); a spinner
  shows only while a push is actually in flight.

### 9.2 Connectivity

- [Planned] One connectivity store built from existing signals (browser `online`/`offline` events, request
  outcomes, a HEAD probe of the app's own origin on web), no NetInfo: a 5 s window suppresses flaps; it
  re-checks every 15 s while offline in the foreground and on foreground return; a `useSyncExternalStore`
  leaf re-renders only on a spell change; nothing runs before the first subscriber. Android's "Unable to
  resolve host" voids the proof of being online until something answers.
- It drives only sync scheduling and status labels. Own origin unreachable -> "Waiting for connection";
  origin answers but the API does not -> server unreachable, "Needs attention" only after N failed pushes in
  that spell.
- A push or pull with no answer for 15 s flips the label to waiting; the op stays in flight until its
  deadline.

### 9.3 Outbox

[Built] `OutboxOp` has `opId`, `deviceId`, `actor`, `entityType/Id`, `opType`, `baseVersion`, `payload`,
`schemaVersion`, `deps`, `attempts`, `nextAttemptAt`, `lastError`. Nothing drains it yet (no server).

- **Ids are final and minted on the device** by `ctx.newId()` only (UUID). The server accepts them as
  primary keys and never renames one. One `isEntityId(type, s)` checks shape at every boundary (deep links,
  pull, share tokens). A real identity change (guest claims an account, two friend records merge) arrives
  as an explicit mapping record; when two candidates fit, merge nothing and ask. [Built] minting
  (`StoreProvider`); shape check is A-010.
- **The op id is the server's idempotency key**; a replay returns the original acknowledgement. A tombstone
  push answered 404/410 counts as acknowledged.
- **Classify every push answer with one pure `classifyPushFailure(status)`** (A-007): transient = no answer
  (status 0), 5xx, 401, 408, 425, 429 (retry with backoff, `max(jittered backoff, Retry-After)`); 409 ->
  conflict (structured conflict flow, § 9.5); any other 4xx -> **refused**: the op stops for good, stores
  `refusedReason`, drops out of pending/backoff, blocks only later ops on the same entity, and the row shows
  "Needs attention" with Fix / Discard. Discard reverts only that op locally (tombstone or inverse with
  history). `lastError` alone is not terminal.
- **The outbox is scoped to the account that queued it** (`accountId`, or the install id before signup).
  The drain checks session account === op account before every send; rows from another account wait for
  that account. A 401 never deletes unsynced rows.
- **Order:** ops for one entity push FIFO; the drain is sequential on purpose. Financial ops are never
  coalesced (each is a history entry other members see); only preference ops may coalesce.
- **Progress resets the retry streak.** Each acknowledged batch resets failure counts; an op is flagged only
  after N consecutive failures with no acknowledgement between. Each loop has a cap; reaching it marks the
  op "Needs attention" with a worded reason and raises one issue, never an endless spinner.
- **Deadlines:** sync requests time out at about 30 s; FX and OCR downloads use `withTimeout`.
- **Undo holds the op:** deleting writes the tombstone at once, but its op gets `nextAttemptAt = now +
  UNDO_VISIBLE_MS`; Undo deletes the op and restores the entity in one transaction. One `UNDO_VISIBLE_MS`.
  [Partial] undo toasts restore through mutations (`useActivityActions`); the hold is A-008.
- **Triggers:** push on enqueue, on reconnect, on AppState active / `visibilitychange` visible, and every
  15 s while non-empty and online; pull once after the queue drains, not per op. The sender starts once at
  the app root (`data/SyncProvider`), independent of screens, and resumes the persisted outbox at launch.
  On going to background, request a short background task to finish an in-flight push; never assume JS
  runs after that. Pull-to-refresh on every list calls one `syncNow()` (drain, then pull); offline it ends
  at once with the label, no error toast. A push notification is only a hint to pull; its payload is never
  written to the store. Re-check on background-to-active, never inactive-to-active.
- **A local write that fails** keeps the composer open with a Lingui error, nothing reads "Saved on this
  device", and one `store/write` issue is raised per launch.
- **Telemetry per op** (`sync.op`): at most one `queued` or `failed`, then exactly one terminal `saved`,
  `refused` or `conflict` (persisted `counted` flag); duration from the persisted `createdAt`.

### 9.4 Pull and the wire (M2)

- **Batch from day one:** push takes `ops[]` and returns each op's outcome; pull reads from a cursor. A
  missing entity is 409/422, never a 404. No per-row server calls. A GET never writes.
- **Every request names its account and group/ledger.** The server keeps no per-session "current group".
- **Acknowledge only a parsed answer.** An op is acknowledged only when the push response is JSON,
  validates against the ack schema and names that op id. A 2xx HTML page (captive portal, SPA fallback), an
  empty body or a body cut by our own abort is "no answer" (status 0), never an ack. An unvalidated pull
  never advances the cursor.
- **Decoders never throw.** Every wire and storage shape (pull payload, invite preview, import rows, local
  rows of an older schema, share-intent payload, preferences JSON) has one `parse<Kind>V<n>()` returning a
  typed value or `{skip, reason}`. A skipped row is quarantined, counted and shown, and never aborts the
  pull. Money fails closed: an amount that does not parse rejects the row, never defaults to `0n`, never
  clamps. [Partial] `codec.decode()` calls `BigInt()` on untrusted strings and can throw (A-005).
- **Forward compatibility:** unknown fields are preserved; an unknown entity kind or op type from a newer
  device is kept untouched and shown as a generic "Updated in a newer version" row. Absent optional field
  means old behaviour; `null`/absent means "not set", `[]` means "explicitly none", and serializers never
  coerce one into the other.
- **Version skew:** push/pull carry `protocolVersion`; a too-old client gets a typed code the app words
  ("Update Splito to keep syncing") instead of looping. A missing capability reads as off and hides its UI.
  Each shim carries `// compat: delete when <condition>`. A new endpoint falls back only on 404. The server
  ships first; client windows (tombstone retention, outbox give-up, idempotency-key reuse) are at most the
  server's.
- **Payloads:** one serializer per entity builds payloads from a field whitelist (UI/draft fields cannot
  sync). Fields that belong together travel in one op (expense with shares and items, amount with currency,
  fxRate with fxDate, group with initial members). Retired fields stop being emitted, stay in history, and
  are still accepted on read.
- **A pull never overwrites pending local changes**: an entity with a pending op keeps its local version and
  records the server version as the new base; a pending tombstone is never resurrected. Test: a pull during
  a pending edit keeps the edit.
- **A server read never removes local data.** A 404/410 for an entity the store holds never deletes or hides
  it; only a pulled tombstone or membership removal does. Hidden, archived or filtered is not deleted.
- **Expiry is elapsed device time since the read** (`{receivedAt, lifetimeMs}`), never `Date.now()` vs a
  server `expiresAt`. Server timestamps are serialized with `toISOString()` and parsed only by
  `parseServerStamp()` (tested on Postgres text).
- **Contracts are tested on both sides.** Each protocol version has golden fixtures in
  `packages/sync/fixtures`, produced by a script that runs real `packages/sync` mutations through the real
  Fastify handler; both the client parser and the API tests read them. No hand-typed JSON contracts.
- **Before the API exists, build against a fake server**: `packages/sync/testServer` implements the M2
  protocol in-process; Playwright runs against it; M2 swaps in Fastify with no UI change (A-042).

### 9.5 Conflicts, refusals and other devices

- **A refused or conflicting item stays visible** in lists and local balances with a one-line "Needs
  attention" tag; tapping opens one shared panel with the reason and Fix / Discard. It never shows
  "Syncing..." indefinitely and never silently vanishes.
- **A conflict names who changed it** (actor and time from history) and offers keep mine / keep theirs; it
  is a metric, never an issue.
- **Access is the server's answer.** The client may hide edit/delete from the cached role, but the server
  re-checks every op; a refused op becomes a visible row ("Couldn't save: you no longer have access to
  Trip") and its local effect rolls back to server state.
- **Failures found later are logs, not issues:** a refusal or conflict made on another device and found in a
  pull is a log row; a refused op already reported (op id in a persisted set of the last 200) is not
  re-reported at launch.

### 9.6 Store reads and re-renders

- **`data/` hooks use `useSyncExternalStore` with immutable snapshots and the narrowest selector** (a
  boolean or number where possible); equal answers keep their object; a row re-renders only when its own
  entity or outbox state changes. Each mutation declares the projections it touches (balances, activity,
  analytics, per-person totals) and the change notice carries them. [Partial] `data/hooks.ts` `useLive`
  re-runs its loader for every hook instance after every commit, always sets a new value, and carries an
  `eslint-disable react-hooks/exhaustive-deps` (A-016).
- **React Compiler purity:** render reads only hook state; store-handle methods (`store.getAll`,
  `store.outbox`) run only in effects and handlers; every `useSyncExternalStore` takes a module-level
  subscribe; `'use no memo'` is a last resort; data-hook tests mock the subscription. Bail-outs are counted
  against a baseline (A-017).
- **Figures are computed before filters.** A row's balance is computed over the full ledger; search, show
  filter and sort only select and order. Only definitional switches (Include groups, currency) change
  figures.
- **Rows carry what they draw.** List rows are view-models from one selector over the visible list (per-row
  balances computed in the projection), passed as primitives plus one id-taking callback. A row at rest
  holds no Prompt, mutation hook or extra subscription; one delete/hide Prompt per screen receives the id.
  Bounded `.map` lists (items, participants, chips) render a memo row component. Membership tests use a
  `Set`.

### 9.7 Storage engines

- Native: `expo-sqlite` with WAL (`data/store.ts`); web: IndexedDB via `idb` (`data/store.web.ts`), which
  calls `navigator.storage.persist()` at open. [Built]
- **Blocked browser storage:** preferences and UI conveniences fall back to memory silently; the ledger must
  not. If IndexedDB cannot open or persist (private mode, quota, eviction), show a persistent notice that
  data will not be kept on this device. [Planned]
- **Sample data never counts.** Demo data is built through real mutations, uses invented names, is labelled,
  and is never merged into a real account or used as a fallback. [Built] `?demo=1` seeds only in dev/e2e
  builds (`data/demo.ts`).

---

## 10. State and service boundaries

- **Session-only UI memory** (expanded rows, last scroll) lives in a tiny module store, never the synced
  store or preferences. Device conveniences live in MMKV `Storage` instances. [Built] `storage/`.
- **Every user-facing choice is a preferences-registry entry** (`packages/sync/src/preferences.ts`, 24 keys
  today). [Built] Removing a setting's UI never drops its stored value or key until a dated migration. A
  test checks every key has a Settings row (A-032).
- **Restored selections pass the picker's own rule** (`isSelectable()`: exists, not left/archived, currency
  still present), else the registry default.
- **"Today" is one shared store.** `useToday(tz)` (midnight timer + refresh on foreground) feeds
  Today/Yesterday sections, the default expense date and analytics periods; render never calls
  `new Date()`/`Date.now()`. "2 min ago" is a `<TimeAgo>` leaf on one shared minute ticker that pauses in
  the background. `YYYY-MM-DD` values compare as strings. Derived status ("Settled", day labels) is computed,
  never stored. [Partial] `state/shell/tick-every-minute.tsx` exists; 7 `.tsx` files read the clock
  directly (A-015).
- **Timers re-check on foreground:** invite expiry, "synced 5 min ago", reminders and backoff
  `nextAttemptAt` re-evaluate on AppState active / `visibilitychange`, never trusting a long `setTimeout`.
- **Display keys on the record's own fields** (split mode, items, currency), never on current group or app
  settings, so history renders as saved.
- **Busy guards are keyed by entity and op**, never by mutation type; a guarded call that skips returns a
  value the caller must handle visibly.
- **Single flight from the first tap:** Save expense, Record payment, Settle up, Create group, Add friend,
  Delete and (M2) Accept invite go through one `useSingleFlight` (a ref closed synchronously; a disabled
  prop applies only after a render), released in `finally`. A second press is ignored and recorded as
  `tap_while_busy`. The composer mints the expense id when it opens, so a double submit upserts the same id.
  e2e: double-tap Save creates one expense. [Partial] screens track `isSaving` state (A-011).
- **Gated features (M2)**: flags are named predicates in `#/env` with per-tier values and `EXPO_PUBLIC_*`
  overrides; a flag hides the entry point, never the route; never comment code out to hide a feature
  (§ 21). Server-decided switches (AI chat, server OCR, guest links): absent, false or never fetched = off;
  the last answer per account is cached for offline use; a 403 "not available" is worded and refreshes the
  flag; the route enforces it too. A switch that can change on another device is drawn "Checking..." until
  known, never as off.
- **Never decide an action from an unanswered read**: Invite vs "Already on Splito", Accept invite and Link
  account wait for their read; "unanswered" is never false.
- **Access-granting actions fail closed** (create/reset/revoke invite, guest edit link, balance link): they
  check the server permission when their sheet opens and stay disabled until it answers; offline they say
  "Needs a connection". Display gates may fail open. Reads that feed a confirmation are fresh.
- **Get-or-mint links are actions**: an invite link or QR is minted by opening the Invite sheet and stored
  on the group; never minted by a re-running hook or on pull; offline it says "Available when online" and
  never fabricates a URL.
- **No account enumeration (M2):** Add friend answers only "invite sent" or "already a friend"; pages return
  the same not-found for "not yours" and "gone". Placeholder friends are claimed by invitation: preview,
  Accept, then an atomic server merge that re-attributes history.
- **Non-member data** (invite previews, user search results) stays in memory; group members' shared ledger
  is persisted by design (§ 21).
- **Nudges are pure rules** evaluated on a loaded store and render as inline cards, never self-opening
  dialogs.

---

## 11. Credentials, sessions and device identity

[Planned M2] No tokens exist today. `deviceId`, `meId` and drafts live in MMKV.

- **One module** (`storage/credentialStore(.native).ts`) reads or writes the session token and keeps a copy
  in memory; operations run one at a time; a storage refusal never blocks sign-in. Native uses
  expo-secure-store `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; an MMKV marker detects a Keychain entry that
  outlived an uninstall. Web uses an **httpOnly cookie + CSRF** (never `localStorage`). Enforced by A-001's
  credential counter.
- **Only the Splito API's 401 ends the session** (never the device clock, never a 401 from FX, OCR, AI or
  storage, which are that feature's error). Sign-out keeps unsynced outbox rows for the same account.
- **One `signOutCleanup()`** lists every device-wide reset (account-scope prefs cache, that account's drafts,
  push token, telemetry identity, flag cache) and is mirrored here when built.
- **Backups:** list what Android Auto Backup and iCloud carry. `deviceId` must not be restored to a second
  phone: keep it in secure store `THIS_DEVICE_ONLY` or regenerate it when a restore is detected. Decide
  whether the SQLite ledger is backed up, and test that a restored DB with an unsynced outbox pushes safely
  under idempotent op ids (A-048).
- **Web dev and cookies:** web dev runs the API on localhost; CORS allows credentials for exactly the dev
  and prod origins; localhost cannot carry the cookie to a remote API. One fixed web dev port.
- **Redirects and external URLs are validated:** OAuth callbacks, "continue to" targets and server redirects
  go through `isSafeRedirect()` (https, allowlisted parsed hostname, loopback only in dev); URLs from
  server or user data go through `safeExternalUrl()` (https plus allowlisted payment schemes such as
  `upi:`). Bun tests cover lookalike and path-only hosts.
- **Sign-in sheets** (Google/Apple auth sessions) run inside the hang-tracking pause wrapper (§ 16).
  Store-review sign-in is decided by the server (no `Platform.OS` check in packages). A release check
  refuses an iOS build missing required entitlements (Sign in with Apple, associated domains, push).
- **Extensions get an opaque id only:** the iOS share extension's App Group holds the shared files and an
  opaque account id, never the token, names or amounts.

---

## 12. Payments boundary (record, never send)

Splito records payments; it never moves money and sells nothing (free forever).

- [Built] Record payment / Settle up write repayments through `createRepayment(s)` mutations
  (`packages/sync/test/repayments.test.ts`).
- [Built] UPI hand-off (`components/people/UpiPayDialog.tsx`) opens `upi://pay` and, on return, asks "Yes,
  record ..." because Splito cannot see the payment app. **Coming back from an external payment app is never
  proof of payment**; the user confirms.
- Repayments are atomic and idempotent through the op id, and the buttons are single-flight (§ 10).
- Payment-app links (v2: PayPal.me, Venmo, Revolut, ...) go through `safeExternalUrl()` and one
  `openLinkOrToast` helper (Bluesky `useOpenLink` pattern) that shows a toast on failure. [Partial] the UPI
  dialog calls `Linking.openURL` directly (A-032).
- No paywall, checkout, wallet or store-review payment hiding (GameRun's are skipped, § 22). Anything that
  costs money per call (AI chat, OCR, FX provider) is rate-limited server-side only.

---

## 13. Uploads and attachments

[Planned v2] Receipts and avatars. None exist yet.

- **Limits** (size, type) live in one constant module shared with the API and are checked on the device
  before any upload URL is requested, in the server's own words.
- **One picture pipeline** `pictureForUpload()` in `lib/`: files stored locally (no base64 in JS),
  re-encoded (resize/JPEG, original kept if within limit), attached on Save, temp files deleted on Discard.
  Blobs never go into entity or outbox rows; they upload separately and are referenced by id.
- **Lifecycle:** a copied receipt is deleted only when its upload is acknowledged and no op or draft
  references it, or its draft is discarded; never while a failed upload may resume. One pure function
  decides.
- **Slow platform reads** (iCloud-only originals, HEIC conversion, large PDFs) run under a timeout and fall
  back to the picker's copy with one issue.
- **Signed URLs:** expiry judged on device elapsed time from the read; re-sign once on refusal (concurrent
  refusals share one read); the first refusal is a breadcrumb, the second an issue; sign only visible
  attachments.
- **Transfers:** bounded auto-resume; one `attachment.upload` outcome per upload with resumed/retried flags;
  the bucket's CORS allows PUT and upload headers from every Splito web origin (checked in Safari).
- **Display:** one `useAttachmentState` + `AttachmentStatus`; an image that errors falls back to the next
  source and finally to initials/emoji; placeholders reserve the final size and collapse on failure; the
  full viewer mounts on tap; no client timeout labels an image broken.
- **Camera and permissions** are lazy (§ 2); a refusal or missing camera is a state with a Lingui
  explanation and a Settings link, recorded as a `permission` metric, never an issue.
- **OCR never auto-posts**: receipts create drafts (§ 5).

---

## 14. Links and deep links

[Built] `navigation/linking.ts` (native: `splito://`, `https://splito.app`) and `linking.web.ts` resolve every
route from `routes.ts`; `/notifications` aliases to `/activity`; a bare `/` opens the Home tab preference.

- **One resolver** handles https, the custom scheme and notification URLs. Hosts live in one JSON shared with
  the app config. Invite, QR and balance links resolve through it.
- **Unknown paths open home** and record `dead_link` friction with the route shape only. [Planned] (A-014)
- **Deep links resolve from local data first** and push the final screen directly. An entity not yet on
  this device shows loading until the first pull (offline: "Not on this device yet"), never "Not found"; a
  tombstoned or unknown id shows "not found" with `goBack`. A failed read is an error with retry, never the
  empty state.
- **Link params are sanitised** by charset and length before any request (invite and share tokens); one-shot
  keys are dropped once used.
- **Links carry no command:** notification, QR and invite links only navigate; they never settle, delete or
  accept from the link.
- **Sign-in preserves intent (M2):** an invite or claim link opened signed out stores its relative target in
  the draft store, runs sign-in or local-profile creation, then resumes.
- **Public pages (M2):** `/join/:token`, `/i/<token>`, `/b/<token>` are matched exactly (near-miss tests),
  render outside the app shell, and are served by Fastify with og tags (never amounts or names unless the
  owner chose) and a bounce into the app. Invite flow: preview, Accept, redeem; outcomes accepted /
  declined / already (409) / gone (404/410) / failed, each its own screen.
- **Per-tier host claims:** each build claims only its tier's link host (checked by a release-config
  script); AASA and assetlinks list only app paths (join, group, person), excluding auth callbacks and
  downloads; the web deploy keeps dot-paths.
- **Share:** one share helper takes the entity id plus the screen's summary; screens never call Share APIs
  directly; capability fallback per § 2.
- **Secrets are scrubbed:** invite tokens and join codes are removed from URLs, breadcrumbs and nav spans in
  `#/logger`, with a bun test.

---

## 15. OTA updates, app version and web reloads

[Planned] `expo-updates` is not installed.

- **Check at launch and on background -> active**, never inactive -> active (Control Centre and system
  alerts). Don't re-fetch an update already downloaded and waiting. A stale error already in expo-updates'
  state is re-checked, not reported. "No update" is a signed 200, never a 404. Timeouts: Android 10 s, iOS
  60 s. Record `ota.check` and `ota.launch`. Native changes move the fingerprint and need a store build.
  These go into `RELEASE.md` when EAS Update is wired (A-050).
- **Version footer** [Partial]: Settings > About shows `APP_VERSION` (package version + native build number
  from `expo-application`; never `Constants.expoConfig.version`, which an OTA rewrites). To add: the update
  id beside it, a Dev/Stage badge off prod, and a Restart button only while an update is waiting, which
  flushes telemetry first (A-039).
- **Never auto-reload while work is at stake.** Every automatic web reload (stale chunk, bfcache restore,
  service-worker update, account switch) first checks `hasWorkAtStake()`: an open FormSheet with changes or
  an attachment whose bytes are not persisted. Outbox rows are already in IndexedDB and never block.
- **Stale web chunks:** a deploy keeps previous builds' chunks for at least 3 days (or the service worker
  keeps the old precache); a chunk-load error reloads once, shows the error screen on a second failure
  within 60 s, and reports only if the page's own origin answers.
- **bfcache:** `pageshow` with `persisted` flushes telemetry and reloads (subject to the work check), so a
  restored tab never drifts from IndexedDB written by other tabs.
- Release order and the rollout rule: the server ships first; a new sync protocol or storage engine ships
  behind a per-tier flag with the old path kept as rollback until every tier is on.

---

## 16. Errors and telemetry

[Planned] Today `#/logger` is console-backed with Bluesky's call surface and `#/analytics` is a no-op. There
is no telemetry vendor and no root error boundary.

### 16.1 Privacy (Splito's rules win over GameRun's)

- Identity is an **opaque account id and install id only**: no email, name or phone on events.
- **Logs, metrics and friction never carry** typed text, expense titles or notes, amounts, file names, or
  any friend's or member's name or id. An error line that names another person is shown, but only its code
  is recorded. A currency code is allowed.
- **Replay is off**, or masks every amount, name and note.
- **Scrubbing runs twice:** in `beforeBreadcrumb` and again in `beforeSend`/`beforeSendTransaction` (native
  breadcrumbs merge in later and skip the first pass). Invite tokens and codes are scrubbed from URLs and
  nav params.
- **Settings has a "Send diagnostics" master switch for everyone.** Off means the SDK is never initialised
  and nothing telemetry-related mounts. Each per-capability env switch has a test that, when off, nothing
  of that capability is sent. Overrides are cleared on sign-out.
- **One vendor**, behind `#/logger` and `#/analytics`; no second analytics SDK.

### 16.2 The module

- `#/logger` and `#/analytics` are the only callers of the vendor SDK (sentryImport counter) and the only
  `console.*` callers (A-001; 2 files today, both copied from Bluesky).
- **Recording is not sending:** calls enqueue and never throw or block; a drain runs on idle after
  transitions in <= 4 ms slices and keeps each row's recorded time; everything flushes on AppState
  background, and the app awaits the flush (max 2 s) before any restart.
- **Local runs report nothing:** `__DEV__`, localhost, tunnels, a local API URL, and simulator/emulator
  builds. Environments equal backend tiers (dev, stage, prod); e2e reports under its tier with an
  automation segment or not at all. Vendor packages are upgraded together. `dist` = build time in minutes.
- **Drops are measured:** because sends are deferred, raise the RN SDK `maxQueueSize` (~300; the default 30
  lost events in GameRun) and use the browser offline transport; read `client_discard` stats before and
  after any queuing change.
- **Root `AppErrorBoundary`** (Bluesky's, copied) with the web chunk rules of § 15 (A-018).

### 16.3 What gets recorded

- **Record where something completes**, never per render, frame or keystroke. Flows record a count with
  `outcome` plus a duration. Metric attributes are enums, booleans or small counts. Flow metric helpers sit
  beside the flow (`features/settlement/model/settleMetrics.ts`) and are called from hooks, never components.
- **Real failures are issues; friction is a metric.** Offline, a cancel, a denied permission, the person's
  own invalid input, a 429 from their second tap: not issues.
- **Retries are breadcrumbs; only the final failure is an issue.** Each retried sync attempt leaves a
  `sync.attempt` breadcrumb (status or code, batch size). An op raises an issue once, only when given up or
  refused as a bug.
- **Caller answers are not transport issues** (M2 HTTP client): 304, 400, 401, 402, 403, 404, 409, 410,
  422, 429 are handled by the caller; a specific normal (status, path) goes in `EXPECTED_ANSWERS`. **But a
  422 on sync push is an issue** (`sync.rejected_after_valid`): the client validated first, so client and
  server rules drifted.
- **A no-answer is an issue only when the device was demonstrably online**: something answered within the
  30 s before the request, the app/page was not away since it started, and (web) the page's own origin
  answers a HEAD.
- **Grouping:** an API issue fingerprint is service + status + request shape (`POST /v1/sync/push`, ids
  replaced by `:id`); 502/503/504, Cloudflare 52x, no-answer and timeout collapse into one
  `api/unreachable` issue; dedupe once per shape until a success.
- **Noise filter:** `beforeSend` drops browser-extension stacks, third-party fetch failures and the
  mail-scanner bridge rejection (balance and invite links get emailed); tag the browser brand.
- **Spans and correlation (M2):** request spans are named by route shape; trace headers and
  `X-Splito-Visit` (random per launch and per 30 min in background) go to Splito hosts only; the API tags
  events with visit id, opaque account id, batch id and op ids; every custom header is in Fastify CORS
  `allowedHeaders` in the same change with a preflight test, and a route that throws still returns CORS
  headers.
- **Pause hang tracking under system sheets** (auth sessions) that keep the app active.
- **Haptics:** `#/lib/haptics` swallows rejections and reports a rejecting native module once per session.
- **Press analytics, if ever wanted,** live only in `Button`/Pressable wrappers after the press; labels with
  names or amounts are recorded as `(dynamic)`; fields record focus and submit, never values.
- A **Diagnostics** screen (dev/internal builds) shows outbox depth, last errors and store size; "Share
  diagnostics" sends JSON without amounts or names (A-040).

### 16.4 Metrics (planned names; a change here is dated)

| Metric | Attributes | Where |
|---|---|---|
| `mutation.save` | opType, outcome, ms (budget p95 < 100 ms) | `packages/sync` mutations via `data/` |
| `sync.push` / `sync.pull` | outcome, batch size bucket, ms | sync loop |
| `sync.op` | outcome saved/queued/failed/refused/conflict, opType, ms from createdAt | sync loop |
| `outbox.depth` | count bucket | sync loop |
| `expense.save`, `settle.record`, `invite.accept`, `invite_link`, `export`, `import.commit`, `share`, `permission` | outcome + small enums | flow helpers |
| `add_expense_open`, `expense_save`, `tab_switch`, `ui.loading` (>= 1 s) | ms | shell, composer |
| `app.splash`, `ota.check`, `ota.launch`, `attachment.upload` | outcome | launch, OTA, uploads |
| friction: `tap_while_busy`, `dead_link`, `inline_error`, offline spell | kind | shared hooks |

### 16.5 Issues (planned; a raised name missing here fails A-002's undocumentedIssue counter)

| Service | Codes (group) and dedupe scope | Not an issue | Raised in |
|---|---|---|---|
| store | `write` - once per launch | - | `packages/sync` via `data/` |
| sync | `refused`, `rejected_after_valid` (422) - once per op id; `stalled` - once per online spell after N failed pushes | offline, 409 conflict, 401, own input, another device's history | sync loop |
| api | status + request shape; `unreachable` - once per shape until success | caller answers (304...429) | HTTP client |
| ota | `check_failed` - once per launch | no update, offline | OTA hook |
| chunk | `load_failed` - once per route per launch | page hidden, own origin down | ErrorBoundary |
| haptics | `rejected` - once per session | disabled, missing | `lib/haptics` |

---

## 17. Performance budgets

Budgets (owner rule 10 + `AGENTS.md`): cold start to interactive People < 1.5 s on a mid-range phone (web
LCP < 1.5 s cached); tap feedback < 100 ms; local save p95 < 100 ms; 60 fps (120 ProMotion) transitions and
lists of 1,000 rows; no JS long task > 50 ms while typing, scrolling or animating; bundle growth justified.
Numbers go in `docs/COMPLETION_MATRIX.md` with a baseline and an after on the same flow. [Partial] budgets
are written; nothing records them automatically (A-037).

- **Lists:** Bluesky `List` only; never unbounded `.map()`. People, Groups and Activity render overview
  cards, section headers, rows and the empty state as typed rows in one List with prefixed keys; the empty
  row renders only after the first local query resolves (no "No friends yet" flash); skeleton rows reuse the
  row styles. Lists whose sticky headers can appear or disappear set `removeClippedSubviews={false}`. If
  profiling shows the Overview over-mounting, render it as the first row.
- **Mount heavy blocks on open, on idle or near the screen**: itemized breakdowns, split detail, charts
  below the fold, menu and drawer contents. Group tabs mount panels lazily. Long pages (Analytics, Group)
  render their first screenful first. Polling (M2 invite status) runs only while visible and stops after
  three failures.
- **Charts:** one `react-native-svg` path in `features/analytics/charts` (no other chart library, CDN script
  or WebView: A-002); width from the container's `onLayout`, never a wider Svg; one Svg plus one gesture
  surface mapping `locationX` to a bar (never a Pressable per bar); entrance by a Reanimated clip or
  translate over a finished drawing, never animated SVG props; a chart point opens the filtered expense
  list; a text alternative for screen readers. [Partial] charts exist in `components/charts/`.
- **Animation:** UI thread only (Reanimated worklets). Loops rest: every `withRepeat(-1)` (shimmer, spinner,
  pulse) is cancelled when its screen loses focus or reduced motion is on; Lottie plays once and rests;
  motion `off` shows the end state. AnimatedAmount never re-renders React per frame. Motion flags are read
  in the effect or worklet that starts an animation. Worklets never name a module constant in a default
  parameter (A-002). Tab-icon pops and FAB motion transform the Pressable itself. Never
  `useNativeDriver: false`; never animate width/height from JS except the search expand.
- **Reanimated synchronous UI-props flags**: add both to `apps/client/package.json` after checking Bluesky's
  reanimated patch still applies, and measure tap-to-sheet before and after.
- **Launch:** start the local restore at import time; independent M2 launch requests run in parallel
  (`settleAll`); the drain stays sequential.
- **Bundles:** keep Bluesky's lazy imports and inline requires; measure web first-load chunks before adding
  a lazy boundary (tap-opened dialogs first); warm tab modules on idle one per turn only if a first visit is
  measured slow; illustrations ship as WebP; unreferenced assets are deleted.
- **Render gate:** a Playwright scenario counts renders (launch to People, tab round, add expense, search
  four characters) on main vs branch; numbers go in the PR.
- **Dev-only tools never ship:** the release script refuses to build with any `EXPO_PUBLIC_` debug,
  profiler or override variable set.

---

## 18. Accessibility

- Interactive elements get a `label`; targets are at least 44 x 44 pt; controls in one toolbar row share one
  height.
- Validation and sync failure lines use one accessible-alert prop (`role="alert"` on web, an announcement
  on native).
- Selection is never shown by colour alone (§ 6). Charts and receipt images carry a text alternative.
- Every animation honours reduced motion and the `motion` preference. [Built] `motion/useShouldReduceMotion`.

---

## 19. Testing

| Layer | Tool | Status |
|---|---|---|
| Unit, packages | `bun test` (`pnpm test`): 8 domain and 7 sync test files; one store contract runs against SQLite and fake IndexedDB | [Built] |
| Unit, client | `bun test ./src/` in `apps/client`: 8 files (dates, amount steps, People sort, split form, activity feed, ledger, routes, swatches) | [Built] |
| Property | `fast-check` in the split, ledger, settlement and reports tests (conservation, permutation invariance) | [Built] |
| Golden | bun snapshots of `computeShares`, `allocate` (weights), settlement plans, per-currency balances; decoding tests for every past local and sync schema | [Planned] A-006 |
| e2e | Playwright against the exported web build: 10 specs (activity, analytics, animations, demo, expense, group, motion, people, settings, shell) | [Built] |
| Architecture | `apps/client/src/architecture/rules.test.ts`: per-file counters, baseline only shrinks | [Planned] A-001, A-002 |
| Native | Maestro where a simulator/emulator exists; iOS and Android Release builds for native changes | [Planned] |
| API (M2) | Fastify against real Postgres under Bun; fault injection (crash after server commit before ack, and before local cursor commit) | [Planned M2] |

Rules:

- **Goldens are recorded before a change.** A deliberate behaviour change replaces them in its own commit
  and says why; never regenerate them to go green.
- **Fixtures come from real code**, never hand-typed JSON (domain fixtures from recorded flows; sync fixtures
  through real mutations and, from M2, the real handler).
- **Pin silent failures:** every opType has a server handler (parity), every preference key has a Settings
  row, every currency formats and round-trips, every domain error code has a message, every analytics
  figure's formula has a worked example.
- **Required content is asserted** by a mandatory-sections helper on web at 360 and 1200 px: expense detail
  (amount and currency, payers, each share, items when itemized), group (Expenses/Balances/Members tabs and
  Settle up), person (balance per currency).
- **Per-feature Playwright spec** seeded through a test-only store fixture (no server): both themes, 320,
  390, 768/800, 1280 and 1440 px; empty, offline, refused and conflict states; fails on any console error or
  horizontal overflow; geometry checks for owner rules (title centred, at most one right action, footer
  pinned); screenshots to a gitignored `apps/client/qa/<feature>/`. A stale selector is fixed in the spec,
  never by reverting UI. Release e2e runs on `expo export -p web` output.
- **Every wait is bounded** (Playwright and bun): a timeout fails the test.
- **Library workarounds and `patches/`** each have a test that fails when the workaround stops applying.
- **Never commit tokens.** e2e uses seeded local-store fixtures; M2 signed-in QA reads a token from env or a
  gitignored file.

---

## 20. Build, lint and dependencies

- **Oxlint, errors only.** Every enabled rule is an error; existing violations live in a suppressions
  baseline that fails on new ones and on fixed-but-still-recorded ones. Hook and component default params
  of `[]`, `{}` or a function are hoisted to module constants. Oxlint runs in CI (it takes seconds). [Partial]
  oxlint is a dev dependency; no config or baseline yet (A-003).
- **Dependency audit** (`pnpm audit`) is triaged by root package and recorded in § 23; never force-fix
  anything that downgrades Expo, RN or Bluesky-pinned packages.
- **`patches/`** (from Bluesky) each name the upstream issue and version range.
- **Release checks:** native module gate (§ 2), entitlements check (§ 11), per-tier link hosts (§ 14), no
  debug env (§ 17).
- **Work in throwaway worktrees**; automated review findings are proven and answered (once on GitHub).

---

## 21. Conflicts resolved (GameRun vs Splito)

| GameRun does | Splito does | Why |
|---|---|---|
| "You're offline" banner; failed reads re-run on reconnect | Status labels (§ 9.1), no banner | Offline is normal in an offline-first app |
| Server-first freshness (re-read on return, poll before success) | Reads from the local store; only "Synced" waits for the ack | Offline-first |
| `useCopy()` copy modules | Lingui | Standard here; Hindi plurals |
| `createStyles`/`useStyles`, own type scale, own Dialog, breakpoints 768/1024 and a 208 px sidebar, phone-presentation hook | ALF, Bluesky Dialog, `useBreakpoints()`, Bluesky Layout | Our UI code is Bluesky's |
| Expo Router thin `app/` routes | React Navigation 7 | Matches Bluesky's navigator and linking |
| Web token in `localStorage` | httpOnly cookie + CSRF | Spec security rule |
| Sentry identity = email and name; replay unmasked | Opaque ids; replay off or masked | Privacy; app used before signup |
| ESLint, not run in CI | Oxlint in CI | Speed; takeaways |
| Filters drawer applies each choice at once | Apply button (owner rule 8c); keep the active dot and options from loaded data | Owner rule |
| Account control top right, drawer title centred, stacked dialog buttons, tapping the current tab does nothing | Owner rules 1, 2, 7; re-tap scrolls to top | Owner rules, Bluesky |
| Save always pressable, errors under fields | Save disabled until valid (owner rule 7), reason always visible | Owner rule; GameRun's lesson kept |
| Hidden features commented out on screens | One flag predicate, entry point hidden | Commented code drifts past lint, types and tests |
| Latest unsent commit replaces the queued one | Financial ops never coalesce | Each is history others see |
| Bad stored values clamped on read | Money never clamped; malformed rows quarantined | Money rules |
| Another person's data never persisted | Member ledgers persisted; non-member data in memory only | Offline-first |
| RN Animated native driver for tap motion | Reanimated (owner rule 10) | Owner rule, Bluesky |
| Presses through gesture-handler taps | Bluesky Button/Pressable; revisit only if dropped taps are measured | Bluesky first |
| QA token committed in the architecture doc | Never commit tokens | Security |

---

## 22. Not adopted (skipped)

Sport, report, coach and analysis features; paywall teasers, unlock offers and entitlement grants; Stripe
checkout, wallets and org pools; store-review payment hiding; camera, video, pose, frame grabbing and slow
motion; Live Activity / Live Update and long uploads outside the app; CleverTap, Matomo and GA mirroring and
campaign pushes; staff "log in as user"; backend-choice pill and Sentry overrides UI; GameRun's shell
machinery (header copy during tab slides, blur rules, splash animation internals, draggable floating
button); screen freezing; TanStack observer field tracking; runtime font readiness; viewer-gated content;
profiling and typed dashboards (until dashboards exist); a Web Worker path (until OCR or a large import
measures a long task); signed-URL caching for picked files (until attachments exist).

---

## 23. Lessons

Inherited from GameRun (2026-10-26); each holds for Splito's stack:

- A transparent RN `Modal` still swallows taps on iOS; iOS silently refuses a second modal over an open one;
  changing a dialog's `key` is dismiss + present and iOS can drop the present.
- Yoga `flex: 1` is a 0 basis: text vanishes or wraps one letter per line on iOS/Android while web looks
  fine. Flexed text on web needs `minWidth: 0` to ellipsize.
- On Android, `elevation` decides drawing and `zIndex` decides touch; set both.
- Hermes `TextDecoder` supports only UTF-8/16, and Hermes rejects date strings browsers accept.
- Expo's Android fetch hands over a partial body on cancel instead of rejecting: treat it as a timeout.
- Captive portals and SPA host fallbacks answer API paths with 200 `text/html`.
- Sentry RN's default `maxQueueSize` (30) drops events once sends are deferred; native breadcrumbs never pass
  `beforeBreadcrumb`; system auth sheets cause false app-hang reports.
- An iCloud-only photo original can hang the picker read indefinitely.
- A busy guard keyed by mutation name silently skipped a second row's write (GameRun #644).
- A server-side "current workspace" changed by another device filed records in the wrong scope.
- A dev build's link claims opened the prod app: claim per tier.
- `useFonts` with an empty map reports loaded forever.

Splito lessons (add newest last, dated, with PR):

- (none yet)

---

## 24. Checklists

**Adding a split mode:** domain `SplitInput` union + `computeShares` + `validateExpense` codes + Lingui
messages + golden fixture + property test + composer UI + expense detail rendering + CSV + `assertNever`
switches compile + § 9.4 forward-compat row for older clients.

**Adding a locale:** Lingui catalog + `numberLocale` + plural rules tested on Hermes + date format + Indian
or other grouping in the round-trip test + RTL check if applicable + footer geometry at 320 px.

**Adding a preference:** registry entry (key, type, default, scope, group, label) + Settings row (tested) +
Reset to default + sync scope decided + read path before first paint if it changes paint.

---

## 25. Feature rules

Rules that belong to one feature area rather than a layer.

**Lists (People, Groups, Activity).**
- Local search filters on every keystroke (owner rule 9); search and Filters buttons hide while the list is
  empty; the empty state does not repeat the header's action. M2 server lookups (find a user) are debounced,
  keep previous results and run only while their sheet is open.
- Programmatic scroll or an initial pager page is not a user edit: it never changes a filter or fires
  telemetry.
- Desktop card grids compute columns from width, and skeletons use the identical grid.
- A dismissible banner mounts above the section that reloads, so the dismissal outlives the reload.
- A failed refresh keeps rows on screen with an inline note; only a failed first load with nothing cached
  shows Bluesky's error screen with Try again.

**Analytics and export.**
- The table view pins the name column; figure columns scroll under one horizontal scroller with a fixed row
  height; widths come from one `tableScale` module.
- [Built] Export CSV: `@splito/domain` `reportCsv`/`csvCell` (RFC 4180, CRLF, formula guard on text that is
  not a plain number, so a refund's `-12.50` stays a number); web download with a UTF-8 BOM
  (`screens/Analytics/exportCsv.web.ts`); native hands the text to the share sheet. Metric `export` with
  file and outcome; a cancel is silent; only a failed write or hand-over is an issue.
- Grouping after a category rename uses a normalised `categoryKey()`; stored ids stay as written.

**Import (backup JSON, v2 Splitwise CSV).** Two steps: parse and preview (schema validation, duplicates,
problems listed first with file line numbers and excluded), then commit as one mutation batch with outcome
imported / partial / file / failed. The parser lives in `packages/domain`. A file the user can fix is a
metric, not an issue. Large imports publish whole-percent progress to one leaf; the store never persists
progress.

**FX.** The rate is requested when a foreign currency is picked, not on Save; the converted line holds its
height with `...`; a failure retries on next open or reconnect, never in a loop. A dated bundled snapshot of
currencies and rates is used only when the read fails, labelled with its date; production paths never fall
back to demo data. Converted values are labelled estimates (§ 7).

**Invites, codes and public views (M2).** Person and invite rows show Sent / Opened / Joined (Joined wins);
Resend is limited server-side and its 429 is worded, not an issue. Join codes use one sanitise/format pair,
preview once complete, and are secrets in telemetry. Server-rendered public pages (guest link, balance link,
invite preview) return a projection type with a client/server parity test; sync pull keeps full entities.
Read-only balance links never render write UI.

**Push and live updates (M2).** Push tokens are requested again on a schedule and only where one is owed; a
failure is one issue per launch. If live sync (SSE/WebSocket) is added, N connections that never went live
raise one issue and polling pull stays the fallback. Local reminders respect dismissal; web notification
permission is asked only from a tap.
