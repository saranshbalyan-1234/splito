# Reuse record - PWA stream (F-1901)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Paths are relative to `apps/client/`. Icons are Lucide (ISC); no Bluesky glyphs, illustrations, logos or
`assets/images` are copied.

**Bluesky search (2026-10-27):** `grep -ri "serviceWorker|workbox|beforeinstallprompt"` over `src/`, `bskyweb/`
and `public/` finds no service worker, no install prompt and no PWA update flow (social-app ships none), and
Expensify App is not available at `upstream/App` in this checkout. The worker, the post-step and the install
state are therefore written from scratch, following the standard Workbox precache pattern (versioned precache,
cache-first shell, stale-while-revalidate runtime cache, update waits for the page). Everything on screen reuses
Bluesky's components below.

| Splito file | Upstream pattern | Splito changes |
|---|---|---|
| `web/sw.js`, `scripts/pwa.ts` | none (Workbox pattern, written here) | Hand-written, no dependency; `classify()` is the one routing decision and is unit-tested |
| `src/lib/pwa/state.ts` | `src/state/shell/drawer-open.tsx` (module store read with `useSyncExternalStore`) | Install / update / standalone state |
| `src/lib/pwa/workAtStake.ts` | none | Counter of FormSheets with unsaved input (ARCHITECTURE 15) |
| `src/features/pwa/PwaHost.tsx` | `src/components/Toast/index.tsx` (`Toast.Action` with Undo, as `screens/Expense`) and `src/components/Prompt.tsx` | "New version available" toast with Reload, one-time install hint, discard-changes prompt |
| `src/features/pwa/InstallHelpDialog.tsx` | `FormSheet` (picker form) | Add to Home Screen steps; Lucide `Share`, `SquarePlus`, `Check` |
| `src/screens/Settings/components/InstallAppItem.tsx` | `src/screens/Settings/components/SettingsList.tsx` `PressableItem` | Row shown only when installable |
