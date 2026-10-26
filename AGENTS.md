# AGENTS.md - Splito Development Guide

Splito is an offline-first expense splitting app for iOS, Android and web/PWA.
The client is built on code adapted from Bluesky `social-app` (MIT, pinned at
`4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465`), and these standards are taken from
Bluesky's `AGENTS.md` and Expensify App's `contributingGuides/STYLE.md` and
`PERFORMANCE.md` (MIT). Where the two disagree, Bluesky wins for client code,
because our UI code is Bluesky's.

Design spec: `docs/superpowers/specs/2026-10-26-splito-design.md`.
Upstream reuse record: `docs/REUSE_MAP.md`.

## Tech Stack

- Expo 58, React Native 0.88, React 19.3, React Native Web
- React Navigation 7, Reanimated 4 + Worklets, Gesture Handler 3
- Lingui 5 for i18n, ALF design system (from Bluesky)
- React Compiler enabled
- Packages (`packages/*`) are pure TypeScript, tested with `bun test`
- API (M2): Fastify on Bun, PostgreSQL

## Commands

```bash
pnpm install                       # root; pnpm 11.28.5, Node 24 (auto-downloaded)
pnpm test                          # all package tests (bun)
pnpm typecheck
pnpm --filter @splito/client web   # Expo web dev server
pnpm --filter @splito/client ios   # dev client build (needs Xcode)
pnpm --filter @splito/client e2e   # Playwright against the web build
```

## Project Structure

```
apps/client/src/
  alf/          Design system from Bluesky - themes, atoms, tokens
  components/   Shared UI components (Button, Dialog, Menu, TextField ...)
  screens/      One directory or file per route
  features/     Macro-features spanning screens (e.g. settlement, capture)
  data/         Store wiring and hooks over @splito/sync
  navigation/   Navigator, linking, shell
  lib/          Utilities (haptics, logger, merge-refs ...)
  locale/       i18n
packages/
  domain/       Money, splits, ledger, settlement, FX - pure, no UI, no IO
  sync/         Local store, outbox, mutations, preferences
```

- Money rules live only in `packages/domain`. Screens never do arithmetic on money.
- Every write goes through a mutation in `packages/sync` (one transaction: entity + history + outbox).
- Do not write new files under `src/view/`; it only holds Bluesky's `List`/`Views` utilities.
- Co-locate: `screens/Group/index.tsx` + `screens/Group/components/`. A component that fits in one file stays `Component.tsx`.
- Files: PascalCase components, camelCase directories and other files.

## Money and data rules (Splito-specific, non-negotiable)

- Money is `bigint` minor units; stored and sent as decimal strings. Never `number`, never floats.
- Every financial record carries its currency. Never sum unlike currencies.
- Use `parseAmount` / `formatAmount` / `computeShares` / `validateExpense` from `@splito/domain`.
- Dates are `YYYY-MM-DD` local dates plus an IANA `tz`.
- Deletes are tombstones. Never hard-delete financial history.
- Never show "Synced" before the server acknowledges.
- Any new user-facing choice gets an entry in the preferences registry (`packages/sync/src/preferences.ts`).

## Styling (ALF, from Bluesky)

`import {atoms as a, useTheme} from '#/alf'`. Static atoms are `a.*`, theme atoms
come from `useTheme()`. Order: flexbox, spacing, text, theme atoms, raw styles.
Platform helpers `web()`, `native()`, `platform()`. Breakpoints via `useBreakpoints()`.

## Component patterns (Bluesky)

- Function declarations for components; destructure props in the parameter list.
- Inline prop types for components, with defaults for optional props.
- Fragment shorthand unless a `key` is needed.
- Reuse `#/components/*` (Button, Dialog, Menu, TextField, Toast, Typography) before writing new UI.
- Interactive elements get a `label`; testable elements get a `testID`.
- **Dialog footgun:** run post-close work inside `control.close(() => ...)`.
- React Compiler is on: don't add `useMemo`/`useCallback` without a specific reason.
- Haptics: `useHaptics()` from `#/lib/haptics`, call by intent (`tap`, `confirm`, `success`). Never import `expo-haptics` directly.

## Naming (Expensify)

