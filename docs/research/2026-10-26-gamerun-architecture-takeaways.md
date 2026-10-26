# GameRun ARCHITECTURE.md: takeaways for Splito (2026-10-26)

Source: `GameRun/gamerun-expo/expo-app/ARCHITECTURE.md` (`GR/` below). Bluesky's ALF and Splito's offline-first rules still win.

## Adopt

1. **The doc is the app's memory, updated in the same PR** (§ Keeping this document current; the closing "This document is kept current"). GameRun lists when a PR has to touch it: architecture change, a new read/write, a new or changed rule, a shared component or platform twin, a telemetry change, or "a lesson the next change needs" (a root cause, a library quirk, a failed approach), each dated with its PR. Format: rule first, then the reason, then where it lives. One rule lives in one place; AGENTS.md holds the summary.
   **Splito rule:** create `docs/ARCHITECTURE.md` with that trigger list. A PR that leaves it out of date is incomplete. Any rule every change must follow also gets a line in AGENTS.md.

2. **Rules a scan can check are enforced by a test with a baseline that only shrinks** (§ Styles, "The rules a scan can check"; `GR/src/architecture/rules.ts`, `baseline.ts`, `architecture.test.ts`). Each rule is one pure counter per file. Old code's count is frozen, and new code must score zero.
   **Splito rule:** add `apps/client/src/architecture/rules.test.ts` (bun) for the rules oxlint can't express: no hex/rgba outside `alf/`, no direct `react-native` `Modal`, no `expo-haptics` import, no new file under `src/view/`, no token read outside the credential store, no `number`-typed money in `packages/domain`.

3. **One codebase on every platform** (§ Modules, "One codebase for every platform"). A platform difference lives behind a `.web`/`.native` adapter pair in shared code, never inline. Feature code may branch on a *capability* (biometrics, OTA), never on a *style*. A split file comes as a full set, so no platform resolves to nothing. Every feature is tested on iOS, Android and web, and the PR says how each one was checked.
   **Splito rule:** add the capability-vs-style and full-set rules to AGENTS.md § Platform-specific code, plus "PR states how each of the three platforms was checked".

4. **Dependency direction** (§ Folder structure: `features → domain → shared`, and `shared` never imports upward).
   **Splito rule:** `screens/` and `features/` import from `data/`, which imports from `@splito/sync`, which imports from `@splito/domain`. `alf/`, `components/` and `lib/` never import `screens/`, `features/` or `data/`. Add it as a counter in item 2.

5. **Shell and navigation** (§ Responsive shell; `GR/src/application/navigation/goRoot.ts`). Every Back control calls `goBack(router, fallback)`, so a page opened from a deep link or a refresh still has somewhere to go back to. The shell renders the header immediately and the body only after the transition finishes (`useAfterTransition`, with `PagePlaceholder` standing in).
   **Splito rule:** one `goBack(navigation, fallbackRoute)` helper in `navigation/`. Person and Group detail pages (which the spec requires to be deep-linkable) use it.

6. **Dialog and form conventions** (§ UI and dialogs; `GR/src/shared/ui/Dialog.tsx`).
   - Never render RN `Modal` directly (a transparent Modal still swallows taps on iOS).
   - A closed dialog renders nothing.
   - Root overlays sit in one stacking order, with toasts above everything.
   - A full-screen flow is a route, not a dialog.
   - A field never rewrites what was typed to fit a limit. It filters only characters the field can never hold, and otherwise says what is wrong.
   **Splito rule:** add all of these to AGENTS.md § Component patterns. The field rule is directly about amount entry.

7. **Theming discipline** (§ Theming). Components use semantic roles only, never palette values, hex literals or a static colour export. If no role fits, the new role goes into both light and dark. Pure functions that build colours (SVG, charts) take the theme colours as a parameter.
   **Splito rule:** apply this to ALF. A missing colour becomes a new ALF theme token in every theme (light, dark, and later black-and-white). Chart builders on `react-native-svg` take `t.palette` as an argument.

8. **Launch splash** (§ Launch splash; `GR/src/shared/layout/LaunchSplash`). A root overlay holds until fonts and the first-screen assets are ready, with an 8 s cap. The long intro plays once per app version (`shared/lib/launchIntro`). Each launch records `app.splash` with `outcome` (art/timeout/font_error).
   **Splito rule:** the splash waits for fonts plus the local store being open and its first query done. Cap it, then show the app anyway.

9. **OTA updates and app version** (§ Over-the-air updates; `GR/src/features/app-version/hooks/useOtaUpdate.ts`, `model/otaUpdate.ts`).
    - Check at launch and on background→active, never on inactive→active (Control Centre and system alerts trigger that).
    - Don't re-fetch an update that is already downloaded and waiting.
    - A stale error already in expo-updates' state is checked again, not reported.
    - "No update" is a signed 200, never a 404.
    - Android times out after 10 s, iOS after 60 s.
    - Native changes (secure store, new modules) move the fingerprint and need a store build.
    - Record `ota.check` and `ota.launch`.
    - The Settings version footer reads the binary version from `expo-application`, never `Constants.expoConfig.version` (an OTA rewrites it), with the update id beside it (`GR/src/features/settings/components/AppVersionSettings.tsx`).
    **Splito rule:** copy these into a Splito `RELEASE.md` once EAS Update is wired.

