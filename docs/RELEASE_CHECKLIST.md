# Release checklist

Blocking items that must be closed before any public release (public web deploy, TestFlight/App Store, Play Store).

- [ ] **Replace the logo.** The current mark (`assets-owner/logo-owner-provided.svg`) is Bluesky's butterfly trademark, used at the owner's request for development only. Bluesky's ASSETS.md excludes its marks from the MIT licence and app stores reject look-alike apps. Replace it with an original mark in the single logo source file/component and regenerate the brand kit (`apps/client/scripts/brand.ts`).
- [ ] Remove dev-only switches from release builds (Demo mode, EXPO_PUBLIC_TOUR) - verify they are inert in production.
- [ ] Real authentication and sync live (no "arrives with sync" placeholders shipped as features). Set `EXPO_PUBLIC_AUTH_API_URL` (https) for every release build, in `render.yaml`'s web build command and the `stage`/`prod` EAS profiles: `auth-config.js` refuses to build without it (F-250). Replace the `unavailable` AuthClient with the HTTP client; Google and Apple sign-in (the buttons say "arrives with sync" today).
- [ ] After the real auth API exists: re-enable the update-toast e2e (`e2e-pwa/pwa.spec.ts`, skipped because a production build has no dev sign-in), and show the update toast signed out too.
- [ ] Set `EXPO_PUBLIC_FEEDBACK_EMAIL` (`FEEDBACK_EMAIL` in `#/env`; support address for "Send by email" feedback; it defaults to `feedback@splito.app`, which must be a real mailbox before release) and the backend feedback endpoint.

## Deep links (F-254; hosts and paths live in `apps/client/link-hosts.json`)

- [ ] Backend/domain: host `/.well-known/apple-app-site-association` (applinks for the app id, `paths` = the `appPaths` of `link-hosts.json`, nothing for auth callbacks or downloads) and `/.well-known/assetlinks.json` (package `app.splito`, the release signing SHA-256) on **each tier's host only** (`dev.splito.app`, `stage.splito.app`, `splito.app`). Each build claims only its own tier's host (`EXPO_PUBLIC_TIER`, default `prod`; `app.config.ts`, checked by `src/lib/links/appConfig.test.ts`). The web deploy keeps dot-paths.
- [ ] Build with the `eas.json` profile of the tier (`dev`, `stage`, `prod`): each sets `EXPO_PUBLIC_TIER`, which picks the claimed host and the host in the links the app makes (invites, copy link). An unknown value fails the build. `appPaths` claims `/` (Home alone, exact on Android) and `/notifications`; keep downloads and auth callbacks out of the AASA `paths` and `assetlinks`.
- [ ] Deferred link after install (`src/lib/links/deferred.ts` is a stub): needs the backend claim endpoint; no third-party SDK.
- [x] Signed-out resume (`src/lib/links/intent.ts`) is on with F-250 (`isSignInRequired`); run the cold-start links of the simulator list below signed out as well (native not run).

### Simulator and emulator checks (run by hand on a dev build, cold and warm)

A link opens the exact screen, sheet or picker. Replace the ids with ones on the device (Settings > Data > Demo mode seeds sample data in a dev build). Cold = the app was killed first; warm = it is running.

```sh
# iOS simulator (Universal Link host needs the AASA; the custom scheme works without it)
xcrun simctl terminate booted app.splito                       # cold
xcrun simctl openurl booted "splito://people/PERSON_ID/record-payment"
xcrun simctl openurl booted "https://dev.splito.app/groups/GROUP_ID/balances"
xcrun simctl openurl booted "splito://expense/new/currency"
xcrun simctl openurl booted "splito://settings/regional/timezone"
xcrun simctl openurl booted "splito://search?q=dinner&mode=ask"
xcrun simctl openurl booted "splito://activity/others?drawer=menu"

# Android emulator (App Links verify against assetlinks.json; the custom scheme works without it)
adb shell am force-stop app.splito                             # cold
adb shell am start -W -a android.intent.action.VIEW -d "splito://people/PERSON_ID/record-payment" app.splito
adb shell am start -W -a android.intent.action.VIEW -d "https://dev.splito.app/groups/GROUP_ID/balances" app.splito
adb shell pm get-app-links app.splito                          # verification state per host
```

On a phone a sheet is native dialog state, not a stack route: the link opens the page, then the sheet over it (`src/navigation/sheets.ts`, `queueSheets`). Expected: the page shows with the sheet or picker on top and the draft intact; dismissing the sheet leaves the page; an unknown path opens Home. Not run in the task that built this (the iOS simulator was in use).
