# Reuse record - demo mode (F-228a)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every adapted file starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC); no Bluesky glyphs or assets are copied.

## Bluesky search (what was looked for, what was reused)

Searched `social-app@4e4ad9c` for: a "debug mode" / "dev mode" banner or switch, an account-level
"preview" mode, separate local databases per account, and an inline status banner above the header.
Bluesky has none of a second database (its per-account data is MMKV scopes and the server), no demo mode and
no mode banner. What it does have, and what is reused unchanged in role:

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/DemoBanner.tsx` | `src/components/Admonition.tsx` (`Outer`, `Row`, `Icon`, `Content`, `Text`, `Button`) | The banner is an Admonition of type `tip`: icon, "Demo mode ·" text and a small secondary "Switch back" button. Bluesky uses Admonition for in-page notices (language, labels); here it is the one persistent banner |
| `src/screens/Settings/DemoMode.tsx` | `src/screens/Settings/components/SettingsList.tsx` (`Item`, `PressableItem`, `ItemIcon`, `ItemText`), `src/components/forms/Toggle.tsx` | A Settings > Data row with a switch (Bluesky's settings checkbox row) and, while on, a "Reset demo" pressable row with a `Prompt.Basic` confirm |
| `src/components/Layout/Header/index.tsx` (edited) | `src/components/Layout/Header/index.tsx` | The banner sits inside `Header.Sticky`, above the header row, so it never covers a header and slides away with it on phones, as Bluesky's minimal-shell header does |
| `src/storage/index.ts` (edited) | `src/storage/index.ts` | `Storage` gains an optional key scope prefix (`setStorageScope`), so demo mode keeps its own search history, read marks and drafts; the MMKV classes are otherwise unchanged |

Written for Splito (no Bluesky equivalent): `src/data/demoMode.ts` (opens the demo database, e2e hook),
`src/data/demoSeed.ts` (the `demo.mode` row in the real database, seeding in one transaction, wipe),
`src/data/StoreProvider.tsx` (the store swap without a remount), `src/state/demo.ts`,
`src/data/friends.ts` (the directory that answers follows the mode), `e2e/openDemo.ts`,
`packages/sync/src/demoLarge.ts` (the curated story folded into the generator).

Edited shared files: `components/SyncStatusDot.tsx`, `lib/syncState.ts`, `lib/useSyncDot.ts` (the "Demo" dot),
`screens/Settings/index.tsx`, `architecture/rules.ts` (`demoStaticImport`), `storage/schema.ts` (the old
`demoMode` / `demoPending` device keys removed), `lib/openExternal.ts` and its call sites (e2e builds record
external links instead of handing them to the operating system).

## Removed

`?demo=1`, `?demo=large`, `EXPO_PUBLIC_DEMO`, `EXPO_PUBLIC_DEMO_AUTO`, `demoPending`, "Add demo data" and "Remove
demo data", `data/demo.ts`, `data/demoData.ts`, `data/demoLarge.ts`.

## For the other branches (e2e)

Every spec that opened `/?demo=1` now calls `openDemo(page, path?)` from `e2e/openDemo.ts`, which waits for
`window.__splitoTest.demoMode`, runs `demoMode(true)` and then loads `path`. Specs must not rely on the six
curated friends (Riya, Arjun, Priya, Sam, Lena, Diego) being on screen without scrolling: the dataset has 36
friends and 15 groups and lists are virtualised.
