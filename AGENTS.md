# AGENTS.md - Splito Development Guide

> **Binding architecture and product/UI rules live in `docs/ARCHITECTURE.md` - read it before any change; it
> wins over this file.** Owner decisions are in its § 26 "Product & UI rules (owner decisions, binding)".

Splito is an offline-first expense splitting app for iOS, Android and web/PWA.
The client is built on code adapted from Bluesky `social-app` (MIT, pinned at
`4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465`), and these standards are taken from
Bluesky's `AGENTS.md` and Expensify App's `contributingGuides/STYLE.md` and
`PERFORMANCE.md` (MIT). Where the two disagree, Bluesky wins for client code,
because our UI code is Bluesky's.

This file is the coding-standards guide. Architecture and owner rules: `docs/ARCHITECTURE.md`.
Design spec: `docs/superpowers/specs/2026-10-26-splito-design.md`.
Upstream reuse record: `docs/reuse/<stream>.md` (one file per work stream).

## Owner decisions are recorded in the same turn

Any owner decision (product, UI, UX, behaviour, branding, stack or process, including corrections like "it
should be there") is written into `docs/ARCHITECTURE.md` § 26 in the same turn: rewrite the rule in its topic
so only the current truth remains, add a decision-log row, and commit it with the change (ARCHITECTURE § 0
rule 9). Never add owner rules to this file. A `UserPromptSubmit` hook in `.claude/settings.json` repeats this
reminder on every prompt.

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
pnpm lint                          # oxlint, errors only; oxlint-suppressions.json only shrinks
pnpm check                         # lint + typecheck + package tests + client tests (incl. architecture rules)
pnpm --filter @splito/client web   # Expo web dev server
pnpm --filter @splito/client ios   # dev client build (needs Xcode)
# Android (JDK 17 + SDK + emulator setup: docs/ANDROID.md), from apps/client:
CI=1 npx expo run:android --port 8226 --device emulator-5584   # build, install, run
ANDROID_SERIAL=emulator-5584 METRO_PORT=8226 pnpm android:smoke <outDir>        # add expense + settle up
pnpm --filter @splito/client e2e   # Playwright against the web build
pnpm --filter @splito/client renders   # wasted-render gate: Metro dev server + why-did-you-render, fails above e2e-renders/baseline.json (~1.5 min)
pnpm --filter @splito/client e2e:pwa   # production build + service worker (offline, update); ~2 min build
pnpm --filter @splito/client build-web # production web build with sw.js (e2e:build has none)
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
- Budgets and animation requirements: `docs/ARCHITECTURE.md` § 26.10 (owner rules)
  and § 17 (engineering rules).

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
`docs/reuse/<stream>.md`. Search Bluesky before writing anything (ARCHITECTURE § 26.1). Never copy Bluesky's licensed icon glyphs, illustrations,
logos or `assets/images/`.

## Latest owner UI decisions (binding; newest wins; apply even if your task text says otherwise)

Moved. The owner's UI and product rules (formerly numbered 1-24 here) are consolidated, with superseded rules
resolved, in `docs/ARCHITECTURE.md` § 26 "Product & UI rules (owner decisions, binding)"; history is in its
decision log (§ 26.23). Read that section before any UI change.