- Booleans start with `is` or `should` (`isSettled`, `shouldShowRemaining`).
- Prop callbacks are named for what happened: `onExpenseSaved`, not `onSave`.
- Internal handlers are named for what they do (`saveExpense`), not `handleX`.
- Types are PascalCase with no `Type` suffix; unions are singular.
- Library modules use `function name()` declarations.
- Prefer `unknown` over `any`; no `@ts-ignore` (use `@ts-expect-error` with a reason).
- Use `satisfies` to check literal config objects.

## i18n

All user-facing strings go through Lingui (`useLingui` from `@lingui/react/macro`,
alias `t` to `l`; `<Trans>` for JSX). Dates via `i18n.date`. Amounts via
`formatAmount`. Debug-only strings stay plain.

## Platform-specific code

Use file suffixes (`.web.tsx`, `.native.tsx`, `.ios.tsx`, `.android.tsx`), prefer a
directory with `index.tsx` / `index.web.tsx`. Never conditional `require()`.
`react-native-gesture-handler` must not be imported on web (Metro enforces this).
Runtime checks: `IS_WEB`, `IS_NATIVE`, `IS_IOS`, `IS_ANDROID` from `#/env`.

## Imports

Always use `#/` for absolute client imports and `@splito/*` for packages.

## Performance (Expensify process + Bluesky setup)

- Bluesky build setup is kept: React Compiler, lazy imports, inline requires,
  upstream patches in `patches/` for react-native, metro, reanimated, screens, svg.
- Lists use Bluesky's `List` (`#/view/com/util/List`); never render unbounded `.map()` lists.
- Animations run on the UI thread (Reanimated worklets); no JS-driven animation loops.
- Store reads are local and incremental; no full-ledger refetch per render.
- Before claiming a speed-up: record a baseline and an after measurement with the
  same flow (Chrome Performance on web; React Native DevTools/Hermes profiler or
  Flashlight on Android; React DevTools Profiler for re-renders). Put numbers in
  `docs/COMPLETION_MATRIX.md`.
- Budgets: p95 local save under 100 ms; no input-blocking long task during entry.

## Comments

Explain why, not what. Docblocks (`/** */`) on exported declarations. Multi-line
comments use `/* */`. ASCII only in comments. `ponytail:` comments mark deliberate
simplifications with their ceiling.

## Formatting and lint

Prettier config from Bluesky (`prettier.config.ts`: no semicolons, single quotes,
no bracket spacing, trailing commas). Oxlint.

## Attribution

Every file copied or adapted from upstream starts with
`// Adapted from <repo>@<sha> (MIT) - <upstream path>` and gets a row in
`docs/REUSE_MAP.md`. Never copy Bluesky's licensed icon glyphs, illustrations,
logos or `assets/images/`.

## Latest owner UI decisions (binding; newest wins; apply even if your task text says otherwise)