10. **Links** (§ Links; `GR/src/application/navigation/incomingLink.ts`, `universalLinks.json`). One resolver handles https, the custom scheme and push URLs. An unknown path opens home. Campaign entry points are route files or plainly named query keys, and a one-shot key (`?share=1`) is dropped once it has been used (`useSettledParams`).
    **Splito rule:** `navigation/linking.ts` is the only resolver. Invite, QR and balance links resolve through it. Hosts live in one JSON shared with the app config.

11. **Errors and telemetry** (§ Errors and Sentry; § Telemetry, rules 1-18; `GR/src/shared/telemetry/metrics.ts`).
    - `AppErrorBoundary` at the root.
    - Local/dev runs report nothing.
    - All capture goes through one module that never throws or blocks.
    - Record where something *completes*, never per render, frame or keystroke.
    - Flows record a count with an `outcome` plus a duration.
    - Real failures are issues. Friction (including being offline) is a metric, not an issue.
    - Data screens mark `ready` once.
    - Every Sentry capability has a per-environment switch in env config.
    - ARCHITECTURE.md keeps a table of metrics and issues, updated in the same PR.
    - Drops are measured, never assumed. The web transport keeps a disk queue for offline envelopes.
    **Splito rule:** `src/logger` and `src/analytics` are the only Sentry callers. Add metrics `sync.push`/`sync.pull` (outcome, batch size, ms), `outbox.depth`, and `mutation.save` against the 100 ms p95 budget.

12. **Session token storage** (§ Where the session token lives; `GR/src/shared/lib/credentialStore.native.ts`, `domain/account/model/authStorage.ts`).
    - Only one module reads or writes the token, and it keeps a copy in memory.
    - On native it uses expo-secure-store with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (readable by background sync, kept out of backups).
    - An AsyncStorage marker detects a Keychain entry that survived an uninstall.
    - Store operations run one at a time (`serial`).
    - A storage refusal never blocks sign-in.
    - Sessions end only on the server's 401, never on the device clock.
    **Splito rule:** add `storage/credentialStore(.native).ts` with these rules. A 401 signs out without deleting unsynced outbox rows: hold them for the same account's next sign-in.

13. **Honest figures and batched reads** (§ Payments; "One request for a list, never one per item").
    - A figure that was not read is never shown as 0: show `…` while loading and `—` when it is unknown.
    - A list is one request. A multi-item write is one request.
    **Splito rule:** balances and totals follow the `…`/`—` rule. Sync push/pull stays batched, and no per-row server calls.

## Conflicts (which wins)

- **UI copy via `useCopy()` modules** (§ UI copy) vs Lingui: **Lingui wins**. It is already standard and handles Hindi plurals.
- **`createStyles`/`useStyles` and the GameRun type scale** (§ Theming, § Styles) vs ALF atoms: **ALF wins**. Our UI code is Bluesky's. Keep only the "semantic tokens only" discipline.
- **Expo Router thin `app/` routes** (§ Modules) vs React Navigation 7: **RN7 wins**. It matches Bluesky's navigator and linking.
- **GameRun's own `Dialog`** (modal on web, drawer under 768 px) vs Bluesky `#/components/Dialog`: **Bluesky wins**. Keep GameRun's rules (item 6), not its component.
- **Breakpoints 768/1024 and a 208 px sidebar** vs Bluesky `useBreakpoints()`/`Layout`: **Bluesky wins**. One shell, Bluesky's numbers.
- **Offline notice** (§ Offline notice: a "You're offline" banner, offline inferred from failed requests, failed reads re-run on reconnect): **Splito wins**. Offline is the normal state, not an error, so show the spec's sync status labels instead of a banner. Borrow only "one store, mounted once, no per-screen copies".
- **Web token in `localStorage`** (§ Where the session token lives): **Splito spec wins**. Use an httpOnly cookie with CSRF.
- **Sentry identity is email and name on every event, and replay is unmasked except `ReplayMask`** (Telemetry rules 5, 9): **Splito privacy wins**. Use an opaque account id and install id only. Mask amounts, names and notes in replay, or turn replay off. The app is used before signup.
- **ESLint config** (§ Styles, Lint) vs Oxlint: **Oxlint wins**. Item 2's test covers what Oxlint can't check.
- **Server-first freshness** (re-read on return, poll the server before showing success): **offline-first wins**. Reads come from the local store, and only the "Synced" label waits for the server's acknowledgement.

## Skip

- All sport/report/analysis/coach sections (§ Report gating to § Hockey position evaluations, § Adding a sport).
- CleverTap extension, campaign pushes, CleverTap/Matomo/GA mirroring.
- Stripe checkout, wallets, org pools (§ Payments, § Plans): no payments in Splito.
- Upload progress outside the app (Live Activity/Live Update): revisit only if OCR uploads get long.
- Staff "log in as user" sessions, backend-choice pill, Sentry overrides UI, camera/live capture, motion glyphs (we use Reanimated), Sprint/PR history.
