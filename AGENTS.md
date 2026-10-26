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
# Android (JDK 17 + SDK + emulator setup: docs/ANDROID.md), from apps/client:
EXPO_PUBLIC_DEMO=1 CI=1 npx expo run:android --port 8226 --device emulator-5584   # build, install, run
ANDROID_SERIAL=emulator-5584 METRO_PORT=8226 pnpm android:smoke <outDir>        # add expense + settle up
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

## Latest owner UI decisions (binding; newest wins)

1. **The account avatar sits at the TOP RIGHT and opens Bluesky's account Menu** (owner, 2026-10-26: "We should move profile icon to top right"; this supersedes the earlier top-left avatar + drawer). It is the last right-hand item of every top-level header (People, Groups, Analytics) on every platform: top-right of the main content header on desktop/tablet web, top-right of the Bluesky top bar on phones (the logo or title stays centred). It is Bluesky's 32px avatar (`HeaderAvatar`, testID `header-avatar`) and opens a Bluesky `Menu` - a dropdown on web, a bottom sheet on native - with Profile, Settings, Analytics and the theme switch (`header-menu-profile|settings|analytics|theme`). There is no drawer, no account block at the bottom of the sidebar, no Profile row in the sidebar and no Profile tab in the bottom bar; `/profile` is reached from the menu.
2. **Header system (Bluesky `Layout.Header`).** LEFT: empty slots on top-level pages (as wide as the right side, so the title stays centred); `BackButton` on every pushed page; "Cancel" in the Add expense composer. CENTRE: the page name (`TitleText`), the Splito logo on People, the entity name plus `SubtitleText` on Person/Group. RIGHT: at most one page action (People = Add friend, Groups = Create group, Analytics = Export CSV, Notifications = Mark all read, Person/Group = Settle up or overflow, Expense = Edit + overflow, Add expense = Save pill), then on top-level pages the notifications bell, then the avatar. On phones the top-level header hides on scroll down and returns on scroll up (`HidingHeader`, Bluesky's minimal-shell behaviour).
3. **Notifications live in the header bell** (`header-notifications`, immediately left of the avatar on top-level pages) and open `/notifications` (`/activity` redirects). Sidebar = People, Groups, Analytics, Settings + "Add expense" pill; phone bottom bar = People, Groups, Analytics + Bluesky FAB.
4. **No extra header icons.** Anything that is not the page action, its overflow menu, the bell or the avatar lives in the page body (e.g. Analytics' chart/table toggle in its filter row).