1. **Avatar sits TOP-LEFT, in Bluesky's hamburger spot, and opens Bluesky's drawer.** Phones and narrow web (< 800): the avatar replaces Bluesky's hamburger/menu button (`Layout.Header.MenuButton`) at the left of the top bar; the Splito logo stays centred as in Bluesky. Desktop/tablet web: the avatar sits at the top-left of the main content header (left of the page title). It opens a side drawer copied from Bluesky `src/view/shell/Drawer.tsx` (MIT, usual header + reuse row) sliding in from the LEFT exactly as Bluesky's does: Bluesky's layout, spacing, rows, header block and footer; scrim tap and swipe (native, Gesture Handler) to close; Bluesky's animation; focus trap + Escape on web. Header: avatar, name, "Saved on this device" / sync status, link to Profile. Items (icon + label): People, Groups, Analytics, Activity, Profile, Settings; then Dark theme toggle; then Help and About. No avatar anywhere on the right; the dropdown menu is removed. testIDs: `header-avatar` (trigger), `drawer` (panel). (Owner, 2026-10-26: "open the drawer like Bluesky where all menu appears like the hamburger", "move this to left, where hamburger icon was in Bluesky".)
2. **Header system (one rule set for every screen; Bluesky `Layout.Header` components).** LEFT slot: avatar (opens the drawer) on top-level tab pages (People, Groups, Analytics, Activity); Bluesky `BackButton` with goBack(fallback) on every pushed page (Person, Group, Settle, Expense, Edit expense, Profile, Settings and its sections, Add friend, Create group); "Cancel" text button in the Add expense composer. CENTRE: page name, centred on all platforms (`TitleText`); People shows the Splito cat logo instead of a "People" title (spec: no redundant title); Person/Group show the entity name with a `SubtitleText` (e.g. "Trip · 5 members"); Expense shows its title. RIGHT: at most ONE basic action (Bluesky header icon button, or the Save pill in the composer), optionally followed by a Bluesky "..." overflow Menu, (no bell; rule 3): People = Add friend; Groups = Create group; Analytics = Export CSV; Activity = Mark all read; Person = Settle up + overflow (Edit, Delete); Group = Settle up + overflow (Edit group, Members, Payment rules); Expense = Edit + overflow (Delete); Add expense = Save pill; Settings/Profile/Settle = none. Empty slots keep their width so the title stays centred. Header is sticky with Bluesky's bottom border; on phones it hides on scroll down and returns on scroll up (Bluesky minimal-shell behaviour). On desktop web the same header sits at the top of the main content (the sidebar is separate). Page-level primary actions in the body are not duplicated in the header. (Owner, 2026-10-26: "centre page name, right some basic action, left back or avatar".)
3. **Activity is a bottom/sidebar destination again (supersedes the header bell).** The feed is called "Activity" (route `/activity`; `/notifications` redirects), icon = lucide `Activity` (pulse) - not a bell - with Bluesky's unread badge on the nav item (bottom bar and sidebar; badge counts unread items from others). Phone bottom bar = People, Groups, Analytics, Activity + Bluesky FAB; web sidebar = People, Groups, Analytics, Activity, Settings + "Add expense" pill; drawer lists Activity in its primary items. NO notifications bell in any header. Activity screen header: left avatar, centre "Activity", right "Mark all read"; body keeps Bluesky's notification-list structure with tabs "All" / "From others", day sections, actor avatar, your effect (lent/borrowed), read/unread tint, row menu, swipe, hide, undo. testIDs: `tab-activity`, `screen-activity`. (Owner, 2026-10-26: "make notification as activity and move to bottom".)
4. **No extra header icons.** Anything that is not the single page action or its overflow menu moves into the page body. Analytics: the chart/table view toggle lives in the filter row (next to period / currency / group filters), not in the header; the header is avatar | "Analytics" | Export CSV. Apply the same audit to every screen. (Owner, 2026-10-26: "what's the second icon on header left of avatar".)
5. **Itemized expenses, complete.** An expense is either a single amount or a bill of items (the Itemize split). Each item: name, amount, and who had it; tapping a person's chip again increases their portions (x2, x3, long-press/right-click to reset) so one item can be shared unequally (e.g. 2 of 3 beers); an "Everyone" shortcut per item; items can be reordered and deleted; tax, tip, service charge and discount are entered once and follow each person's item subtotal; a live "remaining to assign" readout and Save disabled until everything is assigned. Domain: extend `SplitInput` items so participants may carry integer weights (`participants: Array<string | {id: string; weight: number}>`, plain strings = weight 1), allocated exactly with `allocate` (bigint, stable tie-break) - add bun tests (conservation, 2-of-3 portions, tax pro-rata with weights). Expense detail lists every item with its people/portions and each person's resulting share. (Owner, 2026-10-26: "an expense can be one expense or multiple, like dinner $100 divided into dishes, and each item assigned to people in the split".)
6. **Notifications rows: who did it + what it means for you.** Keep Bluesky's notification row layout from the preview shell, but the avatar shows the ACTOR (the person who added/edited/deleted), never the participants; merge in the richer Activity content from the activity feature stream: day section headers (Today / Yesterday / weekday / date), the amount and your effect ("you lent EUR 9" in positive colour / "you borrowed INR 450" in negative colour), group name, read/unread tint, row menu (mark read, hide, delete expense) and swipe actions. (Found in preview review, 2026-10-26.)
7. **Every form sheet / dialog uses one layout (shared `FormSheet` component built on Bluesky's `#/components/Dialog`).** Applies to Add expense (from the FAB / sidebar pill), Edit expense, Add friend, Create group, Edit group, Members, Payment rules, Record payment, filters, settings editors (accent, categories, timezone, ...), Reset prompts excepted (those stay Bluesky `Prompt`). PHONES = Bluesky bottom sheet: top bar with the title on the LEFT and a circular close button with an X glyph at the TOP RIGHT (lucide `X`, 30-32px circle `t.atoms.bg_contrast_50`, label "Close", testID `sheet-close`) - no "Cancel" text in the top bar; footer pinned at the BOTTOM above the keyboard (react-native-keyboard-controller sticky footer, as Bluesky's composer) and safe area with TWO buttons side by side filling the width: "Cancel" (secondary, testID `sheet-cancel`) on the left, primary action ("Save" / "Save expense" / "Add friend" / "Create group", testID `sheet-save`) on the right, disabled until valid; any live readout (e.g. "remaining to assign") sits just above the footer. WEB = centred modal popup (Bluesky web Dialog, scrim, max width ~600, focus trap, Escape closes): X close button at the TOP RIGHT, footer buttons right-aligned at the BOTTOM RIGHT: Cancel then Save. Pure pickers (currency, date, category, people chooser) show only the X (selection applies immediately), no footer. Closing via X / Cancel / scrim / swipe with unsaved changes asks via Bluesky Prompt ("Discard changes?"). This overrides rule 2's "Cancel / Save pill" for composers. (Owner, 2026-10-26: "all the drawers to have cross button like this and cancel and save button at bottom; drawers become modal/popup on web with a cross button on top right and save and cancel on bottom right".)
8. **Balances in Groups, Filters in Friends.** (a) Groups list: a "Balances" summary at the top identical in style to People's (one card per currency: "You are owed" / "You owe" totals across all groups, never summing currencies, link to Analytics), and each group row shows your balance in that group per currency. (b) Group page: Bluesky tab bar with "Expenses" / "Balances" / "Members"; Balances shows each member's net per currency (groupNet) plus a "who owes whom" list (pairwise, from the settlement plan in direct mode) and a "Settle up" button. (c) People/Friends list: a "Filters" button in the "Friends N" section header row (body, not the header - rule 4) opening a FormSheet (rule 7) with: "Include groups" switch (default from includeGroupsDefault pref, on), currency (All / each currency present), show (All / Owes you / You owe / Settled), sort (Amount / Name / Recent, default from peopleSort pref); Cancel + Apply at the bottom; changes apply only on Apply; the button shows a dot/count when non-default filters are active; filters drive both the summary cards and the list; Person page history obeys the same Include groups choice (spec). testIDs: `friends-filters`, `groups-balances`, `group-tab-balances`. (Owner, 2026-10-26: "add balances option in group as well, and filters option in friends, also add option for include group there".)
9. **Overview + search + filters on both Friends and Groups.** Both list screens (People/Friends and Groups) start with an "Overview" section (replaces the "Balances" heading): per-currency cards "You are owed" / "You owe" (never summing currencies) with a small line of counts ("6 friends - 2 settled" / "3 groups - 1 settled"), and an "Analytics >" link. Below it, the list section header row ("Friends 6" / "Groups 3") has two icon buttons on its RIGHT: search (lucide `Search`, testID `list-search`) and Filters (testID `list-filters`, rule 7 FormSheet, with the active-filter dot). Search is ICON ONLY until tapped; tapping expands it (Reanimated width/opacity animation, reduced-motion aware) into a full-width Bluesky search input (`#/components/forms/SearchInput` pattern from Bluesky) in that same row with autofocus and an X to collapse and clear; results filter live as you type (friends by name; groups by group name or member name), with a Bluesky empty state "No matches for '...'". Groups filters: type (Trip / Home / Couple / Other), status (Active / Archived), currency, show (All / You are owed / You owe / Settled), sort (Recent activity / Name / Amount). Friends filters: rule 8(c). Filters and search combine. (Owner, 2026-10-26: "add overview in both friends and groups, with search and filters as well, search icon only, expands once I click".)
10. **Speed and animation on every change (always).** No feature is done unless it is fast and animated like Bluesky:
    - Speed budgets (measure and record in the PR/report): cold start to interactive People list < 1.5 s on a mid-range phone (web: LCP < 1.5 s on a cached load); any tap gives visual feedback within 100 ms; local save p95 < 100 ms; screen transitions at 60 fps (120 on ProMotion) with no dropped frames on lists of 1,000 rows; no JS long task > 50 ms during typing, scrolling or animation; no full-ledger recompute per render (memoized selectors / incremental projections); lists virtualized with Bluesky `List`; images/Lottie lazy-loaded; bundle growth justified.
    - Animation on every surface, UI-thread only (Reanimated worklets, no JS-driven loops): native stack push/pop and swipe-back; sheets/dialogs with Bluesky spring; list rows enter/exit/reorder (LinearTransition / FadeInDown); press feedback (PressableScale) on every tappable row/card/button; tab switches; expanding search; filter dot; AnimatedAmount whenever a money total changes; skeleton shimmer while loading; Lottie empty states; success check + haptic on save/settle; drawer open/close with scrim. Every animation honours reduced motion and the `motion` preference (full / reduced / off).
    - Verify with a profiler (Chrome Performance on web; React Native DevTools / Hermes profiler on the simulator) for any change touching lists, navigation or totals, and include the numbers in the report. (Owner, 2026-10-26: "consider speed and animations always".)
