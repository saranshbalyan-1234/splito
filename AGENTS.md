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

1. **Avatar sits TOP-LEFT, in Bluesky's hamburger spot, and opens Bluesky's drawer.** Phones and narrow web (< 800): the avatar replaces Bluesky's hamburger/menu button (`Layout.Header.MenuButton`) at the left of the top bar; the Splito logo stays centred as in Bluesky. Desktop/tablet web: the avatar sits at the top-left of the main content header (left of the page title). It opens a side drawer copied from Bluesky `src/view/shell/Drawer.tsx` (MIT, usual header + reuse row) sliding in from the LEFT exactly as Bluesky's does: Bluesky's layout, spacing, rows, header block and footer; scrim tap and swipe (native, Gesture Handler) to close; Bluesky's animation; focus trap + Escape on web. Header: avatar, name, "Saved on this device" / sync status, link to Profile. Items (icon + label): People, Groups, Analytics, Profile, Settings, Notifications; then Dark theme toggle; then Help and About. No avatar anywhere on the right; the dropdown menu is removed. testIDs: `header-avatar` (trigger), `drawer` (panel). (Owner, 2026-10-26: "open the drawer like Bluesky where all menu appears like the hamburger", "move this to left, where hamburger icon was in Bluesky".)
2. **Header system (one rule set for every screen; Bluesky `Layout.Header` components).** LEFT slot: avatar (opens the drawer) on top-level tab pages (People, Groups, Analytics); Bluesky `BackButton` with goBack(fallback) on every pushed page (Person, Group, Settle, Expense, Edit expense, Notifications, Profile, Settings and its sections, Add friend, Create group); "Cancel" text button in the Add expense composer. CENTRE: page name, centred on all platforms (`TitleText`); People shows the Splito cat logo instead of a "People" title (spec: no redundant title); Person/Group show the entity name with a `SubtitleText` (e.g. "Trip · 5 members"); Expense shows its title. RIGHT: at most ONE basic action (Bluesky header icon button, or the Save pill in the composer), optionally followed by a Bluesky "..." overflow Menu, plus the notifications bell at the far right on top-level pages (rule 3): People = Add friend + bell; Groups = Create group + bell; Analytics = Export CSV + bell; Notifications = Mark all read; Person = Settle up + overflow (Edit, Delete); Group = Settle up + overflow (Edit group, Members, Payment rules); Expense = Edit + overflow (Delete); Add expense = Save pill; Settings/Profile/Settle = none. Empty slots keep their width so the title stays centred. Header is sticky with Bluesky's bottom border; on phones it hides on scroll down and returns on scroll up (Bluesky minimal-shell behaviour). On desktop web the same header sits at the top of the main content (the sidebar is separate). Page-level primary actions in the body are not duplicated in the header. (Owner, 2026-10-26: "centre page name, right some basic action, left back or avatar".)
3. **Notifications live in the HEADER, not the nav.** The Activity feed is presented as Notifications, opened from a bell icon button (Bluesky bell glyph via lucide `Bell`, Bluesky unread-badge style; testID `header-notifications`) at the FAR RIGHT of the header on every top-level page (People, Groups, Analytics), on web and phones. The page's own action (Add friend / Create group / Export CSV) sits immediately left of the bell (so top-level headers have at most two icons on the right). Pushed pages show no bell. Tapping the bell pushes the Notifications screen (route `/notifications`; `/activity` redirects): header left Back, centre "Notifications", right "Mark all read"; body copies Bluesky's Notifications screen with tabs "All" and "From others"; everything built for Activity (day grouping, read/unread, row menu, swipe, hide, undo) stays. The unread badge counts unread items from others only. Remove Activity/Notifications from the web sidebar, the phone bottom bar and the drawer's primary list (the drawer may list "Notifications" under the secondary items). Resulting nav: web sidebar = People, Groups, Analytics, Settings + "Add expense" pill; phone bottom bar = People, Groups, Analytics + Bluesky FAB. testIDs: `screen-notifications`. (Owner, 2026-10-26: "If it's notification it should be in header - move it to header actually".)
4. **No extra header icons.** Anything that is not the single page action, its overflow menu or the notifications bell moves into the page body. Analytics: the chart/table view toggle lives in the filter row (next to period / currency / group filters), not in the header; the header is avatar | "Analytics" | Export CSV + bell. Apply the same audit to every screen. (Owner, 2026-10-26: "what's the second icon on header left of avatar".)
