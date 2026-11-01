# Splito architecture

How Splito is built, and the rules every change follows. This is the app's memory: when you are about to
change something, read the section first, and update it in the same change.

- Binding order when rules disagree: owner decisions in § 26 (Product & UI rules) > design spec
  (`docs/superpowers/specs/2026-10-26-splito-design.md`) > Bluesky's code and conventions > this document's
  rules taken from GameRun. `AGENTS.md` (coding standards) and `CLAUDE.md` point here.
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
   link to it. A coding standard every change must follow also gets a one-line summary in `AGENTS.md`;
   product and UI rules live only in § 26.
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
9. **Every owner decision is recorded in § 26 in the same turn it is made, and committed with the change.**
   This covers product, UI, UX, behaviour, branding, stack and process decisions, including corrections
   ("it should be there", "move X", "keep Y"). Rewrite the rule in its § 26 topic so only the current truth
   remains (never append a rule that contradicts an older one), update every other place that restates it,
   and add one row to the § 26.23 decision log (owner's words, decision, rule, what it replaced). Never record
   owner decisions in `AGENTS.md`. A `UserPromptSubmit` hook in the repo's `.claude/settings.json` injects
   this reminder on every prompt. Reason: owner, 2026-10-26: "make sure this file updates on its own,
   whenever there is any such decision".
10. **Record lessons and rules without being asked** (owner 163). Whenever work turns up something every future
    change should follow (a root cause, a library quirk, a review finding, a platform rule, a test or perf rule, a
    convention), Claude writes it here in the same turn as a dated § 23 lesson or a rule in its section, updates
    BACKLOG when it implies work, commits and pushes, without waiting for the owner to say "add this". Reason:
    owner, 2026-10-30: "make sure you do it yourself always, whenever you think this should be in the app".
11. **This file learns by itself, performance first** (owner 191). Every performance finding (a measurement that
    missed or surprised, a root cause, an approach tried and rejected, a review finding, a test-method lesson)
    becomes, in the same change, a rule in § 17 "Performance rules learned" (what to do, why, the numbers) and a
    dated § 23 lesson; a rule that a later finding contradicts is rewritten, never left beside it. Enforcement,
    so it does not depend on memory: `pnpm check` runs `scripts/lessonsGate.ts`, which fails a branch that
    changes perf specs, the renders baseline or measured numbers in `docs/COMPLETION_MATRIX.md` without also
    changing § 17 or § 23 here; every builder brief says to record lessons; every Opus review lists findings
    that should become rules; the repo's `UserPromptSubmit` hook repeats this. Reason: owner, 2026-10-30: "make
    sure everything we learn from performance captures in architecture"; "that file should be self learning".

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
  money arithmetic also lives in `components/split/form.ts`, `components/people/ledger.ts`
  and `screens/People/sort.ts`; A-001 freezes it and A-004 moves it.
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
  | A row's "more actions" menu | `#/components/RowMenu` (`RowMenu`, `useRowMenuTrigger`): right-click, Menu key / Shift+F10, long-press (native and phone-width web); the "..." button on every width or wide only |
  | Category name, tile | `useCategoryLookup` / `useCategory` (translated, gone id = Other) and `CategoryTile`, all in `#/components/split/shared` |
  | Toast, undo | `#/components/Toast` |
  | Long list | `#/view/com/util/List` |
  | In-page tabs | Bluesky Pager + `TabBar` (§ 26.9) [Partial: `components/TabBar.tsx`, no Pager yet] |
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
  A-002). [Built] pattern in use (`data/store(.web)`, `lib/export/saveFile(.web)`, `env/index(.web)`).
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

The shell is Bluesky's, per § 26.3-26.9 and § 26.17 (drawer from the top-left avatar, header slots,
Activity as a destination, LeftNav, right column, FAB, sheets, animated tab switches). [Built] in `view/shell/`,
`components/Layout/`, `navigation/Navigation.tsx`.

- **One `navigationItems` array feeds the bottom bar and the web sidebar** (there is no side drawer, owner 217), and a test pins § 26.3's
  order. Nav items never hide or reorder while data loads; only badges (Activity unread) appear
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
- **The FAB has one suppression rule list**: shown only at phone widths on screens with no Back (§ 26.6), so
  hidden on Settings and its sections, Profile and every pushed page; also hidden on onboarding, any screen
  with a pinned footer, while a sheet is open and while the keyboard shows; decided by the focused screen,
  not by mount.
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

Every form sheet uses § 26.8's layout through `components/FormSheet.tsx` (title left, round X top right,
Cancel + primary pinned at the bottom; a bottom sheet with drag-to-close on phones, a centred popup with the
footer bottom right on rail and desktop). On phones every modal, prompts included, is a bottom sheet.
[Built] header and footer.

- **Never render React Native `Modal` directly** (a transparent Modal still swallows taps on iOS). [Built]:
  zero uses; A-001 keeps it that way.
- **A closed dialog renders and reads nothing.** Store subscriptions for a sheet live in an inner body
  component that mounts only while open (or closing); things that must outlive the close (save in flight,
  undo toast, telemetry) live in the caller's hook. Content stays frozen through the exit animation. Row
  menus and overflow menus mount their dialog body only while open. [Partial] Bluesky's Dialog unmounts
  content; the body/shell split is A-022.
- **Run post-close work inside `control.close(() => ...)`** (Bluesky footgun). [Built] in `AGENTS.md`.
- **One native modal at a time, except one dialog over a route sheet** (assistant's ruling 2026-10-30, after
  the iOS QA of Wave B; Bluesky's composer does the same): a route-level sheet (Add / Edit expense, presented as
  a native form sheet) may have ONE dialog sheet (a picker, Discard changes?, a global sheet) presented over it,
  from the top-most presented controller (`modules/bottom-sheet/ios/SheetView.swift`). Never two dialogs stacked.
  A FormSheet dialog that opens a picker (currency, date, category, people) never presents a second native modal
  over itself on iOS: either push the picker inside the sheet, or hand
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
- **Save is disabled until valid (§ 26.8), and the reason is always visible** just above the footer
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
- **Every empty state looks the same and is animated with art about that screen** (owners 146, 172, 213): one
  `EmptyState` layout on every screen and state (first-use empty, search with no match, filters with no match,
  all settled, no history, no balances, nothing to settle, no feedback, no invite links, not found, Ask with nothing
  yet): the same structure (animated illustration, one short message, **one** clear call to action that is the next
  useful step, plus at most one lesser secondary button), the same illustration size (168 phone, 200 wider) and top
  spacing; never a bare icon or text only, never a dead end. The `illustration` prop is required by the type.
  Each illustration is original and about its own screen (19 pieces: people, groups, activity, analytics, search,
  filter, settled, history, expenses, balances, settle, feedback, invites, not-found, ask, disputes, payments,
  comments, reminders; an Activity empty state picks the one for its type or filter), light and dark variants, all
  240 x 240, **played once to a resting frame and held** (§ 17), the same frame under reduced motion, lazy: the
  JSON and `lottie-web` are dynamic imports. A test fails on any `EmptyState` without an illustration
  (`architecture/emptyStateArt.test.ts`). *Why:* "make the home empty screen animation like other screens"; "why
  there is no animation here"; "empty screen animations should be there always, and related to those screens
  only, and design/structure should be same"; "proper empty screen and proper cta".
- **Every list has a type filter where items have types; Activity filters by type** (owner 173; F-259, built for Activity, Home's "See all" follows with Home):
  Activity's Filters offer the type (Expenses, Payments, Comments, Groups, Friends and invites, Reminders, Disputes)
  besides All / Me / Others (owner 92), remembered (decision 90) and in the URL (`/activity?type=transactions`).
  Every "See all" of Recent transactions (Home, right column, Group) lands on Activity with the transactions type
  already applied (`/activity?type=transactions`, scoped to the group from a Group page). *Why:* "in activity add
  the filter option to choose the type, like transaction etc; when I click on see all transactions it should land
  here".
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

[Partial] The native splash comes from the `expo-splash-screen` plugin and web shows the launch mark in
`public/index.html`. `StoreProvider` opens the store before rendering the shell. [Built] (F-264, owner 185) the
mark breathes while the store opens, and the launch screen fades out (200 ms) over the first screen:

- **Web:** `#launch` in `index.html` is a fixed overlay beside `#root` (not inside it, so React's first commit does
  not remove it and the fade shifts nothing); its CSS keyframes (scale 1 -> 1.08 -> 1, 1.2 s, ease-in-out, infinite;
  `prefers-reduced-motion` gets a 2.4 s opacity pulse) run from first paint, no script. `markLaunchReady()`
  (`components/LaunchScreen/index.web.tsx`) fades it out and removes it. Dark mode is ALF Dim's background.
- **iOS / Android:** `index.ts` calls `SplashScreen.preventAutoHideAsync()` at import; `components/LaunchScreen` draws
  the same PNG as the splash plugin (200 dp, centred in the whole window, not the safe area, white or Dim by the
  system scheme) and hides the native splash when the image has loaded, then breathes on the UI thread
  (Reanimated `withRepeat`, `useReducedMotion` -> opacity pulse) until `markLaunchReady()`.
- **The ready signal** is `StoreProvider`: the store is open, or a storage notice or an open error says it will not
  be. It is a module call from an effect, so no component re-renders on ready; only the native launch screen
  re-renders once (to unmount after its fade). Fonts are embedded natively / `font-display: swap` on web and
  preferences read synchronously, so they need no wait. No cap is built yet (below).
- Checks: `e2e/launch.spec.ts` (bundle held back by a gate; 390 and 1440, light and dark, reduced motion),
  `src/alf/splash.test.ts`.

Not built (A-020):

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
  header, Profile, Settings, per-row status, web tab title prefix "● 3 unsynced - ") are sinks
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

### 9.8 Local database schema (binding; scalability first)

*Why:* "manage the indexeddb properly, a lot of different data is clubbed into a single table"; "the db level
architecture is very important for scalability". Replaces the v1 layout (one `entities` store holding every
type keyed by `[type, id]`, read with full scans). Target: 10,000+ expenses, 500 people, 100 groups per device
with every hot screen reading by index, never by full scan (§ 17 budgets, F-109).

- **One store / table per entity type** (IndexedDB object stores and SQLite tables share names and columns):
  `people`, `groups`, `group_members`, `expenses`, `expense_parties`, `repayments`, `writeoffs`, `comments`,
  `friend_requests`, `group_requests`, `invite_links`, `feedback`, `preferences`, `reminders`, `disputes`, plus infrastructure `history`, `outbox`,
  `meta`. A new entity type gets its own store and a migration; nothing is "clubbed" into a shared store.
- **Every row** carries `id` (UUID), `version`, `createdAt` / `updatedAt` (UTC ms), `deleted` (+ `deletedAt`,
  `purgedAt`), and for money rows `currency` + amounts as bigint minor units encoded with the codec (§ 9.3);
  an expense also keeps its `date` (LocalDate in the user's timezone).
- **Every row carries its own sync status** `syncStatus`: `local` (on this device only: no account yet, never
  queued), `pending` (queued in the outbox), `syncing` (sent, waiting for the server), `synced` (acknowledged;
  `serverVersion` and `syncedAt` stored), `failed` (refused or conflicted; `syncError` holds the reason and it
  surfaces as "Needs attention", § 9.5). The mutation that writes a row sets it in the same transaction as the
  outbox op; the sync engine moves it forward only on real acknowledgements, never optimistically to `synced`.
  Every store has a `bySyncStatus` index so counts ("3 changes waiting") are index reads. The UI can show it
  per item (expense, repayment, comment, friend request: a small dot/label on detail pages and a subtle marker
  on rows, same colours as the avatar dot of § 26.7, with text for accessibility), and the avatar dot is the
  aggregate of all rows. Outbox ops keep their own status (`queued`, `sending`, `acked`, `failed`) linked to
  the row by `entityType` + `entityId`. *Why:* "every value can have status, whether it's outbox, pending,
  success, synced, whatever".
- **Unsynced data is drawn lighter** (owner 111; replaces the red per-row dot, answers UX audit #9; F-244). Any
  row, card, chip or detail page whose record is not yet `synced` (`local`, `pending`, `syncing`) renders its
  title, amount and meta in the lighter `text_contrast_medium` tokens (never below WCAG AA: 4.5:1 body, 3:1
  large), so synced data reads full strength and unsynced data visibly lighter; the change animates (fade to full
  strength) when the server acknowledges. `failed` keeps full strength plus the "Needs attention" marker (§ 9.5).
  No per-row coloured dot; the avatar dot (§ 26.7) stays the aggregate. Accessibility label adds "Not synced yet".
  Until the backend exists every record is `local`, so the whole app reads in the lighter style, which is the
  honest state. *Why:* "until the data is synced, keep that unsynced data a little light, so we know this is not
  synced".
- **Normalised relations, not arrays inside JSON:** group membership lives in `group_members`
  (`[groupId, personId]`, `joinedAt`, `leftAt`, role); who paid / owes on an expense lives in
  `expense_parties` (`[expenseId, personId]`, `paid`, `share`, `groupId`, `currency`, `date`). The expense row
  keeps the split input for editing; `expense_parties` is its derived, indexed projection.
- **Indexes for every query path** (name them `by<Field>`): people `byName`, `byUpdatedAt`; groups
  `byUpdatedAt`, `byArchived`; group_members `byPerson`; expenses `byGroupDate` `[groupId, date]`, `byDate`,
  `byUpdatedAt`, `byDeleted`; expense_parties `byPersonDate` `[personId, date]`, `byGroupPerson`; repayments and
  writeoffs `byGroup`, `byFrom`, `byTo`, `byDate`; comments `byTarget` `[targetType, targetId]`; disputes `byTarget` `[targetType, targetId]`, `byTargetStatus` `[targetType, targetId, status]` (a record's open ones: the badge, the one-open-per-person rule, the projection) and `byStatus` (every open one: the Disputed filter); friend_requests
  `byStatus`; group_requests `byStatus` and `byGroup` `[groupId, status]` (a group's pending join requests and invited people); history `byEntity` `[type, id]` and `byChangedAt`; outbox `opId` (unique), `byStatus`.
- **Materialised balance projection** `balances` (`[personId, groupId|'', currency]` -> net minor units),
  maintained in the SAME transaction as every money write (expense, repayment, write-off, delete, restore) by
  the sync mutations, so Home, People, Groups and the right column read balances in O(rows shown) instead of
  re-deriving from the whole ledger; a `rebuildProjections()` maintenance routine recomputes it from source rows
  and a test asserts projection == recomputation after random operation sequences.
- **Disputed projections** `disputed_balances` (`[personId, groupId|'', currency]` -> the part of that net that sits on
  records with an open dispute or hold, plus a count) and `disputed_pairs` (`[personId, otherId, groupId|'', currency]`
  -> the same as debts), kept in the SAME transaction as `balances` (F-1210, § 26.20): a dispute opening or closing moves
  its record's disputed part (an item dispute counts only that item's portion), and a disputed record that is edited or
  deleted moves it with the record. They never change `balances`; `rebuildProjections()` rebuilds them and the property test
  compares them with a recomputation after random sequences that raise, answer and delete under disputes.
- **Reads page by cursor** (`[date, id]` or `[updatedAt, id]`) for every list; selectors never `getAll` a money
  store on a hot path (only maintenance, export and tests may).
  A loop that pages a money store from end to end is a full read and is banned the same way.
- **Analytics and Search never load the ledger** (assistant's ruling, 2026-10-27, after the F-117 review).
  Analytics reads the selected period by `byDate` / `byGroupDate` range and reads history-long charts from an
  `aggregates` projection (`[currency, month, groupId|'', categoryId, personId|'', kind]` -> sum and count in minor units; `personId` '' is the whole record, a person id is that person's share, `kind` separates expenses from transfers), kept in
  the same transaction as `balances` and covered by `rebuildProjections()` and the property test. Search reads
  a `search_terms` store, also maintained in the mutation transaction, and resolves a whole query from its keys
  (F-246). Kinds: `w` words of a record's title / note, notes and items, `p` words of a person's name, `k` words of a
  person's contact and UPI id (they list the person, never the person's records), `g` words of a group's name and trip
  place, `a` amount per currency, `m` month, `c` category, `b` / `h` who paid / who is on a record, `G` its group (`-`:
  none), `d` `<date>:<createdAt>` (the list order), `s` `deleted`, `n` a comment's words on the record it hangs on;
  expenses, payments and write-offs carry them, comments contribute `n` only. Each token is a set of record ids from
  key ranges and the sets are intersected. Each token is probed first within a budget of 500 keys: the narrow ones'
  intersection (at most 500 records) is read by id, the broad tokens are checked on those rows in hand, and order,
  count and totals come from the rows. When every token is broad, each section's first page comes from a newest-first
  walk of its store (`byDate`, at most 1,000 rows, given up early when matches are too rare) with every token checked
  on the row in hand (`eachTerm`, the same terms the keys hold), and the count, the totals (ordered from the `d` keys,
  totalled from the `a` keys) and later pages come after it (`whenCounted`, F-266); only the rows shown are read (30
  per page, payments and expenses paged apart). No in-memory ledger mirror.
  Person and group names resolve at query time (to their live ids, then to their records by `h` / `G`; my own name
  never expands, every record is mine), so a rename rewrites no terms. What `search_terms` holds is versioned in
  `meta.searchIndex` (`SEARCH_INDEX_VERSION`, 3); `store.prepareSearch()` runs at idle after the store opens (and the
  first term read waits for it): it rebuilds the terms from the rows when the version is older or the `d` key count
  differs from the record count (a tab of an older build, a rollback), in chunks of 500 rows, one transaction each
  with a yield between; a failure is forgotten so the next read retries, and the search box shows "Try again" (derived
  data only, no schema version spent).
- **One transaction per mutation** spans the entity, its projections, history and outbox (atomic, § 9.3).
- **Versioned migrations:** `meta.schemaVersion`; IndexedDB `onupgradeneeded` and SQLite `PRAGMA user_version`
  run ordered, idempotent steps (v5: the `disputes`, `disputed_balances` and `disputed_pairs` stores; v4 -> v5 adds them empty; v6: the `group_requests` store, v5 -> v6 adds it empty, and a group's `joinPolicy` lives in its data, absent reads as 'approve'); v1 -> v2 copies rows from `entities` into the per-type stores, builds
  `group_members`, `expense_parties` and `balances`, then drops `entities`. Each migration has a test that
  loads a v1 fixture (incl. the large demo set) and checks every row and balance survives exactly.
- **The Store interface stays the boundary** (§ 1): screens and hooks never touch IndexedDB/SQLite directly;
  the per-type layout lives behind `packages/sync` (typed accessors per store + index queries).
- **The server mirrors it:** the Postgres schema (backend batch) uses the same tables, keys and columns so sync is
  row-to-row.

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

[Built] (F-241, F-254) `lib/links/resolve.ts` is the one resolver: `https://<tier host>/<path>`, `splito://<path>`,
a bare path and a notification's URL all give a page, its params (path, tab, list state) and the sheets open over
it; `buildPath` is its inverse. `lib/links/table.ts` lists every in-page tab, sheet and picker (`SHEETS`, a picker
is its sheet's path plus a segment) and the global sheets (Search & Ask as `/search?q=&mode=ask`, the side drawer as
`?drawer=menu`, Send feedback, Add to Home Screen). `navigation/linking.ts` (native) and `linking.web.ts` only
call it; `/notifications` aliases to `/activity`; a bare `/` opens the Home tab preference.

- **A sheet is a `Sheet` marker route on web.** `useDialogControl({url: 'record-payment/currency'})` binds a dialog
  to its address: `control.open()` pushes the marker (Back closes the sheet, Forward reopens it), a marker already in
  the stack (a pasted or refreshed address) opens the dialog over its page, and closing from inside (X, Cancel,
  Save, scrim) removes the marker. `onUrlOpen` lets a host prepare its draft first (Record payment waits for the
  balances; `'wait'` while data loads, `false` when it cannot show it, which takes the address off again). A marker
  belongs to the page route directly under the run of markers (its route key), so a second mounted copy of the same
  page never opens it too, and a dialog with no page of its own, or one the table does not list for its page, opens
  as a plain dialog with no address. The marker keeps the page's params, so the address keeps its tab and filters.
  On a phone there is no address bar and the native sheet has its own dismiss, so a sheet stays dialog state there;
  a link's first sheet is held (`lib/links/pending`) until the dialog of its page has opened, expires, and is dropped
  when the person leaves the page. Until the in-sheet picker hand-over lands (fix/ios-wB) a phone never opens a
  picker from a link, nor anything over a composer (§ 4, one native modal). Prompts, "..." menus and generic dropdowns have no
  URL; sheets that need a target (Remind, Leave group, a payment's peek, Call it even on one transfer) are listed
  with the reason in `lib/links/table.test.ts`.
- **List state is the address, written on Apply or a tap.** `/groups?sort=name&show=owe&currency=EUR&settled=1`,
  `/?show=owesYou&groups=0`, `/people/:id?groups=0`, `/analytics?period=month&offset=-1&currency=EUR&scope=0:g1,g2`, `/activity/me?type=transactions&group=<id>`;
  a param that is present wins over the saved preference (F-1413), an absent one falls back to it. In-page tabs are
  path segments (`/groups/:id/balances`, `/activity/me`, `/activity/others`) and replace the entry instead of pushing, so the page
  is not mounted twice.
- **One resolver** handles https, the custom scheme and notification URLs. Hosts live in one JSON
  (`apps/client/link-hosts.json`) shared with the app config. Invite, QR, reminder, share, Ask and Search links are
  made with `lib/links/make.ts` and opened through `openLink` (`lib/links/open.ts`).
- **Unknown paths open home** and the address bar is rewritten to `/`; the `dead_link` friction is recorded
  (kind only).
- **Deep links resolve from local data first** and push the final screen directly. An entity not yet on
  this device shows loading until the first pull (offline: "Not on this device yet"), never "Not found"; a
  tombstoned or unknown id shows "not found" with `goBack`. A failed read is an error with retry, never the
  empty state.
- **Link params are sanitised** by charset and length before any request (invite and share tokens); one-shot
  keys are dropped once used.
- **Links carry no command:** notification, QR and invite links only navigate; they never settle, delete or
  accept from the link.
- **Sign-in preserves intent (M2):** an invite or claim link opened signed out stores its relative target in
  the device store (`lib/links/intent.ts`), runs sign-in or local-profile creation, then resumes (`LinkHost`).
  [Built, F-250] `isSignInRequired` is `!isSignedIn()`: the signed-out app (`LoggedOutApp`) holds the address (web) or the
  cold-start and later URLs (native) with `holdSignedOutLink` (Home and `/welcome/N` are not held), and `LinkHost` opens
  the held link once the navigator is up (`openLinkWhenReady`) after sign-in.
- **Every incoming URL goes through `openLink`:** on a phone the cold start's and each later URL is held
  (`lib/links/incoming`, `linking.getInitialURL` / `subscribe`) and `LinkHost` opens it; on web the page-load address
  is checked once the mode is known (`checkInitialLink`). Both apply the demo question and the signed-out hold, and a
  dead link records the `dead_link` friction.
- **Demo mode asks first:** a link that names something by id, opened from outside while demo mode is on, asks
  "Switch back to your data?" (`LinkHost`, `lib/links/gate.ts`); a screen's own buttons (Search, Ask) do not ask.
- **Link params are checked per page:** ids are UUIDs or demo ids, only the query keys a page reads survive
  (`QUERY_KEYS`), an offset is a short signed integer clamped to ±1200.
- **Deferred link:** `lib/links/deferred.ts` is a documented stub; the hand-over of a link kept on the web page
  needs the backend (F-254 acceptance 6).
- **Public pages (M2):** `/join/:token`, `/i/<token>`, `/b/<token>` are matched exactly (near-miss tests),
  render outside the app shell, and are served by Fastify with og tags (never amounts or names unless the
  owner chose) and a bounce into the app. Invite flow: preview, Accept, redeem; outcomes accepted /
  declined / already (409) / gone (404/410) / failed, each its own screen.
- **Per-tier host claims:** each build claims only its tier's link host (checked by a release-config
  script); AASA and assetlinks list only app paths (join, group, person), excluding auth callbacks and
  downloads; the web deploy keeps dot-paths.
- **Share:** one share helper takes the entity id plus the screen's summary; screens never call Share APIs
  directly; capability fallback per § 2. [Built] `lib/sharing.ts` is it: `copyText(text, {toast})`, `shareText`, `shareUrl`
  (the Remind sheet, the invite field and comment rows all call these; no other file touches the clipboard).
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

The budgets are owner rules and live in § 26.10 (cold start < 1.5 s, tap feedback < 100 ms, local save
p95 < 100 ms, 60/120 fps, no JS long task > 50 ms). This section holds the engineering rules that meet them.
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
- **No wasted renders** (owner 108). [Built] (F-242, web; native dev builds load the same library and log to the
  console, with no automated native run yet.) A component re-renders only when what it draws changed. Dev builds only
  load `@welldone-software/why-did-you-render` **10.0.1** (pinned; peer `react ^19`; checked on React 19.3 and the
  React Compiler: it sees compiled and plain components alike because `babel.config.js` sends the dev JSX runtime
  through the library, with `include: [/.*/]` and hook tracking). `index.ts` / `index.web.ts` run
  `if (__DEV__) require('#/lib/whyDidYouRender')`; Metro folds it out of every production and `expo export` bundle
  (`e2e/bundle.spec.ts` checks the e2e export, `e2e-pwa/bundle.spec.ts` the production `build-web` output, which also holds
  no `package.json`: the version is inlined from `app.config.ts`). Each report is kept compactly on `window.__wdyr`
  (the gate reads it there); the console log is opt-in with `EXPO_PUBLIC_WDYR_LOG=1`. The library applies its "values really changed" filter only in its own console notifier, so
  `whyDidYouRender.ts` applies it too. Typical causes, fixed at the root: new objects/arrays/closures passed as props
  each render, unstable context values, a state setter given a new object for an equal value, a store hook returning
  a new snapshot for an equal answer (§ 9.6), list rows not memoised, selectors not narrow enough, **and a component
  the React Compiler skips** (a computed key in a destructuring pattern, a `try`/`catch` around a conditional, a
  function used before its declaration): it re-renders every child on every state change, which no report shows and
  only the render counts do.
- **Render gate:** `pnpm --filter @splito/client renders` runs `e2e-renders/renders.spec.ts` against the Metro dev
  server (own port 8191, `EXPO_PUBLIC_ENV=e2e` for the demo hook; not `expo export --dev`, whose async chunks
  `demoMode` / `DemoMode` overwrite each other on a case-insensitive disk). One scenario: demo switched on, a cold
  launch to Home, a tab round, open Add expense, type 10 characters, close it, scroll 1,000 rows of Activity, open
  Search & Ask and ask one question. Per phase it counts renders of components being shown (`mounts`) and of mounted
  ones (`updates`), per component. It also fails when it saw nothing: fewer than 1,000 rows scrolled, no report at all
  (the library or its JSX runtime is off), or a phase under half its baseline. It fails on (1) any wasted-render report whose origin is our code and that
  `e2e-renders/baseline.json` does not hold (reports that start inside react-native-web, react-native-svg, lucide,
  radix, react-navigation or VirtualizedList are counted, not failed: the list is in the spec), and (2) a phase or
  component count above the baseline by more than 10 % + 1. `RENDERS_BASELINE=write` records an improvement or a
  reviewed increase; numbers go in `docs/COMPLETION_MATRIX.md`. Every merge runs it with the perf spec (decision 107
  gate; merge-gate notes in the matrix).
- **Dev-only tools never ship:** the release script refuses to build with any `EXPO_PUBLIC_` debug,
  profiler or override variable set.


### 17.1 Performance rules learned (self-updating, owner 191)

Each rule came from a measurement; the dated story is in § 23. Newest first within each group.

- **A keystroke renders the list it filters, not the screen; a search swaps rows without their fades; a closed row menu
  is not mounted; the next page is built as a transition.** (1) The query state lives in the component that renders the
  list (`screens/People/components/FriendsList.tsx`), the rows follow it as `useDeferredValue`, and what the screen
  derives from its projections is memoised on them (the React Compiler had left the People screen's whole
  summary-and-rows chain unmemoised: read the compiled output before trusting it), so each row keeps its object and a
  memoised row (`PersonRow`, `RequestsSection`) skips; anything the screen hands the list's heading (the Overview) is
  built by the screen, so a key reuses it; a hook that follows focus (`useIsFocused`, the tour's `usePublishPeopleState`)
  sits in a leaf, or every tab switch re-renders the screen and, with unmemoised rows, all of them (38 rows a switch on
  base, owner 166). (2) Narrowing or widening a list by search is not a change to explain (owner
  213): `useQuietRows()` (`motion/listAnimations.tsx`) makes the rows a query change removes or adds skip Reanimated's
  exit and enter (on web each exit cloned the row and read `scrollTop` on every node of it); the handler calls
  `hush(query)`, the list `settle(query)` once it shows that query, and a settle for an older query is ignored (a commit's
  effects can run after the next key's handler). (3) A row's "..." is a plain button until a mouse is over the row, the
  keyboard is inside it, or it is tapped: Radix's dropdown root, trigger, popper and the phone drawer were about 40 of an
  Activity row's 130 component renders, plus a second render of the popper chain after mount. (4) `usePagedRows` adds a
  page inside `startTransition`, so its render yields; growing a page six rows per commit cut the longest task further
  (53-86 ms) but each step waited on a commit, an effect and the list's resize and intersection observers, so reading a
  year back fell behind the specs' wheel loop: rejected. Measured 2026-10-31 (Chromium, 390 px, touch, large demo, 42
  friends, CPU x6, three interleaved runs per build, load 2-10): People search, 16 keys: 211 -> 59-66 React renders a
  key, 83 -> 2-4 row re-renders, 46 -> 0 exit clones, worst key-to-echo median 987 -> 98 ms, longest task median 536 ->
  69 ms; Activity first fling (27 rows added): 3,475 -> 2,475 renders, worst frame median 773 -> 154 ms, longest task
  median 721 -> 170 ms (still over 50: the page's one commit; cheaper rows are next). `perf/listWork.spec.ts` gates the
  counts, which hold at any load.
- **A summary beside a list reads what the list already computed; it never subscribes and derives again.** The People
  Overview (owner 219) subscribed to every person and every balance row itself and ran `personSummary` twice per
  commit, beside a list that had just done the same: turning demo mode on (about 1,500 commits while People shows) went
  from about 13.1 s without the Overview to 18.8 s with it (Chromium, alone, load 4-6). It now takes the list's
  `friends` (each with the summary People computed under its Include groups choice) and only sums them
  (`balanceTotals`): 12.1-12.8 s over three runs. The sync layer was ruled out first (bun, the large demo: SQLite
  1.0-1.2 s, fake IndexedDB 7.0-7.3 s on `main`, before and after the search change alike).
- **An animated row measures nothing while it mounts or updates; its exit reads the box when it starts.** Reanimated
  4.7.1 on web called `saveSnapshot` (`getBoundingClientRect` plus every ancestor's `scrollTop`) in `componentDidMount`
  and `componentDidUpdate` of every component with an `exiting` prop, so each list row forced a style and layout pass
  as it mounted and on every re-render (c-perf counted 191 forced reads opening Friends and invites, one per row per
  keystroke in a list search). `patches/react-native-reanimated@4.7.1.patch` drops both calls and reads the box at the
  top of `handleExitingAnimation`, while the element still holds its children: c-perf's first cut leaned on
  `getSnapshotForElement`'s fallback, which runs after the children have moved into the clone, so the clone was sized
  from an emptied element. `e2e/animations.spec.ts` fails if opening a page measures its rows again, if a leaving page
  clones a row, if a filtered-out row stops fading out, or if an exit clone is smaller than its row.
- **Nothing that leaves runs its rows' exit animations on web: pages, sheets, popups and composers.** Reanimated's
  `LayoutAnimationConfig skipExiting` is a no-op on web (`JSReanimated.setShouldAnimateExitingForTag`), so the lists'
  wrappers never stopped it there. The exit scope (`useScreenExitScope`, `motion/listAnimations.tsx`) is taken in `Layout.Screen` and
  `OpenedProvider` and makes the shared exit config read "reduce motion" once its scope unmounts (a parent's
  layout-effect cleanup runs before its children's `componentWillUnmount`); a row a filter or delete takes off a list
  that stays still fades out. Rows read `exiting` through `useListAnimations()` / `AnimatedListRow`, inside the scope.
  It is a hook plus a bare context provider, not a wrapper component: c-perf's `<ScreenExitScope>` re-rendered with
  every screen render (the renders gate counted 6 to 11 more updates per phase). Measured 2026-10-31 (Chromium, 390 px,
  touch, large demo, median of three, load under 4.5): popping Person cloned 60 rows (124 ms at 1x, 1,046 ms at 6x),
  Group 20 and Friends and invites 106 (264 ms at 1x, 2,077 ms at 6x); now none, and those Backs take 40, 37 and 38 ms
  at 1x, 279, 171 and 209 ms at 6x.
- **A row reads nothing per row that is the same for every row.** The device locale (`deviceLocale()`, not
  expo-localization's `getLocales()`, which builds `Intl` objects per call on web), breakpoints (one shared
  `matchMedia` list per width, not `react-responsive`'s per-call query and listener) and a friend's balance summary
  (`usePersonSummary`, one `personSummary` per balance snapshot, not one per row over every balance row) are read once
  and shared. A shared answer is kept by its listener and read as a plain value in render: the first port read
  `MediaQueryList.matches` in `useSyncExternalStore`'s snapshot, which the browser may answer by bringing style up to
  date in the middle of a render (an Analytics revisit at x6 read 439-484 ms against a base of 356-488; with the cached
  answer 421-444, inside the base's range).
- **Long writes run behind progress, never a cover, and a write batch writes each rewritten row once.** The demo seed's
  main thread is mostly idle (IndexedDB works in another process); what blocked the app was the full-screen cover.
  Seeding shows a pill and the app stays usable; only the store swap covers it, and only the cover may drop a dirty
  sheet without asking (`useIsStoreCovered`). `txRows` holds the rows a batch rewrites (projection sums, people and
  group activity times) and writes them once; every other store writes through at once so IndexedDB works while
  JavaScript runs (holding every store made the seed slower).
- **Measure Chrome with its accessibility tree off, and name the surface a probe waits for.** Playwright's CDP session
  turns Chrome's accessibility on and every commit then rebuilds the tree (about a third of a tab revisit at 6x); the
  sweep sends `Accessibility.disable` before each measured step, at every CPU rate. "A dialog is on screen" was true at
  once for a picker over its sheet: the probe watches the topmost dialog and waits for one that was not there when it
  armed.

- **A gesture moves DOM nodes, not React state, never trusts a touchend to arrive, and costs nothing when idle.**
  Phone-web pull to refresh (F-258) writes a transform and the spinner straight to the list's nodes; a pull renders
  nothing, the header never moves (only the list's content is translated), and the transform is removed at rest so no
  `position: fixed` child keeps a containing block. There is no wrapper element: `usePullToRefresh` hands the list a
  ref and a memoised indicator, so a list that redraws does not redraw the pull (the first version wrapped the list
  and added 14 updates per scroll round to the renders gate). The cancelling (non-passive) `touchmove` listener is on
  only while the window is at the top (a passive scroll listener toggles it) and `overscroll-behavior-y: contain` is
  set only for the touch that may pull. Every single-finger `touchstart` ends any gesture still on record, because a
  touch whose element left the page before the finger lifted never delivers `touchend` to the window (a row deleted
  under the finger, a menu that closed): one such touch had stopped pull to refresh everywhere until a reload. Measured
  at 390 px in Chromium with real CDP touches: no long task over 50 ms; WebKit has no long task API, so the spec also
  reports the worst frame gap.

- **Specs and render baselines that depend on "now" run on a pinned clock (`e2e/pinClock.ts`), and the gate counts
  only what is deterministic.** The demo's change times and "recently active" are relative to now: homeTabs "Overview
  scope" passed on 30 Oct and failed from midnight (pinned to 28 or 29 Oct it fails the same way; pinned to noon on
  30 Oct it passes). The renders gate also drew about 1,900 or about 3,400 tab updates, run to run, because the first
  visit of a tab lets the large demo's history loading and the Analytics report land inside whichever phase is
  running. The gate pins `Date` (an offset applied at each page load: Playwright's `setFixedTime` freezes it and the
  app never reaches Home), prints the first-visit round
  as `FIRSTVISIT` without gating it, and gates the second round, where every tab is mounted and parked
  (69 mounts + 468 updates in 4 of 4 runs). Median of three, taken on a quiet machine, as below.

- **Every person target adds components to every row that draws one, so make each one the cheapest it can be.** `PersonLink`
  (F-261) puts a `Link` and a `Pressable` behind each avatar and name: the renders gate's scroll phase (1,000 Activity
  rows) mounts about 360 more of each (`Pressable` 2,218 -> about 2,950), the Ask phase 19. It subscribes to nothing (the
  ids and names come down as props; "is this me" is one context read, `state/me.ts`, never a store hook), an avatar-only link
  (about 95 % of them) holds no state and no hover handlers (only a link that shows the name tracks hover and focus for its
  underline), it grows to a 44 px target with padding and an equal negative margin (no wrapper, no layout change), and it is
  memoised. Where a whole row already opens the person (People rows, Members) the avatar and name use `isInsideLink` and mount
  no extra `Link`. A row of bars nobody selects is a `View`, never a disabled `Pressable` (a disabled ancestor disables a link
  inside it: the Ask ranking avatar was unclickable). Measured, Activity scroll of the large demo at 6x CPU, 60 wheel steps,
  with and without the actor-avatar links: 53 and 54 long tasks over 50 ms (total 10.3 s and 9.3 s) against 42 and 46 (9.2 s and
  10.5 s) without; largest 835 and 592 ms against 728 and 963 ms; machine load 37-57, so read it as "no clear difference in time,
  a few more tasks", not as a budget pass. The same over-50 ms tasks occur with no links at all (row mounts dominate), so a
  lighter non-Pressable anchor was not built; revisit it when the Activity row mount itself is cut. The new mounts are the
  feature's cost, recorded once in the renders baseline; no wasted render was added.
- **A query is answered from index keys, never by walking rows; and a narrow answer never reads the whole ledger's
  keys either.** Search first ran broad queries (`> 1000`, a common prefix) by reading the ledger newest first in chunks
  of 200 and checking every row (10,000 expenses: about 10 us per row of SQL, JSON decode and word checks, 0.1 s and
  growing). Keys cost about 0.2-1 us a row, so each token became a set of ids from term ranges (`h` for who, `G` for a
  group, `d` for the date order, `a` for amount ranges and totals) and the sets are intersected. But the first cut then
  ordered and totalled every answer by reading all `d`, `a` and `s` keys, so one match still cost 21,201 keys at 10,000
  expenses + 600 payments, a balance status 45,000 keys, and IndexedDB 50-130 ms of CPU per query (F-246 review I1).
  Now: an answer of at most 500 records is read by id and ordered, totalled and status-checked from those rows (500
  rows cost about what 3,500 keys do, whatever the ledger's size); only a broad answer reads the `d` and `a` ranges; a
  balance status (settled, owed, owe, inactive, hidden) on a narrow answer is checked on the rows instead of listing
  every record in it. Rules: a new searchable field is a term kind, a facet is a key range, a screen never checks rows
  one by one to answer "how many" or "how much" over a broad set, and the cost of a query is bounded by its answer or,
  for a broad answer, by its keys (its first page by at most 1,000 walked rows, next rule). Checked by `searchOracle.test.ts` (random changes on both engines; the keys equal
  the rows' terms, every query equals a row-by-row reference, narrow and broad both exercised). Measure it as the
  drawer waits for it (`openSearch` to the first pages, then `whenCounted` to the counts and totals), not as the whole
  ledger read out.
- **Search stays under 50 ms at 10,000 expenses, on both engines** (`search.test.ts` speed: SQLite at 5,000 and
  10,000, IndexedDB at 10,000, each with 600 payments, 33 queries including balance statuses and broad ORs; median of
  three at load under 10), to the first pages and again from there to the counts and totals. Numbers in `docs/COMPLETION_MATRIX.md` (F-246).
- **A tab switch reads no data and draws only the bar and the navigator; what is left is the browser's and
  react-navigation's.** Counted 2026-10-31 (Chromium, 390 px, touch, large demo, load under 2): 0 IndexedDB
  transactions per switch between visited tabs (90 during load); renders: the bar and the navigator shell only.
  At CPU x1 a switch shows its screen in 31-52 ms (first visits 27-56 ms, Activity's once 142 ms) and lights the tab
  in 11-24 ms; at x4 first visits take 63-217 ms. `propagateParentContextChanges` walks the kept screens on each
  switch; one cause was react-navigation's web `SceneView` handing a new `headerBack` object to `HeaderBackContext`
  on every focus change (patched, `patches/@react-navigation__native-stack@7.21.0.patch`, test
  `navigation/nativeStackPatch.test.ts`), but most of the walk is the navigation state context itself (182 -> 162 ms
  over 6 switches at x6). So a delay felt on iPhone Safari that Chromium does not show is to be measured in WebKit
  (the iOS simulator's Safari) before anything more is changed on this path.
- **A kept tab's size is paid on every switch to it, so a tab draws only what is on screen.** Showing a parked tab
  again re-lays out and restyles its whole tree: Analytics drew all 200 report rows the data layer read (about 4,700
  layout objects), so a switch to it cost 540-930 ms at CPU x6 (one 187 ms layout of 5,878 objects, 428 ms of style).
  Drawing a page at a time (`usePagedRows`, from c-perf) cut it to 209-466 ms (1,960 objects, longest task 727 -> 345
  ms). Measured 2026-10-31 in Chromium at 390 px, touch, the large demo, rapid taps between visited tabs (scratch
  spec, load under 4). The other tabs (600-1,250 objects) take 165-400 ms at x6: about 150 ms style, layout and paint,
  65 ms the navigation commit in the bar's animation frame, 60-90 ms touch handling; React re-renders only the bar
  and the navigator shell (the renders gate's "switching back" legs), but `propagateParentContextChanges` still walks
  the shown and hidden screens' trees (about 30 ms at x6). Every tap landed on the last tab tapped.
- **A cache read during render is re-synced in the effect when the cache filled between render and effect.** Two
  empty states of the same art: the second rendered while the chunk loaded, the first's import filled the module cache
  before the second's effect ran, and the second returned early, keeping the `undefined` it read and staying blank (the
  React Compiler caches the read). The effect takes the cached value (`useIllustrationSource`).
- **Draw and tick icons animate on the event they confirm, never on mount in list rows.** A drawn check on every
  Accept button re-drew as each Activity row scrolled into view (three worklet hooks and a motion subscription per
  row, decoration owner 213 rules out); the drawn check is for a confirmed result (Save), and a tab pops only when it
  becomes active, not when it is left.
- **Narrow first, and a query with nothing narrow gets its first page from a walk, its count and totals after.**
  Every token is probed within a budget of 500 keys (each read capped to what is left, one read at a time, so a broad
  token costs its budget, never its set). The narrow ones' intersection is read by id and the broad tokens are checked
  on those rows in hand; when every token is broad, each section's first page comes from a newest-first walk of its
  store (`byDate`, chunks of 60 doubling to 480, at most 1,000 rows) checking every token on the row in hand, and only
  then, after the page is painted, the full key sets give the count, the totals and the later pages (`whenCounted`). A
  row check is the keys' own answer: `eachTerm` hands the walk the same terms `termRows` stores, and every token kind
  has a row test (`testOf`) beside its key read (`resolve`). Three rules came from measuring it: (1) a row costs 15-25
  keys (SQLite page read plus terms, bun), so the walk gives up after 180 rows when its matches would not fill a page
  within the bound (rows of one day come in id order and bunch the matches, so never sooner), and a section whose
  store fits in the bound is walked to its end and answered exactly; (2) a day is certain only once every row of it
  is read, so the walk stops at a date boundary (119 records a day in the bulk ledger: 180 rows for "> 90"); (3) the
  count's reads hold the main thread, so the drawer starts them a frame after the first page (`useSearch`): started at
  once, "> 90" drew its first page in 505 ms instead of 142 ms. Counted in bun on the bulk ledger (10,000 expenses,
  60 friends): to the first page "> 90" 30,004 keys + 30 rows -> 505 keys + 180 rows, "Bulk Friend 4" 69,345 keys +
  245 rows -> 1,985 keys + 635 rows, "bulk" 49,812 keys -> 645 keys + 324 rows; "Bulk expense 9993" (narrow) 651
  keys + 74 rows both. Chromium, 10,000 expenses, median of five, two rounds each at load 27-37 (indicative only):
  first page "> 90" 1,256 / 1,005 -> 282 / 141 ms, "Bulk Friend 4" 2,751 / 2,084 -> 338 / 289 ms, "Bulk expense
  9993" 178 / 176 -> 123 / 90 ms; the totals arrive later than before ("> 90" 1,256 / 1,005 -> 1,754 / 823 ms, "Bulk
  Friend 4" 3,036 / 2,174 -> 3,748 / 2,580 ms) because they now follow the walk and a frame. Search speed is judged in
  the browser (`perf/schema-v2.spec.ts`); bun's IndexedDB numbers are `fake-indexeddb`'s.
- **Derived data that may be rebuilt is rebuilt at idle, in chunks, and a failure is forgotten.** The search index
  rebuild first ran inside the first search (during the first keystrokes) as one transaction, and a rejected rebuild
  was kept as a rejected promise, so search spun forever. Start such work at idle after open, run it in chunks of a
  few hundred rows with a yield between (10,600 records on IndexedDB: the timer ran between chunks), drop the cached
  promise on failure, and show an error state with Try again instead of a spinner.
- **An animated icon swaps and pops; it never keeps two glyphs mounted.** Cross-fading an outline and a filled glyph doubled the
  icons on every tab bar, sidebar and drawer (tab-round updates 468 -> 624, one new wasted-render report); one glyph in use plus a
  180 ms scale-and-opacity pop on change gives 500, recorded in `e2e-renders/baseline.json` with its reasons in `docs/COMPLETION_MATRIX.md`.

- **Load animation assets and their player on first use, and read a module-level cache through state.** The
  start-up bundle held `lottie-web` (168 KB) and, through `require()` in a registry object, every animation JSON
  (inline requires do not help when the registry object is built at import); each is now a dynamic `import()`
  behind `useIllustrationSource`, so the web first-load JS fell from 7,305,880 B to 7,021,333 B (gzip 1,545,216 to
  1,495,320 B) while 19 new pieces of art (with loading and success, about 415 KB raw in 53 lazy chunks) were added. Measure the entry
  chunks of `expo export` (the `index`, `__common` and runtime scripts in `index.html`) before and after, never the
  folder total. A hook that reads a module-level `Map` during render must also hold what it read in state: the
  React Compiler caches a bare `loaded.get(key)` on `key` alone, so the art never appeared after its chunk
  arrived.

- **A window that grows must keep what it read, and a render baseline is recorded as the median of three runs.**
  Activity's tracker rebuilt the whole history for every page a narrowed list read (10,000 expenses: 23.6 s, then
  72 ms per new expense); it now keeps its pool, cursor and sorted events and merges each page in (0.35 s SQLite /
  1.2 s IndexedDB, 8 / 13 ms per later change; `activityScale.test`). Bound any automatic search in the screen
  (about ten pages) and let the person ask for more. The renders baseline (`RENDERS_BASELINE=write`) is the median of
  three runs taken after the demo data has loaded and on a quiet machine, never the larger of two files and never a
  single low sample: one sample read 4,178 tab updates against 4,418 and made the next run fail on noise.

- **Measure on the slowest target, on a quiet machine.** Desktop Chrome at 1x hid a 600 ms tab switch that an
  iPhone felt as 2 s; measure in WebKit (iPhone simulator Safari or Playwright WebKit) and Chrome at 6x CPU, and
  only at machine load under 10 (at load 25-130 the same test read 2-5x slower and timing tests failed). Name
  the pair you measured: Groups -> Home was 54 ms while Analytics -> Home was 5.9 s.
- **The cost of a switch is often the screen you leave, not the one you open.** Popping a list screen ran a
  Reanimated exit animation per row (a forced layout each), 617 ms at 1x and 5.9 s at 6x. Leaving screens must
  not run row exit animations; main tabs stay mounted (parked) instead of being torn down (owner 166).
- **Freezing tricks that break WebKit or Reanimated are out.** `react-freeze` / `freezeOnBlur` on web runs
  class `componentWillUnmount` and brought the exit animations back (Analytics revisit 500 ms);
  `content-visibility: hidden` on kept screens was fast in Chrome and showed a blank page in Safari.
- **Feedback first, work a frame later.** The tab highlight paints in the press-in commit and the page switches
  a frame later; the bar acts on press-in, not on click (which came ~45 ms after pointerdown, plus Safari's
  double-tap wait without `touch-action: manipulation`).
- **Open first, render after, on the real end of the motion.** Heavy bodies mount when the sheet, drawer, popup
  or screen has finished moving (OpenedContext), not after two frames: before, the drawer menu mounted while the
  panel was still 310 px off screen. Every opened signal has a timer fallback, so content never waits forever.
- **A parked or cached screen never reuses a stand-in render.** The screen cache's placeholder (`<View />`)
  must not be stored as the live descriptor, or a revived tab comes back blank for good.
- **Hot write paths read nothing they can prove empty.** One indexed dispute read per money write cost ~40 % of
  the demo seed (about 1,500 creations); a created record cannot have a dispute, so creations skip it.
- **Growing a window keeps what it read.** A narrowed Activity list that rebuilt from zero five pages at a time
  read the whole history (10,000 expenses: 20 rebuilds, 23.6 s, then 72 ms per new expense); windows grow
  incrementally, automatic searching is bounded (about 10 pages, then "Look further back").
- **Membership checks use a Set.** `read.includes(id)` per event made Mark all read and every rebuild
  O(events x read); a persisted list of ids is read into a Set once.
- **The renders baseline is a median, taken after the data has loaded.** Recording the highest of three noisy
  runs (tabs updates 1,916-3,440) let a doubling pass; the gate waits for an explicit "demo loaded" signal
  before a phase and records the median of three.
- **Guards match only what they guard.** A build check that matched `demo-large-` in the start-up bundle failed
  every Render build silently (§ 23); the Render deploy is checked after every merge, and "no new deploy" counts
  as a failure.
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
  horizontal overflow; geometry checks for § 26 rules (title centred, at most one right action, footer
  pinned); screenshots to a gitignored `apps/client/qa/<feature>/`. A stale selector is fixed in the spec,
  never by reverting UI. Release e2e runs on `expo export -p web` output.
- **Every wait is bounded** (Playwright and bun): a timeout fails the test.
- **e2e specs reuse the shared helpers (owner 210, F-274)**: `e2e/app.ts` `openApp` (load and wait for `window.splito`),
  `e2e/viewports.ts` (`PHONE` 390, `DESKTOP` 1440, `LAPTOP`, `SIZES`; no spec defines its own), `e2e/seed.ts`
  (`seedGroup`, `seedA04`, `BASE`), `e2e/activity.ts` (`activityScreen`, `activityRows`, `activityKinds`),
  `e2e/composer.ts` (`composeButton`, `openAddExpense`, `pickPeople`), `e2e/openDemo.ts` (`openDemo`, `setPref`),
  `e2e/pinClock.ts` (the one way to pin "now") and the `SplitoDevTools` type from `data/devTools.ts` instead of a
  local `type Splito`. A client unit test that needs SQLite uses `bunExecutor` from `@splito/sync/testing`.
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
| Filters drawer applies each choice at once | Apply button (§ 26.12); keep the active dot and options from loaded data | Owner rule |
| Account control top right, drawer title centred, stacked dialog buttons, tapping the current tab does nothing | § 26.4, § 26.8; re-tap scrolls to top | Owner rules, Bluesky |
| Save always pressable, errors under fields | Save disabled until valid (§ 26.8), reason always visible | Owner rule; GameRun's lesson kept |
| Hidden features commented out on screens | One flag predicate, entry point hidden | Commented code drifts past lint, types and tests |
| Latest unsent commit replaces the queued one | Financial ops never coalesce | Each is history others see |
| Bad stored values clamped on read | Money never clamped; malformed rows quarantined | Money rules |
| Another person's data never persisted | Member ledgers persisted; non-member data in memory only | Offline-first |
| RN Animated native driver for tap motion | Reanimated (§ 26.10) | Owner rule, Bluesky |
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

- 2026-10-31, process: **a builder's process cleanup killed the merge gate's test server**, and the 2.4 h full e2e run
  on combined main came back as 647 connection-refused failures. Rules: nobody runs `pkill`/`killall` by name or
  pattern (serve, node, playwright, expo); a process is stopped by its own PID or by its own port
  (`lsof -ti tcp:<port> | xargs kill`); the orchestrator's merge gate serves its build from a copy outside the repo
  on a reserved port with its own server, so no builder's cleanup can reach it; a run whose failures are mostly
  ERR_CONNECTION_REFUSED is a broken run, not a red build.
- 2026-10-30, process: **almost every builder took hours, mostly waiting on each other.** Six to seven builders
  shared one machine (load 25-130); each ran the full 500+ test e2e itself, several times per round, so every run
  took 20-30 min instead of ~10, timing tests failed under load and were re-run, and long-lived overlapping
  branches (Home, taps, Activity, disputes) forced repeated merges of main and conflict rounds; scope added
  mid-round and a network outage added more. Rules: a builder runs only the specs its change touches (plus lint,
  typecheck, unit tests and the renders gate) and the orchestrator runs the full e2e once per merge, on the merged
  main; builders fan out as wide as the independent work allows (owner 208, 2026-10-31: "fanout more to get things
  done", replacing "at most three builders"), split so no two edit the same files; slices are small and merge the same day, in dependency order, so
  nothing builds on a moving target; perf numbers are taken only at load under 10.
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

- 2026-10-29, iOS QA: a native bottom sheet presented from the root view controller fails ("already presenting RNSScreen") when a route sheet (Add expense) is up, so its Discard prompt and every picker never opened. `modules/bottom-sheet/ios/SheetView.swift` now presents from the top-most presented controller (Bluesky's composer is an RN `Modal`, which never met this). Sheets mounted outside the shell's `BottomSheetProvider` (RemindHost) get the context default `{}` as their portal and crash ("Element type is invalid ... BottomSheetNativeComponent"): `App.tsx` gives RemindHost its own provider and outlet. UIKit also asks `onAttemptDismiss` before a clean sheet is dismissed, so only a dirty `FormSheet` may open Discard.
- 2026-10-29, iOS QA: inside a transaction `data/store.ts` runs statements through expo-sqlite's synchronous API with prepared statements; seeding demo mode went from 5.5 s to 2.0 s on the simulator debug build (38,000 statements, each async hop ~0.14 ms).
- 2026-10-29, fix/web-scroll: **mobile Safari scrolled to a blank page.** `react-native-safe-area-context` 5.10.1's
  web provider reports its rect in viewport coordinates, so on a page whose window scrolls (ours) the top inset
  became the scroll offset whenever it re-measured; Safari fires `resize` as its toolbar collapses mid-scroll,
  `Layout.Screen` took that as `paddingTop` (measured 2,500 px) and the whole screen sat below the viewport.
  Fixed by `patches/react-native-safe-area-context@5.10.1.patch` (insets from the window's `env()` only, as in
  5.6; remove the patch once upstream measures in document coordinates). Test: `e2e/scrollWeb.spec.ts` dispatches
  the same `resize` while scrolled and fails without the patch (3,029 px displacement). Chromium never shows it
  (no toolbar), so check scroll fixes in real Mobile Safari, not only Playwright.
- 2026-10-30, fix/ios-wB: **a sheet over a route sheet never opened on iOS** ("Attempt to present ... which is
  already presenting RNSScreen"): the native bottom sheet presented from the root view controller, which was
  already presenting the Add expense form-sheet route, so Discard and every composer picker silently failed and
  a dirty sheet could not close. Fix: `modules/bottom-sheet/ios/SheetView.swift` presents from the top-most
  presented controller (retry when that one is being dismissed; `viewDidDisappear` reports a sheet torn down with
  its route). Rule: § 4 allows one dialog over a route sheet, never two. Check sheets on the iOS simulator.
- 2026-10-30, fix/ios-wB: **a sheet host outside the Shell crashed** ("Element type is invalid ...
  BottomSheetNativeComponent"): `RemindHost` sat outside the shell's `BottomSheetProvider`, so its portal was the
  context default `{}`. Any sheet host mounted outside the Shell gets its own `BottomSheetPortalProvider`.
- 2026-10-30, fix/ios-wB: **tab links from pushed screens did nothing on native.** Tabs are nested in the
  root-stack `Tabs` route and React Navigation 7 doesn't send NAVIGATE into a child navigator, so a link to a tab
  navigates `('Tabs', {screen, params})` on native and `(screen, params)` on web (`linkNavigation()`), with an
  exhaustive tab list (`satisfies Record<keyof TabParams, 1>`).
- 2026-10-30, fix/ios-wB: **SQLite seeding was 38,000 async hops.** Inside a transaction the native store runs
  statements through expo-sqlite's synchronous API with cached prepared statements (seed 5.5 -> 2 s), yielding to
  the event loop every ~500 statements so a bulk transaction is not one long JS task; atomicity unchanged.
- 2026-10-30, fix/tab-taps: **`useDedupe(250)` on tab presses swallowed fast taps** (and per-Link dedupe made A, B,
  A land on B). Idempotent navigation (switching tab, `navigate` with `pop`, `popToTop`) is never deduped; only
  pushes keep a dedupe (owner 150).
- 2026-10-30, fix/tab-taps review: **deferring rendering has a contract** (owners 151/152): `useDeferredReady`
  returns `afterFrame && flag && deferred` (it must not lag when data disappears) and `<Deferred>` shows its
  fallback whenever data is missing (an empty slot only when data was there at mount); a pushed page renders its
  header at once and defers only heavy rows, never skeleton-flashing data it already has; `FormSheet.SheetBody`
  defers only heavy bodies (the composer, long pickers, big filter sheets), never small dialogs (owner 129), so
  nothing jumps from a stand-in height.
- 2026-10-30, fix/tab-taps review: **a page wider than the phone moves the fixed bottom bar off screen.** If the
  document overflows sideways, mobile browsers widen the layout viewport and the fixed bar slips below the fold for
  a frame, so a fast tap hits the screen behind (found: the Analytics loading skeleton had three fixed 120 px
  columns, 417 px wide at 390 px). No element, skeletons included, may be wider than the viewport: size columns with
  flex, not fixed widths; `tabTaps.spec` "no tab widens the page" and the § 19 horizontal-overflow check guard it.
  Do NOT put `overflow-x: clip` on `html`/`body`: it stops the window from scrolling (`scrollWeb.spec` measured 0 px).
- 2026-10-30, F-241 merge: **the renders gate baseline is re-recorded with reasons whenever a reviewed change adds
  renders** (`RENDERS_BASELINE=write`, every increase and its cause listed in `docs/COMPLETION_MATRIX.md`), never
  silently; a merge that leaves the gate red on `main` is not done.
- 2026-10-30, fix/ios-wB: **a guard that throws at mount crashes the native app at launch.** The "sheet needs a
  provider" check first ran for every Dialog, including closed ones, and took the app down on iOS. Checks that
  depend on context a closed dialog doesn't need run when the sheet opens, never at mount (§ 4: a closed dialog
  renders and reads nothing).
- 2026-10-30, F-250 (feat/wC-F249-F250-auth): **Metro's inline requires make module-level side effects lazy.**
  `state/session.ts` sets the account's device-key scope when it is first evaluated, which with inlined requires is
  the first call of `useSession()`, i.e. after the theme had already read its first-frame accent from the unscoped
  key (the accent was lost on every reload). `Themed` now calls `useSession()` before anything reads device storage.
  Anything a module must do before the first render is a call made from `App`, not an import side effect.
- 2026-10-30, F-250: **the signed-out app cannot use the store**, so shared primitives must not assume it:
  `useShouldReduceMotion` (animations, `ScreenTransition`, `PressableScale`) reads `useMaybeStore()` and falls back to
  the OS setting, and the language dropdown has a device twin. Check any component reused on the Continue flow with no
  `StoreProvider` above it (the logged-out e2e fails with "useData outside StoreProvider").
- 2026-10-30, F-250: a prompt opened from inside the web drawer is drawn under the drawer's scrim (clicks hit the scrim),
  and closing the drawer unmounts the prompt with it: dialogs that several places open (Log out?) are mounted once in the
  app (`LogOutHost`, `requestLogOut()`).
- 2026-10-30, F-250 review: **an erase that races the close can silently fail.** Deleting an IndexedDB database while a
  connection is still open blocks forever (and a native file delete throws); a log out that deletes right after unmounting
  the provider depended on timing. The close now announces itself (`expectStoreClosed`), the delete retries and a failure is
  shown. Likewise `Linking.getInitialURL()` answers the launch URL every time, so a log out and in replayed it: read it once.
- 2026-10-30, F-250 review: **a build guard keyed on one env var has holes.** `EXPO_PUBLIC_ENV` unset, a tier without it, an
  e2e build on a prod tier: each skipped the first guard. Builds now have explicit kinds, every kind but production is refused on
  a stage/prod tier, and an unset kind means production in an export. A preview build is a real, separate kind with its own
  checks (dev sign-in present, e2e hooks absent), not production with a switch.
- 2026-10-30, F-250 + F-264 (the breathing splash): the splash stays up until `markLaunchReady()` is called, by `StoreProvider` once its
  store opens. With sign-in required the store opens only with a session, so every path that never opens it must end the splash
  itself: `LoggedOutShell` (the intro, Continue, the public pages, the blocking add step, "Logging out" and its failure, a session that
  did not restore) calls it on mount. `auth.spec` cold-loads signed out and checks `#launch` is gone and the intro shows.
- 2026-10-30, F-250: **the e2e sign-in is browser state, not per-spec code.** `e2e/globalSignIn.ts` signs the dev account
  in once per config and saves `storageState`, which every context starts from; a signed-out spec opts out with
  `test.use(signedOut)`. Playwright's `FullConfig.rootDir` is the test dir, not the config dir: resolve paths from
  `configFile`.
- 2026-10-30, Render: **production builds failed for hours unnoticed.** The demo-leak check in `scripts/pwa.ts`
  matched the text `demo-large-` in the start-up bundle, which the F-241 link resolver's id check contains on
  purpose; every Render build after that merge failed, and the live site silently stayed on the older build. Two
  rules: a build guard matches strings that only the guarded thing contains (a test pins the near-miss), and every
  merge to `main` is followed by checking that the Render deploy succeeded (`render deploys list`), not only the
  GitHub workflow, before saying it is live.
- 2026-10-30, fix/ios-safari-taps: **desktop Chrome at 1x CPU hid a 600 ms tab switch that a phone feels as 2 s.**
  Owner on a real iPhone: tab switches "take time", rapid taps "don't work", Home worst. Measured in the simulator's
  Mobile Safari and in Chrome at 6x CPU (`probe` timings from `pointerdown`, never from `click`): going back to Home
  from Analytics took 617 ms (5.9 s at 6x) while every other pair was under 70 ms, because the flat stack popped
  Analytics and unmounted it, and Reanimated's web exit animation ran for every row (`handleExitingAnimation`:
  clone the node, a forced layout per row). Measure the slowest pair of tabs, not Home from Groups, and in a real
  mobile browser. Fixes: (1) a tab the stack drops is parked in the router's `preloadedRoutes` and re-used by key
  (`parkTabs`), so nothing unmounts or remounts; `navigate(..., {pop: true})` to a parked route is a no-op in the
  stack router, so it is rewritten to `PUSH`; a parked tab keeps its live screen element so neither parking nor
  reviving re-renders it (303 -> 71 renders per switch, all the bar's); (2) the list's "in the visible tree" flag
  is its own component and `onLayout` widths ignore the 0 a hidden tab measures, or every show re-rendered the
  list and its header; (3) the bottom bar navigates on press-in and its highlight paints in that commit, the page
  a frame later (highlight 5-33 ms from `pointerdown` in Safari, 18-58 ms at 6x; it was the same as the screen,
  52-984 ms); (4) `html { touch-action: manipulation }` and `minimum-scale=1` (Bluesky's base.html) so a quick
  second tap is never taken for a double-tap zoom. Do NOT use `react-freeze` / `freezeOnBlur` on web: hiding a
  tree runs class `componentWillUnmount`, so every row's Reanimated exit animation ran (the 500 ms came back) and
  entering animations replayed. Do NOT hide kept screens with `content-visibility: hidden`: it is faster in Chrome
  but real Safari showed a BLANK page on return (found only because the simulator was run; Chrome cannot see it).
  `axe` taps cannot go faster than ~0.6 s apart (each step re-opens the HID session), so rapid-tap sequences were
  verified in Chrome with touch emulation (`tabTaps.spec`), not in the simulator.
- 2026-10-30, owner 168: **heavy content mounts on the real end of the open motion, not after two frames.**
  `OpenedContext` (`lib/hooks/useAfterTransition.ts`) carries "this has stopped moving": the web drawer sheet's
  spring end, a popup's zoom, the native bottom sheet's state event, the side drawer's `animationend` /
  `onTransitionEnd`, the composer routes (`Composer.Outer`, `useScreenOpened`), and on native every screen
  (`Layout.Screen`, `transitionEnd`). `useAfterTransition` / `useDeferredReady` / `<Deferred>` read it (an explicit
  `opened` wins); web tabs and pages do not animate, so they keep two frames. Measured in Safari: Add expense and
  the currency picker mounted their bodies 80 ms into a 296 ms rise (sheet at 574 px); now at the rise's end.
  Native paths (`transitionEnd`, the bottom sheet's `open` state) are written defensively with a 700 ms timer and
  were not run on a device here.
- 2026-10-30, Render: **auto-deploy was switched off by our own Blueprint.** `render.yaml` said
  `autoDeployTrigger: 'off'` (deploys were meant to come from deploy hooks, whose secrets were never set), and a
  Blueprint sync applied it to `splito-web`, so ten pushes after 5b60890 never deployed and nothing failed. Rule: the
  Blueprint is the source of truth for service settings, so a setting the owner relies on (auto-deploy of `main`)
  is written there; "no new deploy in `render deploys list` after a push" counts as a failed deploy.
- 2026-10-30, owner on iPhone Safari: **the tap-speed fix passed in Chrome and still felt broken on the phone.**
  Chrome (desktop and touch emulation) measured every tab at 4-15 ms, but Home re-rendered synchronously on switch
  (about 50 ms on the Mac, several times that on a phone) and the page had no `touch-action: manipulation`, so iOS
  Safari's double-tap detection could hold or swallow quick taps. Rule: tap, scroll and gesture work is verified in
  real Mobile Safari (iOS simulator) and with Chrome CPU throttling at 6x before it is called done, every tab
  (Home included) is measured, and no fix is reported as working on phones from desktop numbers alone.
- 2026-10-30, F-264 (c-splash): **the web launch mark lived inside `#root`, so React's first commit removed it** while
  the store was still opening and the screen went blank. The launch screen is now a fixed `#launch` overlay beside
  `#root` that `markLaunchReady()` fades out when `StoreProvider` has a store (or a notice or error). A native splash
  can only be hidden once, so `preventAutoHideAsync()` runs in the entry and the JS launch screen hides it when its
  image has loaded. Check the native handover in a release build: a dev client draws its own loading UI over it.

- 2026-10-30, F-256 (feat/wC-F256-home): **the id `people` used to mean Home**, so adding a People tab was a rename:
  tab ids are `home | people | ...`, route `Home` at `/`, `People` at `/people`. Stored data is migrated on read, never by
  a write (`packages/sync/src/preferences.ts`): a `tabs` list with no `home` is from before F-256, its `people` was Home,
  so it becomes `['home', 'people', ...rest]` (Home first, People right after it, the user's order kept); a stored
  `homeTab` of `people` next to such a list reads as `home`. The device mirror of the open-on tab was renamed from
  `homeTab` to `startTab`, because a stale `people` there would have opened the People tab for every existing user at the
  first launch. Tests: `packages/sync/test/preferences.test.ts` (legacy shapes), `e2e/homeTabs.spec.ts` (a saved bar is
  migrated; `window.splito.putRawPref` writes a row as an old build stored it, dev and e2e builds only). Rule: when a
  stored id changes meaning, rename the key of any synchronously read mirror.
- 2026-10-30, F-256: **the shell cannot read navigation state.** `createNativeStackNavigatorWithAuth` renders above the
  navigator's context, so `useNavigationState` there throws "Couldn't get the navigation state" and blanks the whole
  web app. The right column's width (hidden on Home) is computed from the shell's own `state` (`useRightNavWidthFor`);
  only code inside a screen (the FAB, the column itself) uses `useRightNavWidth()`.
- 2026-10-30, F-256: **a deep link to a tab mounts Home under it on web** (`backChain` plus the pinned Home screen), so
  Home's hidden copy is in the DOM next to the page you opened: an e2e locator for a row, the FAB or an overview card
  must be scoped to its screen (`getByTestId('screen-people').getByTestId(...)`), as the shell specs already do.
- 2026-10-30, F-256: **the sidebar and rail list every item** (owner 155), so there is no "More" menu, no `tab-more`
  and no `more-*` test ids; Settings and Ask Splito are ordinary sidebar rows (`tab-settings`, `tab-ask`).
- 2026-10-30, F-256 (owner 190): **a hook called above the scaffold cannot read the scaffold's context.** The first FAB
  host kept "a screen holds the FAB back" in React state inside `Layout.Screen` and exposed it by context, but
  `useSuppressFab` is called by the screen, which is the provider's parent, so the context was always the default and an
  empty Home showed a FAB. `RouteFAB.tsx` keeps a module-level set of route keys that hold the FAB (read with
  `useSyncExternalStore`); the screen adds its own `useRoute().key` in an effect and removes it on cleanup. Rule: state
  that a screen sets for its own scaffold goes in a module store keyed by route key, never in a provider the screen
  itself renders under.
- 2026-10-30, F-256 (owner 190): **a pushed copy of a tab is the same screen, so anything that differs is a bug.** The FAB
  is decided by route name only (`fabParams`, `lib/routes/fab.ts`); a pushed Groups copy therefore shows the FAB and every
  header action of the tab, and differs only by Back replacing the avatar (`PushedTabContext`, read only by
  `HeaderAvatar`). Do not add `isPushed` checks to a screen or to the FAB.
- 2026-10-30, F-256 (owner 184, F-263): **a fixed parent chain is a table, not a history.** `PARENT` in
  `navigation/goBack.ts` names a parent for every route (default Home), `backChain` stacks them, and on web the cold parents
  are keyed `cold-<name>-<i>` so `useRealParents` can swap in an expense's real group or friend chain once it loads.
  A pushed copy keeps `from=<origin tab>` in the address so a refresh climbs back to that tab; tapping the tab drops it.
- 2026-10-30, F-256: **read the route in a leaf, never in the component that builds the screen.** `useRoute()` hands back a
  new (equal) route object on many navigation updates (16 times in the renders gate's scroll sweep), and each one
  re-rendered `TabScreen` and so `Layout.Screen` and its children. `TabScreen` now has no hook and wraps the screen in
  `PushedTabFlag`, whose `children` element is made once by `TabScreen`, so React skips the screen; only the tiny provider
  re-renders (one `PushedTabFlag` x1 "wasted" line in `e2e-renders/baseline.json`, recorded on purpose). The gate's tab sweep
  also mounts about 13% more now (`tabs` 21383 -> 24183) because it visits Home and People as well as the old tabs.

- 2026-10-30, F-1213 / F-259 (Activity): four things that cost a rebuild each. (1) **`Link` matches bare route patterns
  only** (`router.matchPath('/activity/all?...')` is NotFound: the pattern ends at `/activity`), so an `href` that
  `Link` pushes must carry a tab as `?tab=`; the resolver and `buildPath` still print `/activity/all`. (2) **A bare
  path that means "the saved tab" needs an explicit segment for the first tab** (`PREF_TABS`), or a link meant for
  All lands on a remembered Others. (3) **A projection's `isTouchedBy` must list every entity type the feed reads**:
  comments and reminders were in `FEED_TYPES` (or are now) but not in `activityQuery`, so new ones did not show
  until something else changed. (4) **A filtered list over a paged window can be empty while older pages match**:
  read older pages until a screenful is listed or the history ends, and show the skeleton, not "nothing matches",
  meanwhile. Also: a main screen that is pushed from a link must be told apart from its tab by a param
  (`from=<tab>`, owner 184, in the address so a refresh keeps Back), not by stack depth (a deep link puts People
  under every page).
- 2026-10-31, F-258 (c-refresh): **pull to refresh on phone web is a window gesture, and Bluesky has none.** Bluesky's
  `List` takes `refreshing`/`onRefresh` for the native `RefreshControl` only; Splito supplies the refresh in the shared
  layer (`useRefreshControl` for `List` and `Layout.Content`, `usePullToRefresh` + `pullController` on web), so a screen
  passes nothing. Web: the window scrolls, so a touch that starts at `scrollY` 0 and moves down is the pull; only that
  case calls `preventDefault` (iOS rubber band, Android Chrome's own refresh), and the list content, not the header, is
  translated. Traps: (1) **a stranded gesture killed pull to refresh everywhere.** The controller kept one `gesture`
  and ignored a new touch while it was set; a touchend that never reached the window (the touched element was removed
  mid-touch) left it set for good. Every single-finger touchstart now ends the previous gesture first, and
  `pullRefresh.spec` removes the touched element mid-pull and pulls again. (2) **Refresh does not re-run projections**
  (owners 212/213): they already re-read on every commit, re-running them redrew every parked tab for nothing, and a
  `run(MORE)` meant for the Activity pager misused its contract (`'unknown'` would restart the tracker); refresh is
  `syncNow()` plus a 400 ms minimum spinner, skipped offline, and FX and sync are an honest TODO until F-2103. (3)
  `lib/` may not import `data/` (the handler lives in `state/refresh`). (4) The Loader's `rotate-500ms` class was never
  defined in `index.html`, so it never spun on web (now added, under `prefers-reduced-motion: no-preference`). (5) Metro
  tries `.ts` before `.web.tsx`, so a native twin named `x.ts` silently shadows `x.web.tsx` on web: give both twins the
  same extension. (6) Playwright WebKit has no `Touch`/`TouchEvent` constructor and no long task API: its run
  dispatches touch-shaped events and reads the frame gap, and says so. Real iOS Safari rubber band and Android Chrome
  were not driven by a person.

---

- 2026-10-30, F-1210 (disputes): **adding a store has a checklist, and each step has failed once.** (1) `STORES`, `ENTITY_STORE`, the `EXTRA` row builder and `EntityType`; (2) IndexedDB `onupgradeneeded` creates the new stores on every old-version path (v2, v3 and v4 each need them, before the rebuild reads the entity stores); (3) SQLite's step uses `CREATE ... IF NOT EXISTS` and a lost `user_version` is read from `meta.schemaVersion`; (4) the migration tests' downgrade helpers drop the new tables, and every fixture built from the large demo plan must **exclude the new type** (an older file cannot hold it; keep one fixture with it for the v1 upgrade); (5) the backup test's writer table needs the new type (`satisfies Record<EntityType, ...>` fails the typecheck otherwise).
- 2026-10-30, F-1210: **a projection that depends on rows of another store is moved from both sides.** The disputed sums change when a dispute opens or closes AND when the record they name is edited or deleted (`projectEntity` handles both; the record's own write takes its disputed part off first, so the delete-then-close order leaves nothing behind). The property test sprinkles disputes over the existing random sequences on a **separate random stream and id minter**, so every existing seed still builds the same ledger; and a twin run without disputes proves balances, pairs and aggregates are identical. A write that mints ids (closing disputes as Gone mints an outbox op id) still shifts later ids: compare groups by creation order, not by id.
- 2026-10-30, F-1210: **a host-mounted sheet needs a fresh mount and a fresh dialog control per request.** On a phone-width web page (and native) a closed sheet keeps its form state (an old note, `isSaving`), and a control that is still closing ignores `open()`: the second Reject/Reopen opened late or never, with a disabled Save. `DisputeHost` mounts a keyed sheet that owns its control and opens it as it mounts. (Remind's host reuses one sheet; its forms are stateless enough to get away with it.)
- 2026-10-30, F-1210: **arithmetic on money belongs in `packages/domain`, even a `min` or a sum for a label** (the architecture rules `moneyArithmetic` and `unlikeCurrencySum` fail a new file in the client): the "of which disputed" capping and the Settle exclusion are `domain/disputed.ts` with tests. Raw `store.method()` calls are banned outside `data/` the same way: a `state/` hook calls a `packages/sync` function (`loadDisputeEvents`, `listDisputedBalances`), never `store.historyMany`.
- 2026-10-30, F-1210: **components cannot import features or data** (`layerDirection`). A piece used by a component (the payment sheet needs the dispute panel) lives in `components/<area>/` and reads through `state/`; only the hosts and sheets that need `data/` stay in `features/`. Count a new `useDialogControl` too: a sheet without an address is listed in `table.test.ts` `NOT_ADDRESSABLE` with its reason.
- 2026-10-30, F-1210: **Lingui turns a call expression in a message into `{0}`**: assign it to a named variable first (`const ago = getTimeAgo(...)`), so the Hindi translator sees `{ago}`. Do not build a sentence by gluing `": " + note` onto a translated one; show the note as its own line.
- 2026-10-30, F-1210 e2e: **never `goto` right after a click that writes.** The write is a transaction still in flight; the reload drops it and the next assertion fails (it looked like a missing feature). Wait for the sheet to close or the toast first. A search drawer input also needs `toBeEditable()` before `fill` under load.
- 2026-10-30, F-1210 review: **a derived adjustment must stay between zero and the thing it adjusts.** The first "leave disputed out of the plan" subtracted the disputed part from every net, which flipped signs on a settled or part-repaid group and asked someone to pay twice for a disputed "payment not received". `withoutDisputed` now shrinks each net toward zero only and rebalances with `allocate`, with a property test (sums to zero, never flips, never grows). Likewise a stored pointer into a list (an item's position) must be the item's own id: reorders and edits moved the dispute onto the wrong item.
- 2026-10-30, F-1210 review: **an "apply the suggestion" action must never change the shape of the record to fit it.** Converting an itemised or percent split to exact amounts to apply an amount fix lost the items. One tap applies a fix only when the split mode survives it (`fixApplies`); otherwise it is an edit by hand, and the panel says why.
- 2026-10-31, F-1713 (c-anim): **an icon that animates a state change mounts only the glyph in use.** The first `MorphIcon`
  kept the outline and the filled glyph both mounted and cross-faded their opacity: tab-round updates went from 468 to 624 (+33 %)
  and a wasted `Rect` report appeared (the old Groups glyph re-rendering with equal props), against a budget of +10 %. Rendering one
  glyph and popping it in on a change (scale and opacity on the UI thread, 180 ms) costs 500 updates, and the baseline records
  that reviewed increase. Rule of thumb: any "morph" is a swap plus a pop, never two live copies.
- 2026-10-31, F-260 / F-1713 (c-anim): **lazy art needs the player lazy too, and a compiled hook must not read a
  module cache without state.** Moving the animation JSON behind `import()` was not enough on its own; `lottie-web`
  was also in the entry (now dynamic) and together they took 285 KB (3.9 %) off the web first-load JS (7,305,880 to
  7,021,333 B; gzip 1,545,216 to 1,495,320), with 19 new empty-state pieces added as lazy chunks (53 with loading, success and lottie-web: 415 KB). The first
  version of `useIllustrationSource` drew nothing: the React Compiler memoised `loaded.get(key)` on `key`, so the
  re-render after the fetch returned the old `undefined`; the hook now keeps `{key, json}` in state. Also: an empty
  state plays once to a resting frame (`playSegments([0, staticFrame])`), so a looped file whose last frame equals
  its first would end blank; every piece has an explicit resting frame, and reduced motion shows the same one.
  Motion that does not explain a change was left out (owner 213): sparkles twinkle, plus-to-X without a menu.
- 2026-10-31, fix/integration: **parked tabs make every unscoped locator ambiguous, and a gate must not count a race.**
  Four specs failed on the merged main with all tabs kept mounted: two asked for `request-Ishaan Verma` and
  `person-Bela Joshi` on the page when Home and People both list them (strict mode: scope to the screen you mean, here
  `screen-people`); the Activity Type-filter check read the list a moment after Apply, while the previous filter's rows
  were still shown (poll for rows of the new type, never read once after Apply); and the cancelled-press test dragged
  a mouse across the page, which selects text, and react-native-web drops the next click on that link after a
  selection (`_selectionTerminated`, its rule), so the link looked swallowed (cancel a touch with
  `Input.dispatchTouchEvent touchCancel` instead). The renders gate's tabs phase read about 1,900 or about 3,400
  updates on the same build: the first visit of a tab lets background history loading and the Analytics report land
  inside the phase, so it is printed and never gated; the second round, on parked tabs, is 69 + 468 every run. A
  frozen clock (`page.clock.setFixedTime`) stops the app reaching Home, so the clock is pinned by an offset.
- 2026-10-31, F-269 (group requests): **someone who has been asked is not a member.** A pending group request is its own
  record (like a friend request), so no split, expense or picker can use the person by construction; the group page,
  the Add members sheet and the expense picker draw them greyed as "Invited" from the request, never from `members`.
  A group's join rule (`joinPolicy`, absent reads as 'approve') is the one source for its link: the link's
  `approveJoins` is derived from it when the link is made or the rule changes, and 'invite' revokes the links; the old
  `invites.approveJoins` preference is gone. A new store is a schema step on both engines (checklist above, v6), and
  a request component that reads data lives in `screens/` (Activity gets its buttons through a render prop, as for
  friend invites). New messages must be extracted, translated and compiled before an e2e build, or the app prints the
  message ids (`+EvjqO`) and every text assertion fails.
- 2026-10-31, F-269 review: **removing a preference leaves its rows on devices.** `invites.approveJoins` is gone from the
  registry (a group's own rule replaced it), but old devices still hold its row: readers look up by registry key and
  skip unknown ids (`resetAllPrefs` filters them, backup exports only account-scope keys it knows), and a test keeps it
  so. A request that lapsed (30 days) must not block asking again: every "is there already one" check reads
  `requestState`, never the stored `pending`. Getting into a group by a request or a link marks the written version
  (`Group.viaRequest`), so Activity shows the request's row and not "created" or "edited".

- 2026-10-31, F-253 (guided tour): four things a coach-mark feature needs. (1) **A host above the navigator cannot read
  navigation state**, so the screen that matters (People) publishes what it holds to a module store while it is focused
  (`usePublishPeopleState`), and the host reads that; no timer guesses at the route. (2) **Parked tabs keep their own copy of
  a control** (each tab has a FAB), so a registry keyed by id holds all mounted copies and the tour measures them newest
  first and takes the one that is showing (a hidden tab measures 0 x 0); a registry that keeps only the last one points at a
  hidden FAB. (3) **Check the branch a worktree starts from**: the builder's worktree began at an
  older main where Home was still the start tab, the tour never started (People was not showing) and every spec timed out;
  merging the integration branch (no Home, app opens on People) fixed it, so no Home special case exists. (4) **E2E builds sign every spec in as a fresh account, which is exactly who the tour is for**, so an e2e build never starts it
  by itself; a spec arms it with `window.__splitoTest = {tourAuto: true}` in an init script (hooks installed later spread the
  object, so the flag survives). `expo export` can fail with a missing `react-native-worklets/.worklets/<id>.js`: create the
  empty directory and rebuild with `-c`.

- 2026-10-31, F-261 (c-personlink): **making every avatar a link is a mount cost, and nested links need care.** (1) The renders gate's
  scroll phase counted about 360 more `PersonLink` / `Link` and about 730 more `Pressable` mounts (one per Activity row), so the
  baseline was re-recorded on purpose (median of three; the machine was at load 30-80, not quiet; mount counts are not timing
  dependent). (2) **A link nested in a row must still be an anchor**: a `div role=link` is never activated by Enter or Space in
  react-native-web, so the first version (no `href` when nested) could not be opened from the keyboard; an anchor inside a
  Pressable `div` is valid HTML. react-native-web also does not take Space for a role=link, so `PersonLink` adds one shared
  `onKeyDown` that clicks on Space. (3) **A disabled `Pressable` disables everything inside it**: the Ask ranking rows were
  disabled Pressables, so the avatar link in them was "not enabled"; a row nobody selects is a `View`. (4) Keyboard order: a nested
  link is a tab stop between the row and its buttons (`activity.spec` "hide works from the keyboard" waits for the avatar first).
  (5) Demo mode asks "Switch back to your data?" for a link naming an id the demo data lacks, so test "Not on this device yet"
  outside demo. (6) `components/` may not import `data/`: a one-line `state/me.ts` hook gives them my id. (7) A baseline written by
  a script must keep a phase's `"mounts": 0` (a pruned zero made the gate compare against NaN): only drop zero component counts.

- 2026-10-31, merge of c-personlink, c-refresh, c-joins and c-search (cloud session, load under 2, 4 cores, Chromium):
  **measure search in the browser, not only in bun.** (1) Before c-search, `main`'s `search.test` read 80-110 ms here
  (rows walked one by one); with c-search SQLite reads 20-36 ms at 10,000 expenses, but the IndexedDB case reads
  about 190 ms for every query because `fake-indexeddb` is a slow pure-JS engine, so that number says nothing about
  a browser. (2) The real check is `perf/schema-v2.spec.ts` in the browser: at 10,000 expenses c-search drew the first
  page in 259-709 ms against `main`'s 58-73 ms, while its totals arrived sooner (`main` 1.0-1.3 s): every token was
  turned into its full set of ids before intersecting, so "bulk" (in every title) read 10,000 keys plus every record of
  60 friends. Rule in 17.1 (narrow first). (3) **A type word inside a name is the name:** "friend", "group",
  "payment" are type words, so "Bulk Friend 4" meant "bulk, only friends, amount 4" and could never list an
  expense; the perf spec waited 60 s for one. When the query's words together start one person's or group's name,
  its type words are read as plain words (`asNames`, tested in `search.test` "a type word inside a name"). (4)
  Merging branches that each regenerated the Lingui catalogs is done by taking the union of both `.po` files (no
  translation is lost), then `intl:extract --clean` and `intl:compile`; never "take one side" of a `.po`, which drops
  the other side's Hindi strings; resolve the compiled `messages.ts` to either side first, or extract fails to parse it.
- 2026-10-31, merge of c-joins: **a request's stored `status` is not its state.** Activity's invite rows carried Resend /
  Cancel whenever `status === 'pending'`, so a 40-day-old invite (expired by `requestState`, gone from Invites sent) still
  offered Resend there; group requests had the same check. `main` only passed `friends.spec` "the demo set carries the
  invites flow" because that row was not reached. Every place that offers an answer to a friend or group request asks
  `requestState(r, now) === 'pending'` (with `now` from `useTickEveryMinute`), and the check lives in the action
  component (`OutgoingActions`, `GroupRequestActions`), so only rows with buttons follow the minute clock.
- 2026-10-31, F-246 (c-search): **the "every query under 50 ms" test failed because broad queries read the ledger, not
  because the amount scan was slow.** The amount range was already an index; the slow part was every broad query
  (`f`, `> 1000`, `march`) walking `byDate` in chunks of 200 rows to check each one so the count and totals could
  be shown (about 10 us a row, so 100 ms at 10,000 and more under load), and the old test read whole answers
  through `searchStore`. The fix is structural: terms for every field (`b`, `h`, `G`, `d`, `s`, `n`), each token
  resolved to a set of ids by key range, intersection, ordering and totals from the `d` and `a` keys, rows read only
  for the page. Two things to remember: (1) reading 10,000 index rows costs 2-3 ms, reading 10,000 entity rows costs
  70 ms, so put anything a count or a total needs into the keys; (2) a test that proves "the keys give the rows'
  answer" (`searchOracle.test.ts`: 1,200 random expenses, 18 queries, order and totals compared with a row-by-row
  reference) is what makes this safe, not the speed number. Also: the migration tests' `storedTerms` helper listed
  the term kinds by hand, so a new kind failed dozens of migration tests until it read `TERM_KINDS`.

- 2026-10-31, F-246 fix round (c-search, Opus): **"answered from the keys" was still a full-ledger read.** The first cut
  intersected key sets well, then ordered every answer by reading all `d` keys and totalled it by reading all `a` and
  `s` keys, and a balance status listed every record of every settled group plus every record outside groups: one
  match cost 21,201 keys at 10,000 expenses + 600 payments, "owed" 44,916, and IndexedDB 50-130 ms of CPU per query
  (load 45). Now an answer of at most 500 records is read by id and ordered, totalled and status-checked from its rows;
  the rest is unchanged. Three more things to remember: (1) a word that finds a person must not expand to the person's
  records when it is not a name: phone digits ("91", "98") and UPI words matched almost the whole ledger through the
  `h` keys, and so did my own name; such words are their own term kind (`k`) that lists the person only; (2) a cached
  promise of maintenance work must be dropped when it rejects, or one failure breaks the feature until reload; derived
  data is rebuilt at idle, in chunks with yields, never inside the first keystroke; (3) a version marker cannot see a
  writer of the same version that skipped rows (an older tab, a rollback): also compare a cheap count (`d` keys against
  records). The oracle became a property test (random changes on both engines, the stored keys equal `termRows`, 30
  queries equal a row-by-row reference, narrow and broad both exercised), which is what makes the two paths safe.

- 2026-10-31, c-p0bf (consolidation P0-b, P0-f): **a row menu is one component, because the same gesture kept working on some rows only.** Four hand-built menus (Hide, Dispute, Activity, comments) differed on phone-width web: iOS Safari fires no `contextmenu` on a long-press, so a deleted history row and an Activity row had no way in there (`IS_NATIVE`-only `onLongPress`). `components/RowMenu.tsx` owns it (`useRowMenuTrigger`: long-press where there is no mouse, right-click, Menu key / Shift+F10; `RowMenu`: row + menu + the "..." button), and the architecture rule `rowMenuGesture` counts hand-built `onContextMenu`s (baselined: CommentRow until P1-d, two charge pickers). Test-method lesson: **Chromium's emulated touch (`Input.dispatchTouchEvent`) sends a click at the lift point, which lands on the menu's scrim and closes it about 0.3 s after release**; a real long-press does not, so `e2e/rowMenu.spec.ts` checks the menu while the finger is still down, and desktop WebKit cannot construct a `Touch` (it is sent plain touch objects). Reanimated's `useReducedMotion` is the OS setting read once at start, so a swipe or animation using it ignores the Animations preference: use `useShouldReduceMotion`. Category names translated only in Settings, so a Hindi user saw "Food" everywhere else: one `useCategoryLookup` now names them. Renders: the lookup hands back the same object for the same category, id and name (`nameCategory`), because a fresh `{...category}` per render re-rendered every memoised tile and composer button (type phase: `CategoryTile` 10x, `Pressable` +20, `Button` +10); the one recorded increase is `mount:CategoryTile` 2 to 5 in the launch phase of `e2e-renders/baseline.json`, the five Home rows whose `EntryIcon` now draws the shared tile (edited by hand for that one line, not re-recorded under load 60 to 150).
- 2026-10-31, F-274 P0-a/d/g (c-p0adg): **three more copies became one.** (1) Avatars: `initials(name, mode)` and `nameHash` live in
  `lib/avatarName.ts` (pure, so bun can test it; `UserAvatar` re-exports them) and the Create group preview draws the same
  `GroupAvatar` tile the created group wears ("Goa" is "GO" in both). (2) Days: `useDayLabel()` / `useFormatTime()` in
  `locale/useDates.ts` over the pure `locale/dayLabel.ts` (`dayOfInstant`, `dayBucket`) word every day header and divider
  (Activity sections, the Comments `DateDivider` now in `components/`, dispute lines) in the Timezone and Date format
  preferences; one `MonthCalendar` (`components/forms`) serves the date field and the custom range. A Date format
  change now reaches the Comments divider and statements. (3) Sharing: see § 14. Rule: a helper that a bun test must
  reach cannot sit in a file that imports `react-native` (bun cannot parse its Flow source); put the pure part in
  its own file and re-export.

- 2026-10-31, merge of F-274 cleanup round 1 (c-p0ijk, c-p0bf, c-p0eh, c-p0adg), from the combined Opus review: **a
  clean textual merge is not a correct merge.** c-p0eh added `joinList(..., i18n.locale)` to `statementText.ts` while
  c-p0adg narrowed the same hook to `const {t: l} = useLingui()`: git merged both without a conflict and the merged
  file referenced an `i18n` that no longer existed. Typecheck and lint run on the merged tree before any e2e. Three
  more: (1) deleting a file means sweeping every architecture baseline on the target branch, including rules other
  branches added meanwhile (`FeedCard.tsx` was in the new `personAvatarOutsideLink` baseline, a STALE line fails the
  gate); (2) Hermes has no `Intl.ListFormat`, `DisplayNames`, `RelativeTimeFormat` or `Segmenter`: they go only through
  the guarded `locale/` helpers (`joinList`, `currencyName`), and an exported file never depends on runtime Intl
  support (the statement's "Paid by" column is a plain join, so it reads the same on web and phones); (3) a "nothing
  else does X" claim in this file needs a counter or a grep test: two such claims of the round were already false
  (specs with their own viewport sizes; clipboard use outside `lib/sharing.ts`); the remaining duplicates the review
  listed (time-of-day formatting in four files, `dayOf` / `daysAgo` in `activity/feed.ts`, dead `CATEGORY_ICONS` (removed in the round-2 follow-up), two
  filter-sheet switches) are cleanup round 2 (BACKLOG F-274).
- 2026-10-31, F-274 cleanup round 2 (c-r2): **a clean-up brief that lists files not to touch leaves duplicates behind, so
  record them where the next slice finds them.** (1) Time of day: `useFormatTime()` and a new `useFormatDateTime()`
  (`locale/useDates.ts`) serve Comments, the Expense history line, Activity's timestamp and its tooltip, and DeletedMeta;
  the architecture rule `timeFormatOutsideLocale` counts a hand-written `timeStyle:` / `hour:` / `toLocaleTimeString` outside
  `locale/` and baselines only the device-zone reminders, the import date and the Ask chat (P1-e). A reminder fires on the
  device clock, so it is deliberately not in the Timezone preference. (2) `activity/feed.ts` lost its own `dayOf` / `daysAgo`
  (`dayOfInstant` / `dayBucket` in `locale/dayLabel.ts` are the one rule; `daysAgo(...) === 0` is `dayBucket(...) === 'today'`).
  (3) `clipboardOutsideSharing` fails `expo-clipboard` or `navigator.clipboard` outside `lib/sharing.ts` (CommentRow's Copy
  link was the last). (4) `IncludeGroupsToggle` is the one "Include groups" row (a `Toggle.SwitchRow`); People's
  `FriendsFilterDialog` now uses it too (its own copy went in the orchestrator's follow-up). (5) One email check: the sync
  feedback regex and the unused domain `isEmail` went; `isContactEmail` is the only one. (6) A `plural` macro from
  `@lingui/core/macro` produces the same message id as `<Plural>`, so moving a hand-written "N links" note onto it kept its
  Hindi. Not obvious: builders that share one scratchpad directory overwrite each other's scripts of the same name
  (`edit1.py`); give a scratch script a prefix that is yours.
- 2026-10-31, merge of c-anim (F-1713, F-260, part of F-275), from its Opus review: **a success state wins over a busy
  state in the button's render order, and a spec asserts the success UI itself.** The save button rendered
  `isSaving ? Loader : isSaved ? Check : text`, and the composer, Record payment and Call it even keep `isSaving` set
  until the sheet closes, so the drawn check never showed; the specs had moved to waiting for the toast, so nothing
  caught it. The footer now draws Saved first, disables Cancel while saved and clears the sheet's dirty flag, so a drag
  in the 300 ms before it closes never asks "Discard changes?". Also: (1) an audit finding cannot change an owner rule:
  the branch swapped the Search & Ask Sparkles for a magnifier citing the UX audit, against decision 74; restored, and
  the question goes to the owner; (2) an empty state keeps its one small secondary next step (owners 146, 213) even
  beside the FAB, which stays the primary action: hiding it on phones (tried 2026-10-31) failed `emptyArt.spec`
  and owner 213's "every list has an empty state with one clear call to action"; an inactive group or a deleted
  friend gets none, since they take no new expenses; (3) the dead `SuccessCheck` went with the change that replaced it (section 1).
- 2026-10-31, F-271/F-272 (c-nohome): **renders baseline re-recorded for the start tab; the median of three runs came out identical.**
  Removing Home moved the launch end point to `splito:people-ready` (People, the start tab) and the tab round to People,
  Groups, Analytics, Activity; the gate was recorded three times after the large demo had loaded and the median kept
  (`RENDERS_BASELINE=write` x3, one worker, the machine at a load of 20 to 200 from other builders' runs, which only
  slowed it): launch 3,403 + 302 (301 in one run), tabs 69 + 442, addExpense 498 + 179, type 0 + 793, closeAdd 76 + 193,
  scroll 43,735 + 32,097, ask 1,018 + 943, 7 reports, and the parked-tab test shows no content render on a switch. The
  Analytics Overview now sits in the Analytics list header (`OverviewSection`, a child that reads its own data), so a
  balance change re-renders that section and not the report.
- 2026-10-31, F-271: **"Home" as a fallback is one function, not a literal.** `startPage()` (`lib/routes/startTab.ts`) is the
  start tab's route, set at launch from the device mirror and by `PrefsMirror`; Back's parents (`backFallback`), the
  cold chain (`realParentsFor`, which lists the start tab once when it is the list itself), the resolver's bare `/` and
  unknown links, the logo and sign-in return all read it. A `from=home` in an old address reads as the start tab. A
  saved `tabs` list loses `home` and `ask` on read; only the exact old default bar (`home, people, groups, analytics,
  activity`) becomes the new default (Settings added, owner 206), because treating "People, Groups, Analytics, Activity"
  as the old default made Settings come back every time a user turned it off.
- 2026-10-31, F-272: **"last active" needs comments too, and the projection is the only place that knows.** The people and
  groups projections (`people.lastActivityAt`, `groups.activityAt`) were bumped by money records only, so a comment did
  not move a friend or group up; `projectEntity` now bumps the groups and friends a commented record names, and
  `rebuildActivity` takes the comments, so a rebuilt projection equals the incremental one
  (`historyIntegrity.test`). Screens only read the maps (`useLastActivity`, `useGroupActivity`) and sort.
- 2026-10-31, F-271: **moving a screen moves its architecture baselines.** `screens/Profile.tsx` became
  `screens/Profile/index.tsx`, and Settings' raw store reads moved into `DataSettings.tsx`: the per-file counts in
  `architecture/baseline.ts` and the `docs/reuse` row are keyed by path, so the move fails `rules.test` until both
  follow. A testID that contains a money word (`profile-balance`) is read as arithmetic (`profile - balance`) by
  `moneyArithmetic`; name it for the thing, not the money.
- 2026-10-31, process: **a worktree's `node_modules` links point at whoever ran `pnpm install` last.** A fork that installed
  in a scratch copy re-pointed `@splito/*` and `@bsky.app/bottom-sheet` at its copy; typecheck then failed everywhere. Run
  `pnpm install --frozen-lockfile --offline` once in the worktree only, and never in a copy that shares it.
- 2026-10-31, owner on iPhone Safari again ("tab taps within ms still take time"): **measure the case the owner
  describes, between tabs already visited.** `perf/tapLatency.spec.ts` reloads before every tap, so it times first
  visits only; a rapid round over visited tabs at CPU x6 showed taps are no longer lost (the last tap always wins) but
  each switch takes 165-930 ms, and Analytics was the worst because it drew every report row. Rule in 17.1. Not yet
  verified on a real iPhone: this container has no WebKit or simulator, so iPhone numbers still need the owner's
  phone or Mac.
- 2026-10-31, F-257 (tab slide): **an animation that shifts content right widens the page.** The first cut moved the
  incoming screen 32 px right and `tabTaps.spec` "no tab widens the page" read 422 px on a 390 px phone (the fixed
  bar slips below the fold, § 23 fix/tab-taps). The sliding screen clips sideways (`overflow-x: clip` on the screen
  root only, never on `html` or `body`). Also: a `transform` on a screen's root would carry its `position: fixed` FAB
  with it, so the slide moves the screen's children except `[data-fab]`.
- 2026-10-31, merge of c-nohome: **a projection rule that grows must grow its test oracle in the same change.** F-272
  made a comment (and its edit or delete) bump its record's group and friends for "Last active" (owner 199) in both the
  incremental write and `rebuildActivity`, but `test/projectionCheck.ts` `expectedActivity` still counted money
  records only, so the 10 large-demo migration tests failed on one group (`demo-large-g-b-paris`, a comment 4 minutes
  after its expense) on the branch itself, and nobody saw it because the builder ran only its touched specs. The
  oracle now counts comments the same way. Rule: `pnpm test` (all packages) runs before a branch is called done, not
  only the specs a change touches.
- 2026-10-31, c-nohome review: three rules from what the review found. (1) **A module-level "current value" needs a
  writer on every path that changes it.** The start tab (`setStartTab`) was set at launch from the device mirror but not
  when the preference changed or the tab list was migrated, so Back fallbacks named a stale tab; every path that changes the
  source (launch, preference write, migration) calls the writer, and a test pins each. (2) **A migration that
  drops a fixed item keeps what it guaranteed.** Removing Home from a saved tab list had also removed the one tab the app
  could always open on and the place "Home" fallbacks pointed at; the migration now names the new guarantee (the start tab
  is People, a saved bar keeps People and Settings) instead of only deleting. (3) **Moving a screen from the root stack
  into the tabs breaks every plain `navigate(name)` on native** (React Navigation 7 does not navigate into a child
  navigator; see the fix/ios-wB lesson): Settings became a tab and `navigate('Settings')`, `replace('Settings')`, the drawer's
  sync dot, the dev tour and the Back fallbacks did nothing on native while web worked. In the same change as the move, grep
  every `navigate(`, `replace(`, `popTo(` and `goBack` fallback for the route's name; tab names go through
  `navigateArgs()` (`lib/routes/helpers.ts`), and `goBack(navigation, fallback, IS_WEB)` applies it to every fallback. A bun
  test (`linkNavigation.test`, `goBack.test`) pins the native shape. Not checked on a simulator here.

- 2026-10-31, F-266 (c-perf port): **the wip/c-perf fixes, reviewed before they landed, and what the review changed.**
  (1) Reanimated 4.7.1's web `LayoutAnimationConfig skipExiting` does nothing (`JSReanimated.setShouldAnimateExitingForTag`
  is a no-op), so the screens' `<LayoutAnimationConfig skipExiting>` never stopped a popped page's rows from cloning
  themselves out: Person 60 clones, Group 20, Friends and invites 106 (a 2 s Back at x6). The exit scope fixes it on web.
  (2) c-perf's Reanimated patch dropped the mount/update box reads and let the exit fall back to
  `getSnapshotForElement`, but that fallback runs after `handleExitingAnimation` has moved the children into the clone:
  every exit clone was 0 px tall. The patch now reads the box first; `e2e/animations.spec.ts` checks the clone height and
  fails on c-perf's version (checked by editing the built bundle). A patch's test must fail on the version it replaces,
  not only on upstream. (3) The test that counted every `getBoundingClientRect` read 10, 15 or 20 on the same build
  (onLayout reads vary with timing); it now counts reads made from a class component's mount or update: 0 patched, 10
  unpatched, every run. (4) A wrapper component around every screen adds a render per screen render (renders gate +6 to
  +11 updates per phase): a scope that only provides a value is a hook plus a bare provider. (5) The demo pill made the
  app usable during the seed, which also made `FormSheet.Screen`'s "busy means the store is going away, drop the sheet
  without asking" wrong for the seeding part: only the swap cover (`useIsStoreCovered`) may drop a dirty sheet. (6) The
  renders gate is red on this base before any change (806 Activity rows scrolled of 1,000; baseline older than the People
  start tab): compare counts against a base run on the same machine, never against a stale baseline. (7) Chrome refuses
  to start when `TMPDIR` is long (`Socket path too long`); give Metro its own cache with a short `TMPDIR` (`/tmp/<name>`),
  which also avoids the shared Metro cache pointing at another worktree's `.worklets` files.
- 2026-10-31, full e2e on the combined PR #1 (817 of 844 passed): **after sign-in the app landed on a pushed copy of
  People "from" People** (`/people?from=people`, Back instead of the avatar). The bare `/` is rewritten to the start
  tab before the app reads it (owner 198), so the signed-out app held `/people` as a link to resume, and opening it
  pushed a tab copy over the same tab. Two rules: a link to the tab already showing opens that tab, never a pushed copy
  of itself (`navigateToTarget`); a bare start-tab address is "open the app", never held for after sign-in
  (`holdSignedOutLink`). Also: a change of the demo data (F-269 adds Sara, who joins Goa by an approved request) moves
  every spec that counts friends, settled friends or members; the demo specs derive the count from the plan, so the
  formula names each addition. Unavoidable reds here: 5 `rowMenu` webkit cases (no WebKit in the container) and 10
  pull-to-refresh / touch-scroll cases (CDP `synthesizeScrollGesture` does not scroll this Chromium).
- 2026-10-31, owner's iPhone screenshot (Goa group): **something pinned under the header must move with the header.**
  The group tab bar was `sticky` at a fixed `top: 52`, and the header slides away on phones (owner 87), so once the
  header hid, rows scrolled through a 52 px band above the tabs. `BelowHeader` (`components/Layout/MainScrollProvider.tsx`)
  moves its children up with the header on phones (no fade). It is a component, not a hook the page calls: the header's
  state lives in `Layout.Screen`, which the page itself renders, so a hook in `GroupScreen` read the default and did
  nothing (the F-256 lesson again: a hook called above the scaffold cannot read the scaffold's context). Test:
  `group.spec` "on a phone the pinned tabs move up with the header" (fails without the fix).
- 2026-10-31, owner 215: **an icon's colour travels in its style, so a wrapper that takes the style must hand it on.**
  The c-anim review fix stopped `MorphIcon` passing the caller's style to the glyph (to stop margins applying twice),
  and every bottom-bar, sidebar and drawer icon fell back to the accent colour. The pop now sits alone on the
  wrapper and the whole style goes to the glyph; `shell.spec` checks the bar's icons are drawn in the label's text
  colour.
- 2026-10-31, owner 216 (iPhone Safari): **a left-edge swipe belongs to the browser.** The phone-web drawer opened on a
  touch that started within 24 px of the left edge and moved right, which is exactly iOS Safari's Back swipe (and it
  ran on pushed pages too), so a Back swipe also opened the drawer over the page it went back to. No app gesture starts
  at the screen's left edge; the drawer opens only by its address. Also: React Navigation's web scroll restoration
  scrolled only in the frame after focus, so the page Back returned to was painted once at the old page's offset and
  then jumped; it now scrolls at once as well (`scrollWeb.spec` "Back ... from the first frame"). And a filled icon made
  by filling every shape of a Lucide outline can lose its drawing (People became a plain square): filled glyphs cut
  their detail out with a mask (`createFilledIcon`), and `shell.spec` checks the selected People icon has its holes.
  Real Safari's swipe was not driven here (no WebKit in this container); Chromium's `history.back()` stands in for it.
- 2026-10-31, owner 217: **removing a navigation surface means finding what only it reached.** With the drawer gone the
  phone bar became the only navigation, and Settings > Navigation still let Settings be switched off, which would have
  left a phone with no way back to Settings: the editor now locks Settings with the start tab, and reading a saved bar
  adds Settings when it is missing (an empty bar still reads as the default). Also: an icon whose filled form equals its
  outline (Lucide `activity` is one open line) cannot show a selected tab; pick a glyph with an area to fill (the bell),
  and `shell.spec` checks the selected bar icon is filled. The pulse redraw went with it, so the `tick` variant and
  `playKey` left `AnimatedIcon`; `react-native-drawer-layout` left the dependencies.
- 2026-10-31, owner 218: **a header slot that balances an optional button must come and go with it.** Each tab's header
  kept an empty `Layout.Header.Slot` on the left to balance Search & Ask on the right; once the button showed on the
  start tab only, every other tab's title sat 20.5 px off centre (`shell.spec` "centred title"). `SearchAskSpacer`
  renders the left slot only while the button is there.
- 2026-10-31, owner 219: **one question, one control per page.** Analytics' Overview had All / Groups / Direct chips
  while the filter row already had a scope chip, so the page asked the same thing twice and the two could disagree.
  The Overview now follows the page's own scope; on People it follows the list's Include groups switch, so a list and
  its summary never differ. The shared card grid moved to `components/overview/` (People, Groups, Analytics and
  Profile use it); choosing balance rows is selection, the sums stay in the domain (`personSummary`, `groupTotals`).
- 2026-10-31, owner 221: **a page whose filters drive it must not carry a figure they cannot move.** "Balances right
  now" ignored Analytics' period and currency, so the page answered two different questions at once; it left Analytics
  (People and Groups carry it). `overviewLayout.spec` checks Analytics has no Overview and that the People and Groups
  Overviews add up per currency (all = groups + non-group).

- 2026-10-31, F-275 (Add expense essentials, itemize): four things to remember. (1) **A total the person did not type is
  still a total the domain makes**: `evaluateForm` reads an itemised bill once with the amount empty (the domain gives
  `itemsTotal`), then runs again with that figure as the amount text, so payers, shares, the readout and `validateExpense`
  all see an ordinary total and the client adds nothing (`moneyArithmetic` stays at zero). The old chargeForm test that
  said "no printed total: gap undefined" changed on purpose. (2) **A disclosure must put what a control changes next to
  the control**: the first sketch kept the person rows above a "More options" row that held the split chips, so choosing
  Itemize grew the page above the finger and pushed the chips off screen; a non-equal split's editor therefore renders
  under the chips inside the disclosure, and only the equal list (who is in) stays outside. (3) **A tap that toggles
  needs a rule for an item that starts as "Everyone"**: tap-to-toggle on a full set would remove the person tapped (the
  audit's "my beer was charged to Riya"), so an untouched Everyone narrows to the person tapped. (4) **Moving a control
  behind a row breaks every spec that clicks it**: the split chips, the charges and the cash-rounding switch now need
  `chooseSplitMode` / `openCharges` / `openMoreOptions` from `e2e/composer.ts` first; use those helpers rather than
  clicking the row inline.
- 2026-10-31, People search and Activity fling (F-266 sweep misses, owner 189): **the cost was in what the screen
  re-did, not in the list.** (1) Typing in the friends search set state in `PeopleScreen`, so every key re-rendered the
  header, the Overview, the requests, the filter sheet and the list (211 renders a key), and because the compiler had
  not memoised `personSummary` -> `listedFriends` -> `sortFriends` every row got a new object and re-rendered; the rows a
  key removed each ran Reanimated's web exit (46 clones over 16 keys, each reading `scrollTop` of every node). Fix: the
  query moved into `FriendsList`, the rows follow a deferred query, the derived rows are memoised on their projections,
  the rows are `memo`, and a search swaps rows quietly (`useQuietRows`). The first quiet-rows cut settled on any commit
  that showed the query and let a later key's rows fade (12 clones in one run): React flushes the previous commit's
  effects before rendering the next key, after its handler, so `settle` now names the query it showed. (2) Activity's
  first fling added a page of 27 rows in one task of 3,475 renders; each row mounted Radix's closed dropdown and the
  phone drawer, so the menu mounts on first use. A tap opens it once mounted (a native menu control opens through its
  sheet's ref, which exists only then); a mouse over the row or keyboard focus inside it mounts it ahead, because
  swapping the "..." under a focused or pressed button lost Enter (Radix's keyboard open focuses the first item only
  when its own trigger saw the key: `activity.spec` "hide works from the keyboard" caught it). (3) Growing a page six rows
  a commit made every step wait on observers, and four `activity.spec` cases that wheel a year back timed out: a page is
  one transition instead. Two specs read a count once right after the list appeared while the next page was still
  arriving; they now poll. (4) Activity's rows read their animations in `ActivityScreen`, which renders the screen's exit
  scope and so sits above it; they now use `AnimatedListRow`. (5) The renders gate's "switching back to a visited tab"
  test was red on base: People's `usePublishPeopleState` reads `useIsFocused`, so each switch re-rendered the screen and
  all 38 rows; it is a leaf now and the test passes. Method: `perf/listWork.spec.ts` counts renders from the
  commit hook in the e2e build (`LISTWORK_NAMES=1` against a Metro dev server gives component names, `LISTWORK_PROFILE=1`
  a CPU profile, `LISTWORK_TRACE=1` a timeline summary), interleaving base and after builds; the counts are the gate, and
  timings were taken once the machine fell under load 10. Metro started with `CI=1` does not watch files: a dev server for
  profiling an edit must run without it. A screen whose list moved into `./components/` still counts as scrolling with
  `List` (`lib/refresh/screens.test.ts` follows those imports). The renders gate's main scenario cannot run on this base
  (the scroll stops at 806 rows, and with Search & Ask on the start tab only, owner 218, its Ask phase finds no button on
  Activity), so its counts were not compared. Not run: WebKit, iOS, Android.
- 2026-10-31, F-275 (one export): **a shared label is a hook, not a function that takes `l`.** The Analytics scope chip and
  the Export sheet's Group picker must name a scope the same way; passing Lingui's `t` into a helper does not extract
  (the macro only rewrites the tag where it is destructured from `useLingui()`), so the wording lives in
  `useScopeLabel`, which both call. Also: a header action that duplicated a Settings flow had drifted (INR and the period
  only, no choice, a different file); an entry point to an existing sheet is a preset, never a second writer.
- 2026-10-31, process (fan-out of seven builders): **an isolated builder worktree starts from `main`, not from the
  orchestrator's branch.** Every builder of the round began at the last merged `main`, so each lacked the round's own
  changes (Home removed, the Overview moved, the Bell icon) and every merge back conflicted on the generated catalogs and
  on § 23 / BACKLOG. Rules: a builder brief names the base it must merge first (`git merge <orchestrator branch>`) before
  it edits anything; the orchestrator merges catalogs by taking the union of both `.po` files, its own `messages.ts`,
  then `intl:extract --clean` and `intl:compile`, and checks there are no conflict markers before staging.
- 2026-10-31, F-266 (search, broad first page): **a query with nothing narrow paid for its whole answer before its
  first row.** "> 90" and "Bulk Friend 4" built every token's full id set (30,004 and 69,345 keys at 10,000 expenses),
  then read every `d`, `a` and `s` key, all before the first page. Now each token is probed within 500 keys and, with
  nothing narrow, the first page comes from a newest-first walk of the rows with every token checked in hand; the
  count and totals follow (`SearchSession.whenCounted`, the drawer shows "30+" until then). What it took: (1) a check
  on a row must give the keys' answer, so the walk reads a record's terms from `eachTerm`, the function `termRows`
  stores, and every token kind has a row test beside its key read; the oracle compares first pages, then counts and
  totals, then every row, with the default walk and with one too short to finish (so the walk, a walk read to its end
  and a walk given up on are all exercised); (2) a walk that finds little is pure loss (a row costs 15-25 keys), so it
  gives up when its rate cannot fill a page within 1,000 rows, but not before 180 rows, because the first version gave
  up after 60 rows on "Bulk Friend 4": the rows of a day come in id order, which put no match in the first 60; and when
  the expenses' walk gives up the payments are not walked (the whole answer gives both); (3) the count's key reads
  started right after the first page held its paint ("> 90" 505 ms), so the drawer starts them a frame later (142 ms).
  The totals now arrive later than before (they follow the walk); measured at load 27-37, so indicative. A narrow
  query's path and cost are unchanged ("Bulk expense 9993": 651 keys + 74 rows before and after).

- 2026-10-31, F-275 (new-user audit, add friend / report a problem / sign-in): three things a "show only what works"
  change needs. (1) **Decide "does a server exist" in one reactive place.** Add friend branched on the directory,
  and the first idea (a module function reading the active directory) is not reactive: demo mode swaps the directory
  while the sheet is open (`demo-mode.spec` "the store swapping under an open Add friend sheet"), so it reads
  `useDemoMode().hasDirectory`, which `StoreProvider` sets with the swap. (2) **Merging two entries into one keeps
  both kinds in one sheet, not one mutation:** Dispute and Put on hold stay two mutations (`raise`, `hold`); the sheet
  holds a `kind` and only the footer, description and fields change, so a note typed for one kind is cleared when the
  other is picked (a hold's quick reason is not a dispute note). A bus request of kind `report` has no `hold`
  twin; the old `record-dispute` / `record-hold` / `payment-dispute` / `payment-hold` test ids are gone. (3) **A
  fix that an earlier commit already made still needs its test:** the sign-up name was kept by `accountName()` since
  3420360 but nothing asserted it, so the audit's report could not be closed; `auth.spec` now checks Profile shows the
  typed name. Dead code goes with the entry point it served: `SocialButtons`, `NotLiveYet` and `alf/authBrand.ts`
  (Google's brand colours, used nowhere else) were deleted.

- 2026-10-31, owner 220 (Settings merged into Profile): **removing a tab is caught by the types only where the route is a typed
  key.** `TabId`, `TAB_ROUTE`, `TabParams`, `GLYPHS` and `NAV_LABELS` are `Record`s, so deleting `settings` from `TabId` made
  tsc list every one. It did not list the untyped uses: `navigateArgs('Settings', ...)` in the Settings not-found page and the
  moved-page redirect, `go('Tabs', {screen: 'Settings'})` in `DevTour`, the e2e/perf test ids (`tab-settings`,
  `screen-settings`), the Android smoke script and the window-title tests; grep every string spelling of the route name, not
  only the type. Rules: (1) an address that moves is a `redirectOldPath` rule shared by the resolver and `linking.web.ts`, and it
  must match the exact path with its optional trailing slash (`/settings`, `/settings/`) so the longer section addresses
  (`/settings/regional`, `/settings/friends`) keep working; (2) a saved list that names a removed item loses it on read in
  `readRaw` and a list left empty reads as the default bar, never by a write (`tabs`: `['settings']` alone is the four-item
  default; the old "add Settings back" rules and the editor's Settings lock went with the tab); (3) a page with no entry in
  `section.ts` keeps the tab it was opened from lit, so Profile and the Settings sections need none; (4) a screen turned into
  a component keeps its test ids (`settings-*`), and the page that now hosts it adds one wrapper id (`profile-settings`) for
  the new tests to anchor on. Not run on a simulator or a device here.

- 2026-10-31, process (orchestrator's e2e on PR #4): **two Playwright runs in one folder break each other, and the port
  variable is `E2E_PORT`.** A second run started beside the gate's rerun of 82 failures wiped the shared `test-results`
  folder (the first one died at 49/82 with ENOENT on its own trace files), and its `PORT=` setting did nothing: the
  config reads `E2E_PORT`, so both runs asked for 8081. Rules: a run beside another one sets `E2E_PORT` and its own
  `--output` folder; the failures of a run are taken from its log (`file:line` list), not from `--last-failed`, which
  the next run in that folder overwrites. Also from that run: a spec that writes screenshots writes them under the
  ignored `qa/`, never over tracked files; and a spec that calls the dev hook waits for the hook itself
  (`window.splito?.createPerson`), not for the `splito` key, which outlives an account switch.

- 2026-10-31, full e2e on PR #4: **a hand-over between two stores removes the source only after the target has
  committed.** `LocaleFromPrefs` took the language picked while signed out into the account and deleted the device
  copy in the same tick; the account write is an IndexedDB transaction, so a reload in that window (the spec's `goto`
  right after sign-in, or a person refreshing) lost the choice for good. The device copy now goes in the write's
  `then`, and a failed write leaves it for the next launch. Same rule as "never `goto` right after a click that
  writes", from the app's side.

- 2026-11-01, full e2e on PR #4: **demo mode went from 8.0 s to 18.8 s to switch on, and the cause was a new summary
  card, not the store.** Bisect the cheap layer first: the seed timed in bun at `main`, before and after the search
  change, was the same, so the client was at fault; switching the new People Overview off took 5.7 s away. Rule in
  17.1. The remaining 12-13 s against the 8.0 s baseline was measured at load 4-6 and is to be re-read on a quiet
  machine before anything else is changed.
- 2026-11-01, F-278 (Profile fits one phone screen): **make a list's first row a prop, not a second list.** Payment details
  had to be the first row of the Settings rows, so `SettingsRows` takes an optional `leading` node rendered first inside
  its container (absent keeps the list as it was) instead of Profile drawing a section above it with its own spacing;
  `profile-settings` therefore contains `profile-payment`, and an order spec lists the container before its first row.
  Also: removing a section means checking where its job lives first (Friends and invites lists every friend link with
  QR and Copy and "Create invite link"), and `e2e/demo-mode.spec.ts` "seeds the demo database in under 10 s" fails at
  machine load above about 17 (the seed took over 30 s), so it is not evidence about a Profile change.

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
- Local search filters on every keystroke (§ 26.12); search and Filters buttons hide while the list is
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
- [Built] **One export** (F-275, assistant ruling 2026-10-31, after the new-user audit's F-12): there is exactly one
  Export sheet (`features/export/ExportSheet.tsx`), and every entry opens it: Settings > Your data, the Group and Person
  overflows and the Analytics header icon (`analytics-export`, label "Export"). An entry only pre-sets it (`ExportPreset`:
  format, group, friend, currency, a date range, or a scope of several groups): Analytics starts it as a CSV on its
  current period (as a custom range), currency and scope (`screens/Analytics/exportPreset.ts`; one group is the group
  filter, Everything is none, any other scope is `StatementFilter.scope` and is named like the scope chip,
  `useScopeLabel`). The file is the statement CSV (`statementCsv`: RFC 4180, CRLF, formula guard on text that is not a
  plain number, so a refund's `-12.50` stays a number; web download with a UTF-8 BOM through `lib/export/saveFile`;
  native hands the text to the share sheet), so Analytics no longer has its own CSV writer; it lists payments and an
  opening balance too, and ignores a selected chart bar (the old file followed it). `reportCsv`/`csvCell` stay in
  `@splito/domain` for the report rows. The sheet's address on Analytics is `/analytics/export` (+ pickers, listed in
  `lib/links/table.ts`); a pasted one waits for the report, then opens pre-set. Metric `export` with
  file and outcome; a cancel is silent; only a failed write or hand-over is an issue.
  *Reads/writes*: the sheet's own (`loadStatement` by index up to the end date, `loadDisputeMarks`); nothing new.
  *Cost*: the Analytics screen mounts one closed dialog control (no reads until opened); the old full `readRows` pass
  and `report.exportRows` are gone; one preset object per report render. *Telemetry*: none added.
  *Checks*: bun `statement.test.ts` (scope), `exportScope.test.ts`, `table.test.ts`; Playwright `analytics.spec.ts`
  (header icon opens the shared sheet on the year, INR, everything, then on a group and on Non-group only, with the
  files checked), `backup.spec.ts` and `settingsTab.spec.ts` for the other entries; web only, iOS and Android not yet.
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


---

## 26. Product & UI rules (owner decisions, binding)

Everything the owner has decided about the product, its UI and how work is done, consolidated to the current
truth. These rules win over everything else in this document, the design spec and Bluesky's defaults (binding
order at the top), and over any task text that says otherwise. Where a decision replaced an earlier one, only
the current rule is written here; the history is in the decision log (§ 26.23). Every decision so far is dated
2026-10-26.

Format: **rule**, then *Why* (the owner's words), then *Where* (paths on `ui/preview-latest` at `0546097`, the
newest UI branch; the main checkout's `m1-foundation` has no client code). Widths: **phone** = native, or web
under 800 px; **rail** = web 800-999 px (Bluesky's minimal LeftNav); **desktop** = web 1000 px and up (full
labelled sidebar); **wide** = web 1300 px and up (Bluesky `gtTablet`, right column shows).

### 26.1 Principles and process

- **Reuse before you write, inside Splito first** (owner 210). Before adding any component, hook, helper, row,
  card, sheet, query, mutation, format or test helper, search this repo for one that already does it (and then
  Bluesky, rule below) and use or extend it; two pieces of code that do the same job are a defect, fixed by
  merging them into one shared piece. Examples that must stay single: the person row and `PersonLink`, request and
  invite rows and their actions, the Overview card, balance chips, `activityPath` links, the invite link / QR
  block, the FAB allow-list, empty states, filter and sort sheets, amount formatting. Every builder brief says so,
  every Opus review lists duplicates as findings, and a builder report names what it reused. *Why:* "make sure
  whatever can be reused do it".
- **Bluesky first: copy, don't write.** Before writing any code (component, hook, screen, layout, list,
  dialog/sheet, menu, tabs/pager, search input, settings row, toggle, avatar, badge, toast, animation, gesture,
  haptics, keyboard handling, navigation, storage, i18n, error boundary, test helper, e2e pattern, build
  config), search the Bluesky clone at `/Users/saransh/Desktop/Splito-Handoff/upstream/social-app` (`src/`,
  `modules/`, `__e2e__/`, `jest/`, config files) and copy the equivalent, changing only what is required
  (routes, data, logo, licensed icon glyphs -> Lucide, copy, social-only code). Write new code only where
  Bluesky has none (money, splits, settlement: `packages/domain`), following the nearest Bluesky pattern.
  Every report has a "Bluesky search" section (what was searched, what was copied, what was written from
  scratch and why). Reviewers fail work that re-implements something Bluesky has. *Why:* "always take code
  from Bluesky because it has the best code, don't write code on your own; whatever you want to build, check
  in Bluesky". *Where:* attribution header and reuse row (`AGENTS.md` § Attribution, `docs/reuse/<stream>.md`).
- **The UI is Bluesky's design, pixel for pixel;** only the required replacements change (routes, data, logo,
  licensed icon glyphs, copy, social-only code). When a UI behaviour is undecided, do what Bluesky does.
  *Why:* "I need same Bluesky design", "every pixel to pixel same with Bluesky and don't create new, just copy
  paste", "go with what Bluesky had".
- **Copy Expensify too, and copy practice, not just looks:** structure, coding standards, code practice and
  speed come from Bluesky and Expensify App (both MIT); Bluesky wins for client code. Their licensed artwork,
  icons and logos are never copied. *Why:* "And Expensify as well", "make sure to copy not just the design but
  the code practice", "speed and all", "the structure", "coding standards". *Where:* `AGENTS.md`.
- **Best of both, per feature:** for every feature, compare how Bluesky and Expensify App do it and take
  whichever gives the better user experience and the richer feature set, including features one app has and
  Splito lacks. Expensify is the default reference for money and expense flows (split, itemize, receipts,
  scan, reports, settle up, categories, tags, reminders, export, approvals), Bluesky for shell, navigation,
  social, lists, motion and client code. Features and flows can come from either; the visual language stays
  Bluesky's (an Expensify flow is rebuilt with Bluesky components), and licensed artwork, icons and logos are
  never copied. Each feature's reuse row names both apps' equivalents and why one won. *Why:* "make sure to
  pull features from Expensify and Bluesky whatever you think is better for user experience and features".
  *Where:* `docs/reuse/<feature>.md`; scouting list in `docs/BACKLOG.md`.
- **Simple, with every feature and the customization that matters** (owner 129). Splito keeps every
  feature and the settings people genuinely need (decision 128), but it must feel simple: each screen shows
  only what that moment needs (one primary action, the essentials first, power features one tap deeper in a
  menu, sheet, "More" or detail page, never removed); defaults do the right thing so nobody has to configure
  anything to start; no screen is a wall of chips, badges, counts or toggles; copy is short (one line per
  card, one sentence of help at most); a new feature is placed where it is used, not added as a new section
  or setting by default. Every Opus review checks a change for clutter as well as correctness, and the UX
  audit (F-240) and Settings prune (F-251) apply this rule. *Why:* "we need to make this app simple with all
  the features and customization".
- **Simple for the user, simple in the code, instant on every tap** (owner 212). Every screen and flow is
  designed from the user's side first: one obvious main action per screen, plain words (no jargon such as
  "ledger", "outbox", "scope"), the fewest taps to finish a job, the same pattern for the same job everywhere, no
  choice the person must make before they can start, and nothing shown that they cannot act on. Every Opus spec
  states the flow tap by tap and why each step is needed; every Opus review checks it as a new user would and
  lists friction as findings. The code stays as simple as the UI: the smallest change that works, no layer or
  option without a present need, one shared piece per job (owner 210). And every tap answers at once: visible
  feedback within 100 ms and content within 200 ms on the slowest target (owners 107, 189). *Why:* "think from
  users perspective as well, app should be simple to use, nothing complex, make sure of UX"; "code should be
  simple"; "it should be lightning fast when I click somewhere".
- **Every screen has its finishing pieces, and none is overdone** (owner 213): a same-size skeleton wherever
  content loads (never a blank area or a spinner on a list or card); a small loading indicator only where the
  wait is not content (a button saving, a sync, an import, the splash); motion only where it explains a change
  (opening, closing, a value changing, an item arriving), all short and quiet; Lucide icons that mean one thing
  each, used the same way everywhere; an empty state on every list with its own art, one sentence and one clear
  call to action (the next useful step, e.g. "Add a friend"); and one primary call to action per screen. The
  guided tour (F-253) covers only what a new user must know to start (adding an expense, settling up, where
  balances are), at most a few steps, skippable, shown once. Nothing is added for decoration. *Why:* "make sure
  to use proper skeletons, proper animations, proper icons, proper empty screen and proper CTA"; "loading
  wherever required"; "guided tour for required part only"; "don't overdo anything".
- **Customizable where it helps, never forced** (owner 128, replaces "everything customizable"). A setting
  exists only when people genuinely want different answers and the default cannot serve them all (language,
  theme, default currency, timezone, home tab, bottom bar, list filters and sorts, motion, reminders, privacy).
  No setting for a detail nobody changes, no switch that duplicates another control, no setting just to
  hide a small UI element: those get one good default (Bluesky's or Expensify's) and no row. Settings stays
  short and grouped (7 pages after F-251; no Settings search, none is needed at that size); every remaining choice keeps its preferences-registry entry and its Settings
  row (§ 24), and every user choice that does exist is remembered in the database (decision 90). Collections
  (cards, tabs, lists) can still be shown, hidden or reordered where people really differ. *Why:* "customization
  are needed, but not forcefully, only whats needed"; "remove this, its not needed" (the "Language menu"
  switch). Earlier: "remember every single thing to be customizable". *Where:*
  `packages/sync/src/preferences.ts`; F-251 prunes the current list.
- **Fast and animated, always:** no feature is done until it meets § 26.10. *Why:* "consider speed and
  animations always"; "make sure things are smooth like Bluesky"; "animations can be added like Expensify".
- **Best in class, premium, never basic.** Splito aims to beat every competing app on features, looks and
  simplicity. Previews show seeded, populated screens (demo data in dev/e2e builds only), never empty shells.
  *Why:* "make sure this is best in terms of features, looks, simplicity"; "this is way too basic like 10th
  class app"; "make it look professional not some third grade project".
- **A large demo dataset for the owner's own testing** (dev and e2e builds only, never production): a
  deterministic generator (fixed seed) that writes a year of realistic use through the real mutations: about
  30 friends, 12 groups (trips abroad, flat, office lunch, family, wedding, sports), ~1,500 expenses in 6
  currencies with every split mode (equal, exact, percent, shares, itemised with portions, multiple payers),
  repayments, write-offs, notes, categories, recurring rent and subscriptions, and deleted items for the bin.
  It is loaded with `?demo=large` (web) / `EXPO_PUBLIC_DEMO=large` (native) or from Settings > Data > "Add
  demo data" (shown only in dev/e2e builds), adds to whatever is already on the device, and has a matching
  "Remove demo data". **Owner 94 + 95 supersede the URL switches and Add/Remove:** demo is a **mode switch**, Settings > Data >
  "Demo mode" (on/off), backed by its **own separate local database** (its own IndexedDB database / SQLite file,
  with its own preferences, history and outbox). Turning it on switches the app to the demo database, seeded
  once with the one demo dataset; turning it off switches back to the real data, which demo mode never reads
  or writes. Demo data never syncs and never merges into an account. While on, no banner shows (owner 133); the Settings switch and the avatar's "Demo" state say so; "Reset demo" reseeds it. There is ONE demo dataset and ONE
  switch: no small set, no URL (`?demo=1`, `?demo=large` gone), no `EXPO_PUBLIC_DEMO`, no Add/Remove demo
  data; e2e turns demo mode on only through a test-only hook (`window.__splitoTest.demoMode`) that runs the same
  switch (F-228a, being built on feat/demo-mode). Available in every build, production included (owner 148), as lazy chunks the start-up bundle never
  loads; the legacy cleanup and the e2e hook stay dev/e2e only. *Why:* "add a lot of demo data to my
  account".
- **Once the backend exists, the demo data comes from the backend, not the app** (owner 135; F-252, backend
  batch). The demo dataset and its generator move to the server: turning Demo mode on downloads the one demo
  dataset (a versioned snapshot, same shape as a sync pull) into the separate local demo database, and "Reset
  demo" downloads it again; the client bundle then ships no demo seed, generator or fixtures (a build check
  fails if it does). The download is read-only and never touches the real account; offline, the switch says it
  needs a connection and works offline while it stays on. Until the backend
  exists the dev/e2e builds keep seeding locally as today. *Why:* "remember when backend is built, you need to
  download the demo data from backend, not store in frontend".
- **Switching demo mode off deletes the demo data** (owner 136, now and with the backend): turning the switch off
  returns to the real data and then erases the separate demo database and every demo-scoped device key (drafts,
  search history, read marks), so nothing of the demo stays on the device; turning it on again starts fresh
  (seeded locally today, downloaded from the backend once F-252 ships). "Reset demo" goes away, since off and on
  is the reset. *Why:* "and remove when demo mode is switched off".
- **The demo dataset grows with every feature, in the same change** (owner 109). A feature is not done until the
  one demo dataset (§ 26.1 demo mode) shows it with realistic, multi-currency examples: e.g. the Supper Factory
  bill with tax classes and stacked charges (F-403), comment threads (F-1204), reminders (F-1118/F-1119), inactive
  and hidden groups (F-604), deleted expenses, payments and a deleted group shown in place and one hidden
  (decision 103/105), left members and a handed-over admin (F-615), Ask-ready balances, exports, feedback rows.
  A `demoCoverage` test lists every user-facing feature and asserts the seeded demo database contains at least
  one record exercising it; adding a feature adds its line, and the test fails if the demo lacks it. Reviews
  check it; the wave assemble step re-seeds and re-screenshots. *Why:* "make sure to update the demo data again
  and again, with all the changes".
- **Don't ask; decide.** The owner has delegated every open choice: make the call, record it (spec decision
  table or here), deliver the final version, and do not interrupt with questions; reports state what was decided
  instead of asking the owner to confirm product calls (owner 224). *Why:* "don't ask me anything, take your own
  decisions, give final version"; "do what you want to do, take own decisions, don't disturb me"; "You take all
  decisions, don't ask me".
- **The local preview is always the newest build** (owner 122). http://localhost:8090 serves the newest
  integrated code: a watcher rebuilds it (e2e web build, demo mode available) within a few minutes of every
  commit to the integration branch or the main line, so the owner never looks at an old build; the reply that
  reports a change says which commit the preview shows. *Why:* "keep rebuilding app after changes, I see very
  old always".
- **Screenshots after every UI change the owner asks for:** populated light and dark (Dim), phone and
  desktop, sent in the same turn or as soon as they exist, work in progress labelled honestly. During an
  autonomous run the owner asked not to be disturbed: send one consolidated set at the end instead. *Why:*
  "keep sending me SS on my every update"; "don't disturb me".
- **Record every owner decision here in the same turn** (§ 0 rule 9). *Why:* "make sure this file updates on
  its own, whenever there is any such decision"; "make sure to add whatever we discussed so far". *Where:*
  `.claude/settings.json` UserPromptSubmit hook reminds on every prompt.
- **Every request goes into the feature list first, then features are built one by one.** Each owner request
  (new feature or change) becomes or updates an entry in `docs/BACKLOG.md` (ID, acceptance criteria, status)
  and gets a slot in the build order, in the same turn as its § 26 rule. Work then takes the next feature from
  the list and finishes it (built, tested, merged, screenshots, status updated in BACKLOG and
  `COMPLETION_MATRIX.md`). **Building fans out:** features that touch different areas are built in parallel
  by Sonnet workers in separate worktrees (waves ordered by dependency: a feature waits only for what it
  depends on), each reviewed by Opus and fixed once, then one assemble step merges the wave, runs every check
  and deploys the preview. *Why:* "add everything to feature list and pick one by one"; then "fanout with
  sonnet and get done" (replaces strictly one feature at a time).
- **Model split: Opus thinks, Sonnet only builds** (owner 211). Opus (latest) does every important decision
  (what a screen holds, what goes where, the flow from tap to tap, data model and navigation choices, rulings),
  every design/spec handed to a builder, all **performance** work end to end (measuring, finding causes, fixing),
  and every review, audit, judge and verification. Sonnet (latest) only implements what an Opus spec already
  decided (building, fixing review findings, migrating, test work); a builder that hits an open product or flow
  question stops and asks rather than deciding. *Why:* "for important task use opus always like speed, new
  features decisions"; "performance"; "important decisions like what should be there, what should be the flow";
  "sonnet should be used to build only".
- **Large work fans out** into parallel throwaway worktrees (§ 20) with judges and review. *Why:* "Fanout".
- **Push to GitHub after every merge** (owner 149): `main` is pushed to `origin`
  (`github.com/saranshbalyan-1234/splito`, public; Render auto-deploys `main` to https://splito-web.onrender.com)
  right after each merge, using the personal account `saranshbalyan-1234` (a repo-local credential helper reads
  its `gh` token; the global `gh` account is left alone). Only reviewed, merged work reaches `main`; feature
  branches stay local unless asked. Never commit secrets (`.env.local` is git-ignored). *Why:* "now keep on
  pushing to github as well"; "use saranshbalyan-1234 account to push"; "the personal account".
- **The main line is `main`** (owner 147, 2026-10-29; renamed from `m1-foundation`, which stays as a git alias
  pointing at `main` so old references still resolve). Waves assemble on an integration branch and merge into
  `main`. *Why:* "change the main branch to main".
- **No e2e test ever opens another app on the machine** (owner 118). Playwright runs in a real Chrome on the
  owner's Mac, which hands `mailto:`, `sms:`, `tel:`, `upi:`, WhatsApp links and the Web Share sheet to macOS apps.
  So there is no e2e test of "Send by email" (removed on every branch, 2026-10-29), and no spec clicks a share,
  invite-share, Remind send, SMS, WhatsApp or UPI pay control unless the app routes it through `lib/openExternal.ts`,
  which under `IS_E2E` only records the URL on `window.__splitoTest.externalUrls`. Builder and reviewer briefs say so.
  *Why:* "remove email test, the emails are being triggered and app is opened".

### 26.2 Product scope, platforms and backend

- **Keep every feature of the handoff spec, plus the agreed USPs and everyday features;** never cut scope to
  simplify. The master feature list is `docs/BACKLOG.md`, built batch by batch. *Why:* "need all what you
  dropped"; "think of more features if you want to add"; "think of all the features it might have and store
  them and keep building one by one". *Where:* spec §§ 1 and 4, `docs/BACKLOG.md`.
- **Analytics with graphs is required** (§ 26.16). *Why:* "analytics also needed, with graphs and all".
- **Multi-language: English is the default; Hindi is the second launch language** (Hindi is the assistant's
  call). Indian number grouping under Hindi and en-IN. *Why:* "multi language support", "default eng". *Where:*
  § 7, `locale/`.
- **The user sets their own timezone** (Settings > Regional); each expense keeps its local date and IANA tz.
  *Why:* "set your timezone". *Where:* spec § 5, preferences registry.
- **All platforms (iOS, Android, web/PWA) get the full polish: splash, branding, icons, and every wave is checked on each** (an iOS simulator pass and an Android emulator pass after each wave; Android not yet run for Wave B, scheduled after Wave C, 2026-10-30). *Why:* "for all
  platforms: splash, branding etc". *Where:* § 8, `apps/client/scripts/brand.ts`.
- **Front end first, then the backend** (owner 164, 2026-10-30, reaffirms 93 and replaces the plan to start the
  auth/sync backend right after Wave C or in parallel with it): every front-end batch in BACKLOG is finished
  (Wave C, then the remaining front-end batches) AND the owner says they are okay with all the front-end changes
  (an explicit sign-off) before any backend work starts; until then sign-in runs on the
  labelled dev account (owner 125) and everything stays local. *Why:* "finish the frontend first, and then start
  backend"; "once I say I am okay with all frontend changes".
- **Backend comes after the UI, and it is mandatory, not optional** (owner 93: "we need to implement the backend as well, once we are done with all the features"): when the front-end batches are done, every BACKLOG backend item (E21, E22, the server halves of E23 and of any item marked Backend yes) is built before the product is called done. **Backend comes after the UI.** Front-end batches first; the server is Fastify on Bun with **Postgres**.
  *Why:* "let's build backend later once we are done with UI"; "use Postgres". *Where:* `docs/RESUME.md`, § 9.4.
- **GameRun's Expo architecture is adopted where it fits** (§§ 21-22 record the calls). *Why:* "can you also
  look into architecture md file from GameRun expo".

- **Welcome tour on first launch** (owner 123; F-249, Wave C). A fresh install opens short swipeable intro
  slides that say what Splito is and what you can do, before sign-in, then hands over to the Continue screen:
  - **5 slides max**, each an original animated illustration (Lottie, static under reduced motion), a title and
    one sentence, built on Bluesky's Pager with dot indicators (tappable) and its direction-aware slide:
    1. Split anything with anyone: friends, groups, trips, any currency, never mixed.
    2. Bills done right: items, portions, different taxes per item, service and round-off.
    3. Settle up in fewest payments, record cash or UPI, remind gently.
    4. Search or ask anything: "how much did I spend on food in Goa?".
    5. Yours, offline: everything is saved on this device first (copy says sync only once it exists, § 0 rule 6).
  - **Controls:** "Skip" top right on every slide (goes straight to the Continue screen), "Next" as the bottom
    primary, the last slide's primary is "Get started"; swipe and the dots move both ways; a language chip top
    left on the first slide (English / हिन्दी), because the tour is the first thing read. Phone: full screen;
    rail and desktop: a centred card (~560 px) over a dimmed app, Escape = Skip.
  - **Once, then on demand:** shown once per install (`onboarding.tourSeen`, device preference kept in the
    database, decision 90); Settings > Help "See the intro" replays it; never shown in demo mode or to e2e runs
    (the test hook marks it seen; one spec covers the tour itself). Every slide has a URL (`/welcome/1` .. `/5`,
    owner 100).
  - **Two different things** (owner 142): these swipeable **intro slides come BEFORE sign-in** (what Splito is,
    like many apps' first-open screens; "Get started" leads to the Continue screen, owner 140), and the **tour
    comes AFTER the first sign-in** [Built, F-253, web; native not run on a device]: a guided walkthrough over the real
    app, **exactly three steps** (owner 213: only what a new user must know to start), one at a time with Next / Skip
    (the last step's primary is Done): (1) **Add an expense**, on the FAB (phones) or the sidebar "Add expense" pill
    (rail, desktop); (2) **See who owes whom**, on the first friend row of People; (3) **Settle up**, on that row's balance,
    else on the Groups tab. With no friends yet there is no row, so step 2 stands on People's Add friend button with
    empty-state wording ("Your friends will show up here, with what you owe each other."; step 1 falls back the same way
    if its FAB or pill is ever missing, with "Add a friend here first ..."); a step
    with nothing to point at is left out and "Step N of M" counts what is shown (`planTour`, `lib/tour/steps.ts`, pure and
    tested). Each step spotlights the real control and **blurs everything else** (owner 143: a blur plus slight dim, the
    control sharp inside a rounded cut-out, a caption card beside it: below, above or beside by the room there is); web
    `backdrop-filter` masked by the same hole path the dim uses, native a plain dim (`expo-blur` is not a dependency),
    reduced motion or reduced transparency a plain darker dim. The overlay blocks the app underneath, moves focus to the
    caption, Escape is Skip, buttons are 44 px+, the card is at most 340 px and never wider than the screen less 16 px
    gutters (320 px, Hindi). It runs **once per account**, right after sign-in when People is the page showing and loaded
    (`onboarding.tourSeen`, an account preference in the `app` group with no Settings row of its own; Skip and Done both
    set it), never in demo mode, never while a sheet is open (it waits), and replays from **Settings > Support
    "Take the tour"** (hidden in demo mode; it takes the app to the plain People tab first). One `TourHost` is mounted
    at the app root like `LogOutHost`: an account that has seen the tour pays one preference read at launch and renders
    nothing; the overlay, its measuring and its timers exist only while a tour runs. Controls register themselves with
    `useTourRef(id)` (`lib/tour/registry.ts`, a ref callback in a module store, no re-render): the FAB, the sidebar pill,
    People's Add friend, the first row and its balance, and the Groups item of the bottom bar and the sidebar. E2E
    builds never start it by themselves; a spec arms it with `window.__splitoTest = {tourAuto: true}` before the page
    loads. First-use tips after the tour (`tips.enabled`) are not built (owner 213: nothing more than the essentials).
  - Screen readers hear "Step 2 of 5" and each title as a heading; tap targets 44 px; works at 320 px in Hindi.
  *Why:* "like what you get when you install one app and you get one overview, where you have to click next or
  skip which explains you what this app is and how to use".

### 26.3 Shell and navigation

- **There is no Home tab; the Overview is the top of Analytics** [Built, F-271; web checked in e2e at 390 and 1440, native not run on a simulator] (owner 198, replaces the Home tab of 153 below):
  the tabs are **People, Groups, Analytics, Activity** (owner 220: Settings is not a tab or a nav item any more, it is
  part of Profile, opened from the header avatar; Ask Splito is not a tab or a nav item, owner 200). The
  Overview (per-currency balance cards, owners 113/114/120/161) is the first section of People and Groups (owners 219,
  221, § 26.12), labelled as balances right now; Recent transactions is Activity (Type = Expenses and Payments), and recently active people and groups
  are People and Groups sorted by Last active (owner 199). The app opens on **People** (the start tab; Settings >
  Navigation can change it); `/` opens the start tab; the old `/?overview=` address redirects to
  `/analytics?overview=`; a saved tab list or start tab naming `home` is migrated (dropped, start tab People). The
  logo goes to the start tab; every "Home" fallback (Back parents, owner 184; sign-in return) becomes the start tab.
  *Why:* "move the overview section to analytics as well, and then remove home".
- **(Superseded by owner 198) Home, People and Groups are three tabs; the Overview lives only on Home** [Built, F-256, web; native not yet checked on a simulator] (owner 153; replaces the
  Home-holds-the-friends-list layout of 120 and the Overview on Groups):
  - **Home** (`/`), top to bottom (owners 153, 154): the **Overview** (per-currency cards, owners 113/114/120,
    "Analytics ›"; a scope choice in its header, **All** (default) / **Groups** / **Direct** (non-group), changes
    only the cards and their counts, remembered and in the URL `/?overview=groups|direct`, and "Analytics ›" carries
    it over; owner 176); **no requests or invites on Home** (owner 197: they live on their own pages, below);
    **Recent transactions** (F-1415: the newest expenses and payments
    across everything, "See all" -> Activity); **Recently active people** (the 5 friends with the newest change,
    by change time, with their per-currency net, "See all" -> People); **Recently active groups** (the 5 groups
    with the newest change, balance chips, "See all" -> Groups, same rule as § 26.17). Each section is short (5
    rows at most) and hides when empty. Header: avatar | logo (phone) / "Home" | Search & Ask (no Add friend
    here). On wide screens the right column is not shown on Home (its content is on the page), so nothing repeats.
  - **Ids and routes:** the tab ids are `home | people | groups | analytics | activity` (plus `ask`, `settings` in the shared list) and the routes `Home` (`/`) and `People` (`/people`); the old route and id `people` meant Home. Tab glyphs (F-1713): People is Lucide `ContactRound`, Groups is `Users`.
  - **Requests and invites live on their own pages, never on Home** (owner 197): **People** shows friend requests
    (Accept / Decline) and friend invites sent (Resend / Cancel) at the top; **Groups** shows group requests to me
    (Join / Decline), join requests for groups I run (Approve / Decline) and group invites sent, at the top; a
    **group page** shows its own pending join requests and invited members under Members. Each section is the
    one-line row layout of § 26.18, at most 5 rows, then "See all" into Activity filtered to Friends and invites (and
    the group, owner 195), and hides when empty. *Why:* "all these invites should show on their respective page, not
    on home page, like group and people".
  - **People** (`/people`, new tab, Lucide `ContactRound`): friend requests and invites sent at the top (owner 197),
    then the Friends list with its search and Filters (owners 91, 120, 130) and a settings (gear) icon on the right of the
    Friends header (search, Filters, gear; it opens Friends and invites; no "Manage" text button, owner 177); no Overview. Header:
    avatar | "People" | Search & Ask + Add friend. A friend still opens `/people/:id`.
  - **Groups** (`/groups`): group requests, join requests and group invites sent at the top (owner 197), then the
    groups list with search and Filters; no Overview. Header unchanged.
  - **Navigation:** the shared list becomes Home, People, Groups, Analytics, Ask Splito, Activity, Settings; the
    default phone bottom bar is Home, People, Groups, Analytics, Activity (5 tabs, labels shown under the icons up to 5 tabs, `components/TabGlyph.tsx` `TabLabel`); Settings >
    Navigation still lets the user change it (owners 84, 127). Every tab keeps the FAB rule (§ 26.6).
  *Why:* "on home show overview and recent transactions, then create a people tab as well, the group tab is
  already there, the overview is needed only in home".
- **Bluesky's shell on every width.** Web fills the whole screen: left sidebar plus main content (plus the
  right column when wide, § 26.17). *Why:* "on web it should occupy complete screen", "the navigation should
  be like Bluesky", "for web, keep my left sidebar and main content".
- **Destinations:** the home destination is labelled **"Home"** (house icon; it holds the Overview and the short
  recent lists). Phone bottom bar by default = Home, People, Groups, Analytics, Activity, plus the FAB (§ 26.6). **Search and AI are not pages:** both live in the Search & Ask drawer opened from the header icon (below). *Why:* "that search to be available globally on home section instead of a separate page" (replaces "Search as the second tab"). **One navigation per
  width, never two** (owner 217, replaces the phone drawer of 23/62): a phone has only the bottom bar, rail and desktop
  only the sidebar; there is no side drawer anywhere. The bar and the sidebar show the same items with the same icons
  and labels (People, Groups, Analytics, Activity, Settings); the sidebar adds the logo, the "Add expense" pill and the
  footer links (Feedback · Help · Privacy · About), which a phone reaches in Settings > Support. One `navigationItems`
  array and one `NavFooterLinks` component feed them (§ 3). Profile is never a nav item (the avatar opens it). *Why:*
  "Remove the sidebar in mobile completely, either sidebar or bottom navigation"; earlier "make notification as
  activity and move to bottom". *Where:* `view/shell/bottom-bar/`, `view/shell/desktop/LeftNav.tsx`.
- **Search & Ask: one drawer for search and AI.** An AI icon (Lucide `Sparkles`, the widely recognised AI
  mark; not a magnifier, not `Zap`, which reads as "fast") sits **only in the header of the start tab** (owner 218:
  the tab the app opens on, People by default, whatever Settings > Navigation "Open on" names; the button follows a
  change; a pushed copy of that tab keeps it, owner 190), to the LEFT of that page's action, on every platform; no
  other tab or page draws it (Groups, Analytics, Activity, Settings), and Cmd/Ctrl+K and "/" still open the drawer from
  anywhere on web (`SearchAskButton tab=...`, `state/startTab.ts` `useIsStartTab`); accessibility label "Search or ask Splito", tooltip on web. Tapping it opens the **Search & Ask
  drawer**: a full-height drag-to-close bottom drawer on phones,
  a large centred popup (command-palette style, ~720 px) on rail/desktop. Top: one Bluesky `SearchInput`
  ("Search or ask anything"), autofocused. Empty: recent searches and suggested questions. Typing shows grouped
  live results (People, Groups, Expenses: title, notes, items, category, amounts like "> 1000", dates like
  "yesterday"; query highlighted) with an "Ask Splito: '<query>'" row first. Tapping that row, or pressing
  Enter on a question, turns the drawer into the Ask Splito conversation (§ 26.19) with a back arrow to the
  results; tapping a result opens it and closes the drawer. **Cmd+K (Ctrl+K on Windows/Linux) opens it from
  anywhere** on web and on iPad/Android with a hardware keyboard (also "/" on web); pressing it again or Escape
  closes it. On desktop the header button's tooltip and the input's right edge show the hint "⌘K" / "Ctrl K".
  There is no Search page and no Search nav item; the old `/search` route opens the drawer with the query. The
  Friends section's own search icon is removed; Groups keeps its list search. *Why:* "the search option to be
  left of add people on the header, which expands on click"; "this search should open a drawer instead which
  would support ai as well".
- **Settings > Navigation lets the user choose the phone bottom bar from every sidebar item.** All items of the
  shared list (People, Groups, Analytics, Activity; owners 198, 200, 220) are offered, each with a toggle
  and a drag handle (Bluesky's reorderable list): what is on and its order is the bottom bar, with **any number of
  tabs** (the start tab cannot be turned off; Settings is no item, it is in Profile behind the avatar, owner 220, and
  a saved bar naming `settings` loses it on read). Tabs share the bar width equally; with
  more than 5 the labels hide and icons stay at Bluesky size with their badges. An item that is off is not on a phone
  (its page still opens from links). Default bar: People, Groups, Analytics, Activity (owner 220). **On rail and desktop every item always shows** (owner 155, replaces 127's "off items under More" on wide
  screens): the sidebar and rail list all items (People, Groups, Analytics, Activity),
  in the order chosen in Settings > Navigation, with no "More" item; the on/off choice shapes only the phone bottom
  bar.
  "Reset" restores the default. Stored in the existing `tabs` preference. *Why:* "all of the sidebar options to
  be available in settings to be added in navigation bar".
- **The bottom bar keeps a little air under its labels** (owner 222): on phone web the bar pads its bottom by the
  home-indicator inset, or 8 px when the browser reports none (Safari with its toolbar shown), so the labels never sit
  on the screen's edge (`BAR_BOTTOM_PAD`, `BottomBarWeb.tsx`); native keeps Bluesky's `clamp(inset, 15, 60)`. Content
  follows the bar's measured height. *Why:* "Add a little padding from bottom on navigation bar".
- **Every place has a URL, so a copied link lands on the same screen** (owner 100; F-241, built; Expensify's model, where every side panel and modal is a route). Every page, every in-page tab (Group
  Expenses / Balances / Members, Activity tabs, Analytics views), every sheet and popup (Add / Edit expense,
  Record payment, Settle up, Add friend / Invite people, Create / Edit group, Members, Payment rules, Filters,
  Search & Ask with its query and Ask mode, Send feedback, Export / Import, every Settings section and editor),
  **every drawer** (the side drawer / menu, e.g. `?drawer=menu`, and the Search & Ask drawer) **and every bottom
  sheet including pickers opened inside a sheet** (currency, date, category, people: a sub-route of their sheet,
  e.g. `/expense/new/currency`; owner 101)
  and the list state that matters (filters, sort, Show settled, scope, period, currency) is in the URL on web
  (path or query) and the same deep-link path on native. Opening one pushes its URL; closing goes back; browser
  Back closes the top sheet; pasting or refreshing the URL opens the parent page with that sheet or tab on top,
  with the draft restored (§ 5). An entity that is not on this device shows "Not on this device yet" (§ 14).
  Exceptions, for safety: confirmation prompts (Delete?, Log out?, Discard changes?) and "..." menus are not
  addressable, and no URL ever performs or arms an action (§ 14 "links carry no command"); a sheet URL only
  opens the sheet. *Why:* "for every tab, every popup it should be via url, so that even if i copy paste the
  url i land on same place". *Assistant rulings, 2026-10-29 (not yet seen by the owner):* tab switches replace the
  history entry, so Back never steps through tab taps; a pasted sheet-plus-picker URL is one history entry, the
  browser's Back leaves to the previous site and the in-app X steps back one level.
- **Deep links work end to end, everywhere** (owner 145; F-254, client part built with F-241; the hosted
  files and the deferred-link hand-over ship with the backend/domain). Every URL of F-241 (pages, tabs, sheets, drawers, pickers, list
  state) is also a deep link: `https://splito.app/<path>` opens the installed app at that exact screen through
  iOS Universal Links (associated domains + `apple-app-site-association`) and Android App Links (verified
  `assetlinks.json`), falls back to the web app when the app is not installed, and `splito://<path>` works as
  the custom scheme; the same resolver (§ 14) handles links from push notifications (F-2201), invite links and
  QR codes (F-619), email/SMS reminders, the share sheet, Ask answers and Search results. Opening a link:
  signed out -> intro/Continue, then resumes at the target (owner 125); in demo mode -> asks to switch back
  first when the target is real data; not on this device yet -> "Not on this device yet" until the pull
  (§ 14); unknown path -> Home. Links only navigate, never act (§ 14). After an install from a link, the first
  open goes to that link's target (deferred link, store-safe: the link is kept on the web page and handed over
  by the app's first open, no third-party SDK). Each build claims only its tier's host (§ 14). Tests: a table
  of every route parsed from both `https` and `splito://`, e2e opening links cold and warm on web, and
  iOS/Android simulator checks with `xcrun simctl openurl` / `adb shell am start -d`. *Why:* "integrate deep
  links properly as well".
- **A person's avatar or name opens that person, everywhere** (owner 178; F-261, Wave C): on every screen and
  width, tapping or clicking a person's avatar or name opens their page (`/people/:id`): expense and payment detail
  (paid by, split rows, items), Activity rows (the actor), comments (the author), group Members and Balances, the
  Settle plan, search and Ask results, recent people, requests and invites, the right column. Me opens Profile; a
  removed or unknown person opens their read-only page or "Not on this device yet", never nothing. One shared
  `PersonLink` (Bluesky's profile-link pattern: `UserAvatar` + name as a link with hover underline on web, 44 px
  target) does it, so no screen wires its own; where the whole row already opens something else (an expense row),
  the avatar and name are their own nested targets that open the person. Shell first (owner 152), no redraw (166).
  *Why:* "clicking on avatar or name anywhere on the website should open that friend's details"; repeated
  2026-10-31: "on click of others avatar, it should open up them as people" (own avatar opens Profile, owner 206).
  [Built, F-261, web; native unverified: `components/PersonLink.tsx` (an anchor with an `href`: Enter, Space and Cmd-click work;
  avatar-only links hold no state), `personPath` / `openPerson` in `lib/links/make.ts` for every push that names a person.
  People rows, Members and requests reuse it (`isInsideLink` where the whole row already opens the person); the group header's
  member stack is one control that opens Members, not a link per face; Settings > Friends rows have no "Open" button because the
  avatar and name do that job (owner 213). The architecture rule `personAvatarOutsideLink` fails a new `<UserAvatar` outside it,
  and its baseline lists only what is not a link to a person: own avatars, selection rows and dialogs, the member stack, an
  invitee who is not a person yet.]
- **Person names are capitalised word by word** (owner 181): every word of a person's full name starts with a
  capital letter ("saransh balyan" -> "Saransh Balyan"); the rest of each word stays as typed, so "McDonald" and
  "D'Souza" survive. Saved that way on every path (add friend, own profile name, contacts, invites, join, demo
  seed, sign-up) through one `capitalizeName` in `packages/domain`, and shown that way through the same function,
  so names already saved lower-case read right too. Scripts without letter case (Devanagari) are unchanged.
  Group names, expense titles and emails are not names and stay as typed.
  *Why:* "name should be capitalized first letter in complete name".
- **Activity's route is `/activity`; `/notifications` redirects to it.**
- **A main screen reached from a link shows Back** (owner 179): when Home, People, Groups, Analytics or Activity
  is opened from something other than its own tab or sidebar item (a "See all", an Overview card, a search or Ask
  result, a notification, a deep link), it opens as a pushed page with Back in the header that returns to where the
  person came from (filters from the link applied, e.g. Activity with type=transactions); tapping the tab itself
  always gives the plain tab screen with the avatar. The pushed copy keeps the FAB and every header action of the tab; only Back replaces the avatar (owner 190). One
  helper decides (the link resolver / `tabLink()`), not each screen. *Why:* "even if you go to a main screen from
  some links, it should show a back button, in case you don't go directly from tabs". *Where:* `tabLink()` in
  `lib/routes/helpers.ts` (the `Link` default `push` action, `navigateToTarget` in `lib/links/open.ts` for links the
  running app opens; nav items use `navigationAction="navigate"` and never push), `HeaderAvatar` (Back instead of
  the avatar; the only difference from the tab, owner 190) reads `PushedTabContext`, which the tab screen sets; the FAB does not. Web pushes the tab route with
  a `from` param naming the tab it was opened from (it is in the address, owner 184); native pushes `Pushed<Tab>`
  twins registered in the root stack. A pushed copy is never the current tab: pressing its own tab replaces it with
  the plain tab, without `from`. A cold page load of a plain address is the plain tab. e2e `homeTabs.spec.ts`. Every "See all" of Recent transactions (Home, the right column, a Group page) uses `seeAllTransactionsPath(groupId?)` (`lib/links/make.ts`): `/activity?tab=all&type=transactions[&group=<id>]` (the tab is a query there because `Link` matches bare route patterns; the address bar prints `/activity/all?from=<origin>&type=transactions`), All so a saved Me or Others never narrows it.
- **Every page has a fixed parent, so Back always goes somewhere specific** (owner 184): with history, Back
  returns to the page you came from; with none (a refresh, a pasted address, a notification, a new tab), Back
  goes to the page's parent and the parents are stacked under it, so a second Back keeps climbing. The parents:
  a Settings section (Appearance, Language, Notifications ...) -> Profile (owner 220: Settings lives in Profile); a person -> People; a group ->
  Groups; an expense or payment -> its group, else the friend it is with, else Home; Edit -> the thing edited;
  Settle -> its group or friend; Profile -> the start tab; Friends and invites -> People; Analytics/Activity
  sub-addresses -> that tab. Back never disappears from a pushed page, refreshed or not. A main tab screen opened
  from a link (owner 179) keeps its Back after a refresh: the address carries its origin as a short `from`
  (`/activity/all?type=transactions&from=home`), and Back returns there; tapping the tab itself drops it. One
  table (`backFallback` in `navigation/goBack.ts`) holds every parent; an architecture test fails on a route
  without one. Supersedes the assistant ruling "a refreshed pushed copy becomes the plain tab". *Why:* "there
  should be some specific set of back for sure, for example if I open Appearance in Settings, the flow is from
  Settings to Appearance".
- **Pushed pages slide like a native stack** (owner 227). Native: the native stack's own push and pop (iOS slide
  and edge swipe back, Android). Phone-width web: a push slides the new page in from the right over the old one
  (about 280 ms, iOS curve) and the app's Back slides the page underneath back in from the left (a short parallax);
  a Back that came from the browser's own swipe (iOS Safari's left-edge swipe, which already slides its snapshot,
  owner 216) is not animated again. Compositor only (CSS on the screen root, no JS per frame, no React render), the
  leaving page is never kept alive for it and no row exit animation runs (§ 17.1); a page's fixed FAB does not move
  with it; reduced motion or Animations off: instant. Rail and desktop web stay instant, as Bluesky. Main-tab
  switches keep their own slide (§ 26.9). *Why:* "stacked screens are not there, like if I click on my avatar to go
  to profile it should animate and go there and then same for swipe back".
- **Pushed pages** (Person, Group, Settle, Expense, Profile, Settings and its sections, Add friend, Create
  group) show Back in the header; top-level pages (Home, People, Groups, Analytics, Activity) show the avatar.
  **A main screen opened from a link is the same screen as its tab; the only difference is Back in place of the
  avatar** (owner 190): same header actions, same FAB, same filters, layout and content. The FAB follows § 26.6,
  not the Back state. *Why:* "the only diff should be whether back button is visible or not".
- **The logo returns home and is inactive on home** (spec).
- **Page background (`html`/`body` on web) always follows the active theme** (no black band under Dim
  content).
- Main-tab switch animation and tab icons: § 26.9.

### 26.4 Header

One rule set for every screen, built from Bluesky `Layout.Header` components. *Why:* "think of header, when to
show what: centre may be page name, right maybe some basic action, and left may be back or avatar". *Where:*
`components/Layout/Header/`, `components/HeaderAvatar.tsx`.

- **Left:** the avatar (testID `header-avatar`) on top-level pages at every width, desktop included; Bluesky
  `BackButton` with `goBack(navigation, fallback)` on pushed pages. **At every width the avatar opens Profile**
  (owner 201, replaces "on phone and rail the avatar opens the drawer"). **Profile and Settings are one page**
  (owner 220, replaces owner 206's separate Settings tab): `/profile` (a pushed page; Back returns where you were,
  else the start tab) holds the person first and then every Settings row (§ 26.15); `/settings` opens it too, and
  `/settings/<section>` pages keep their addresses with Back to Profile. No Settings tab, sidebar or bar item.
  Labelled "Open profile". No avatar on the right
  and no avatar dropdown menu. *Why:* "on click of avatar, now open profile inside settings" (owner 201; earlier: "it should open the drawer like Bluesky where all menu appears like the
  hamburger"), "and move this to left, where hamburger icon was there in Bluesky"; "on desktop when sidebar is
  opened completely don't open sidebar on avatar click".
- **Centre:** the page name, centred on all platforms (`TitleText`). Home shows the logo mark (§ 26.11) on
  phones only; on rail and desktop, where the sidebar already shows the logo, it shows the title "Home". *Why:*
  "on desktop, show home instead of branding as branding is there on left". Person and Group show the entity name with a `SubtitleText` ("Trip · 5
  members"); Expense shows its title. Empty slots keep their width so the title stays centred.
- **Right:** at most one basic action (exception: the start tab adds the Search & Ask icon to its left, § 26.3, owner 218) (Bluesky header icon button), optionally followed by a Bluesky "..."
  overflow Menu. No bell and no other header icon: anything else lives in the page body (Analytics' chart /
  table toggle sits in its filter row). Body primary actions are not repeated in the header. *Why:* "what's
  the second icon on header left of avatar".

  | Screen | Right slot |
  |---|---|
  | People | Add friend (+ Search & Ask while it is the start tab, owner 218) |
  | Groups | Create group (+ Search & Ask while it is the start tab) |
  | Analytics | Export (opens the shared Export sheet) (+ Search & Ask while it is the start tab) |
  | Activity | Mark all read (+ Search & Ask while it is the start tab) |
  | Person | Settle up + overflow (Remind, Export statement, Edit, Remove friend) |
  | Group | Settle up + overflow (Edit group, Members, Payment rules, Export) |
  | Expense | Edit + overflow (Delete) |
  | Settings, Profile, Settle | none |

- **Behaviour (exactly Bluesky's minimal shell):** on phones (native and mobile web) the header scrolls away
  with the content as you scroll down and slides back in as soon
  as you scroll up a little (Bluesky `useMinimalShellMode` / `useMinimalShellHeaderTransform` /
  `useMinimalShellFooterTransform`, its thresholds and springs, driven on the UI thread from the list's scroll
  handler); reaching the top always shows it; switching tabs or opening a sheet resets it to shown. On
  rail/desktop the header stays sticky (as Bluesky). Bluesky bottom border. *Why:* "just like in bluesky, even
  the header should scroll but once i scroll up a little it should appear".
  **Only the header hides: the bottom bar and the FAB stay visible while scrolling** (they hide only where
  Bluesky hides its footer: full-screen pages, open keyboard). *Why:* "during scrolling don't hide bottom
  navigation, only header needs to be hidden" (owner 87, replaces the bar/FAB part of 81). On rail and desktop it sits at the top of the main content, separate from the
  sidebar.
- **Add expense and Edit expense are sheets (§ 26.8), so they have no header;** no header anywhere carries a
  "Cancel" text button or a "Save" pill.

### 26.5 Left sidebar (rail and desktop)

Bluesky's `LeftNav`, copied as closely as possible. *Why:* "you need to improve left sidebar, it doesn't look
good"; "the left sidebar looks bad on desktop". *Where:* `view/shell/desktop/LeftNav.tsx`.

- **It holds:** the logo mark, the shared nav items (§ 26.3), the "Add expense" pill, and the shared footer
  links (Feedback · Help · Privacy · About; same component as the drawer) pinned to the bottom of the sidebar
  on desktop and rail-width web (owner 214, replacing owner 188's "directly under the pill"; the items and the pill
  stay one block at the top). No avatar or
  `ProfileCard`, no "Splito" wordmark, no recent groups or transactions (those live in the right column,
  § 26.17). *Why:* "remove the avatar from sidebar"; "remove label from logo".
- **Logo:** the mark only (§ 26.11), 40 px, horizontally centred in the sidebar column, 12 px (space.md) below the
  content header row's centre line, for a little air on top (owner 126; was aligned with the header row). *Why:* "make the branding in
  centre".
- **Nav items:** Bluesky `NavItem` exactly (24 px icon, `text_xl`, active = bold + filled icon,
  `rounded_full` hover background, Bluesky badge/dot): the shared list of § 26.3. The
  sliding active indicator (§ 26.9) sits beside the active item.
- **Navigation icons are drawn in the text colour, never the accent** (owner 215): the bottom bar and the sidebar
  draw every tab icon in the theme's text colour (white in Dim and Black, near-black in light), active and
  inactive alike; the selected tab is shown by its filled glyph and bold label, as in Bluesky. The accent colours
  buttons, links and the FAB, not the nav. *Why:* "make the navigation selector white again like it was previously".
- **A filled tab glyph keeps its drawing** (owner 216): a selected icon is a solid shape with its inner detail cut out
  (`createFilledIcon`, a mask), never Lucide's outline with every shape filled in, which can merge into a blob. People is
  a solid card with the head and shoulders cut out (filling the outline drew a plain square that read as a calendar).
  *Why:* "People tab when selected is not correct".
- **Add expense:** Bluesky `ComposeBtn` as a large full-width pill with a plus icon; it opens the Add expense
  popup (§ 26.8). *Why:* "go with what Bluesky had".
- **Compact, no space it does not need** (owner 188): the sidebar is as wide as its content needs (icon,
  label, padding; one constant, 216 px, set by the footer row in English and fitting Hindi's longest label; a language that
  needs more raises that one number), so the content starts sooner; the
  logo, items and pill form one block at the top and the footer links sit at the bottom (owner 214). Hairline right border; sticky full height; scrolls on its own when tall. Phone and rail
  layouts are unchanged. *Why:* "on desktop there is a lot of space we don't need there in sidebar".
- **Rail (800-999 px):** Bluesky minimal mode: mark, icons only, round compose button.

### 26.6 FAB

- **The Bluesky FAB shows at phone widths on every screen where you would add an expense** (owner 190): the
  main tabs (Home, People, Groups, Analytics, Activity) **and their pushed copies opened from a link** (Back
  replaces only the avatar; the FAB, header actions such as Search & Ask, Filters, Add friend and the gear, and
  every other control stay exactly as on the tab), the Person page (Add expense pre-selects that friend) and the
  Group page (pre-selects that group). It is hidden where adding an expense makes no sense: Settings and its
  sections, Profile, Expense and payment detail, forms and the composer, while a sheet is open, while the
  keyboard shows, and on onboarding (§ 3's suppression list). Rail and desktop have no FAB; the sidebar pill adds
  expenses there. *Why:* "fab icon to show everywhere on the screen from nav bar"; "home and activity also should
  show the fab"; "the fab icon should not be visible on desktop as we have it on sidebar"; "all the + buttons or
  anything should be there" (replaces "if back button is not there show it").
- **Decided once, from the route** (`fabParams` in `lib/routes/fab.ts`, a small allow-list of route names, pushed copies included; `RouteFAB` in the screen scaffold `Layout.Screen` renders it under every screen, so no screen has its own FAB; a screen can only hold it back with `useSuppressFab`: an empty Home or People, an inactive or deleted group; `FAB` draws nothing on wide screens). It keeps Bluesky's
  stays in place while scrolling (owner 87), and lists pad their bottom by the FAB clearance.
- **Tapping it opens Add expense as a bottom sheet** (§ 26.8). On a Group or Person page it pre-selects that group or
  friend; wide screens, which have no FAB, keep the body's "Add expense". *Why:* "use the same flow of that FAB icon".
- *Where:* `components/AddExpenseFAB.tsx`, `view/com/util/fab/`.

### 26.7 No side drawer; the avatar's sync dot

- **There is no side drawer, on any platform or width** (owner 217, replaces Bluesky's drawer of owners 23, 60, 62,
  201 and 216's address-only drawer): a phone navigates with the bottom bar alone, rail and desktop with the sidebar
  alone (§ 26.3). Nothing opens a drawer; an old `?drawer=menu` address opens its page without one. What the drawer
  held lives elsewhere: the tabs in the bar, Profile on the header avatar (owners 201, 206), Feedback, Help, Privacy and
  About in Settings > Support (owner 204), and Settings is in Profile, behind the header avatar (owner 220). *Why:* "Remove the sidebar in
  mobile completely, either sidebar or bottom navigation"; earlier "Sidebar opens up when swiping" (owner 216).
- **The browser's Back gesture is the browser's** (owner 216): the app puts no gesture at the left edge of a phone
  screen, and the page Back returns to is drawn at its own saved scroll from the first frame
  (`useWebScrollRestoration` scrolls at once on focus, then again a frame later for a re-mounted screen), so Safari's
  swipe lands on its snapshot without a jump. *Why:* "Swipe doesn't look good to go to last screen".
- **Sync-status dot on the user's avatar** (the header avatar at every width): **green** = signed in, online,
  everything synced; **yellow** = syncing or waiting to sync (changes in the outbox, or offline with unsynced
  changes); **red** = on this device only (no account yet, nothing backed up). Bluesky presence-dot geometry
  (bottom-right, ring in the background colour). Never colour alone (§ F-1801): the avatar's accessibility label says
  the state ("Synced" / "Syncing" / "On this device only"), and a long-press or hover shows it as a tooltip. It
  replaces every other "Saved on this device" text in the shell. Until the backend exists the honest state is red.
  *Why:* "add green icon for online, add a yellow icon for syncing, add a red icon for on device only".
- *Where:* `view/shell/index(.web).tsx` (no drawer layout), `components/HeaderAvatar.tsx`, `components/SyncStatusDot.tsx`.

### 26.8 Sheets, popups and prompts

- **On phones every modal is a bottom sheet that closes when dragged down; rail and desktop keep centred
  popups.** This covers form sheets (Add expense, Edit expense, Add friend, Create group, Edit group,
  Members, Payment rules, Record payment), settings editors (accent, categories, timezone, ...), pickers
  (currency, date, category, people), filters, menus, and **prompts and confirmations** (Discard changes?,
  Log out?, Delete?, Reset). The owner calls these "drawers"; they are not the side drawer of § 26.7. *Why:*
  "all modal in mobile should be drawers I said". *Where:* `components/Dialog`, `components/FormSheet`,
  `components/Prompt.tsx`.
- **Form sheet layout (one shared `FormSheet` on Bluesky's Dialog).** Phone: top bar with the title on the
  LEFT and a round close button with a Lucide `X` at the TOP RIGHT (30-32 px circle `t.atoms.bg_contrast_50`,
  label "Close", testID `sheet-close`), no "Cancel" in the top bar; a footer pinned at the bottom above the
  keyboard (react-native-keyboard-controller sticky footer) and the safe area, with two buttons filling the
  width: "Cancel" (secondary, `sheet-cancel`) left, the primary ("Save", "Save expense", "Add friend",
  "Create group", `sheet-save`) right, disabled until valid; any live readout ("EUR 3 left to assign") sits
  just above the footer. Rail/desktop: a centred popup (Bluesky web Dialog, scrim, max width ~600, focus
  trap, Escape closes), X at the top right, footer buttons at the bottom right: Cancel, then Save. *Why:*
  "the cancel button to be a cross on top right like iPhone native, and save button on bottom"; "all the
  drawers to have cross button like this and cancel and save button at bottom, drawers become modal/popup on
  web, with a cross button on top right and save and cancel on bottom right".
- **Pickers** show only the X; a selection applies at once; no footer.
- **Alerts (toasts) appear at the top right and every one has a close button** (owner 110). Rail and desktop:
  stacked in the top-right corner, below the header line, newest on top, max 3 visible. Phones (native and phone
  web): at the top, full width inside the side gutters, below the safe area / status bar (a corner makes no sense
  at 390 px). Every toast has a round X (label "Dismiss", 44 px hit area) besides its action (Undo, Reload ...);
  it can also be swiped up/aside on phones; it still auto-hides after its time unless it holds an action the user
  must see (update toast stays until dismissed). Bluesky's toast look and animation (sliding in from the top),
  reduced-motion aware. *Why:* "the alerts I receive, move them to top right and add one close button as well".
- **Prompts** keep Bluesky `Prompt`'s content and buttons; on phones they present as a bottom sheet like
  everything else (Bluesky's native Prompt already does; phone-width web must too). Dragging a prompt down is
  Cancel; a destructive action never runs from a drag.
- **Add expense and Edit expense are form sheets on every width:** a bottom sheet on phones (drag handle,
  snaps to full height when the form needs it, keyboard-aware), the centred popup on rail and desktop. Never
  a pushed page or a full-screen modal. *Why:* "when I click on add expense, it should open a sheet from
  bottom".
- **Drag to close:** every bottom sheet closes when dragged down past ~30 % of its height or flicked down
  (velocity threshold), from the handle, the top bar, or the content when it is scrolled to the top. With
  unsaved changes the sheet springs back and asks "Discard changes?" (itself a prompt, so a bottom sheet on
  phones; on iOS it follows § 4's one-native-modal rule). Closing by X, Cancel or scrim asks the same. The
  threshold logic is unit-tested; drag-to-close has an e2e check where the runner supports gestures. *Why:*
  "and should be closable if I drag it down".
- **Every sheet and popup animates** (§ 26.10). *Why:* "all the sheets should have animation".

### 26.9 Tabs and pager

- **In-page tabs are Bluesky's Pager, never a segmented control,** and every set looks like Activity's "All /
  Me / Others": one shared component copied from Bluesky `src/view/com/pager/` (Pager on
  react-native-pager-view with swipe between pages, TabBar with the animated sliding underline,
  scroll-to-selected, haptic selection tick, `PagerWithHeader` where a header block sits above the tabs); web
  uses Bluesky's web pager. Group: Expenses / Balances / Members; Activity: All / Me / Others; Analytics,
  Person and Settings if tabbed. *Why:* "there is no animation when switching tabs, but it's there in Bluesky,
  why it's not there". *Where:* `components/TabBar.tsx` (Pager not copied yet, § 1 table).
- **Every tap reflects immediately; heavy rendering is deferred** (owner 151, extends 150 to the whole app):
  any tap (rows, buttons, chips, switches, filters, sheets, tabs, menus, the FAB) changes what the user sees in
  the same frame or the next: the pressed state, the selected chip, the switch thumb, the opening sheet's motion,
  the new screen's header and a same-size skeleton. Anything slow (long lists, charts, breakdowns, the next tab's
  body, search results) renders after that first frame (owner 152, the pattern: **tabs** switch first (indicator,
  header, a same-size skeleton body) and fill in after; **popups and sheets** start their open motion at once with
  their shell (title, X, footer) and mount the body after; **screen changes** start the header and transition at
  once and render the body after the transition; one shared helper does it for every screen, `useAfterTransition()`
  plus a `<Deferred fallback={<Skeleton/>}>` wrapper, never a per-screen timer), via React transitions (`startTransition` /
  `useDeferredValue`), mounting the body after the transition (§ 3) or on idle; a busy body never delays the
  tap's own feedback, and later taps are never queued behind it. Measured: an e2e/perf check of tap-to-first-
  visual-change under 100 ms (§ 26.10) for the main tappables at 390 px, and none of them waits on a JS long
  task. *Why:* "all the taps everywhere should reflect immediately, maybe defer some rendering". *Where:*
  `lib/hooks/useAfterTransition.ts` (`useAfterTransition`: false for the first two frames; `useDeferredReady(flag)`:
  the flag and a painted first frame, data landing later also deferred), `components/Deferred.tsx`,
  `FormSheet.Inner` / `FormSheet.Screen` bodies via `SheetBody`, the tab screens' `isLoading` (People, Groups,
  Analytics, Activity, Person, Group) and the in-page tabs (`useDeferredValue(tab)`: the bar follows the tap, the
  list re-renders as a transition); check `perf/tapLatency.spec.ts` (`E2E_PORT=8231 pnpm perf -- tapLatency`, CPU x1
  and x4, plus taps 50 ms after a screen-changing tap).
- **Pull to refresh on every screen, with the header staying put** (owners 167, 169, 170; F-258, Wave C): every
  full screen of the app refreshes by pulling down at the top, whether or not it has a header (Home, People,
  Groups, Activity, Analytics, Person, Group, Expense, Payment, Settle up, Profile, Settings and its sections, Friends
  and invites, Search & Ask results, and the signed-out screens, where it simply reloads them). Built once in the
  shared screen/list scaffold, so a new screen gets it for free (a test lists every route and asserts it).
  The one exception is sheets and popups on phones: there a pull down at the top closes the sheet (owner rule
  § 26.8, "should be closable if I drag it down"), so the two gestures never fight. The header stays
  fixed and visible while pulling and refreshing (the minimal-shell hide never runs during a pull; the spinner
  sits under the header, never over or above it); the list content moves, the header does not. Native uses the
  List's `RefreshControl` (Bluesky's `List` already supports it; iOS bounce, Android material spinner); phone web
  (iOS Safari, Android Chrome) gets the same gesture from a small shared pull handler on the window scroll that
  works with the safe-area patch (§ 23) and never fights browser overscroll (`overscroll-behavior-y: contain` on the
  root while pulling). What it does (owners 212, 213): it calls one `syncNow()` (FX rates when online, drain, then
  pull, § 9.3; a no-op until F-2103) and holds the spinner at least 400 ms so it never flashes. It does not re-run the
  screen's queries: projections already re-read on every commit. Offline it ends at once, never an error toast, and
  nothing reads "Synced" before an acknowledgement.
  Shell first (owner 152): the spinner appears in the same frame as the pull threshold; nothing else redraws unless
  data changed (owner 166). *Why:* "also add pull to refresh, header should stay while pulling down to refresh".
- **Open first, render after, even the first time** (owner 168, sharpens 151/152): a tab switch, a drawer and a
  popup or sheet first OPEN (the tab highlights and its shell shows, the drawer slides in, the sheet slides up or
  the popup scales in) with only light content (header, title, X, footer, a same-size skeleton), and the heavy
  content mounts after the opening has finished (transition end / the sheet's or drawer's opened event, not a
  fixed two frames), so rendering never competes with the opening, on the first visit as much as on later ones.
  Later visits show the frozen content at once (owner 166). One shared helper (`useAfterTransition` /
  `<Deferred>` / `deferBody`) waits for the real "opened" signal of tabs, drawers and sheets. *Why:* "even for the
  first time, the rendering should happen once the tab is open, or drawer is open or popup is open".
- **Switching tabs never redraws** (owner 166): a tab already visited stays mounted and is frozen while hidden
  (react-native-screens `freezeOnBlur` / react-freeze, as Bluesky; the web twin too), so switching back shows it
  instantly, exactly as it was left (scroll position included), with zero re-render of its content unless its data
  actually changed while away. Focus is never a reason to re-render (no work in focus effects that rebuilds the
  body, no store hook returning a new snapshot for an equal answer, no re-keying). Deferral (owners 151/152) applies
  only to a tab's first visit or to data that really changed. The renders gate's tab round enforces it. *Why:* "it
  should not redraw".
- **Tab taps always win, however fast** (owner 150): every tap on a bottom-bar, sidebar, rail or in-page tab
  switches at once, even when taps come milliseconds apart or during a running switch animation: the newest tap
  cancels or redirects the animation, nothing is debounced, locked or swallowed (the first tap after a screen
  change included), on iOS, Android, phone web (iOS Safari) and desktop. The switch acts on press-in where the
  platform allows (as Bluesky's bottom bar), the heavy body may mount after, and the landing tab is always the
  last one tapped. *Why:* "when I click on tabs immediately it doesn't work; in other apps I keep clicking on tabs
  within ms and it still switches". *Where:* no `useDedupe` on a tab press (it dropped every tap within 250 ms of
  another, app-wide on native and per tab on web; `useNavigationDeduped().navigate` no longer dedupes, it is
  idempotent); e2e `tabTaps.spec.ts`.
- **Main bottom-bar / sidebar switches are animated** (owner override of Bluesky's instant switch; reaffirmed by
  owner 174 on 2026-10-30, "in tab switch, it should switch with sliding animation"; it must stay interruptible per
  owner 150 and must not redraw per owner 166): a direction-aware horizontal slide (from the right when moving to a
  tab on the right in the bar's own order, else from the left). [Built, F-257 slide part, 2026-10-31, web checked in
  Chromium, native not yet run] Web: a bar tap notes the direction (`lib/routes/tabSlide.ts`) and the screen that
  gains focus sets `data-tab-in` on its root; a CSS keyframe in `public/index.html` shifts the screen's content 32 px
  with a fade in 200 ms on the compositor (no JS per frame, no React render; the fixed FAB is excluded, the screen
  clips sideways so the page never widens), and a newer tap simply shows its screen with its own slide. Native: the
  bottom tabs' `animation: 'shift'`. Reduced motion or motion off: instant (the bar notes no direction; CSS
  `prefers-reduced-motion`; native `'none'`). Sidebar switches (rail and desktop) stay instant for now. A small indicator under the active bottom-bar icon / beside the active sidebar item springs
  to the new tab like the Activity underline; the tapped icon does a small spring scale pop while filled and
  stroke states cross-fade, with a Bluesky haptic tap; the unread badge springs in on count change; re-tap
  scrolls to top. No swipe between main tabs (it would fight the drawer edge-swipe and row swipe actions).
  Content is usable at once; lazy tabs stay mounted after the first visit. Under reduced motion or motion
  `off`, no animation. *Why:* "need animations while switching bottom navigation", "tab navigation like in
  activities tab". *Where:* `navigation/Navigation.tsx`, `view/shell/bottom-bar/`.

### 26.10 Motion and speed

*Why:* "consider speed and animations always"; "smooth like Bluesky"; Expensify "have some animations on
pages". § 17 holds the engineering rules that meet these budgets.

- **Speed budgets (measured and recorded in every PR/report):** cold start to an interactive People list
  < 1.5 s on a mid-range phone (web: LCP < 1.5 s on a cached load); visual feedback within 100 ms of any tap;
  local save p95 < 100 ms; 60 fps (120 on ProMotion) transitions with no dropped frames on lists of 1,000
  rows; no JS long task > 50 ms while typing, scrolling or animating; no full-ledger recompute per render;
  lists virtualised with Bluesky `List`; images and Lottie lazy-loaded; bundle growth justified. Any change
  touching lists, navigation or totals is profiled (Chrome Performance on web; React Native DevTools / Hermes
  profiler on a simulator) with a baseline and an after, numbers in `docs/COMPLETION_MATRIX.md`.
- **Lightning fast is a merge gate, not a goal** (owner 107). No screen, tab, sheet or list ever shows a delay
  the user can see: the first frame of any navigation shows real content or a same-size skeleton within 100 ms
  (never a blank area or a spinner), sheets start moving within one frame of the tap, and typing never drops a
  character. Every merge (each slot and every wave assemble) runs the perf spec (`playwright.perf.config.ts`)
  and the render-count scenario (§ 17) on the 10,000-expense fixture and fails on any budget miss or a
  regression over 10 % against the main line; Opus reviews check new code for extra store reads, re-renders,
  unbounded lists and JS-thread animation. Numbers go in `docs/COMPLETION_MATRIX.md`. *Why:* "keep performance in
  mind, it should be lightning fast, no delays in rendering anywhere".
- **Fast everywhere, proven per screen on the slowest target** (owner 189): every screen and every
  interaction meets the budgets above, not only the ones someone reported: opening and closing each screen and
  pushed page (Person, Group, Expense, Settle, Settings and each section, Profile, Friends and invites, Search &
  Ask), every tab and revisit, every sheet, popup, menu and picker, the drawer, scrolling every list, typing in
  every field and search, saving, deleting, filtering, switching demo mode, and the first load. The proof is a
  perf sweep spec that walks every route in the link table and every interaction, measured in WebKit (the iPhone
  simulator's Safari or Playwright WebKit) and in Chrome at 6x CPU throttle, on the large demo set and the
  10,000-expense fixture, on a quiet machine (load under 10, or the numbers are not used): tap to visible
  feedback < 100 ms, tap to content < 200 ms at 6x, no long task > 50 ms, no exit animation on rows of a screen
  that is leaving. A miss is fixed at its cause before the wave closes; the per-screen table lives in
  `docs/COMPLETION_MATRIX.md`, and a new screen or interaction joins the sweep in the same change. *Why:* "did it
  fix the performance everywhere, not just the taps"; "it should be everywhere".
- **Animation on every surface, UI thread only** (Reanimated worklets, no JS loops): native stack push/pop and
  swipe-back; sheets and popups; list rows enter/exit/reorder (`LinearTransition` / `FadeInDown`); press
  feedback (`PressableScale`) on every tappable row, card and button; tab switches (§ 26.9); expanding search;
  filter dot; `AnimatedAmount` whenever a money total changes; skeleton shimmer while loading; success check +
  haptic on save and settle; drawer open/close with scrim.
- **Animated icons and Expensify-style animation wherever it helps** (owner 96, narrowed by 213; F-1713, built in
  part). Icons animate on meaning, never as decoration, and every one is the single `AnimatedIcon` primitive
  (`components/anim/AnimatedIcon.tsx`, Lucide geometry only, animated SVG paths and Reanimated on the UI thread, no
  per-icon Lottie): tab and sidebar icons morph to their filled state on select (`MorphIcon`; the Activity bell's
  unread badge springs in on its own, the pulse redraw went with the pulse icon, owner 217), the check draws on Accept and on the Save, Record payment and Call it even buttons (no full-sheet success screen, F-275; the sheet closes with one toast), the
  trash lid lifts while a Delete button is hovered, pressed or focused, the sync dot breathes while syncing and
  rests otherwise, chevrons turn on expand. Two items of the original list are **not built** because motion there
  would not explain a change (owner 213): Search & Ask sparkles twinkling on open (the drawer opening shows it) and
  the FAB plus turning into an X (the FAB opens Add expense; no menu exists; add it with the first FAB menu).
  Expensify-style moments in addition to the page illustrations below: a success animation when a
  balance reaches zero ("All settled"), a confetti-free celebratory Lottie on first expense and on settling a
  trip, animated empty states, and spring page/sheet transitions. Every animation honours reduced motion and
  the `motion` preference (static fallback), stays inside § 26.10 budgets (profiled), and never blocks input.
  *Why:* "also add animations on svg icons or animations like Expensify wherever we can".
- **Expensify-style page illustrations in v1:** each main page (People empty state, Groups, Activity,
  Profile/Settings sections, Analytics) has an animated Lottie header or empty-state illustration, original
  to Splito; Lottie never drives navigation. *Where:* spec § 4 "Motion & feel", `apps/client/scripts/lottie.ts`.
- **Sheets and popups:** phone sheets slide up with Bluesky's bottom-sheet spring, the scrim fades, the handle
  follows the finger, a drag-down dismiss tracks the gesture and springs closed or back, snapping between
  heights animates, the keyboard moves the footer. Web popups fade and scale 0.96 -> 1 (~180 ms), scrim fades,
  closing reverses. Pickers inside a sheet push/slide; content height changes animate. Save shows a check +
  haptic before the sheet closes. No sheet appears or disappears without motion.
- **Reduced motion and the `motion` preference (full / reduced / off)** are honoured by every animation;
  under `off` sheets open and close instantly with a fade only.

### 26.11 Theme, accent and logo

- **Default theme is Bluesky's:** Bluesky blue accent (`#006AFF`); Splito emerald is an optional accent.
  *Why:* "same Bluesky design".
- **Dark mode defaults to ALF `dim`.** A `darkTheme` preference (`dim` default | `dark`) sits under Appearance
  as "Dark mode style: Dim / Black", as in Bluesky; `useThemePrefs()` returns it and `useColorModeTheme` uses
  it. Screenshots and judges use Dim for "dark". *Why:* "by default keep the dim mode in dark".
- **The logo is the owner-provided butterfly SVG, for development only:** `assets-owner/logo-owner-provided.svg`
  (single path, viewBox 0 0 600 535). It lives in ONE source file and ONE component (`components/brand/Logo.tsx`
  via react-native-svg) so a replacement is one change, and it is used everywhere: sidebar, People header,
  splash, favicon, app icons (brand kit generated by `apps/client/scripts/brand.ts`). It is the mark alone: no
  "Splito" wordmark or label, no tile, and Bluesky's name appears nowhere. *Why:* "I have a logo.svg file in
  downloads, use that", "just use that" (after being told it is Bluesky's trademark); "use it everywhere, even
  for the favicons"; "remove label from logo". Release blocker: § 26.22.
- **In the UI the mark is drawn in the current accent (`t.palette.primary_500`) on every theme and surface**
  (light, Dim, Black, sidebar, header): changing the accent recolours the logo everywhere. Static assets
  (favicon, app icons, native splash) keep the SVG's default blue (`#1185fe`). *Why:* "changing accent color
  should change logo color as well" (replaces "keep it blue always").
- **The splash mark breathes while the app loads** (owner 185): the logo on the launch screen zooms gently in and
  out (scale 1 -> 1.08 -> 1, about 1.2 s a cycle, ease-in-out) for as long as content is loading, so the person
  sees it working: on web from the very first paint (CSS keyframes inline in `index.html`, before any script
  arrives), on iOS and Android by a JS launch screen that matches the native splash pixel for pixel and takes over
  the moment JS runs (Reanimated, UI thread). It stops and fades into the first screen when loading ends; reduced
  motion swaps the zoom for a slow opacity pulse. *Why:* "animate the splash screen icon, so that I see that it's
  loading; like zoom in zoom out a little, so I know content is being downloaded".
- **Splash in dark mode uses the Dim background, never pure black** (native splash `dark.backgroundColor` and
  the web launch screen take ALF Dim's background token, logo centred); light mode keeps the light background.
  *Why:* "on splash show the dim instead of black".
- **Icons are Lucide** (Bluesky's licensed Central glyphs are not copied; assistant's call). Bluesky's
  logos, artwork and trademarks are not shipped except the dev-only mark above.

### 26.12 Lists: overview, search, filters, balances

*Why:* "add balances option in group as well, and filters option in friends, also add option for include
group there"; "add overview in both friends and groups, with search and filters as well, search icon only,
expands once I click". *Where:* `screens/People`, `screens/Groups`, `screens/Group`, `components/ListToolsHeader.tsx`.

- **An Overview tops People and Groups, each counting what its page is about, with no scope control of its own**
  (owners 219, 221; replaces owner 176's All / Groups / Direct chips and 198's Analytics Overview). The same
  card grid and counts line everywhere (`components/overview/Overview.tsx`), "Balances right now", ignoring any period
  or currency filter, currencies never summed:
  - **People:** my balances with friends, counted exactly as the Friends list counts them: Include groups on (the
    default), every balance; off, the non-group ones (so the list and its summary always agree, one control). Counts
    "N friends · M settled"; a card's caption "N friends". A card opens Analytics in that currency with the same scope
    (everything / non-group only). Sits above the requests and the list (`FriendsOverview`).
  - **Groups:** my balances inside groups (what each group owes me or I owe it, groups that owe me and groups I owe
    summed apart, `groupTotals`). Money is never hidden (owner 89): inactive and hidden groups count whatever the list
    filters show; deleted ones do not. Counts "N groups · M settled" (settled = everyone square); a card's caption "N
    groups". A card opens Analytics in that currency scoped to groups. Above the requests and the list
    (`GroupsOverview`).
  - **Not on Analytics** (owner 221): everything on Analytics follows its filters (§ 26.16), and balances right now
    cannot follow a period, so they live only here. An old `/?overview=groups|direct|all` link lands on Analytics with
    the matching scope (`overviewScopeParam`); the `home.overviewScope` preference stays in the registry, unused.
  Hidden while the page has nothing to count (no friends, no groups). *Why:* "On the analytics tab, all group and direct
  filter is at top already, it shows up again in filter"; "overview section to be on people and groups as well, think
  about it properly".
- **Overview cards: only the net is coloured and on the right** (owners 156-161; with F-256). Each currency
  card reads:
  - line 1: "You are owed" / "You owe" / "Settled" with the currency chip on the LEFT ... the NET on the RIGHT,
    large, green or red with its arrow ("↙ ₹48,793.00"), right-aligned;
  - line 2 (only when both directions are open), LEFT, small, in the normal text colours as today: "Owed to you
    ₹49,243.00";
  - line 3 (same), LEFT, small, normal colours: "You owe ₹450.00";
  - last line, LEFT, small: the count ("4 friends").
  The net is the only coloured amount and the only thing on the right. About 64-96 px tall on phones; the same
  layout in the desktop grid (owners 113/114 decide columns and equal heights). Amounts never truncate (owner
  120). Tapping a card opens Analytics in that currency. *Why:* the owner's mock-up: "You are owed [INR] ... ↙
  ₹48,793.00 (net, large, green) / Owed to you ₹49,243.00 (small, white/grey like it is) / You owe ₹450.00 (small,
  white/grey like it is) / 4 friends".
- **Overview currency cards are separate, equal boxes in a balanced grid** (owner 113; F-245, queued): each
  currency is its own card (own border, radius, padding, gap between cards), never cells of one shared box; all
  cards in a row have the same width and height (the row takes the tallest card's height, content top-aligned).
  Columns are chosen so rows stay even: phone 1 column (2 when the card fits); rail/desktop at most 3, with 1 -> 1,
  2 -> 2, 3 -> 3, 4 -> 2 x 2, 5 -> 3 + 2, 6 -> 3 x 2 (a short last row keeps the same card width, left-aligned,
  never stretched across the row). **It adapts to every screen size** (owner 114): the column count comes from
  the measured width of the content area (`onLayout`), not from fixed breakpoints: fit = floor(width / 240 px
  min card width), capped at 3, then the balanced rule above picks the columns from min(fit, count); it re-lays
  out live on resize, rotation, split view, the sidebar collapsing to the rail and the right column appearing at
  1300 px, from 320 px phones to ultra-wide screens (where the 3-column cap keeps cards readable). The counts line ("15 groups · 6 settled") sits below the grid as plain text,
  not as a strip inside a box. *Why:* "the view is not good in the overview if I don't have either 3 or 6, it should
  be properly boxed each one" (screenshot: 4 currencies, the 4th card stretched across a shared box).
- **Home reads top-down, nothing cut off, nothing crowded** (owner 120, from the owner's Home screenshot of
  2026-10-29; F-248, fixed in the Wave B post-assemble batch with F-244 and F-245):
  - **Order:** Overview first, then Recent transactions (F-1415), then Recently active people and Recently active
    groups (§ 26.3, owners 153/154; the Friends list itself moved to People). Requests and invites are not on Home;
    they are on People, Groups and the group page (owner 197, replacing owner 175's rows on Home).
  - **Overview amounts and labels are never truncated:** the label is written in full ("You are owed", "You
    owe"), the amount auto-shrinks to fit what the label leaves it on the card's right (down to `text_lg`, then
    wraps the currency symbol line rather than ellipsize); cards in one grid row stretch to the tallest card's
    height (a card without the "Owed to you / You owe" sub-lines is not padded with blank lines, so phone cards
    stay compact).
  - **No red per-row dots** on friend, request or invite rows (owner 111: unsynced rows are drawn lighter).
  - **Friend rows stay on two lines at phone width:** name plus at most two group chips and "+N" (the rest in
    the row's detail), and on the right one net line per currency (max 3, then "+N"); chips never wrap to a
    second chip line, and the per-currency nets are not repeated inside the chips. The list's last row clears
    the FAB (§ 26.6 bottom padding).
  - **Friends header** gets its list search back (owner 91, F-1414) beside Filters.
  *Why:* "ui issues" (screenshot: Invites sent above the Overview, "You are o..." and "₹307,786.(" cut off,
  uneven cards, red dots on invite rows, a friend row with two lines of chips and amounts under the FAB).
- **Amounts in a row are always vertically centred** (owner 130): in every list row with an amounts column
  (friends, groups, history, right-column rows), the amounts sit centred on the row's vertical middle whether
  they are one line, two or more, and the avatar and the name block are centred the same way; never
  top-aligned. *Why:* "how much I owe or these things should always be vertically center, whether it's one row
  or two rows or any number of rows".
- **Each group row shows your balance in that group per currency.** (The Overview's places: owner 219 above.)
- **The list section header row** ("Friends 6" / "Groups 3") carries icon buttons on its RIGHT: on Groups,
  search (Lucide `Search`, testID `list-search`; on Home the global search field replaces it) and Filters (`list-filters`, with a dot/count when non-default
  filters are active). Both hide while the list is empty (§ 25).
- **The Friends list has its own search, besides Search & Ask** (owner 91; F-222 removed the icon, F-1414
  restores it; not built yet). It filters only the list it sits on, combines with the filters, and the query is
  not kept after leaving the screen.
- **Search is an icon until tapped,** then expands (Reanimated width/opacity, reduced-motion aware) into a
  full-width Bluesky `SearchInput` in the same row, autofocused, with an X that collapses and clears. Results
  filter live: friends by name, groups by group or member name; no match shows Bluesky's empty state "No
  matches for '...'".
- **Filters open a form sheet (§ 26.8) with Cancel + Apply; changes apply only on Apply,** and drive the list
  (not the Overview on Home, which has its own scope, owner 176). Filters and search combine. Friends: "Include groups" (default from the
  `includeGroupsDefault` preference, on), currency (All / each present), show (All / Owes you / You owe /
  Settled). Groups: type (Trip / Home / Couple / Other), status (Active / Inactive / All), show (Shown / Hidden /
  All), currency, show (All / You are owed / You owe / Settled). **Sort is its own control** [Built, F-272] (owner 199): a Sort
  button beside Filters in the People and Groups list headers opens a menu (radio items): **Last active** (default:
  newest change first, any expense, payment, comment or edit involving them), Name, Amount (largest balance first),
  Newest (most recently added). The choice is remembered per list (`peopleSort`, `groupsSort`) and in the address
  (`?sort=`); a non-default sort tints the button like an active filter. *Why:* "add sort filter people and group,
  default sort by last active". The Person page's history obeys the same Include groups choice.
- **Groups are Active or Inactive, and Shown or Hidden: two separate controls, no "Archive"** (owner 89,
  replaces 88's single Archive). Both live in the group's header overflow, are recorded in history, and have an
  Undo toast.
  - **Active / Inactive is the group's state, for every member** (synced; any member can change it; Activity
    row). An inactive group takes no new expenses: its page shows "Inactive · Make active to add expenses"
    instead of Add expense; adding, editing, moving an expense into it or restoring one into it is rejected by
    the sync mutation itself (`GROUP_INACTIVE`), not only hidden in the UI. Settle up, Record payment, Call it
    even and comments still work, so open money can be closed. Making a group inactive with an open balance is
    allowed after a prompt that lists the open amounts per currency and offers "Settle up first". Inactive
    groups leave the main view: the Groups list shows them only in an "Inactive (N)" fold at the end
    (preference `groups.showInactiveFold`, default on), and they are out of recent groups and every group
    picker.
  - **Show / Hide is personal** (my account only, never changes the group for others; preference
    `groups.hidden`, a list of group ids synced across my own devices). A hidden group leaves my Groups list,
    sidebar and right-column recent groups and group pickers; it stays reachable through the Groups filter
    Show = Hidden, search and links from history, and I can still add expenses from its page if it is active.
  - **Money is never hidden:** balances of inactive and hidden groups keep counting on Home, People and the
    overview, with the group's chip marked "Inactive" or "Hidden".
  - **Groups filter:** Status (Active / Inactive / All, default Active) and Visibility (Shown / Hidden / All,
    default Shown; labelled "Visibility" because "Show" is already the balance filter).
  - **Who may do what (assistant's call, 2026-10-27, after the B3 review):** any member may add expenses (when
    active), make the group inactive/active, hide it for themselves and leave; only an admin may remove another
    member, change roles or delete the group (`NOT_ADMIN`); the last admin hands admin on before leaving.
    Groups made before roles existed treat their creator as admin. Server enforcement follows with F-2108. The old `archived` flag reads as Inactive (read-time adapter, no schema change).
  *Why:* "add archive group option as well, when archived it stops showing in main view and no expense can be
  added", then "or make it as active inactive and hide show instead of archive".
- **"Settled" means everyone is square, not only me** (assistant's ruling after the Wave B review, 2026-10-29):
  a group counts as settled, and is hidden by default, only when every member's net in every currency is zero;
  a friend is settled when our shared balance is zero in every currency. A group where I am even but others
  still owe each other stays listed. One list-level projection decides it (never per row, § 9.6). The filter
  sheets have one "Show settled" switch (no separate "Settled" choice in Show); the all-settled empty state reads
  "All settled up" with a single "Show settled" button.
- **Settled is hidden by default; every choice is remembered in the database** (owner 90; not built yet,
  BACKLOG F-1413). Friends and groups that are fully settled (every currency at zero) are hidden from the Home /
  People and Groups lists by default; each filter sheet gets a "Show settled" switch (default off) and the
  counts line keeps saying "N settled" so nothing looks lost. Balances and totals are unaffected. Every choice a
  user makes (filters, sorts, Show settled, Include groups, currency, scope chips, tab choices) is stored in the
  local database as a preference and is still applied after a reload or restart, instead of living in screen
  state. Device-scope preferences also move from MMKV / localStorage into the database's preferences store
  (device scope = not synced, but in the database); only secrets stay in the OS secure store, and a boot copy
  may mirror theme for a flash-free first paint while the database stays the source of truth. *Why:* "by default
  hide settled, in filters option for show settled, every setting that we choose to be stored in db".
- **Group page:** Pager tabs Expenses / Balances / Members (§ 26.9). Balances shows each member's net per
  currency, a "who owes whom" list (pairwise, from the direct-mode settlement plan) and "Settle up".
  Payment rules are reached from the header overflow (§ 26.4). testIDs `friends-filters`, `groups-balances`,
  `group-tab-balances`.

- **A trip asks where it is** (owner 182): New group and Edit group show "Where? (optional)" for the Trip type
  only, beside the trip dates: one plain text field ("Goa", "Lisbon & Sintra"), offline, no map or place search
  (F-313 adds those online later). It is saved on the group (`location`), shown with the type and dates ("Trip ·
  Goa · 12-18 Mar") on the group row and the group header, searchable as a place (§ 26.19 "places"), and carried
  into the CSV. Changing the type away from Trip keeps the value hidden, not erased. Every demo trip has one.
  *Why:* "for trip ask for location as well".

### 26.13 Expenses and itemize

- **Add expense always shows "Paid by", and it starts as me** (owner 207): the Paid by row is visible on every
  Add expense, whatever the entry point (FAB, sidebar pill, a group or person page, Ask Splito's prefill, a
  scanned receipt, a duplicate) and every width; a new expense always starts with me as the payer, never a
  remembered or predicted payer, until the person picks someone else (an Ask prefill that names a payer, "Riya
  paid", is the only exception). Editing keeps the saved payer. *Why:* "add expense should have paid by always,
  by default to me".
- **Add expense shows the essentials first** [Built, F-275, web; native not run] (assistant's ruling 2026-10-31 from the
  new-user audit, owners 129/212; not yet seen by the owner). Top to bottom: title (with its category), amount, Split
  with, Paid by (always, starts as me), Group, Date; then, only when two or more people are on it and the split is
  equal, the "Split" list of who is in; then ONE "More options" row. Focus lands on the amount when a new expense
  opens (an edit does not steal focus). There is no "Add people" button inside the split (the Split with row is the
  one way in). "More options" holds the chips that choose how to split (Equally, Exact, Percent, Shares, Equal + extra,
  Itemize), the editor of any split other than equal, cash rounding and Notes; it opens by itself for a form that
  already uses one of them (an edit, a restored draft) and, closed, its row summarises what is set ("Itemize · Note").
  The chips wrap (no sideways scroll). `components/split/ExpenseComposer.tsx`, `SplitEditor.tsx` (`SplitModeChips`,
  `SplitRows`, `CashRounding`), `fields.tsx` (`DisclosureRow`).

*Why:* "an expense can be one expense or with multiple expense, like dinner $100, but can be divided into
dishes etc and each item can be assigned to each in split"; "in itemize don't show default tax tip discount"
-> "let it be" -> "it should be there"; "but add the percentage option as well". *Where:*
`components/split/`, `packages/domain`.

- **An expense is one amount or a bill of items** (the Itemize split). Each item has a name, an amount and who
  had it. **A tap on a person's chip assigns them (one portion); a tap on someone already on the item takes them
  off** (long-press or right-click takes them off too), and an item still on its untouched "Everyone" narrows to the
  person tapped, so a first tap never leaves the others charged. A portion stepper (x2, x3) per person shows only
  once two or more people are on the item, so one item can be shared unequally (2 of 3 beers); each item has an
  "Everyone" shortcut that resets portions; items reorder and delete (F-275, assistant's ruling 2026-10-31).
- **An itemised bill takes its total from the items when none is typed** (F-275): with the amount left empty, the
  total is the items plus charges as `@splito/domain` works them out (`evaluateForm` re-reads the form with the
  domain's `itemsTotal` as the amount and sets `isTotalFromItems`; the client adds nothing), the amount field says
  "Total from the items: X" under itself, and Save needs nothing else. A typed total always wins and keeps the
  "left to assign" check and "Use as total".
- **Domain:** `SplitInput` item participants may carry integer weights (`participants: Array<string | {id:
  string; weight: number}>`, a plain string = weight 1), allocated exactly with `allocate` (bigint, stable
  tie-break). Bun tests: conservation, 2-of-3 portions, tax pro-rata with weights.
- **Tax, tip, service charge and discount sit behind one row, "Tax, tip and discounts"** (F-275, assistant's
  ruling 2026-10-31 that narrows owner 40's "it should be there" from always-open controls to one always-visible row;
  settled by the assistant under owner 224): collapsed, the row shows a one-line summary when any is set ("Tax ₹30.00 · Discount
  ₹150.00", or "3 charges" for a charge list); it opens by itself on a bill that already has some, and expanding it
  shows the presets, the charge list or the four plain rows. Each plain row has an amount / % toggle (segmented "INR | %"), remembered per kind in the
  `itemizeAdjustmentModes` preference (defaults: tax %, tip %, service %, discount amount). Percentages take up
  to 2 decimals and are stored as integer basis points. Order: discount on the items subtotal; then service
  charge and tax on the discounted subtotal; then tip on the discounted, pre-tax subtotal (said in the UI help
  text). Percent-to-money conversion happens only in `packages/domain` (bigint, round half away from zero to
  the currency's minor unit; tests include JPY scale 0, BHD scale 3, 18 % GST on INR, 12.5 % service, 15 %
  discount), then each adjustment is spread pro rata over each person's weighted item subtotal.
- **Tax classes and scoped, stacked charges (one bill, different taxes per item).** A real bill taxes food
  and alcohol differently and stacks tax on the service charge (owner's sample: The Supper Factory, New Delhi:
  items 2,011.00 = food 1,611.00 + alcohol 400.00; Service charge 10% on all items = 201.10; VAT 12.5% on food
  + its service = 221.51; VAT 20% on alcohol + its service = 88.00; total 2,521.61; Net to pay 2,522.00, so a
  round-off of +0.39). So:
  - **Every item has a tax class** chip (default "Standard"; user list in Settings, defaults Food, Soft
    drinks, Alcohol, Other; receipt markers such as `*` and `#` map to classes).
  - **Charges are an ordered list**, each with a name, kind (service, tax, packing, delivery, other, discount),
    a % or fixed amount, **applies to** (all items, chosen classes, or chosen items) and **stacks on** (items
    only, or items plus the earlier charges that fall on the same items). A "prices include this tax" switch
    adds nothing and only shows the tax portion.
  - **Each charge is spread over the people who had the items it applies to**, pro rata by their weighted
    share of that charge's base (bigint, largest remainder, in `packages/domain`). Someone who had no alcohol
    pays none of the alcohol VAT or of the service charge on alcohol.
  - **Round-off and reconciliation:** a round-off line makes the computed total equal the printed total and is
    spread over everyone's share; a reconciliation row shows items + each charge + round-off = total, and a
    mismatch is highlighted, never silently absorbed.
  - **Presets:** a simple single tax/tip/service/discount (the rules above) stays the default; "Restaurant,
    India" and others ship as presets, and a bill's charge setup can be saved per merchant and reused.
  - **Expense detail and each person's breakdown** show items, then each charge share per person.
  *Why:* "See this bill, it has both alcohol and food and diff tax is applied on both. Consider this as well.
  How to split such bill. Currently we don't support, as the taxation we added was overall on the bill".
  *Where:* `packages/domain/src/adjustments.ts`, itemize editor, BACKLOG F-403.
- **The "remaining to assign" readout and the total stay exact;** Save is disabled until everything is
  assigned.
- **Expense detail lists every item with its people and portions, each person's resulting share, and
  adjustment lines** ("Tax 18% - INR 216.00").

- **Many currencies everywhere, never mixed.** A group has a home currency (set on create, editable) that only
  pre-fills new expenses; any expense, repayment or write-off in a group, with a friend, or alone can use any
  currency (a Lisbon trip from India holds EUR and INR). Every balance, total, chart, overview card and settle
  plan is kept and shown per currency, side by side ("₹1,200 · €45"); amounts in different currencies are never
  added together. Settle up plans each currency separately; settling everything in one currency is an explicit,
  reviewed conversion with the rate shown (BACKLOG Trips II). Friends show one line per currency they share
  with you. Demo data (small and large sets) includes multi-currency groups, friends and direct expenses so
  every screen is seen with more than one currency. *Why:* "add multiple currency examples for everything,
  like group (if logically makes sense or group should have one currency), friends, etc".

### 26.14 Activity

*Why:* "make notification as activity and move to bottom". *Where:* `screens/Activity.tsx`,
`components/activity/`.

- **Activity is a navigation destination, not a header bell** (§ 26.3): Lucide `Bell` icon (owner 217, replaces the
  `Activity` pulse, a single line that looked the same selected or not), solid when selected, as Bluesky's
  notifications tab; Bluesky's unread badge on the nav item (bottom bar, sidebar), counting unread items from others. testIDs
  `tab-activity`, `screen-activity`.
- **Header:** avatar (Back on a pushed copy, § 26.3) | "Activity" | (Search & Ask while Activity is the start tab, owner 218) | Filters | "Mark all read".
- **Body keeps Bluesky's notification list:** day section headers (Today / Yesterday / weekday / date), read/unread
  tint, row menu (mark read, hide, delete expense), swipe actions, hide and undo.
- **Tabs All / Me / Others** (owner 92; F-1213, built): the shared TabBar; Me = what I did, Others = what other
  people did. The choice is remembered (`activity.tab`, decision 90) and is the address: `/activity` is the saved
  tab, `/activity/all`, `/activity/me`, `/activity/others` name one (`PREF_TABS` in `lib/links/table.ts`: a bare
  path means the saved tab, so All needs a segment of its own); a tap writes the segment by the one list-state rule
  (`param`) and saves the choice. **My own changes are never unread**: the nav badge, "Mark all read" and a tab's
  unread count only ever count other people's changes, so Me has nothing to mark (Mark all read is disabled
  there) and a row of mine has no "Mark as unread". "Mark all read" marks everything on All and Others and only the
  listed rows when a type or group narrows the list (the rest stays unread). The nav badge is always the whole
  feed's, whatever tab or filter is showing.
- **Filters sheet with Type** (owner 173; F-259, built): the header's Filters button (testID `activity-filters`, a
  dot while a type is chosen) opens a sheet with Cancel + Apply and one multi-select, **Type**: Expenses, Payments,
  Comments, Groups, Friends and invites, Reminders, Disputes (none chosen = all; an event's type is read from its
  kind in `activityTypeOf`, so the disputes kinds count without a change here). Remembered on Apply
  (`activity.type`), and the address: `?type=transactions` (expenses + payments, the owner's word for what every
  "See all" means), `?type=comments,groups`, `?type=all` (clears a saved choice); `/activity/filters` is the sheet.
  `?group=<id>` scopes the list to one group (changes of that group, a comment by its expense's group) and shows a
  chip that clears it. The empty state follows the tab and the filter (§ 7: animated, with "Show every type" when
  narrowed; "Show every type" clears only the type and keeps a group, "Show everything" clears a group); a list
  narrowed by a type or a group that holds fewer than a screenful searches back **at most about ten pages (1,000
  changes) by itself**, five pages a step, under a same-size skeleton and never "nothing matches"; past that the
  empty state says "Nothing matches in the latest changes" with **"Look further back"** (five more pages a tap), and
  scrolling (`onEndReached`) keeps reading. A tab alone (Me, Others) never searches by itself. **Disputes get no tab
  of their own** (ruling 2026-10-31): the tabs stay All / Me / Others, Disputes is a Type, and its empty text is the
  disputes copy ("No disputes or holds..."). **Every "disputed" link opens Activity filtered to disputed
  transactions** (owner 192): tapping a disputed amount or count anywhere (a person's or group's "of which ₹X
  disputed", Settle's "₹X disputed, not in this plan", the friend Settle up notice, a search tip, any future Home
  line) opens Activity as a pushed copy with Back (owners 179/190) on All with the Type filter set to Expenses,
  Payments and Disputes (`?tab=all&type=expenses,payments,disputes`), scoped to the group (`&group=<id>`) when the
  link sits in a group. One helper (`seeDisputedPath({groupId})`, beside `seeAllTransactionsPath`) builds it;
  a dispute badge on a single row still opens that record. *Why:* "when click on disputed from anywhere, it loads
  up activity with transaction and disputed filter". **Every "transactions" link works the same way** (owner 193):
  a Recent transactions heading or "See all", a transaction count ("12 expenses", "3 payments") on Home, a
  person, a group, Analytics or the right column opens Activity as a pushed copy on All with the Type filter set
  to Expenses and Payments (`seeAllTransactionsPath({groupId})`, group-scoped when in a group); a single
  transaction row still opens that transaction. *Why:* "when click on txn it shows up activity again, with all
  txn including txn filter". **Activity is the one full list behind every "see all"** (owner 194): any link that
  leads to a longer list of things that happened (transactions, disputes, comments, reminders, payments, group
  changes, friend activity, a group's or a person's history) opens Activity as a pushed copy with the matching
  filters already set: Type (any mix), `group=<id>` and `person=<id>` (events involving that friend), each shown as
  a removable chip and in the Filters sheet. A group's Expenses and a friend's History stay full lists on their
  pages (they are those pages' main content, with page-only filters: Show hidden, Disputed only), and their
  headings link into Activity scoped to the group or friend (assistant's ruling 2026-10-31, after F-268); no other
  screen grows its own long history list. **Wherever a link can lead
  to Activity, it does** (owner 195), including requests and invites: "See all requests and invites" and every
  request or invite count opens Activity with Type = Friends and invites, and those rows carry their actions in
  place (Accept / Decline on a request, Resend / Cancel on an invite sent), so Activity is where they are handled.
  Friends and invites keeps only the tools that are not a list (invite link, QR, contacts, manage links). The point:
  one place to see and handle everything, so nobody wonders which screen holds what. *Why:* "this way we can
  handle everything from one place and user won't be confused". One family of helpers builds these links
  (`activityPath({types, groupId, personId})`, with `seeAllTransactionsPath` / `seeDisputedPath` as presets).
  *Why:* "this activity page should be used like this with filters everywhere". The window grows **incrementally**: `activityTracker` keeps its pool,
  cursor and a sorted event list when `want()` grows (`loadMore` reloads with an empty notice, never `'unknown'`) and
  rebuilds only the entities a read names; 10,000 expenses walk to a 10,000-event window in 0.35 s (SQLite) / 1.2 s
  (IndexedDB), a new expense then costs 8 / 13 ms (`activityScale.test`; it was 23.6 s and 72 ms per expense with
  a rebuild per page). The nav badge counts the newest page only (everything unread is newer than the read mark),
  so it never depends on the tab, filter or window. Comments are Activity events (`comment.added`,
  written once; editing or deleting one is housekeeping, and the row never repeats the text).
  *Assistant rulings, 2026-10-30 (not yet seen by the owner):* my own changes cannot be unread; "Mark all read" on a
  narrowed list marks only the unread rows it lists ("Marked these as read"); the Group page has no Recent transactions section yet, so its "See all" is only the helper
  `seeAllTransactionsPath(groupId)`, ready for when the section lands. *Reads/writes:* the Activity projection
  (now also refreshed by comments and reminders), prefs `activity.tab`, `activity.type`. *Cost:* one pref write
  per tab tap or Apply; the feed filters in `buildRows` (2.8 ms for 1,000 events, bench test); older pages are
  read only while a narrowed list is short. *Telemetry:* none. *Checks:* `feed.test`, `urlState.test`,
  `resolve.test`, `linkNavigation.test`, `demoCoverage.test`, sync `activity.test`; e2e `activityFilters.spec`
  at 390 and 1440, `activity`, `shell`, `tabTaps`, `deeplinks` specs updated for three tabs.
- **A row shows who did it and what it means for you:** the avatar is the ACTOR (who added, edited or
  deleted), never the participants; the line carries the amount and your effect ("you lent EUR 9" in the
  positive colour, "you borrowed INR 450" in the negative colour) and the group name.

- **A deleted item looks deleted** (owner 98): wherever a deleted record appears (Recently deleted, Activity's
  "deleted" rows, the detail page of a deleted expense or payment, a deleted group's entry), its title and
  amount are struck through (`textDecorationLine: 'line-through'`, contrast-medium colour) and a small Lucide
  `Clock` icon with the deletion time follows ("Deleted 2 h ago"; the exact date and time on hover / long-press;
  the screen reader says "Deleted, <time>"). Counts and helper lines ("8 records", "Gone in 28 days") are not
  struck. *Why:* "deleted item should show a stroke and clock symbol and time".

- **No Recently deleted bin: a deleted item stays where it was, struck through, forever** (owner 103, replaces
  the bin and decision 102). Deleting an expense, payment, write-off or comment leaves it in its own list (the
  group's Expenses tab, the person's history, Activity, search results) in its normal date position, drawn as
  decision 98 says (title and amount struck, clock, "Deleted <time> · by <name>"); a deleted group stays in the
  Groups list (and its page still opens, read-only, with its expenses struck); a deleted friend stays in People,
  struck. Deleted items never count in any balance, total, chart, export total or settle plan. Nothing is ever
  purged: no bin, no "days left", no `history.binDays` setting, no "Delete forever". Opening a deleted item shows
  it read-only with "Restore" (and its history); Restore keeps the same checks as before (a missing person or
  group, an inactive group). **Deleted items always show; hiding is a manual, per-item choice** (owners 104,
  105): each deleted row (and its page) has "Hide" (row menu / long-press / right-click; Undo toast), which hides
  that one item for me only. **Who can be hidden (owner 106):** an expense, payment or write-off only once it is
  deleted (a live one has no Hide); a group at any time (Hide / Show, besides Make inactive / Make active, § 26.12);
  a friend only once deleted. Hidden ids live in an account preference (`lists.hiddenItems`, a set of ids synced across my devices; it
  never changes anything for others). Lists gain one "Show hidden" filter (default off) that brings back
  everything I hid, each with "Unhide"; it is the same filter that shows groups hidden under decision 89 (the
  Groups "Visibility" filter becomes this "Show hidden" switch). No global "hide all deleted" switch. Only "Erase this device's data" (Settings > Data) removes data, and it says so. *Why:* "lets
  remove this deleted items and keep deleted items inside their actual place with a stroke, like a deleted
  expense and keep it forever, and same for groups".

### 26.15 Settings, sign in and log out

*Why:* "add sign in option, and logout as well in settings". *Where:* `screens/Settings` (the section pages; the list itself is `screens/Settings/components/SettingsRows.tsx`, rendered inside `screens/Profile`, owner 220), `state/session.ts`,
`screens/Login/`, `lib/auth/`, `data/account.ts`. **[Built, F-250, front end against the dev AuthClient only]:**
- **`useSession()`** (`state/session.ts`, Bluesky's hook shape on a module store; the account is in device storage,
  the API token joins it in the credential store, § 11) answers `hasSession`, `currentAccount`, `missingContact` and
  `canSync` (false until the sync engine exists, so rows still read "Saved on this device"; `useSyncDot` and
  `useRowStatus` read `canSync`, not `hasSession`). `App.tsx`'s `AuthGate`: no account -> `LoggedOutApp` (intro, then
  the Continue flow, no store open); an account missing its email or phone -> the blocking `AddMissingContact` (no
  store); otherwise `StoreProvider` keyed by the account id opens `splito-acct-<id>` (`data/storeNames.ts`).
- **`AuthClient`** (`lib/auth/types.ts`: lookup, sendCode, verifyCode, signInWithPassword, signInWithCode,
  createAccount, resetPassword, addContact). Dev and e2e builds get `lib/auth/dev.ts` (accounts in device storage, codes
  shown in the dev banner, a fixed dev account) as a lazy chunk reached only behind `__DEV__` / `EXPO_PUBLIC_ENV=e2e`
  (`e2e-pwa/bundle.spec.ts` checks the production export holds none of it); every other build gets the `unavailable`
  client and the screens say "arrives with sync". `auth-config.js` (read by `app.config.ts`) sorts builds into kinds and refuses
  production until the auth HTTP client exists (§ 26.22); the review site is the `preview` kind.
- **One database per account; device keys too.** Search history, Ask chat, drafts, reminder bookkeeping and the
  first-frame preference copies are under `acct:<id>:` (`setStorageScope`), demo mode keeps `demo:`. Log out
  (`data/account.ts logOut`, the `LogOutHost` prompt from Profile, owner 202) always erases (owner 186): the app
  shows `LoggingOut` (which unmounts the provider, closing the database), then `eraseAccountData` deletes the database, the
  demo database, the account's and demo's device keys, its "me" id and the service worker's data caches, and only then does the
  session end; the device's language and theme are copied out first and stay.
- **Data from before accounts:** the old unkeyed `splito` database is offered once after sign-in (`LegacyDataOffer`,
  "Move this device's data into your account"): Move copies it through the backup path (`createBackup` ->
  `applyBackup`, merge) and deletes it; "Not now" leaves it on disk and the offer is not repeated (a Settings > Data row
  to ask again is the upgrade).
- **Verification tokens (the F-2101 contract):** `verifyCode` answers a short-lived, one-use token for the contact; `createAccount`
  takes both tokens (email and phone) and `addContact` the one, never the code again (`lib/auth/types.ts`, tested against the dev
  client in `dev.test.ts`).
- **Each account is its own "me" and its own demo:** the "me" person id is minted per account (`meIds` device key; the old
  device `meId` is the pre-account database's, which Move re-points), and the demo database and its device keys are named by
  account id (`splito-demo-<id>`, `demo:<id>:`). A session id that could not be a database name is no session. Another tab's
  sign-in or sign-out is followed through the `storage` event on the session key.
- **Log out waits for the close:** `expectStoreClosed(accountId)` is armed before the session ends and settles when
  `StoreProvider`'s cleanup has closed every connection of that account (a store still opening, a swap's old store); only then
  is the data deleted (with retries). A failure shows "Logging out" with Try again and the session stays (`loggingOut` device key,
  so a restart resumes it), never a half-erased account. The prompt counts unsynced changes with `syncCounts()` (an index read) and
  keeps Log out off until the count is known.
- **The legacy offer is answered by Move, Not now or no old database;** an open or closed-by-reload offer comes again, and
  Settings > Data keeps "Move this device's older data" while the old database exists.
- **Signed-out pages:** the intro, Continue, Help, Privacy, About (`/settings/help|privacy|about`) and `/join/<token>` (a stub page
  that leads to sign-in until the invite flow exists) are the only things a signed-out device shows (`lib/links/public.ts`).
  Native: the launch URL is read once per process (`takeInitialUrlOnce`) and, signed out, only `url` events are held after it.
- **The intro's art is Lottie** (original, `pnpm lottie`: `welcome-split|bills|settle|ask|offline`, light and dark, a still frame
  under reduced motion); the Pager is replaced by `ScreenTransition` plus a swipe that follows the finger and ignores vertical and
  diagonal drags; "Step N of 5" is for screen readers only.
- **Not in this task:** setup after sign-in (F-211) and the guided tour (F-253); Google and Apple (buttons only, a
  tap says "arrives with sync"); the real HTTP client (F-2101/F-2102).

- **Settings has no Profile or account row** (owner 216, replaces "Settings starts with an Account section"): Profile is
  reached only from the header avatar (owners 201, 206); the Settings list starts with Friends and invites, then the
  preference sections, Support and Your data. *Why:* "Remove profile from settings".
- **The review site is a "preview" build** (assistant's ruling 2026-10-30, after the F-250 review; the owner
  reviews the front end on https://splito-web.onrender.com before any backend, owners 164/165): Render builds with
  `EXPO_PUBLIC_ENV=preview`, which allows the labelled dev account ("Preview build: local dev account, data stays in
  this browser, don't use a real password", `noindex`), never on a stage or prod tier; a real production build is
  refused until the auth HTTP client exists. The intro slides keep their animated (Lottie) art (owners 123, 172); the
  Pager is replaced by Bluesky's `ScreenTransition` plus a swipe, because `react-native-pager-view` is not shipped.
- **Signed out, the app is the logged-out flow** (owners 125, 138-140): Bluesky's logged-out look, copied screen
  for screen where it still applies (`view/com/auth/LoggedOut.tsx`, `SplashScreen(.web).tsx` with the logo mark and
  tagline, `screens/Login/FormContainer` and `LoginForm` layout, Bluesky's step indicator and `BackNextButtons`),
  reduced to one Continue screen: "Email or phone" (Apple and Google arrive with the auth API, below); then password (or a one-time code) for an
  existing account, or, for a new one, verify, the missing details, a password and setup (owner 141). No Create
  account, handle or captcha screens. It is the whole app while signed out and cannot be closed. Every
  field is validated. Until the auth backend exists (F-2101..F-2105) the code step shows Bluesky's Admonition
  "Sign-in arrives with sync" and only the dev/e2e "Continue with a dev account" works; no fake success, no fake
  account. *Why:* "there is signin page already there in bluesky, use that"; "basically no signup needed".
- **Signed in (only once the backend exists):** an account row (avatar, name, email/phone, sync status) and
  a destructive "Log out" row opening a prompt "Log out?". **Log out lives on Profile** (owner 202): the "Log out"
  row is the last row of Profile (`/profile`) and nowhere else (not in the Settings list, the drawer footer
  or the sidebar); the blocking add-contact step keeps its own Log out. **Profile holds only the person** (owner
  203). **Profile holds Settings too** (owner 220, replaces 203/206's separate Settings tab): after the person's
  sections come the Settings rows (Friends and invites, the preference sections, Support, Your data), then Log out
  last; there is no separate Settings screen. **Profile is a full page about you** (owner
  209), and **it fits on one phone screen** [Built, F-278, web checked at 390 x 844 and 320 px Hindi; native not run] (owner 228, replacing 209's tall header and its Add me section): a
  compact header row (avatar about 64 px on the left, which you can change; on the right the name, email and phone
  with a verified tick, "On Splito since <month year>"; Edit as an icon button); one stat row (Friends, Groups,
  Expenses, You paid this year), each tapping through to People, Groups, Activity (Me, transactions) and Analytics;
  then the Settings rows straight away with no "Settings" heading: **Payment details** first (its detail is your UPI
  ID, it opens the same edit sheet), Friends and invites (which holds your friend link and QR: there is no Add me
  section on Profile), the preference sections, Support and Your data; Log out last, the sync note in small text
  under it. **No balance and no recent activity on Profile** (owner 225): balances live on People and Groups (their
  Overviews), your changes in Activity on Me (the Expenses stat opens it). The header paints at once; the rest
  mounts after the first frame (owner 168). *Why:* "move the logout button inside profile"; "remove settings from
  profile"; "also update profile page, it looks very less"; "Remove your balance, recent activity from profile";
  "think proper about settings and profile screen it doesn't look good as setting has moved to bottom and I have to
  scroll".
  *Why:* "move the logout button inside profile"; "remove settings from profile". **Log out erases everything this account left on the
  device** (owner 186): its local database (every store, the outbox, history, attachments cache), its demo
  database, its account-scoped preferences, drafts, the session and any cached copies (service worker data
  caches, search index); device-level choices (language, theme) stay so the logged-out flow still speaks the
  person's language. There is no "keep" option. The prompt says what will happen ("This removes all your Splito
  data from this device") and, when the outbox holds changes the server has not acknowledged, says so first with
  the count ("N changes haven't synced yet and will be lost"), so nothing unsynced is deleted silently (§ 11).
  The erase finishes before the logged-out flow shows; a failure is reported and retried, never left half-done.
  *Why:* "when logout, it should remove all data from db".
- **Log out is not in the drawer footer or the Settings list** (owner 202; it is on Profile only).
- **Auth state comes from one `useSession()`** (Bluesky pattern, `src/state/session`), signed out until the
  backend lands.
- **Feedback** ("add one feedback section as well"). Placement copied from Bluesky: the sidebar footer's
  "Feedback" link (wide screens; a phone has no drawer, owner 217), **"Support" in Settings is one row that opens its
  own page** (owner 204, `/settings/support`, Back -> Settings) holding every help item: Send feedback, Your
  feedback, Help, Privacy, About (and the app version); the Settings list itself shows only the "Support" row,
  and the sidebar footer links still go straight to each page. *Why:* "make support a section, which opens
  up all these menus". **The data items work the same way under the name "Your data"** (owner 205, assistant's
  name: plain, says whose and what): one "Your data" row in Settings opens `/settings/data` (Back -> Settings)
  with Export, Import (restore a backup), Move this device's older data (while an old database exists) and Reset
  all settings, plus the "Deleted items stay in their lists" note; the Settings list shows only the row. *Why:*
  "and same for data, think of a proper name as well". and the shared footer links at the bottom of the left sidebar and the drawer (§ 26.3)
  "Feedback · Help · Privacy · About" (`desktop/RightNav.tsx`); below 1300 px desktop reaches them through the
  drawer and Settings. "Send feedback" opens a FormSheet (bottom drawer on phones, centred popup on desktop):
  type chips Bug / Idea / Question / Other, a required message, optional screenshot or photo, "Include app
  info" toggle (default on: version, platform, OS, language, current screen; never amounts, names, notes or
  receipts; the sheet shows exactly what is attached), optional reply email (prefilled once signed in). Sent
  feedback is kept in "Your feedback" with its status. Until the backend feedback endpoint exists, Send saves it
  on the device (status "Saved on this device") and offers "Send by email" (a prefilled email draft to the
  support address, `FEEDBACK_EMAIL`, a release-checklist item); once the backend exists it goes through the
  outbox. No shake-to-send preference (removed by F-251, owner 128).

- **One "Continue" screen, no separate sign-up, with a password** (owners 140, 141; replaces the separate Create
  account / Sign in screens). The logged-out flow starts on one screen built from Bluesky's `LoginForm` layout:
  one "Email or phone" field and Continue (the Apple and Google buttons of owner 138 come back with the auth API; until then one muted line, below). Splito then checks
  whether that account exists:
  - **Existing account: password or one-time code, the user's choice** (owner 144): the next step offers both as
    equals, a segmented choice "Password | Code" over the field (Bluesky's password field with "Forgot?", or the
    6-digit code sent to that email or phone); the choice last used on this device is preselected, and either can
    be switched to at any time. An account without a password (made with Google or Apple) sees Code only. Forgot password sends a code to the email or phone, then a new
    password (Bluesky's `ForgotPasswordForm` -> `SetNewPasswordForm` -> `PasswordUpdatedForm`).
  - **New account (created in the same flow, no "Create account" anywhere):** the next steps verify the entered
    email or phone with a code, ask only for what is missing (name, the other of email/phone, verified by code,
    owner 139) and a password (minimum 8 characters, strength shown, never a hint of which accounts exist beyond
    "We'll create your account"), then setup (F-211).
  - **Google / Apple:** no password needed for them; a first-time social sign-in runs the same missing-info steps
    and may set a password later in Settings > Account.
  *Why:* "we can have signup and login as same screen only, no separate screen needed, basically no signup
  needed"; then "password should be there as well".
- **The name typed while signing up is the account's and "me" person's name** [Built; test `auth.spec` "a new
  account"]: `createAccount` returns it on the session account and `accountName()` (`state/session.ts`) hands it to
  `ensureMe` when the account's database opens, so Profile shows it and never "Add your name" (the audit saw "M" and
  "Add your name" after typing "Asha"). "Me" is used only when an account has no name (a Google or Apple one).
- **Every account has both an email and a phone number, both verified** (owner 139; F-250 UI, F-2102 server).
  A new account needs name, email and phone (E.164, region default); both email and phone are required and
  each is confirmed with a one-time code before the account is usable (owner 140: collected in the one Continue
  flow, no separate sign-up). Continue accepts either one. Any signed-in account missing one of them (signed up with Google or Apple, which give only an email, or an
  older email-only or phone-only account) sees a blocking "Add your phone number" (or "Add your email") step right
  after sign-in, before Home or setup: enter, verify with a code, continue; it cannot be skipped, and the only
  other action is Log out. Offline the step says it needs a connection. The directory lookup (§ 26.18) uses both.
  *Why:* "on signup, make email and phone both mandatory; if logged in via email only and no phone is there, ask
  to update phone first".
- **Sign in with Google and Apple** (owner 138; real with F-2102). Once the auth API exists the Continue screen
  (owner 140) offers "Continue with Apple" and "Continue with Google" above the email or phone option, on every
  platform (Apple first on iOS, Google first on Android and web; the platforms' own button styles: Apple's
  black/white button, Google's branded button). Native: `expo-apple-authentication` and Google Sign-In; web: Sign
  in with Apple JS and Google Identity Services. The server verifies the ID token, creates or finds the account and
  links by verified email (never merges silently on an unverified one; asks); Apple's "Hide my email" relay works.
  A new account from Google/Apple still goes through setup (F-211). **Until then they are not buttons** [Built,
  F-275, assistant's ruling 2026-10-31; § 0 rule 6, owner 212]: the two biggest buttons on the first screen did
  nothing, so the Continue screen shows the email or phone field first and, under the form, one small muted line,
  "Google and Apple sign-in come with sync." (`SocialComing`); the button code was deleted (git history has it).
  *Why:* "on login, sign in with google and apple as well".
- **Sign-in is required: without an account nothing of the app is visible** (owner 125; replaces "signing in
  is optional" and F-211's zero-signup start; F-250, Wave C, right after the welcome tour). Signed out, the app
  shows only: the welcome tour (owner 123), Bluesky's logged-out flow (splash, Sign in, Create account, Forgot
  password; copied as above), language choice and the legal/help pages. No ledger, list, Settings page,
  search, demo switch or deep-linked record renders, and the local database is not opened, until a session
  exists. A deep link opened signed out (expense, group, invite) is kept and resumed after sign-in (§ 14
  "sign-in preserves intent"); public invite pages (`/join/:token`) stay public and lead to sign-in.
  - **Order on a fresh install:** welcome tour -> Create account or Sign in -> setup (F-211: name, purpose,
    currency) -> Home.
  - **Offline-first still holds after sign-in:** the session is kept on the device (credential store, § 11), the
    app opens and works offline with the account's local database (one database per account, so two accounts on
    one device never mix), and only an API 401 ends the session (§ 11). Sign-in itself needs a connection, and
    says so offline.
  - **Log out** returns to the logged-out flow and closes that account's database; it erases all of that
    account's data on the device (owner 186, § 26.15; unsynced warning first).
  - **Data already on a device from before this rule** is offered once after the first sign-in: "Move this
    device's data into your account" (F-2104), never merged silently.
  - **Until the auth API exists** (F-2101/F-2102, built after the whole front end, owner 164): dev and e2e builds offer
    "Continue with a dev account" on the sign-in screen (a local, clearly labelled account, never in production;
    e2e signs in through `window.__splitoTest`); production builds refuse to ship without the real auth API
    (release blocker § 26.22). The auth API itself comes with the backend, after the whole front end (owner 164).
  *Why:* "also without login, nothing should be visible, auth is required".

- **On/off settings are switches, on every platform** (owner 132): every boolean setting (Demo mode, each
  Notifications row, Animations, Haptics and the rest) uses Bluesky's `Toggle.Switch` on iOS, Android and web,
  never a checkbox (Bluesky's `Toggle.Platform` draws a checkbox on web and Android, so it is not used for
  settings). Multi-choice settings keep radio rows. *Why:* "it should be a switch not a checkbox".
- **No demo banner** (owner 133, replaces the "persistent banner on every screen" of § 26.1 and 132's compact
  banner): demo mode shows no banner anywhere and reserves no space; it is visible only as the Settings > Data
  "Demo mode" switch, the avatar's "Demo" state and **every header title ending in " - Demo"** ("Home - Demo",
  "Groups - Demo", "Goa trip - Demo"; on phone Home, where the header shows the logo, a small "Demo" label beside
  it; the web document title too), done once in the shared header title (owner 134). *Why:* "don't show that
  banner, not needed"; "in all headers, write Home - Demo like this instead".

### 26.16 Analytics

- **Everything on Analytics follows its filters** (owner 221, replaces 198/219's balances Overview at its top): the
  period, currency and scope chips drive every figure on the page (the summary, every chart and table, the list and
  the export); nothing there ignores them. Balances right now, which cannot follow a period, are on People and Groups
  (§ 26.12); Analytics' "Balance over time" shows the balance up to the end of the chosen period. *Why:* "Make sure
  analytics everything changes according to filters it should not have something which is not affected by these".
- **Analytics is a main destination with graphs** (charts and a table view), filtered by period, currency and
  group; the chart/table toggle sits in that filter row, never in the header; the header's one action is
  Export (the shared Export sheet, § 25, pre-set to the filters on screen). One chart per currency, or converted with the rate labelled. *Why:* "analytics also needed, with
  graphs and all". *Where:* `screens/Analytics`, § 25 "Analytics and export", spec § 4.
- **Analytics has no expense list; Activity is the list behind it** (owner 226, applying owner 194 to Analytics;
  F-276). Analytics shows the filter bar, the summary and the charts only. One link under the charts, "See these
  expenses", opens Activity as a pushed copy with Back (owners 179, 190) on All with Type = Expenses and the page's
  filters carried over: the period as `from` / `to` (the records' own dates), `currency`, and the scope (`scope`, the
  Analytics encoding, `0:g1,g2`). Tapping a chart's bar, slice or row opens the same list narrowed to it (a bar's days,
  a `category`, a `person`), instead of narrowing a list on Analytics; there is no selection chip. In Activity each
  carried filter is a removable chip, like `group` and `person` (§ 26.14), and a record filter (`from`, `to`,
  `currency`, `category`, `scope`) keeps only expenses, payments and write-offs that match it. *Why:* "Why does
  analytics has the expense list, for that redirect to activity with other filters".
- **All Analytics filters sit on one line** (owner 171): currency, scope, period (‹ 2026 ›) and the Charts/Table
  switch in one row that scrolls sideways on narrow screens rather than wrapping. *Why:* "all filters to be in one
  line".
- **One scope control, not a dropdown plus a toggle.** The filter row has a single "scope" chip whose label
  says what is counted: "Everything" (default), "Non-group only", "Goa trip", "Goa trip + 2" (up to 3 groups named), "4 groups" (a count from 4),
  "Non-group + 2 groups". Tapping it opens one sheet (bottom drawer on phones, popup on desktop) titled "Show
  expenses from" with one checklist: an "All" row at the top, then "Non-group expenses" (direct with friends),
  then every group (active first, archived under a fold; search when more than 8), each with its icon; Cancel /
  Apply in the footer, Apply disabled when nothing is ticked. The separate "Include groups" toggle is gone.
  Tapping a group in the "By group" chart narrows the scope to that group. The last scope is remembered per
  device (`analyticsScope`, device pref). *Why:* "analytics group selection needs to be rethought, one dropdown
  and one selection doesn't make sense".

### 26.17 Desktop right column (wide, 1300 px and up)

*Why:* "let's have a right sidebar, where it shows recent transactions, and recent groups", "max to 5".
*Where:* `view/shell/desktop/RightNav.tsx`, `view/shell/desktop/RecentTransactions.tsx`.

- **A fixed 320 px right column in Bluesky `RightNav` style** (left hairline, own scroll), hidden under
  1300 px. Content fills the space between the two columns.
- **"Recent transactions":** the 5 newest expenses and repayments involving me: category tile, title, my net
  chip (lent / borrowed, from domain `personNet`); a row opens the expense; "See all" -> Activity.
- **Recent transactions also live in the page body** (owner 97; F-1415): Home has a "Recent transactions"
  section with the newest 5 expenses and repayments across everything (all friends, all groups) [Built, F-256];
  a Group page gets the same section scoped to that group only (queued). Rows: category tile (a banknote for a
  payment), title, date, my part as a +/- chip; "See all" -> Activity (Group -> the group's Expenses tab). The
  right column is not shown on Home (owner 153), so nothing repeats there; other pages keep it. Count,
  visibility and position as preferences are queued with the Group section.
- **"Recently active groups":** the 5 groups with the newest change (an expense or repayment added, edited
  or deleted in it, or the group itself edited), by change time, not expense date; balance chips; "See all" ->
  Groups. The Groups list "Recent activity" sort uses the same rule.

### 26.18 Adding friends, invites and contacts

*Why:* "to add the friend, it should ask the email or mobile, and try to invite, once they accept they can be
used anywhere"; "also create invite link, or qr, with limits"; "they should accept to be here, or add one option
if they are not on splito (we should check before)"; "if they are not there show the warning, and one option to
add anyway (only for you)"; "also i should be able to select from contacts". *Where:* `components/people/AddFriend*`,
`screens/Invites/`, `packages/sync` (friend requests, invite links), backend directory + invites API.

- **With no directory (no backend yet) Add friend makes a normal local friend** [Built, F-275, assistant's ruling
  2026-10-31; fixes audit blocker 2]: the sheet is a plain form with the **name first and required** (focused), an
  optional "Email or mobile number (optional)" and "Choose from contacts"; **Add friend** creates the "only for you"
  friend below at once, usable in any expense or group, and keeps the contact for a later invite. No lookup, no
  "request to accept" or "when you're online" copy (§ 0 rule 6), no invite-link row (it fails closed offline). The
  request flow below starts only when a directory answers (`useDemoMode().hasDirectory`: demo mode today, the
  backend later).
- **Add friend asks for an email or mobile number** (with a directory: one field, auto-detects which; phone in
  E.164 with the user's region as default), plus an optional display name. A "Choose from contacts" button sits in the same
  sheet: native contacts picker (expo-contacts, permission primer first, § F-216); on web the Contact Picker API
  where the browser has it, otherwise the button is hidden. Picking a contact with several numbers/emails asks
  which one.
- **Splito checks before inviting.** As soon as the value is valid, Splito looks it up in the account directory
  (exact match only, privacy-preserving, rate-limited; never reveals anything but "on Splito / not on Splito"):
  - **On Splito:** primary action "Send friend request". The person appears under People > "Invites sent" as
    pending (resend, cancel). **They must accept**: nobody becomes your friend, and no one is added to your
    groups, without their consent. Once they accept they are a full friend and can be used anywhere (any group,
    any expense, settle up), and both sides see the shared history.
  - **Not on Splito:** a warning banner "<value> isn't on Splito yet" with two actions: **"Send invite"**
    (SMS / email / share sheet with a personal invite link) and **"Add anyway (only for you)"**, which creates a
    private friend (F-601) visible and usable only on your side. When that person later joins and accepts, the
    private friend is linked to their account (history merges, F-616).
  - **Directory unavailable (offline while a directory exists):** "We'll check when you're online"; the request is
    queued in the outbox, and "Add anyway (only for you)" is still offered. With no directory at all see the first
    bullet: no request is made.
- **Pending people are not selectable** in expenses or groups until they accept (they show greyed with
  "Waiting for <name> to accept"); a private "only for you" friend is selectable at once.
- **Request and invite rows share one layout:** avatar, name, status line, and the actions on the right of the
  row, all on ONE horizontal line (actions vertically centred with the name block, side by side, never wrapped
  below the name; "basically in horizontal row"). Requests: Accept (check icon, primary) and Decline (X icon); Invites sent: Resend (send icon) and Cancel
  (X icon). On phones the actions are icon-only round buttons (with accessibility labels and a long-press
  tooltip); on rail/desktop each shows its icon and full text ("Accept", "Decline", "Resend", "Cancel"). *Why:*
  "make accept decline like invites sent, on mobile only icon for both, for web complete text with icon" Activity's
  friend-request rows use the same one-line layout: Accept / Decline on the right in place of the "..." menu,
  whose items move to long-press / right-click on that row (assistant's call).
- **Incoming requests** show in Activity (from others, unread badge) and at the top of People ("Requests":
  Accept / Decline). Declining is silent to the sender (stays "pending" until it expires after 30 days).
- **Invite link and QR with limits, only inside "Invite people".** The Home header's person-plus button is
  "Invite people" (it opens the Add friend sheet); the invite link / QR row lives only inside that sheet. On a
  group, it lives only inside the group's "Add members / Invite people" sheet. No header overflow, menu or page
  shows invite links outside these flows (the Home "..." overflow and the Group overflow entries are removed;
  "Manage invite links" is reached from the invite-link sheet's "Manage links" button and from Settings).
- **Every group says who can join, and adding someone asks them** (owner 196). New group and Edit group
  show one choice, "Who can join", with three options in plain words (radios; disabled for anyone but an admin); the
  group's "Add members / Invite people" sheet shows only the current rule as one line ("Link, an admin approves each
  join · Change"), and Change opens Edit group (owner 212: the options live in one place):
  - **Anyone with the link:** the group link and QR work, and whoever opens it joins at once.
  - **Link, I approve each join** (the default; everyone but an admin reads it as "Link, an admin approves each
    join"): opening the link sends a join request; the group's admins see it in Activity (Type = Friends and invites,
    owner 195) and Approve or Decline it in the row.
  - **Invite only:** no link exists (an existing link stops working); people join only when a member adds them.
  Adding someone to a group never puts them in without consent: adding a Splito friend whose account is linked
  (possible only once a directory or the backend can deliver the request) sends them a group request ("Riya added you to Goa trip", Join / Decline in their Activity), and they show in the members list as
  "Invited" (greyed, not selectable in expenses) until they join; a friend with no account link (private, local,
  or any friend before sync exists) is added straight away, so nobody waits on an answer that cannot arrive
  (assistant's ruling 2026-10-31, after the F-269 review; demo mode's directory answers group requests after its
  usual delay); adding someone not on Splito sends an invite or adds them "only for you" (as for friends above). The choice is shown on the group page under Members ("Anyone
  with the link can join" and so on) so everyone can see it; only admins change it. *Why:* "in group link, it should
  show anyone can join, or invites only, or add like this; if I add someone they would accept or I can send
  request".
- **Settings > "Friends and invites"** (its own Settings row and page, Bluesky settings-list layout) manages
  friends and invites in one place:
  - **Friends:** every friend (search when more than 10) with "Add friend" at the top (opens the Invite people
    sheet) and **Remove friend** per row (row menu on phones, button on desktop). Removing asks for confirmation
    (bottom drawer on phones). A friend with an open balance in any currency cannot be removed until it is
    settled or written off: the prompt shows the open amounts per currency and offers "Settle up" and "Call it
    even". Removing keeps every past expense and payment (the name stays, marked "Removed"), takes them out of
    pickers and lists, and can be undone; they can be added again later. Removing someone from a shared group is
    a group action (F-613), not this.
  - **Invites and requests:** Requests received (Accept / Decline), Invites sent (Resend / Cancel), Invite
    links (every friend and group link with uses left, expiry, Revoke, "Create invite link"), and the defaults
    (max uses for friend and group links, expiry, approve each join, who can send me friend requests).
  **Placement (assistant's call, owner asked for the best spot):** the hub lives in Settings, but each action
  also sits where the user already is, as in Bluesky (block/mute live on the profile's "..." menu): "Remove
  friend" is in the Person page overflow (same guarded flow), Home's "Friends N" section header gets a
  "Manage" link to this page, and the invite sheet's "Manage links" opens its Invite links section.
  Same row components as Home and the invite sheet; Settings > Privacy keeps "Let people find me by email /
  phone" and links here. *Why:* "add invite management in settings as well"; "add one option in settings of
  friends, where you can add remove friends as well, and invite management as well".
- **Privacy settings (preferences registry):** "Let people find me by email / phone" (default on),
  "Who can send me friend requests" (everyone / people with my link only), default invite-link limits.
- Demo mode (`?demo=1`) ships a fake directory so every branch of the flow can be seen; production uses the
  backend directory API (backend batch). No fake "sent" states in production builds.

### 26.19 Ask Splito (AI chat)

*Why:* "add one ai chart option, think about the placement" (read as AI chat; answers include charts).
*Where:* `components/SearchAsk/`, `lib/ask/`, backend AI endpoint (backend batch).

- **Ask Splito lives inside the Search & Ask drawer (§ 26.3) and is not a tab** (owner 200): it is reached on every
  platform from the header Search & Ask icon (sparkles) of the start tab (owner 218), and from web "/" or Cmd/Ctrl+K anywhere.
  It is never an item in the sidebar, rail, drawer list, bottom bar or Settings > Navigation; a saved tab list
  naming `ask` is migrated (dropped). There is no separate Ask page. *Why:* "ask splito is not a tab".
- **The conversation copies Bluesky's DM conversation layout** inside the drawer (message list, composer bar above the keyboard, day
  separators). Empty state: suggested question chips ("How much did I spend on food this month?", "Who owes
  me the most?", "Split last night's dinner 3 ways", "Show my Goa trip spending by day").
- **Answers can carry rich cards:** an inline chart (same chart components as Analytics), a small table, a
  balance card, or an action card ("Add this expense", "Record payment", "Remind Riya") that opens the normal
  sheet pre-filled; the AI never writes data without that confirmation.
- **Honest capability:** questions over your own data (totals, who owes whom, spend by category / person /
  group / period, trends) are answered on the device by a deterministic engine in `lib/ask` using
  `@splito/domain` (exact money, never summing currencies). Free-form language goes to an AI model through the
  backend (Claude, latest model) once it exists; until then unsupported questions get "I can answer this once
  you sign in" with the closest supported suggestion. No fake answers.
- **Claude powers search and Ask with the owner's Claude API key** (owner 115; F-247). Search & Ask sends the
  question to Claude (latest model; a fast tier such as Haiku for query understanding, Sonnet/Opus only for
  free-form answers) which returns a structured query (tool use with a JSON schema: intent, people, groups,
  categories, types, amount ranges per currency, dates/periods, text terms) that the on-device engine runs
  against the local store; Claude never computes money (amounts always come from `@splito/domain` on the device)
  and its output is validated before use. **The key is never in the bundle, the repo, logs, backups or sync:**
  until the backend exists the key lives in the git-ignored `.env.local` at the repo root (`ANTHROPIC_API_KEY`,
  owner 117; `.env.example` documents it) and is read only by a small dev-only local AI proxy
  (`scripts/ai-proxy`, started with the dev/preview server) that the app calls; it is never an `EXPO_PUBLIC_*`
  variable (those are copied into the JS bundle) and never reaches the client. Once the backend exists, the
  backend proxy (§ 26.19) replaces the local one with the same contract. What is sent: the question plus the names of my
  people, groups and categories needed to resolve it, never amounts, notes or other records; shown once on first
  use. Offline or with no key, the on-device parser answers as today. *Why:* "I have Claude keys, you should
  enable that as well in search".
- **Search understands every field and combines them logically** (owner 116; F-246): people (name, nickname,
  "with Riya", "paid by Riya"), places (expense title, notes, item names, group name, trip location), amount
  ("500", "> 1000", "between 200 and 800", "around 1k", "1 lakh", with or without a currency, in the user's
  number format), category, type (expense, payment, write-off, comment, group, friend, invite), group, date
  and period ("yesterday", "last month", "March", "in Goa trip"), currency, payer, status (settled, owed, deleted,
  hidden, inactive). Facets combine with AND across facets and OR within one ("food or travel in Goa over 500");
  each recognised facet shows as a removable chip in the search box; free text matches the remaining words;
  results stay grouped (People, Groups, Expenses...) with totals per currency and paged (§ 9.8 `search_terms`,
  extended with tokens for every field above). *Why:* "make sure the search works logically with most of the
  things like name, place, amount, category, type, group etc".
  *How the query is read (assistant's ruling, F-246, replacing "words and simple amount filters"; fix round rulings
  2026-10-31):* English and Hindi words for "over / under / between / around", "this / last week / month / year" (the
  week starts on the `weekStart` preference), months and one day ("4 march", "march 4", "4 march 2026"; without a year,
  the latest one not after today), today / yesterday, "paid by X / X ne", "with X / X ke saath", "in <place>",
  statuses and types; amounts accept `1k`, `1.5 lakh`, `2 cr`, a currency sign or code, and `rs`, `Rs.`, `rupees`,
  `रु` (all INR); joining words ("in", "on", "for", "spent", "at", "of", "the", "to", "from", "में", "पर", "लिए"...)
  are dropped when they are not part of a facet and something else is left; `food or travel` (Hindi `या`) is OR
  inside one facet, everything else AND (Hindi `और` is AND, as "and" is); a name that nobody has ("with friends") is
  just words; a close spelling counts only for a person's name, keeps the first letter and is at most 20 letters; a
  status or type word that finds nothing ("group dinner", "settled bill") is searched as text. A friend's contact
  (email, phone, with or without the country code) or UPI id finds the friend, never their records; my own name finds
  nothing (every record is mine). A category is found by its name in the person's language and by its stored name.
  Status: *deleted* = tombstones (people and groups too), *disputed* = an open dispute or hold, *hidden* = the groups I
  hid and the deleted items I hid, *inactive* = inactive groups; *settled / owed / owe* are a group's own nets (all
  zero / I am owed / I owe), and for a record outside any group my direct balance with the others on it (a friend's
  balance inside groups is not folded in). Results: People, Groups, Payments (payments and write-offs) and Expenses
  (with count and per-currency totals), in that order, each paged with its own Show more, so loading more never moves a
  section; a comment's text finds the expense, payment or write-off it is on; each row names the field that matched
  (Notes, Item, Group, Place, Category, With, Paid by, Comment, Amount, Date, Currency, status) and marks the words; an
  amount, date, currency or status match is the tag alone (the amount and date are already in the right column), and a
  balance status says where it applies: "Settled in group", "Owed in group", "You owe in group" on a group's record,
  "Settled", "Owed", "You owe" outside groups; the row's accessibility label names the matched fields and the comment;
  each facet is a removable chip under the box. Types are expense, payment, write-off, comment, group and friend; not
  searched: invites and friend requests (they are not ledger records and have their own list in People), so "invite"
  is a plain word. If the search cannot be answered (its index cannot be built), the drawer says so with Try again,
  never an endless spinner.
  *Reads/writes:* reads term ranges (`store.terms`), `getMany` for a narrow answer (at most 500 records) and for the
  30 rows of a page, the people / groups / balances projections for the statuses, `listOpenDisputes` for *disputed*;
  `store.prepareSearch()` once per open at idle; writes up to 12 term rows per expense, payment or write-off, none
  for a comment beyond its words. *Cost:* a narrow query touches its tokens' keys (each probe at most 500) plus its
  rows; a broad one's first page costs at most 500 keys per token plus at most 1,000 walked rows per section, and its
  count and totals (after the first page is painted) its full key sets and the `d` and `a` ranges (about 1 us a key);
  a stale index is rebuilt once, at idle, in 500-row chunks.
  *Telemetry:* none added (a failed index build is a `StoreProvider.prepareSearch` error log). *Checks:*
  `search.test.ts` (parser, per-field, paging, speed on both engines at 10,000, IndexedDB rebuild), `searchFields.test.ts`
  (every field on SQLite and IndexedDB, contacts, weekStart, localised categories, >30 payments, mixed-version writer,
  failed rebuild), `searchOracle.test.ts` (property test on both engines: first pages on open, then counts and totals,
  then every row, with the walk, a walk read to its end and a walk given up on), `searchQuery.test.ts` (table of 107
  queries), `searchMatch.test.ts`, `e2e/search.spec.ts` at 390 and 1440; web verified, native not run.
- **Privacy:** AI is opt-in (preference "Ask Splito uses AI", default off until signed in); the first use
  shows exactly what data is sent; nothing is sent for on-device answers.

### 26.20 Comments, reminders, disputes and export

*Why:* "add comment feature, remind, export etc". *Where:* `components/comments/`, `lib/remind/`,
`lib/export/`, `screens/Settings/Data`.

- **Comments** on every expense and repayment: a thread at the bottom of the expense detail using Bluesky's
  reply rows and a composer bar (Bluesky DM composer); @mention of participants, emoji, edit and delete your
  own; a comment count on expense rows; new comments from others show in Activity (unread). Local and in the
  outbox now; shared once sync exists.
- **Remind:** "Remind" on the Person page (overflow), on each debtor row in group Balances and in the Settle
  plan. It writes a friendly message with the amount per currency and the UPI / payment link (F-1501 text)
  and opens the share sheet (WhatsApp, SMS, email); once the friend is on Splito and the backend exists it
  also sends an in-app reminder. "Remind me" schedules a local notification for yourself (date/time, repeat).
  Gentle limits: one in-app reminder per person per 3 days; every reminder is logged in Activity.
- **Export:** Settings > Data > Export (CSV, PDF statement, full JSON backup; filters: date range, group,
  person, currency) with Import (JSON backup restore); plus Group overflow "Export", Person overflow "Export
  statement", the Analytics header's Export icon (one shared sheet, pre-set to its period, currency and scope; § 25). Exports are generated on the device; amounts exact, per
  currency.

- **Disputes and holds** (owner 119; F-1210, Wave C after comments merge). Anyone in a shared record can say
  "this is wrong" or "wait", without editing someone else's expense, and it is settled in the open.
  - **What can be disputed:** an expense, one item of an itemized bill (my portion), a repayment ("I didn't
    receive this") and a write-off ("Call it even" I don't agree with). Not comments or groups.
  - **Who:** any participant of the record, plus any group member for "I was left out" (they may not be a
    participant yet). One open dispute per person per record; several people may dispute the same record.
  - **Reason is structured** (one chip, then an optional note, required for "Other"): Not part of this / I was
    left out / Wrong amount / Wrong split or my share / Wrong payer / Duplicate (pick the other expense) / Wrong
    currency or date / Payment not received (repayments) / Other. A reason may carry a **proposed fix** (amount,
    my share, payer, the duplicate's id), so the answer can be one tap.
  - **Hold is the light version** (Expensify's hold): "Put on hold" with a required reason ("waiting for the
    refund", "need the receipt") pauses a record that is not wrong yet; any participant may release it in one
    tap. Disputes and holds share the badge, the sub-total and the settle rule below.
  - **One entry: "Report a problem"** [Built, F-275, assistant's ruling 2026-10-31; keeps both of owner 119's kinds,
    replaces the separate Dispute and Put on hold menu items and buttons, audit F-15]: the expense and payment "..."
    menus, a history row's menu and the payment details have one item, "Report a problem" (`record-report`,
    `payment-report`), which opens one sheet. Its first choice is **Dispute** (chosen) or **Put on hold**, then the
    reason chips (or the hold reason) as before. It is raised as me: no "Raised by" picker is shown; a small
    secondary button, "Record this for someone else", reveals it (before the backend, below). One item of an itemised
    bill keeps its own "Dispute my portion" (a hold applies to the whole record).
  - **States:** Open, then exactly one of Accepted (the fix was applied: one tap applies the proposed fix as a
    normal edit with history, or the resolver edits by hand; **one tap only when the fix keeps the record's split mode:** an
    amount fix scales an equal, percent, shares or adjusted split, a share fix needs an exact split, a payer fix never touches
    the split, a duplicate or an unreceived payment is deleted; an amount fix on an itemised or exact split, or a share fix on
    anything but an exact split, is not offered as one tap, only "Edit it", with a line saying why, and where one tap is offered
    the panel says what the edit will change), Rejected (reason required), Withdrawn (by the
    person who raised it) or Gone (the record was deleted). After a rejection the raiser may reopen once with a
    new note; after that only a group admin answers it (accepts, rejects or reopens it): the adder and payer already said
    no once. A record outside a group has no admin, so its adder or payer still answers a reopened dispute and a second
    reopen is refused. Editing a disputed record asks the editor "Does this resolve <name>'s dispute?". **Who resolves:** the person who added the record, or its payer, or a group
    admin (also when the adder has left). Nobody resolves their own dispute except by withdrawing.
  - **Money: a disputed or held record still counts; it does not wait.** Balances, totals, the overview, charts
    and exports keep counting it as recorded, because the record stands until someone changes it, and a dispute
    that removed money would let anyone erase what they owe with one tap and make everyone's balances jump. What
    changes: every place that shows a balance adds a per-currency "of which disputed" line (‹₹1,200 · ₹400
    disputed›), the row and the detail page carry an amber "Disputed" or "On hold" badge (icon plus text, never
    colour alone), and **Settle up leaves disputed and held amounts out of the plan by default**, says so
    ("₹400 disputed, not in this plan") and offers "Include disputed" (remembered per group,
    `group:settleIncludeDisputed`, default off), so nobody pays or chases money that is being questioned.
    What "left out" means: per person and currency the net only shrinks toward zero by their disputed part, never flips or grows
    (a settled group stays settled, a part-repaid balance loses at most what is still owed, a disputed "payment not received"
    never asks anyone to pay twice), and the other side is scaled back so each currency still sums to zero; the amount stated is
    what was actually removed. A friend's Settle up and Call it even do the same: the prefill and the write-off leave the disputed
    part out unless "Include disputed" is on there. Item disputes name the item by its own id, so reordering a bill moves
    nothing, and an edit that removes the item counts nothing for it and closes the dispute as Gone.
    Accepting a fix changes the balance through the edit; rejecting it changes nothing. A dispute on a record
    before a settle-up checkpoint (F-1205) shows as "Adjustment after settle-up" when accepted.
  - **Where it shows:** raising and resolving each post a system line into the record's comment thread (the
    discussion happens there, § 26.20 comments); Activity rows for raised, answered, reopened and released
    (unread for the resolver and the raiser respectively); a "Needs your answer" item on the For you card
    (F-230) and a Disputed filter on lists, Activity and Search (`status: disputed`); a dispute column in CSV.
    A dispute open 3 days nudges the resolver once on the For you card; no push spam.
  - **Data:** its own `disputes` store (§ 9.8): id, targetType, targetId, itemIndex?, raisedBy, kind
    (dispute | hold), reason, note, proposedFix, status, resolvedBy, resolution note, timestamps; indexes
    `byTarget` and `byStatus`; every change a sync mutation with history and an outbox op; the
    "of which disputed" figures come from a projection kept in the same transaction as `balances`, never a scan.
    Permission checks (`canDispute`, `canResolveDispute`) live in `domain/permissions.ts`; the server re-checks.
  - **Before the backend** every record is mine, so a dispute raised on this device is raised by me, and only
    after "Record this for someone else" does it record "raised by" a chosen participant (labelled "recorded by
    you", like recording a payment for others); it becomes
    two-sided with sync (F-2208). Demo data carries every state (owner 109).
  *Why:* "add an option for disputes as well, think about it properly"; "should we calculate disputed expense
  or wait until they are resolved".

  - **[Built] (F-1210, 2026-10-30)** `packages/sync/src/disputes.ts` (mutations `dispute.raise|hold|release|accept|reject|withdraw|
    reopen|gone`, each a versioned write with history and an outbox op; accept with `apply` runs the fix through `updateExpense`
    in the same transaction; `updateExpenseResolving` saves an edit and accepts in one), `packages/domain/src/permissions.ts`
    (`canDispute`, `canResolveDispute`: the raiser, or whoever recorded it for them, may only withdraw or reopen; the adder, a
    payer or an admin answer; a second reopen is admin only) and `disputed.ts` (the "of which" and Settle arithmetic).
    Client: `components/disputes/` (badge, "of which disputed" line, panel, thread line, row menu items), `features/disputes/`
    (`DisputeHost` at the app root with the raise/hold sheet and the reject/reopen note sheet), `state/disputes.ts` (reads and
    writes), `lib/disputes/bus.ts`. A hold's reason is free text (required); a dispute's `other` needs a note. A proposed fix
    exists for amount, share, payer and duplicate; "Payment not received" applies by deleting the payment; accepting without a fix
    only records that the resolver agreed. A deleted record closes its open disputes as Gone in the deleting transaction
    (`write()` does it for every path, a group delete included).
  - Where it shows: Expense and Payment pages (badge, panel, thread lines), history rows (badge; right-click, long-press or a
    "..." button on wide screens opens Report a problem), an itemised bill's items ("Dispute my portion"), Person and Group
    balances ("of which ₹400 disputed", per currency, pointing the way the balance does and never above it), Settle up (disputed
    and held amounts left out by default with the amount stated, "Include disputed" remembered per group in
    `group:settleIncludeDisputed`, a new plan hash on every raise, accept and release), the edit prompt "Does this resolve
    <name>'s dispute?", Activity (a Disputes type on Activity's Filters, and rows for raised, held, answered, reopened, released,
    withdrawn; Gone is the delete's own row), "Disputed only" in the Group and Person filter sheets (the page's own choice,
    not in the address yet), Search (`status: disputed`, alone or with words), and a Dispute column in the CSV statement.
  - **Not built (why):** the For you card's "Needs your answer" and its 3-day nudge (the card, F-230, is not built and Home is
    being redesigned: `useOpenDisputes()` in `state/disputes.ts` is the read it needs); "Adjustment after settle-up" (needs the
    F-1205 checkpoints); "of which disputed" on the Home overview cards (another builder owns them: follow-up note in
    BACKLOG F-1210); the Disputed filter in the address (F-241).
  - *Reads/writes*: stores `disputes`, `disputed_balances`, `disputed_pairs`; reads `byTargetStatus` (a record), `byStatus` (all open,
    one projection for every list and badge), `byTarget` (a record's history), `disputedBalances`, `disputedPairs`; outbox op types
    `dispute.raise`, `dispute.hold`, `dispute.release`, `dispute.accept`, `dispute.reject`, `dispute.withdraw`, `dispute.reopen`,
    `dispute.gone`; no server routes yet.
  - *Cost*: raising is one transaction (the dispute, its history row, one outbox op, plus the disputed sums of one record: two index
    reads and a few row writes). Every money write adds one indexed read of the record's open disputes. Lists read the open
    disputes once, not per row. No timers, no dependencies; one bundled sheet host at the root.
  - *Telemetry*: none added (no new metric name).
  - *Checks*: bun `permissions.test.ts`, `disputed.test.ts`, `disputes.test.ts` (both engines), `ledgerProjection.property.test.ts`
    ("never move a balance" with disputes riding on their own random stream), `migrate.test.ts` (v4 -> v5 on both engines and the
    large set), `demoCoverage.test.ts` (13 lines); Playwright `disputes.spec.ts` at 390 and 1440. iOS and Android: not yet.

- **Notifications: one switch for money, one for comments** (owner 131; built with F-251). Settings >
  Notifications has "Payments" (one switch for both new expenses that include me and payments to or from me;
  replaces the separate "New expenses" and "Payments" switches, `notify.expense` folds into `notify.payment`,
  an old "off" on either reads as off), "Comments" (`notify.comments`, on: a comment or @mention on an expense or
  payment I am in), "Invites" and "Reminders I set". Like the others, Comments only notifies once sync exists
  (§ 0 rule 6), and the page says so. *Why:* "new expense and payment should be one, make it payment, add one
  more notification for comments".
  *Assistant ruling, 2026-10-31 (not yet seen by the owner; after the c-nohome review):* until sync exists,
  Settings > Notifications shows only "Reminders I set"; the Payments, Comments and Invites switches (and Privacy's
  "find me by email / phone") are hidden (`NOT_BUILT` in `SettingsSection.tsx`), under owner 212 ("nothing shown that
  they cannot act on") and § 0 rule 6. Their preferences stay in the registry and the rows come back with sync.

- **Push notifications on every platform** (owner 137; F-2201, in the first backend batch right after sign-in
  and sync, F-2101..F-2103). Real push, not only local alerts: iOS (APNs) and Android (FCM) through
  `expo-notifications`, and web through Web Push (VAPID) in the PWA's service worker, so a browser tab that is
  closed still gets them where the browser allows. What pushes follows Settings > Notifications exactly
  (Payments, Comments, Invites; Reminders stay local): an expense that includes me, a payment to or from me, an
  edit or delete that changes my share, a comment or @mention, a friend request or accepted invite, a dispute
  raised or answered (F-1210). Text is in the recipient's language and never shows amounts or names on the lock
  screen unless the privacy level allows (F-1605); tapping opens the exact screen by its URL (owner 100);
  per-group threads; actions where safe ("Mark read", "Open"; never "Settle" or "Delete", § 14). Permission is
  asked only from a tap, after a one-screen primer, never at launch; refusing is a state with a Settings link,
  not an error. A push payload is only a hint: the app pulls and shows local data, never writes the payload to
  the store (§ 9.3). Tokens are per device and account, refreshed on a schedule, removed on log out. *Why:* "we
  need to add push notifications as well".

### 26.21 Offline web app (service worker and PWA)

*Why:* "also add service worker for cache and pwa". *Where:* `apps/client/web/`, export post-step.

- **A service worker in production web builds** (off in dev and e2e): precaches the hashed app shell and
  assets, stale-while-revalidate for fonts and images, navigation falls back to the cached shell so the app
  opens offline. It never caches API responses (data lives in IndexedDB, § 9).
- **Updates:** a new version installs in the background; Bluesky-style toast "New version available ·
  Reload"; never reloads on its own while a sheet has unsaved input.
- **PWA:** web manifest (name, short name, icons from the brand kit, Dim dark background, standalone display),
  install via the browser prompt captured once and offered as "Install app" in Settings (and a one-time,
  dismissible hint); iOS shows "Add to Home Screen" instructions.

### 26.22 Release blockers

- **The butterfly logo must be replaced before any public release** (public web deploy, TestFlight / App
  Store, Play Store). It is Bluesky's trademark, excluded from Bluesky's MIT licence, and stores reject
  look-alike apps. The item in `docs/RELEASE_CHECKLIST.md` stays open until an original mark replaces the one
  logo source file and the brand kit is regenerated. *Why:* the owner chose it for development after being
  told.
- **A production build is refused until the auth HTTP client exists** (F-250): `auth-config.js` (read by `app.config.ts`)
  sorts every build into a kind from `EXPO_PUBLIC_ENV` (development, e2e, preview, production; no value means production in
  an export and development in `expo start`), refuses production outright until `AUTH_HTTP_CLIENT_READY` flips (then it needs an
  https `EXPO_PUBLIC_AUTH_API_URL`), and refuses any kind on a stage or prod tier. The review site is the **preview** kind
  (`render.yaml` builds `EXPO_PUBLIC_ENV=preview`): the labelled dev account, a fixed note on Continue, `noindex`, no e2e hooks
  (`authConfig.spec.ts`, `e2e-pwa/bundle.spec.ts`, `e2e-pwa/pwa.spec.ts`).
- The other release blockers (dev-only switches inert, real auth and sync live) are listed in
  `docs/RELEASE_CHECKLIST.md`.

### 26.23 Decision log

Every owner decision, in the order it was made (all 2026-10-26). "Replaced" names what the decision overrode;
"AGENTS rN" is the rule's number in the old `AGENTS.md` list (see git history before this section existed).

| # | Owner said | Decision | Rule | Replaced |
|---|---|---|---|---|
| 1 | "need all what you dropped"; "think of more features" | Keep every spec feature, add USPs | § 26.2 | Assistant's proposed cuts |
| 2 | "analytics also needed, with graphs and all" | Analytics with graphs | § 26.16 | - |
| 3 | "multi language support"; "default eng" | Multi-language, English default (Hindi second: assistant) | § 26.2 | - |
| 4 | "set your timezone" | User-settable timezone | § 26.2 | - |
| 5 | "smooth like Bluesky"; "animations like Expensify" | Bluesky smoothness, Expensify page animations in v1 | § 26.10 | Lottie planned for v3 |
| 6 | "every single thing to be customizable" | Preferences registry, everything customizable | § 26.1 | - |
| 7 | "use Postgres" | Server on Postgres | § 26.2 | - |
| 8 | "copy from Bluesky ... and Expensify ... code practice, speed, structure, coding standards" | Copy code and practice from both | § 26.1 | - |
| 9 | "best in terms of features, looks, simplicity" | Best-in-class bar | § 26.1 | - |
| 10 | "for all platforms: splash, branding" | Full polish on every platform | § 26.2 | - |
| 11 | "look into architecture md file from GameRun expo" | GameRun architecture adopted where it fits | § 26.2 | - |
| 12 | "way too basic like 10th class app" | Premium, populated previews | § 26.1 | - |
| 13 | "same Bluesky design", "every pixel to pixel same" | UI copied pixel for pixel | § 26.1 | Splito's own visual language |
| 14 | "create your own butterfly logo" -> "use same logo for now" -> "butterfly only" -> "very shitty" | (all replaced) | § 26.11 | Original split-butterfly |
| 15 | "symmetrical, use a cat", "Lucide", "don't draw", "but fill" | Filled Lucide cat | § 26.11 | Butterfly (#14); later replaced by #46 |
| 16 | "either blue n white or black n white" | Cat blue+white or black+white | § 26.11 | Replaced by #45, #46, #49 |
| 17 | "on web it should occupy complete screen", "navigation like Bluesky" | Bluesky shell, full-width web | § 26.3 | - |
| 18 | "even on web make it fab icon only" -> "go with what Bluesky had" | FAB on phones, pill on desktop | § 26.6 | Spec's central + button |
| 19 | "for web, keep my left sidebar and main content" | No right column | § 26.17 | Replaced by #47 |
| 20 | "don't ask me anything ... build backend later" | Decide without asking; backend after UI | §§ 26.1, 26.2 | - |
| 21 | "use the same flow of that FAB icon" | Add expense opens like Bluesky's composer | § 26.6 | - |
| 22 | "move profile icon to top right" | Avatar top right (dropdown) | § 26.4 | Replaced by #23 |
| 23 | "open the drawer like Bluesky", "move this to left, where hamburger icon was" | Avatar top left opens Bluesky drawer (AGENTS r1) | §§ 26.4, 26.7 | #22 |
| 24 | "centre may be page name, right maybe some basic action, left back or avatar" | Header rule set (AGENTS r2) | § 26.4 | - |
| 25 | "make notifications as activity or move to top" -> "move it to header" | Header bell | § 26.14 | Replaced by #28 |
| 26 | "what's the second icon on header left of avatar" | No extra header icons (AGENTS r4) | § 26.4 | - |
| 27 | "an expense can be one expense or with multiple ... dishes" | Itemized expenses with portions (AGENTS r5) | § 26.13 | - |
| 28 | "make notification as activity and move to bottom" | Activity tab with badge, no bell (AGENTS r3) | § 26.14 | #25 |
| 29 | "the cancel button to be a cross on top right like iPhone native, and save button on bottom" | X top right, Save at bottom | § 26.8 | Header "Cancel" + "Save" pill (AGENTS r2) |
| 30 | "cross button ... cancel and save button at bottom; modal/popup on web ... bottom right" | Shared FormSheet layout (AGENTS r7) | § 26.8 | #29's Save-only footer |
| 31 | "add balances option in group ... filters in friends ... include group" | Group balances, Friends filters (AGENTS r8) | § 26.12 | - |
| 32 | "add overview in both friends and groups, with search and filters, search icon only" | Overview, expanding search, filters (AGENTS r9) | § 26.12 | Groups "Balances" heading (r8a) |
| 33 | "do what you want, take own decisions, don't disturb me"; "store them and keep building one by one" | Autonomy; `docs/BACKLOG.md` built in batches | §§ 26.1, 26.2 | Screenshot on every update during autonomous runs |
| 34 | "consider speed and animations always" | Budgets and animation everywhere (AGENTS r10) | § 26.10 | - |
| 35 | "always take code from Bluesky ... check in Bluesky" | Bluesky first (AGENTS r11) | § 26.1 | - |
| 36 | "no animation when switching tabs"; "need animations while switching bottom navigation" | Pager tabs, animated main tabs (AGENTS r12) | § 26.9 | Segmented controls; Bluesky's instant switch |
| 37 | "you need to improve left sidebar" | Bluesky LeftNav (AGENTS r13) | § 26.5 | - |
| 38 | "by default keep the dim mode in dark" | Dark = Dim (AGENTS r14) | § 26.11 | Pure black dark |
| 39 | "in desktop, when you show logo add the name as well" | Desktop wordmark (AGENTS r15) | § 26.5 | Replaced by #48 |
| 40 | "in itemize don't show default tax tip discount" -> "let it be" -> "it should be there" | Adjustments stay visible | § 26.13 | Hide-until-added (reverted the same minute) |
| 41 | "but add the percentage option as well" | Amount / % toggle (AGENTS r16) | § 26.13 | - |
| 42 | "add expense ... sheet from bottom, fab ... if back button is not there show it"; "home and activity also" | Add expense bottom sheet; FAB on every no-Back screen, all widths (AGENTS r17) | §§ 26.6, 26.8 | Desktop part replaced by #49 |
| 43 | "all the sheets should have animation"; "closable if I drag it down" | Animated sheets, drag to close (AGENTS r18) | §§ 26.8, 26.10 | - |
| 44 | "add signin option, and logout as well in settings" | Account section, honest sign-in (AGENTS r19) | § 26.15 | - |
| 45 | "keep it blue always" | Logo always blue (AGENTS r20) | § 26.11 | #16; replaced by #49 |
| 46 | "I have a logo.svg file in downloads, use that", "you can change the color", "just use that", "use it everywhere, even for the favicons" | Owner butterfly, dev only, release blocker (AGENTS r21) | §§ 26.11, 26.22 | Cat (#15); r20's "butterfly not used" |
| 47 | "let's have recent transactions instead of recent groups" -> "or have both, do we need a right sidebar" -> "right sidebar ... recent transactions, and recent groups", "max to 5" | Right column, 5 + 5 (AGENTS r23) | § 26.17 | #19; recent groups in the left sidebar (r13d) |
| 48 | "show the brand text on desktop" -> "make the branding in centre" -> "remove the avatar from sidebar" -> "remove label from logo" | Centred mark only; no sidebar avatar (AGENTS r22) | § 26.5 | #39; ProfileCard (r13a) |
| 49 | "changing accent color should change logo color ... don't open sidebar on avatar click ... fab should not be visible on desktop" | Accent logo; avatar -> Profile on desktop; phone-only FAB (AGENTS r24) | §§ 26.4, 26.6, 26.11 | #45; desktop FAB (#42) |
| 50 | "all modal in mobile should be drawers" | Every phone modal, prompts included, is a bottom sheet | § 26.8 | Prompts excepted (AGENTS r7) |
| 51 | "make sure this file updates on its own"; "add whatever we discussed so far" | Decisions recorded here in the same turn; hook reminder | § 0 rule 9, § 26.1 | Numbered list in `AGENTS.md` |
| 52 | "to add the friend, it should ask the email or mobile, and try to invite, once they accept they can be used anywhere"; "invite link, or qr, with limits"; "they should accept"; "if they are not there show the warning, and one option to add anyway (only for you)"; "select from contacts" | Add friend by email/mobile or contacts, directory check first, consent required, not-on-Splito warning with Send invite / Add anyway (only for you), invite link + QR with use and expiry limits | § 26.18 | Add friend = local name only (F-601) |
| 53 | "add one feedback section as well" | Feedback in drawer, Settings > Support and desktop right-column footer (Bluesky placement); in-app feedback sheet, saved locally + email draft until backend | § 26.15 | Feedback as email draft only (BACKLOG F-215) |
| 54 | "in the recent group, make it recently active groups" | Right column section "Recently active groups", ordered by last change time | § 26.17 | "Recent groups" by latest expense date |
| 55 | "on desktop, show home instead of branding as branding is there on left" | Desktop/rail home header shows the title "Home"; home destination labelled Home | §§ 26.3, 26.4 | Logo in the People header at every width |
| 56 | "on splash show the dim instead of black" | Dark splash uses Dim background | § 26.11 | Black dark splash |
| 57 | "add one ai chart option, think about the placement" | Ask Splito AI chat: sidebar/drawer item, Analytics header, Search row; on-device answers + backend AI | § 26.19 | - |
| 58 | "also add service worker for cache and pwa" | Production service worker, update toast, manifest, install | § 26.21 | PWA in Batch 5 |
| 59 | "add comment feature, remind, export etc" | Comments on expenses, Remind (share + in-app + remind me), Export/Import | § 26.20 | - |
| 60 | "remove me from drawer-profile"; "removed the other saved on device and me" | Drawer header shows real name, no "Me", no sync text | § 26.7 | "Saved on this device" in drawer header |
| 61 | "add green icon for online, yellow for syncing, red for on device only ... on player avatar on sidebar drawer" | Sync-status dot on the user's avatar (drawer + header), with text label | § 26.7 | Sync status as text |
| 62 | "mobile sidebar and desktop seems to be different, make them same" | One nav list + one footer for sidebar and drawer | §§ 26.3, 26.5, 26.7 | Drawer had Profile, theme toggle; sidebar had no footer |
| 63 | "add everything to feature list and pick one by one" | Every request becomes a BACKLOG entry; build one feature at a time to done | § 26.1 | Many feature streams in parallel |
| 64 | "add a lot of demo data to my account" | Large deterministic demo dataset, `?demo=large` + Settings > Data (dev/e2e only), removable | § 26.1 | Small `?demo=1` set only |
| 65 | "there is signin page already there in bluesky, use that" | Sign in / Create account copy Bluesky LoggedOut + Login + Signup screens | § 26.15 | Own method-picker sign-in screen (email/phone code, Apple/Google) |
| 66 | "where is the ai chat placement, and why i see a new search, its also not visible on mobile" | Search becomes the second phone bottom-bar tab (Bluesky); Ask Splito placement unchanged (sidebar/drawer, Analytics header, Search row) | §§ 26.3, 26.19 | Search only in the drawer on phones |
| 67 | "analytics group selection needs to be rethought, one dropdown and one selection doesn't make sense" | One scope chip + one checklist sheet (All / Non-group / each group); Include groups toggle removed | § 26.16 | Group dropdown + "Include groups" toggle |
| 68 | "add multiple currency examples for everything, like group (if logically makes sense or group should have one currency), friends" | Group currency is only a default; any currency per expense; everything shown per currency, never summed; demo data multi-currency everywhere | § 26.13 | - |
| 69 | "why i see a search section on sidebar but only on web, whats the placement for ai chat, and i need on both platforms" | Search tab on phones + Ask Splito chip/suggestions in Search; both on web and mobile; nav unification and Ask Splito built next, right after the audit fixes | §§ 26.3, 26.19 | Ask Splito last in the queue |
| 70 | "all of the sidebar options to be available in settings to be added in navigation bar" | Settings > Navigation: every sidebar item can go in the phone bottom bar (2-5 tabs, reorder, Home fixed) | § 26.3 | Fixed bottom bar; Custom navigation offered only some tabs |
| 71 | "that search to be available globally on home section instead of a separate page" | Global search field at the top of Home with in-place grouped results; Search is no longer a page or nav item; freed bottom-bar slot goes to Ask Splito (centre) | §§ 26.3, 26.12, 26.19 | Search page + Search tab (rows 66, 69) |
| 72 | "the search option to be left of add people on the header, which expands on click" | Global search is a header icon left of Add friend that expands into the search field | §§ 26.3, 26.4 | Search field always visible at the top of Home (row 71) |
| 73 | "this search should open a drawer instead which would support ai as well" | Search icon (every top-level header) opens the Search & Ask drawer: search results + Ask Splito chat in one place; no Search or Ask pages; bottom bar back to Home, Groups, Analytics, Activity | §§ 26.3, 26.4, 26.19 | Expanding header search (72), Ask Splito centre tab and screen (71) |
| 74 | "make it as a ai icon like flash or something ... basically we are combining ai and search" | The Search & Ask header button uses the Lucide Sparkles AI icon (not a magnifier) | § 26.3 | Magnifier icon |
| 75 | "command + k opens this up" | Cmd/Ctrl+K opens and closes the Search & Ask drawer everywhere (web, hardware keyboards), hint shown on desktop | § 26.3 | "/" or Cmd/Ctrl+K on web only |
| 76 | "make accept decline like invites sent, on mobile only icon for both, for web complete text with icon" | Requests and Invites sent rows: actions on the right; icon-only on phones, icon + text on desktop | § 26.18 | Accept/Decline text buttons under the name |
| 77 | "invite link and qr to show once i click on invite people, not outside" | Invite link / QR only inside the Invite people (Add friend) sheet and the group Add members sheet; header overflow entries removed | § 26.18 | Invite link in Home "..." and Group overflow |
| 78 | "manage the indexeddb properly, a lot of different data is clubbed into a single table"; "the db level architecture is very important for scalability" | Local DB v2: one store per entity type, normalised members/parties, indexes per query, balance projection in-transaction, cursor paging, versioned migrations, Postgres mirrors it | § 9.8 | Single `entities` store with full scans |
| 79 | "every value can have status, whether its outbox, pending success, synced whatever" | Per-row `syncStatus` (local / pending / syncing / synced / failed) with index, shown per item, aggregated in the avatar dot | §§ 9.8, 26.7 | Only a global status label |
| 80 | "use sonnet for all implementation and opus for decisions and reviews" | Sonnet builds and fixes; Opus decides, reviews, audits, judges; every feature gets an Opus review before the next | § 26.1 | One model for everything |
| 81 | "just like in bluesky, even the header should scroll but once i scroll up a little it should appear" | Bluesky minimal shell on phones (header, bottom bar, FAB hide on scroll down, return on slight scroll up), sticky on desktop | § 26.4 | (rule existed but was not working) |
| 82 | "fanout with sonnet and get done" | Independent features build in parallel Sonnet worktrees in dependency waves, Opus review per feature, one assemble per wave | § 26.1 | Strictly one feature at a time (row 63) |
| 83 | "add invite management in settings as well"; "add one option in settings of friends, where you can add remove friends as well, and invite management as well" | Settings > Friends and invites: friends (add, remove with open-balance guard, undo), requests, invites sent, invite links, defaults | § 26.18 | Only "Manage invite links" under Privacy |
| 84 | "in navigation any number of options can be there" | Bottom bar takes any number of tabs (Home alone up to all items); labels hide above 5 | § 26.3 | 2 to 5 tabs |
| 85 | "make sure to pull features from Expensify and blusky whatever you think is better for user experience and features" | Per feature, take the better of Bluesky and Expensify (UX and features); Expensify leads money flows, Bluesky leads shell and client code; visual language stays Bluesky | § 26.1 | Bluesky first, Expensify for practice only |
| 86 | "See this bill, it has both alcohol and food and diff tax is applied on both ... how to split such bill ... the taxation we added was overall on the bill" | Items carry tax classes; ordered charges each apply to all items, chosen classes or chosen items and can stack on earlier charges; each charge spread only over who had those items; round-off and reconciliation to the printed total; presets and per-merchant memory | § 26.13 | One overall tax on the whole bill |
| 87 | "during scrolling don't hide bottom navigation, only header needs to be hidden" | On phones only the header scrolls away; bottom bar and FAB stay visible while scrolling | §§ 26.4, 26.6 | Bar and FAB hid with the header (row 81) |
| 88 | "add archive group option as well, when archived it stops showing in main view and no expense can be added" | Archived groups leave the Groups list, recent groups and pickers (reachable via filter, Archived fold, search); no new, edited, moved or restored expenses (enforced in the mutation); settle, payments and comments stay; balances still count | § 26.12 | Archive only hid the group from Groups |
| 89 | "or make it as active inactive and hide show instead of archive" | Two controls: Active/Inactive (group-wide; inactive takes no new expenses, enforced in mutations; settle stays; Inactive fold) and Show/Hide (personal pref `groups.hidden`); balances never hidden; old `archived` reads as Inactive | § 26.12 | One "Archive" (row 88) |
| 90 | "by default hide settled, in filters option for show settled, every setting that we choose to be stored in db" | Settled friends and groups hidden by default with a "Show settled" filter switch; every user choice (filters, sorts, scopes) persists as a database preference; device-scope prefs move from MMKV/localStorage into the DB | § 26.12 | Settled shown; filters in screen state; device prefs in MMKV |
| 91 | "add search on friends as well" | Friends list keeps its own inline search (icon that expands, live filter by name) next to its filters, in addition to the Search & Ask drawer | § 26.12 | Search & Ask only (F-222 removed the Friends search icon) |
| 92 | "in activity, add all, me and others" | Activity Pager tabs All / Me / Others (Me = actions I did, Others = actions by others) | § 26.14 | All / From others |
| 93 | "remember we need to implement the backend as well, once we are done with all the features" | Backend is mandatory scope: after all front-end features, every backend item is built before the product is done | § 26.2 | - |
| 94 | "now we have import and remove demo data, why do i have ?demo=1, only one demo mode from settings" | One demo dataset, added and removed only from Settings > Data; `?demo=1`, `?demo=large`, `EXPO_PUBLIC_DEMO` removed; e2e seeds via a test-only hook running the same path | § 26.1 | `?demo=1` small set + `?demo=large` + Settings |
| 95 | "instead of add/remove demo data, make it a switch like switch to demo mode, so that it doesn't add data to current account, both accounts keep different" | Demo mode is an on/off switch over its own separate local database (own prefs, history, outbox); real data untouched; banner while on; Reset demo; never syncs | § 26.1 | Add/Remove demo data into the current account (row 94) |
| 96 | "also add animations on svg icons or animations like Expensify wherever we can" | Meaningful animated SVG icons (tab fill morph, check draw, trash lid, sync pulse, FAB rotate, sparkles, chevrons) on the UI thread plus Expensify-style success/empty/celebration animations; reduced motion and `motion` pref respected | § 26.10 | Static icons; Lottie only for page illustrations |
| 97 | "on the home page and group page add option for recent transactions as well; home shows all, group shows only group level recent txns" | "Recent transactions" section in the Home body (everything) and on each Group page (that group only), customizable | § 26.17 | Right column only (desktop 1300 px and up) |
| 98 | "deleted item should show a stroke and clock symbol and time" | Deleted records show struck-through title and amount plus a Clock icon and "Deleted <time>" everywhere they appear | § 26.14 | Plain rows (strikethrough removed in B3 polish) |
| 99 | "only when demo i said, with a switch with diff data"; "no small demo or anything, only one switch" | One demo dataset, one Settings switch over a separate database; no small set, no ?demo=1 or any URL alias; e2e uses a test-only hook | § 26.1 | Small ?demo=1 set kept as a test alias (row 95 plan) |
| 100 | "for every tab, every popup it should be via url, so that even if i copy paste the url i land on same place" | Every page, tab, sheet/popup and meaningful list state has a URL (web) / deep link (native); open pushes, close goes back, paste/refresh restores; prompts and menus excluded; URLs never act | § 26.3 | Sheets and tabs held in screen state |
| 101 | "even the drawer or sheet should have same rule" | The side drawer, the Search & Ask drawer and every bottom sheet, including pickers inside sheets, are URL-addressable too | § 26.3 | Rule 100 named pages, tabs, sheets and popups only |
| 102 | "if i deleted an item and setting is for 90 days, and i change the setting to 7 days, the old item should still follow its own rule" | Each tombstone stores its own purgeAfter from the bin setting at delete time; changing the setting affects only later deletes | § 26.14 | Purge computed from the current setting |
| 103 | "lets remove this deleted items and keep deleted items inside their actual place with a stroke, like a deleted expense and keep it forever, and same for groups" | No Recently deleted bin; deleted expenses, payments, write-offs, comments, groups and friends stay in their own lists, struck through, never purged, never counted; open read-only with Restore; "Show deleted" filter (default on) | § 26.14 | Recently deleted bin with timed purge (F-1203, decision 102) |
| 104 | "by default show deleted as well" | Deleted items are shown by default; "Show deleted" filter defaults on | § 26.14 | (confirms 103's default) |
| 105 | "they need to manually hide, and then, show hidden to be used" | Deleted items always show; each can be hidden manually (personal, per item, Undo); one "Show hidden" filter (default off) reveals hidden items and hidden groups | § 26.14, § 26.12 | Global "Show deleted" filter (row 103) |
| 106 | "an expense can be hidden if deleted, group can be hidden/show or made inactive active" | Hide is offered on expenses/payments/write-offs (and friends) only after deletion; groups can be hidden/shown any time and made inactive/active | § 26.14, § 26.12 | (clarifies 105) |
| 107 | "keep performance in mind, it should be lightning fast no delays in rendering anywhere" | Performance budgets become a merge gate: first frame < 100 ms with real content or a skeleton, no blank/spinner, no dropped keystrokes; perf spec + render counts on 10k fixture at every merge, fail on budget miss or >10 % regression | § 26.10 | Budgets measured and recorded only |
| 108 | "also check wasted renders or rerendering everytime, remember in architecture"; "why did you render" | why-did-you-render in dev builds tracks every avoidable re-render; a Playwright render scenario fails on any report or a count above baseline; part of the merge gate | § 17, § 26.10 | Render counts recorded, no wasted-render check |
| 109 | "make sure to update the demo data again and again, with all the changes, add it in architecture" | Every feature adds realistic demo data in the same change; a demoCoverage test fails when a feature has no demo record; assemble re-seeds and re-screenshots | § 26.1 | Demo data updated ad hoc |
| 110 | "the alerts i receive, move them to top right and add one close button as well" | Toasts at top right (rail/desktop), top full-width on phones, each with a close X, swipe to dismiss on phones | § 26.8 | Bottom-left web toasts without close |
| 111 | "until the data is synced, keep that unsynced data a little light, so we know this is not synced" | Records not yet synced render in lighter (AA-safe) text, fading to full strength on server ack; failed keeps full strength + Needs attention; no per-row red dot | § 9.8 | Red per-row sync dot (decision 79 per-item marker) |
| 112 | "dont show settled up friends by default" | Reaffirms decision 90: settled friends (and groups) hidden by default with a "Show settled" filter; this part is pulled forward into the Wave B assemble, the "every choice in the database" part of F-1413 stays queued | § 26.12 | (priority raised) |
| 113 | "the view is not good in the overview if i dont have either 3 or 6, it should be properly boxed each one" | Each Overview currency card is its own equal-size box; balanced columns (4 -> 2x2, 5 -> 3+2 left-aligned); counts line below the grid | § 26.12 | Cards as cells of one shared box, last card stretched |
| 114 | "and it should adapt to all screen sizes" | Overview grid columns come from the measured content width (min card 240 px, max 3) with the balanced rule, re-laid out live on any resize, 320 px to ultra-wide | § 26.12 | Fixed phone/desktop column counts |
| 115 | "i have claude keys, you should enable that as well in search" | Claude (latest models) turns questions into structured queries run on device; never computes money; key in OS secure store via Settings until the backend proxy exists; never bundled, committed, logged, backed up or synced | § 26.19 | On-device parser only until the backend AI endpoint |
| 116 | "make sure the search works logically with most of the things like name, place, amount, category, type, group etc etc" | Search covers people, places, amounts, category, type, group, dates, currency, payer, status; AND across facets, OR within; facet chips; per-currency totals; paged | § 26.19 | Words, names and simple amount filters |
| 117 | "create one env file and ask for token there, i would paste" | Claude key in git-ignored `.env.local` (ANTHROPIC_API_KEY), read only by a dev-only local AI proxy; never EXPO_PUBLIC_*, never in the bundle | § 26.19 | Key entered in Settings, stored in OS secure store (row 115) |
| 118 | "remove email test, the emails are being triggered and app is opened" | The "Send by email" e2e test is removed on every branch; no e2e spec clicks a control that hands a link to another app unless it goes through `openExternal` (records only) | § 26.1 | e2e asserted the mailto hand-off (feedback.spec) |
| 119 | "add an option for disputes as well, think about it properly"; "should we calculate disputed expense or wait until they are resolved" | Disputes (structured reason, proposed fix, one-tap accept, reject with reason, withdraw, reopen once, admin closes) and holds on expenses, items, repayments and write-offs; a disputed record keeps counting in balances with an "of which disputed" line and a badge, and is left out of the Settle up plan by default with "Include disputed" | § 26.20 | F-1210 draft (disputed amounts out of the plan, no states or resolver rules) |
| 120 | "ui issues" (Home screenshot, 2026-10-29) | Home order Overview, requests, recent, Friends; Invites sent move to the Friends and invites page; overview labels and amounts never truncated and cards even; no red per-row dots; friend rows two lines (2 chips + N, one net per currency); Friends search back | § 26.12 | Invites sent above the Overview; truncating cards; chips wrapping |
| 121 | "I don't see invites related data in demo" | The one demo dataset carries the invites flow in every state: incoming requests (waiting, declined), invites sent (Sent, Opened, Joined, Expired, Cancelled), private "only for you" friends incl. one linked on joining, friend and group invite links in every state, a group join request, and their Activity rows; "Opened" and "join request" are stand-ins until F-2105 | § 26.1 | Demo had no invites data |
| 122 | "keep rebuilding app after changes, i see very old always" | localhost:8090 is rebuilt automatically after every commit to the integration branch or main line | § 26.1 | Preview rebuilt only at the end of a wave |
| 123 | "add another feature, like what you get when you install one app ... click next or skip which explains you what this app is and how to use" | Welcome tour on first launch: up to 5 slides (Pager, dots, Skip / Next / Get started, language chip), then setup (F-211); once per install, replay from Settings > Help; first-use tips after it, one at a time, each once | § 26.2 | F-211 began at the language/name step with one FAB coach mark |
| 124 | "Feedback ∙ Help ∙ Privacy ∙ About should be in one line" | The footer links are one line in the sidebar and the drawer (nowrap row, text_xs), English and Hindi | § 26.5 | Inline text that wrapped in the 240 px sidebar |
| 125 | "also without login, nothing should be visible, auth is required" | Sign-in required: signed out shows only the tour, the logged-out flow, language and legal pages; DB opens only with a session; offline after sign-in; one DB per account; dev/e2e dev account until the auth API; auth backend moved up after Wave C | § 26.15 | Sign-in optional, zero-signup onboarding (F-211), closable sign-in screen |
| 126 | "add a little padding from top, on sidebar on logo" | Sidebar logo sits 12 px lower than the header centre line | § 26.5 | Logo on the header row centre line |
| 127 | "navigation changes reflect on mobile only, it should be same on desktop as well" | Settings > Navigation drives the bottom bar, the rail and the desktop sidebar alike (same items, same order); items turned off go under "More" at the end of the sidebar/rail; the drawer follows the same order | § 26.3 | Desktop and rail always showed the full list |
| 128 | "remove this, its not needed" (Language menu switch); "customization are needed, but not forcefully, only whats needed" | Settings only where people genuinely differ; no switches for small UI details or duplicates; Language menu switch removed (dropdown always shown); F-251 prunes the rest | § 26.1 | Everything customizable |
| 129 | "remember, we need to make this app simple with all the features and customization" | Simple first: every feature kept, each screen shows only what the moment needs, power features one tap deeper, good defaults, short copy, no clutter; reviews check for clutter | § 26.1 | - (complements 128) |
| 130 | "how much i owe or these things should always be vertically center, whether its one row or two rows or any number of rows" | Row amounts (and avatar, name block) are vertically centred, never top-aligned | § 26.12 | Friend rows top-aligned the first net on the name line |
| 131 | "new expense and payment should be one i guess, make it payment, add one more notification for comments" | One "Payments" notification switch covers new expenses and payments; new "Comments" switch | § 26.20 | Separate New expenses and Payments switches; no comments switch |
| 132 | "in demo mode i see extra space on top, and it should be a switch not a checkbox" | Boolean settings are Bluesky switches on every platform; demo banner compact, text visible, no empty band | § 26.15 | Toggle.Platform checkboxes on web; blank demo banner band on desktop |
| 133 | "dont show that banner, not needed" | No demo banner at all; demo state shown by the Settings switch and the avatar's Demo state | § 26.15, § 26.1 | Banner on every screen (94/95), compact banner (132) |
| 134 | "in all headers, write Home - Demo like this instead" | In demo mode every header title ends with " - Demo" (logo + "Demo" label on phone Home; document title too) | § 26.15 | - (with 133) |
| 135 | "remember when backend is build, you need to download the demo data from backend not store in frontend" | With the backend, Demo mode downloads the demo dataset from the server into the demo DB; no demo seed in the client bundle | § 26.1 | Demo dataset generated in the app (dev/e2e) |
| 136 | "and remove when demo mode is switched off" | Switching demo off erases the demo database and demo-scoped keys; on again starts fresh; no Reset demo | § 26.1 | Demo DB kept between sessions; Reset demo |
| 137 | "we need to add push notifications as well" | Real push on iOS (APNs), Android (FCM) and web (Web Push in the PWA), following the Notifications switches; privacy-aware text; opens the exact screen; permission only from a tap; first backend batch | § 26.20 | Push planned without platform detail (F-2201) |
| 138 | "on login, signin with google and apple as well" | "Continue with Apple" and "Continue with Google" on splash, Sign in and Create account, every platform; server verifies tokens, links by verified email | § 26.15 | Email/phone only on the sign-in screens |
| 139 | "on signup, make email and phone both mandatory; if logged in via email only and no phone is there ask to update phone first" | Sign-up requires email and phone, both verified by code; any account missing one gets a blocking add-and-verify step after sign-in (only Log out besides) | § 26.15 | Sign-up with email or phone (one field) |
| 140 | "we can have signup and login as same screen only, no separate screen needed, basically no signup needed" | One Continue screen (Apple, Google, email or phone + one-time code); new accounts created in-flow by asking only what is missing; no passwords, no Create account or Forgot password screens | § 26.15 | Bluesky Create account / Sign in / password / Forgot password screens |
| 141 | "password should be there as well" | Passwords kept inside the one Continue flow: existing account enters password (or one-time code, Forgot password); new account sets one after verifying; Google/Apple need none | § 26.15 | Code-only, no passwords (row 140) |
| 142 | "tour is when i have logged in, and want the swipable screen before login like some app does" | Swipeable intro slides before sign-in (F-249); a separate guided coach-mark tour over the real app after first sign-in and setup (F-253) | § 26.2 | One welcome tour before setup (row 123) |
| 143 | "tour focuses on the feature and blur other places" | Each tour step keeps the focused control sharp and blurs (plus slight dim) the rest of the screen | § 26.2 | Dimmed backdrop only |
| 144 | "either signin with password otp, users choice" | Existing accounts choose Password or Code as equal options (segmented), last choice remembered per device | § 26.15 | Password first with "Use a one-time code instead" |
| 145 | "integrate deep links properly as well" | Every URL is a deep link: Universal Links, App Links, splito:// scheme, web fallback; one resolver for push, invites, QR, reminders, shares; signed-out and demo handling; deferred link after install; simulator tests | § 26.3 | Deep links partly wired (§ 14), no universal/app links |
| 146 | "make the home empty screen animation like other screens, there is slight diff in button and top paddings" | One empty-state layout everywhere: same illustration, motion, top spacing, one small secondary button | § 7 | Home had a title, large primary + secondary buttons and its own centring |
| 147 | "change the main branch to main" | Main line renamed from m1-foundation to main (old name kept as an alias) | § 26.1 | m1-foundation as the main line |
| 148 | "i dont see demo mode in deployed app" (https://splito-web.onrender.com, auto deploy on main) | Demo mode ships in every build, production included, as lazy chunks; start-up bundle stays demo-free | § 26.1 | Demo mode dev/e2e only (F-227 c4) |
| 149 | "now keep on pushing to github as well"; "use saranshbalyan-1234 account to push" | Push main to origin after every merge as saranshbalyan-1234 (repo-local credential helper); Render auto-deploys main | § 26.1 | No remote; never push |
| 150 | "when i click on tabs immediately it doesnt work, in other apps i keep clicking on tabs within ms it still switches" | Every tab tap switches at once, even milliseconds apart or mid-animation; newest tap wins; nothing debounced or swallowed, every platform | § 26.9 | Taps during a switch could be ignored |
| 151 | "all the taps everywhere should reflect immediately, maybe deffer some renderring" | Every tap shows its result in the same or next frame; slow bodies render after via transitions/deferred mount; tap-to-first-change < 100 ms measured | § 26.9, § 26.10 | Only tap feedback within 100 ms (body could block) |
| 152 | "for example switch tabs first, and render content later, same for popups or diff screen that happen"; "make sure such things are stored in architecture, and it should be self updating whenever we make such decisions" | Shell first, content later for tabs, sheets and screens via one shared helper; every such decision recorded in § 26 + log + BACKLOG in the same turn (§ 0 rule 9, prompt hook) | § 26.9, § 0 | - (spells out 151) |
| 153 | "on home show overview and recent transactions, then create a people tab as well, the group tab is already there, the overview is needed only in home" | Home = Overview + Recent transactions; new People tab (requests, invites row, friends list with search/filters); Groups list without Overview; nav Home, People, Groups, Analytics, Ask, Activity, Settings; default bar Home, People, Groups, Analytics, Activity | § 26.3 | Home held the Overview and friends list; Groups had its own Overview; bar Home, Groups, Analytics, Activity |
| 154 | "also on home show recent active people, and recent active group"; "also request and all" | Home adds Requests (when pending), Recently active people and Recently active groups (5 each, See all); right column not shown on Home at wide | § 26.3 | Home = Overview + Recent transactions only (row 153) |
| 155 | "also on desktop show all the tabs" | Rail and desktop sidebar always list every item in the chosen order, no More; on/off shapes only the phone bar | § 26.3 | Desktop followed the on/off choice with off items under More (127) |
| 156 | "the overview, this looks bad in mobile, in the overview move the red and green to right or think of something else" | Compact overview cards: label and small lines left, large red/green net amount right and vertically centred; ~64-72 px on phones; same layout in the desktop grid | § 26.12 | Tall boxes with the amount under the label |
| 157 | "Owed to you ₹49,243 · You owe ₹450 ↙ ₹48,793.00 ... this looks bad" | Overview card drops the owed/owe breakdown line; left: label + chip + count only; right: big net; breakdown lives in Analytics (card tap) | § 26.12 | Breakdown line on the card (row 156 draft) |
| 158 | "right side we can have green/red with same styles, and left we can have other details" | Overview card: right = green "owed to you" and red "you owe" lines in friend-row style, vertically centred; left = currency chip, net headline, count line | § 26.12 | Net-only right side (157) |
| 159 | "net amount on right" | Overview card right column: net (large, coloured) on top, then small green owed-to-you and red you-owe lines when both directions are open; left: label, chip, count | § 26.12 | Net headline on the left (158) |
| 160 | "in this red/green text on right and other text keep on left" (screenshot of the card) | Card is a two-column table: each line's words left, its red/green amount right (net large on line 1; owed-to-you green and you-owe red small when both open; count line left only) | § 26.12 | Net and lines stacked on the right (159) |
| 161 | mock-up: net large green on the right of line 1; "Owed to you ₹49,243.00" and "You owe ₹450.00" small, white/grey, on the left; "4 friends" | Only the net is coloured and right-aligned; breakdown lines stay left in normal colours | § 26.12 | Breakdown amounts coloured on the right (160) |
| 162 | "add all these to architecture" (the iOS, tap-speed and links review findings) | Lessons recorded in § 23 (sheet presenting, sheet host provider, tab links on native, SQLite sync batching, no dedupe on idempotent nav, deferred-render contract, sideways overflow, renders baseline upkeep) | § 23 | - |
| 163 | "make sure you do it yourself always, whenever you think this should be in app" | Claude records lessons and rules (§ 23 or the section) on its own in the same turn, plus BACKLOG work, commit and push, without being asked | § 0 rule 10 | Recording lessons only when asked |
| 164 | "finish the frontend first, and then start backend" | All front-end batches finish before any backend work; dev account and local data until then | § 26.2 | Backend batch 1 to start after Wave C / in parallel (125 plan) |
| 165 | "once i say i am okay with all forntend changes" | Backend starts only after the owner explicitly signs off on all front-end changes | § 26.2 | Backend after front-end batches finish (164) |
| 166 | "it should not redraw" (on switching back to Home / any tab) | Visited tabs stay mounted and frozen while hidden; switching back shows them as left with zero re-render unless data changed; deferral only on first visit | § 26.9 | Home re-rendered on every switch |
| 167 | "also add pull to refresh, header should stay while pulling down to refresh" | Pull to refresh on every list (native RefreshControl, phone-web pull handler); header fixed and visible during the pull; local re-read now, syncNow() with the backend | § 26.9 | No pull to refresh |
| 168 | "even for the first time, the rendering should happen once the tab is open, or drawer is open or popup is open" | Tabs, drawers and sheets open first with light content; heavy content mounts after the opening finishes (real opened/transition-end signal), first visit included | § 26.9 | Deferral of two frames only (151/152) |
| 169 | "pull to refresh should work, wherever header is shown" | Pull to refresh on every page with a header (lists and detail pages, Settings included), built once in the shared scaffold; not in sheets, popups or the drawer | § 26.9 | List screens only (167) |
| 170 | "not even with header, pull to refresh should work everywhere on all screens" | Pull to refresh on every full screen, header or not, via the shared scaffold with a test over all routes; sheets keep drag-to-close (§ 26.8) | § 26.9 | Screens with a header only (169) |
| 171 | "all filters to be in one line" (Analytics screenshot) | Analytics currency, scope, period and the table switch share one filter line | § 26.16 | Period stepper on its own line |
| 172 | "why there is no animation here"; "empty screen animations should be there always, and related to those screens only, and design/structure should be same" | Every empty state animated, same structure, with original art about its own screen; test fails on an EmptyState without illustration | § 7 | Some empty states icon-only or text-only |
| 173 | "in activity add the filter option to choose the type, like transaction etc, when I click on see all transaction it should land here" | Activity type filter (in URL, remembered); every Recent transactions "See all" opens Activity filtered to transactions | § 7 / § 26.14 | See all opened unfiltered Activity |
| 174 | "and in tab switch, it should switch with sliding animation" | Main tab switches slide (F-257) next in Wave C, interruptible, no redraw | § 26.9 | Slide specified but not built |
| 175 | "on the home, invite should be shown like previously" (screenshot of the compact "2 invites waiting" row) | Home Requests section shows Invites sent as full rows (Resend / Cancel) again, below the Overview, max 5 then See all | § 26.3 | Compact "N invites waiting ›" row (120, 153) |
| 176 | "in overview by default it should select all, but options for group and direct" | Overview scope All (default) / Groups / Direct, remembered, in URL, carried into Analytics | § 26.3 | Overview always counted everything |
| 177 | "instead of manage button in middle, make it as a settings icon on right in friends in home" | Friends header: gear icon on the right (after search and Filters) opens Friends and invites; no Manage text button | § 26.3 | "Manage" text button in the middle of the header |
| 178 | "clicking on avatar or name anywhere on the website, should open that friend details" | One shared PersonLink: any avatar or name opens /people/:id (Me -> Profile), on every screen | § 26.3 | Only friend rows opened a person |
| 179 | "even if you go to main screen from some links, it should show back button, in case you dont go directly from tabs" | A main screen opened from a link (See all, cards, results, notifications, deep links) is a pushed page with Back to the origin; the tab itself gives the plain tab screen | § 26.3 | Links switched tabs with no way back |
| 180 | Assistant ruling after the F-250 review (owner asleep, "take your own decisions"; owners 164/165 review the front end on Render first) | Render builds a "preview" tier: labelled local dev account allowed, `noindex`, never on stage/prod tiers; real production refused until the auth HTTP client exists; intro keeps animated Lottie art | § 26.15 | Render built `production`, which refused the dev account and broke the deploy |
| 181 | "name should be capitalized first letter in complete name" | Every word of a person's name starts with a capital, saved and shown through one `capitalizeName`; rest of each word as typed; groups, titles, emails unchanged | § 26.3 | Names shown exactly as typed |
| 182 | "for trip ask for location as well" | Trip groups get an optional "Where?" text field in New/Edit group; shown with type and dates, searchable, in CSV, in demo trips | § 26.12 | Trips had name and dates only |
| 184 | "there should be some specific set of back for sure, for example if i open appearance in settings, the flow is from settings to appearance" | Every page has a fixed parent; Back with no history goes to it (parents stacked); a main tab opened from a link keeps Back after refresh via `from` in the address | § 26.3 | Assistant ruling: a refreshed pushed copy became the plain tab; parents only for a few routes |
| 185 | "also animate the splash screen icon, so that i see that its loading"; "like zoomin zoomout a little, so i know content is being downloaded" | Launch mark zooms 1 -> 1.08 -> 1 while loading, web from first paint (inline CSS), native via a matching JS launch screen; opacity pulse under reduced motion | § 26.11 | Static splash mark |
| 186 | "when logout, it should remove all data from db" | Log out always erases the account's local DB, demo DB, account prefs, drafts, session and caches; device language/theme stay; prompt warns with the unsynced count first; no keep option | § 26.15 | Prompt offered "Keep this device's data" / "Erase this device's data" |
| 187 | Assistant ruling after the F-1210 review | After one reopen only a group admin accepts or rejects (outside a group the adder or payer still answers and a second reopen is refused); one-tap "Accept and apply" only when the fix keeps the record's split mode (an amount fix on an itemised or exact split and a share fix on anything but an exact split are "Edit it" only, with the reason shown), and the panel states what the edit will change | § 26.20 | Admin-only closing after the first reopen without saying who answers it; one-tap fixes that converted a split to exact amounts |
| 188 | "on desktop there is a lot of space we dont need ... there in sidebar" | Desktop sidebar fits its content (~200 px), footer links directly under Add expense, nothing pinned to the bottom | § 26.5 | Bluesky standard width; footer pinned at the bottom of the window |
| 189 | "did it fix the performace everywhere, not just the taps"; "it should be everywhere" | Every screen and interaction meets the speed budgets, proven by a perf sweep over every route and interaction in WebKit and Chrome 6x on a quiet machine; misses fixed before the wave closes | § 26.10 | Budgets checked on a few flows and on reported problems |
| 190 | "all the + buttons or anything should be there"; "the only diff should be whether back button is visible or not" (a main screen opened from a link) | Pushed copies keep the FAB and every header action; FAB also on Person and Group pages (pre-selecting); hidden only on Settings, Profile, detail, forms, sheets, keyboard, onboarding | § 26.6, § 26.3 | FAB only where the header had no Back; pushed copies had no FAB |
| 191 | "make sure everything we learn from performace captures in architecture"; "that file should be self learning" | Every perf finding becomes a § 17.1 rule plus a § 23 lesson in the same change; `scripts/lessonsGate.ts` in `pnpm check` fails a branch that changes perf specs, the renders baseline or measured numbers without touching § 17/§ 23; briefs, reviews and the prompt hook repeat it | § 0 rule 11, § 17.1 | Lessons recorded when remembered (§ 0 rule 10) |
| 192 | "when click on disputed from anywhere, it loads up activuty with transaction and disputed filter" | Every disputed amount/count link opens Activity (pushed, Back) on All with Type = Expenses, Payments, Disputes, scoped to the group when in one; one helper `seeDisputedPath` | § 26.14 | Disputed links filtered only the page they were on |
| 193 | "when click on txn it shows up activity again, with all txn including txn filter" | Every transactions heading, See all or count opens Activity (pushed, Back) on All with Type = Expenses + Payments, group-scoped in a group; single rows still open the transaction | § 26.14 | Only Home and right-column "See all" did (owner 173) |
| 194 | "this activyty page whould be used like this with filters everywhere" | Activity is the one full list behind every "see all" of past events; links pre-set Type, group and person filters (new `person=`), shown as chips; action lists (requests, invites) keep their pages | § 26.14 | Group/Person pages and others kept their own history lists |
| 195 | "whrever activiyt can be linked do it, also invites can be hanlded like this"; "this way we can handle everything from one place and user wont be confused" | Every link that can lead to Activity does; requests/invites see-all and counts open Activity (Type = Friends and invites) with Accept/Decline and Resend/Cancel in the rows; Friends and invites keeps only its tools | § 26.14 | Requests and invites kept their own list pages (owner 194) |
| 196 | "in group link, it should show anyone can join, or invites only, or add like this, if i add someone they would acept or i can send request" | Group "Who can join": Anyone with the link / Link, I approve each join (default) / Invite only; adding a friend sends a group request they accept (shown "Invited" until then); join requests and group requests handled in Activity | § 26.18 | Group links always required approval; members were added directly |
| 197 | "all these invites should show on their respectivr page not on home page, like group and people" | No requests or invites on Home; People shows friend requests and invites sent, Groups shows group requests, join requests and group invites, a group page its own; 5 rows then See all into Activity | § 26.3 | Home Requests section with invites sent (175) |
| 198 | "move the overview section to analytivcs as well, and then remove home" | No Home tab; the Overview is the first section of Analytics (balances now, own All/Groups/Direct); tabs People, Groups, Analytics, Activity; app opens on People; `/` and old Home addresses redirect; Home fallbacks become the start tab | § 26.3, § 26.16 | Home tab with Overview, requests, recent transactions, recent people and groups (153, 175) |
| 199 | "add sort filter people and group, default sort by last active" | Sort is its own button beside Filters on People and Groups: Last active (default), Name, Amount, Newest; remembered per list and in the URL | § 26.12 | Sort inside the Filters sheet; People defaulted to Amount |
| 200 | "ask splito is not a tab" | Ask Splito is reached only from the header Search & Ask icon and "/" / Cmd+K; never a sidebar, drawer, bottom-bar or Settings > Navigation item; saved `ask` tab migrated away | § 26.19, § 26.3 | "Ask Splito" item in the shared nav list (57, 155) |
| 201 | "on click of avatar, now open profile inside settings" | The header avatar opens Profile at every width; Profile lives at /settings/profile with Back to Settings (old /profile redirects); the phone drawer opens by edge swipe | § 26.4, § 26.7 | Avatar opened the drawer on phone and rail |
| 202 | "move the logout button inside profile" | Log out is the last row of Profile only; removed from Settings, the drawer footer and the sidebar (the add-contact step keeps its own) | § 26.15 | Log out in Settings > Account and the drawer footer |
| 203 | "remove settings from profile" | Profile holds only the person (avatar, name, contact, stats, Log out); its "Settings" row is removed | § 26.15 | Profile had a Settings row |
| 204 | "make support a section, which opens up all these menus" | Settings shows one "Support" row opening /settings/support with Send feedback, Your feedback, Help, Privacy, About and the version | § 26.15 | Support items listed inline in the Settings list |
| 205 | "and same for data, think of a proper name as well" | Settings shows one "Your data" row opening /settings/data with Export, Import, Move older data and Reset all settings | § 26.15 | Data items listed inline under a "Data" heading |
| 206 | "make profile and settings as diff, avatar opens profile and settings as tab is diff" | Profile is its own page at /profile (avatar opens it, Back returns where you were); Settings is a tab (/settings) in the default bar and sidebar | § 26.4, § 26.3 | Profile inside Settings at /settings/profile (201); Settings reached from Profile Back |
| 207 | "add expense should have paid by always, by default to me" | Paid by is always shown on Add expense and always starts as me on a new expense (any entry point); only an Ask prefill naming a payer differs; edits keep the saved payer | § 26.13 | - |
| 208 | "fanout more to get things done" | Run as many builders as there is independent work (no file overlap), each running only its touched specs; full e2e once per merge by the orchestrator; perf numbers only on a quiet machine | § 23 (process lesson) | At most three builders at once |
| 209 | "also update profile page, it looks very less" | Profile becomes a full page: header with verified contacts and since-date, stat row linking out, Your balance, Payment details (UPI), Add me (QR, link), Your recent activity, Log out last | § 26.15 | Avatar, name and a few stats only |
| 210 | "make sure whatever can be reused do it" | Reuse before writing, inside Splito first then Bluesky; duplicates are defects merged into one shared piece; briefs, reviews and reports enforce it | § 26.1 | Reuse rule covered Bluesky only |
| 211 | "for importantn task use opus always like speed, new features decisions, etc etc"; "performance"; "important decisions like, what should bet ehre, what should be the flow"; "sonnet should be used to build only" | Opus makes every decision (what goes where, flows, data model), writes every spec, does all performance work and every review; Sonnet only implements Opus specs and stops on open product questions | § 26.1 | Sonnet implemented everything, Opus only decided and reviewed |
| 212 | "think from users perspective as well, app should be simple to use, nothing complex, make sure of UX"; "code should be simple"; "it should be lightning fast when i click somewhere" | Design from the user's side (one main action, plain words, fewest taps, same pattern everywhere); specs state the flow tap by tap; reviews check as a new user; simplest code; every tap instant | § 26.1 | Simplicity stated for settings only (128, 129) |
| 213 | "make sure to use proper skeletons, proper animations, proper icons, proper empty screen and proper cta"; "loading wheverever required"; "guided tour for required part only"; "dont overdo anything" | Skeletons where content loads, small loaders only for non-content waits, motion only where it explains, consistent Lucide icons, an empty state with art + one sentence + one CTA on every list, one primary CTA per screen; guided tour only for the essentials; nothing decorative | § 26.1, F-253 | - |
| 214 | "for some reason, by desktop full width sidebar looks really bad"; "Feedback · Help · Privacy · About moves to bottom" | The sidebar footer links are pinned to the bottom again; items and Add expense stay a block at the top; width stays 216 px | § 26.5 | Footer links directly under Add expense (188) |
| 215 | "Tab ui issue"; "make the navigation selector white again like it was previously" | Bottom bar, sidebar and drawer icons in the text colour (white in dark), active shown by the filled glyph and bold label; never the accent | § 26.5 | Accent-coloured icons (a regression of the c-anim review fix) |
| 216 | "People tab when selected is not correct"; "Sidebar opens up when swiping"; "Remove profile from settings"; "Swipe doesn't look good to go to last screen" (iPhone screenshots, 2026-10-31) | Selected People glyph is a solid card with the person cut out; no swipe opens the drawer (address only); no Profile row in Settings; Back (Safari's swipe) shows the page at its saved scroll from the first frame, no app gesture at the left edge | § 26.5, § 26.7, § 26.15 | Filled outline (a plain square); edge swipe opened the drawer (201); Settings Account row with Profile |
| 217 | "Also we need to choose a diff icon for activity, it doesn't make any diff if it's selected or not"; "Remove the sidebar in mobile completely, either sidebar or bottom navigation" | Activity is a Lucide Bell, solid when selected; no side drawer anywhere (phone: bottom bar only; wide: sidebar only); Settings and the start tab cannot leave the bar; old `?drawer=menu` opens the page alone | § 26.3, § 26.7, § 26.14 | Activity pulse icon (unchanged when selected); phone drawer opened by its address (216) |
| 218 | "Ask splito icon only on Home Screen" | The Search & Ask (sparkles) header button shows only on the start tab (the screen the app opens on, People by default, following Settings > Navigation "Open on"); no other tab or page draws it; Cmd/Ctrl+K and "/" still work everywhere on web | § 26.3, § 26.4, § 26.19 | Search & Ask in every top-level header (73, 74) |
| 219 | "On the analytics tab, all group and direct filter is at top already, it shows up again in filter"; "overview section to be on people and groups as well, think about it properly" | Analytics' Overview loses its All / Groups / Direct chips and follows the filter row's one scope; People gets an Overview of balances with friends that follows its Include groups filter; Groups gets an Overview of my balances in groups (inactive and hidden counted); cards open Analytics in that currency and scope | § 26.3, § 26.12, § 26.16 | Overview only on Analytics with its own scope chips (176, 198) |
| 220 | "Remove settings from navigation and merge with profile"; "Fanout max" | Settings leaves the bottom bar and the sidebar; Profile (the avatar, `/profile`) holds the person then every Settings row, Log out last; `/settings` opens Profile, sections keep their addresses with Back to Profile; a saved bar loses `settings`; builders fan out as wide as the independent work allows | § 26.3, § 26.4, § 26.7, § 26.15 | Settings as its own tab and nav item, Profile without Settings (203, 206, 217's locked Settings) |
| 221 | "Make sure analytics everything changes according to filters it should not have something which is not affected by these" | Every figure on Analytics follows its period, currency and scope; the balances-right-now Overview leaves Analytics (it stays on People and Groups); old `?overview=` links map to Analytics' scope | § 26.12, § 26.16 | Analytics Overview of balances right now that ignored period and currency (198, 219) |
| 222 | "Add a little padding from bottom on navigation bar" | Phone-web bottom bar pads its bottom by the home-indicator inset or at least 8 px; native unchanged | § 26.3 | No bottom padding on the phone-web bar |
| 223 | Assistant rulings for F-275 (new-user audit, 2026-10-31; owners 212/213 apply) | Add friend with no directory makes a usable local friend (name first, contact optional); one "Report a problem" entry whose first choice is Dispute or Put on hold, "Raised by" only behind "Record this for someone else"; Google and Apple are one muted "come with sync" line, not buttons; the sign-up name is kept | § 26.15, § 26.18, § 26.20 | Request-to-accept sheet with no server to answer; separate Dispute and Put on hold entries with a Raised by picker; dead Google and Apple buttons (138) |
| 224 | "You take all decisions, don't ask me" | Product calls are settled by the assistant and reported as decided (the Tax/tip/discount row, the statement CSV for the Analytics export and decision 223 stand) | § 26.1, § 26.13 | Reports that asked the owner to confirm product calls |
| 225 | "Remove your balance, recent activity from profile" | Profile drops Your balance and Your recent activity; balances stay on People and Groups, your changes in Activity on Me | § 26.15 | Profile's Your balance cards and recent activity list (209) |
| 226 | "Why does analytics has the expense list, for that redirect to activity with other filters" | Analytics drops its expense list and selection chip; "See these expenses" and every chart tap open Activity (pushed, Back) with Type = Expenses plus the period, currency, scope and the tapped bar, category or person as removable filters | § 26.16, § 26.14 | Analytics' own expense list narrowed by chart taps |
| 227 | "stacked screens are not there, like if I click on my avatar to go to profile it should animate and go there and then same for swipe back" | Pushed pages slide in from the right and Back slides the page underneath back, on phone web as natively; Safari's own swipe back is not animated twice; compositor only, reduced motion instant; desktop stays instant | § 26.3 | Pushed pages appeared instantly on web |
| 228 | "think proper about settings and profile screen it doesn't look good as setting has moved to bottom and I have to scroll" | Profile fits one phone screen: compact header row, one stat row, then the Settings rows with Payment details first; Add me leaves Profile (Friends and invites holds the link and QR); Log out last | § 26.15 | Tall Profile header with Payment details and Add me sections above the Settings rows (209, 220) |

New decisions follow § 0 rule 9: rewrite the rule in its topic so only the current truth remains, then add a
row here.