11. **Bluesky first - copy, don't write.** Before writing ANY code (component, hook, screen, layout, list, dialog/sheet, menu, tabs/pager, search input, settings row, toggle, avatar, badge, toast, animation, gesture, haptics, keyboard handling, navigation, storage, i18n, error boundary, test helper, e2e pattern, build config), search the Bluesky clone at /Users/saransh/Desktop/Splito-Handoff/upstream/social-app (src/, modules/, __e2e__/, jest/, config files) for the equivalent and COPY it (header `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <path>` + row in docs/reuse/<stream>.md), changing only what is required (routes, data, logo, licensed icon glyphs -> lucide, copy, removing social-only code). Write new code only when Bluesky has no equivalent (e.g. money/split/settlement logic, which lives in packages/domain) - and then follow the nearest Bluesky pattern for structure, naming, styling and tests. Every report must include a "Bluesky search" section listing what was searched, which upstream files were copied, and anything written from scratch with the reason. Reviewers fail work that re-implements something Bluesky already has. (Owner, 2026-10-26: "always take code from Bluesky because it has the best code, don't write code on your own; whatever you want to build, check in Bluesky".)
12. **In-page tabs use Bluesky's Pager - never a static segmented control - and look exactly like the Activity screen's All / From others tabs (one shared component; underline style, sliding indicator, swipe between pages).** Every set of tabs inside a screen (Group: Expenses / Balances / Members / Rules; Activity: All / From others; Analytics period or view tabs if tabbed; Person tabs if any; Settings sub-tabs if any) is built by copying Bluesky's `src/view/com/pager/` (Pager on react-native-pager-view for native swipe between pages, the TabBar with the animated sliding underline indicator, scroll-to-selected, haptic selection tick, PagerWithHeader for collapsing headers where a screen has a header block above the tabs) - exactly as Bluesky's Profile, Home feeds and Notifications use them; web uses Bluesky's web pager behaviour. Main bottom-bar / sidebar tab switches ARE animated (owner override of Bluesky's instant switch): it must feel like the Activity tabs' pager: native = React Navigation bottom-tabs custom `sceneStyleInterpolator` + `transitionSpec` giving a DIRECTION-AWARE horizontal slide (new screen comes from the right when moving to a tab on the right, from the left otherwise; ~220 ms, native driver), web = the same direction-aware slide (transform, ~200 ms) of the content area; a sliding indicator (small bar under the active bottom-bar icon / beside the active sidebar item) springs to the new tab exactly like the Activity TabBar underline; no swipe gesture between main tabs (it would conflict with the drawer edge-swipe and row swipe actions); the tapped tab icon does a small spring scale pop (Reanimated, UI thread) while its filled/stroke state cross-fades, plus Bluesky haptic tap; unread badge springs in on count change; re-tap scrolls to top (Bluesky). All of it is disabled under reduced motion / motion pref 'off' (animation 'none') and must not delay input (tab content usable immediately; lazy tabs pre-mounted after first visit). (Owner, 2026-10-26: "need animations while switching bottom navigation".) Remove any segmented-control tab implementation. (Owner, 2026-10-26: "there is no animation when switching tabs, but it's there in Bluesky - why".)
13. **Desktop left sidebar = Bluesky's LeftNav, complete and polished.** Copy `src/view/shell/desktop/LeftNav.tsx` pieces verbatim where possible: (a) TOP: Splito cat logo (40px) vertically aligned with the content header row (same top padding/height as `Layout.Header`), then Bluesky's `ProfileCard` (48px avatar, "Me", "Saved on this device" / sync status, chevron) which opens the account drawer/menu - on desktop/tablet this REPLACES the avatar in the content header's left slot (rule 1 avatar-top-left applies to phones and narrow web); (b) Bluesky `NavItem` exactly (24px icon, `text_xl`, active = bold + filled icon, rounded_full hover background, Bluesky badge/dot) for People, Groups, Analytics, Activity, Settings; (c) Bluesky `ComposeBtn` as "Add expense" (large pill, plus icon, full width of the nav column); (d) below it a "Recent groups" section (up to 5 groups by last activity: small square group avatar, name, your balance chip in positive/negative colour, "See all" link) styled like Bluesky's secondary nav lists; (e) BOTTOM, pinned: muted footer "Help - About - Privacy" links (Bluesky RightNav footer style). Widths/paddings from Bluesky constants (LEFT_NAV_STANDARD_WIDTH, LEFT_NAV_MINIMAL_WIDTH); hairline right border; sticky full height; scrolls independently if tall. Minimal rail (800-1000px): Bluesky minimal mode (avatar, icons, round compose button). The sliding active indicator from rule 12 lives here too. Judges must score the sidebar explicitly. (Owner, 2026-10-26: "you need to improve left sidebar, it doesn't look good".)
14. **Dark mode defaults to Bluesky "Dim".** When the app is dark (theme pref `dark`, or `system` with the OS in dark mode), the default dark palette is ALF `dim`, not pure-black `dark`. Add/keep a `darkTheme` preference (`dim` default | `dark`) under Appearance ("Dark mode style: Dim / Black"), exactly like Bluesky's dark-theme setting; `useThemePrefs()` returns it and `useColorModeTheme` uses it. Logo rule still applies (white cat on dark surfaces). Screenshots and judges use Dim for "dark". (Owner, 2026-10-26: "by default keep the dim mode in dark".)
15. **Desktop logo shows the wordmark.** On desktop/tablet web (sidebar visible, width >= 800) the logo at the top of the sidebar is the cat mark followed by the name "Splito" (bold, Bluesky heading weight/size matched to the 40px mark, vertically centred, same colour rule: blue+white or black+white per theme). In the minimal icon rail (800-1000px) and on phones (centred header logo), show the cat mark only. Component: `Logo` gets a `withWordmark` prop; the sidebar uses it. (Owner, 2026-10-26: "in desktop, when you show logo add the name as well" - supersedes "logo is the mark alone" for desktop.)
16. **Itemize adjustments: amount OR percentage.** Tax, tip, service charge and discount stay visible by default (owner: "it should be there"), and each has a currency/% toggle (segmented "INR | %", remembered per kind in prefs `itemizeAdjustmentModes`, defaults: tax %, tip %, service %, discount amount). Percent inputs accept up to 2 decimals (e.g. 18, 12.5) and are stored as integer basis points; order of application: discount on the items subtotal first, then service charge and tax on the discounted subtotal, then tip on the discounted subtotal (pre-tax) - documented in the UI help text. Conversion to money happens ONLY in packages/domain (new pure function, bigint, round half away from zero to the currency's minor unit, bun tests incl. JPY scale 0 and BHD scale 3, 18% GST on INR, 12.5% service, 15% discount), then the existing pro-rata spread by each person's item subtotal (rule 5 weights) applies; the "remaining to assign" readout and the expense total stay exact. Expense detail shows "Tax 18% - INR 216.00" style lines. (Owner, 2026-10-26: "but add the percentage option as well".)
17. **Add expense = bottom sheet; FAB on every top-level screen.** (a) On phones (native and phone-width web) tapping the FAB (or any "Add expense" button) opens Add expense as the rule-7 FormSheet bottom sheet sliding up from the bottom (Bluesky bottom-sheet module, drag handle, swipe-down to dismiss with the dirty-check prompt, keyboard-aware, snaps to full height when the form needs it) - NOT a full-screen pushed/formSheet modal. Desktop/tablet web keeps the rule-7 centred popup opened from the sidebar pill. Edit expense uses the same sheet. (b) The Bluesky FAB is shown on EVERY screen whose header has no Back button - i.e. all top-level screens reachable from the bottom bar/sidebar/drawer (People, Groups, Analytics, Activity; plus Profile/Settings root if they render without Back) - and hidden on every pushed screen that shows Back (Person, Group, Settle, Expense, settings sections, etc.) and while a sheet is open. Implement once in the shell from the header's left-slot state (no per-screen flags); it keeps Bluesky's hide-on-scroll-down/show-on-scroll-up behaviour and the bottom content inset (rule 9 polish). Context: on a Group's top-level? no - Group is pushed (has Back), so no FAB there; its "Add expense" lives in the group header/body and pre-selects the group. (Owner, 2026-10-26: "when I click on add expense it should open a sheet from bottom, and FAB to show everywhere on the screens from nav bar - basically if back button is not there show it".)
18. **Every sheet and popup animates.** Phones: bottom sheets slide up with Bluesky's bottom-sheet spring (native module), scrim fades in, drag handle follows the finger, swipe-down dismiss tracks the gesture and springs closed or back; snapping between heights animates; keyboard appearance animates the footer (react-native-keyboard-controller). Web: popup fades + scales from 0.96 to 1 (~180 ms, Bluesky web Dialog), scrim fades, closing reverses. Pickers inside sheets push/slide; content height changes animate (LinearTransition). Success state on Save: check animation + haptic before the sheet closes. Reduced motion / motion pref "off": instant open/close with fade only. No sheet may appear or disappear without motion. EVERY bottom sheet (form sheets, pickers, filters, drawer-style menus) closes when dragged down past ~30% of its height or flicked down (velocity threshold), from the drag handle or the top bar, and from the content when it is scrolled to the top; if the form has unsaved changes the drag springs back and shows the "Discard changes?" prompt instead of losing data. e2e/Maestro-style check for drag-to-close where the runner supports gestures; unit-test the threshold logic. (Owner: "and should be closable if I drag it down".) (Owner, 2026-10-26: "all the sheets should have animation".)
19. **Sign in and Log out in Settings (UI now, real auth with the backend).** Settings gets an "Account" section at the top (copy Bluesky's Settings account section + its Login/Signup screens' layout, src/screens/Login, src/screens/Settings). Signed out: row "Sign in" with subtitle "Back up and share with friends" -> pushes the sign-in flow: choose method (Continue with Apple, Continue with Google, Email, Phone) -> email/phone entry -> 6-digit code screen; every field validated; on submit it shows an honest Bluesky Admonition "Sign-in arrives with sync. Your data stays safe on this device." - NO fake success, no fake account. Signed in (only once the backend exists): account row (avatar, name, email/phone, "Synced"/"Saving..." status), "Log out" (destructive row) -> Bluesky Prompt: "Log out?" with warning if the outbox has unsynced changes ("N changes haven't synced yet") and a choice "Keep this device's data" / "Erase this device's data"; logout never deletes unsynced outbox rows silently (architecture rule). Also in the drawer footer and the desktop ProfileCard menu: "Sign in" / "Log out". Auth state comes from one `useSession()` (Bluesky pattern, src/state/session) returning signed-out until the auth backend (BACKLOG F-2101..F-2105) lands. (Owner, 2026-10-26: "add sign in option, and logout as well in settings".)
20. **Logo is always blue.** The Splito cat mark is Bluesky-blue (`#006AFF` / ALF primary_500) with white eyes/nose on EVERY theme and surface - light, Dim, Black, sidebar, header, splash, favicon. The black-and-white variants are retired from the UI (app-icon tiles may still use a white cat on a blue tile). The Bluesky butterfly SVG the owner offered (~/Downloads/logo.svg, Bluesky's trademarked mark) is NOT used. (Owner, 2026-10-26: "keep it blue always".)
