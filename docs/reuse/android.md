# Reuse record - android stream

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Paths are relative to `apps/client/`.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/view/shell/index.tsx` (`Shell`: `SystemBars`, root background) | `src/view/shell/index.tsx` (`Shell`), `src/alf/util/systemUI.ts` (`setSystemUITheme`) | `setSystemUITheme('theme', t)` inlined as one effect; its rejection is caught on the promise (upstream's try/catch never sees it) |
| `src/view/shell/index.tsx` (`BottomSheetProvider`, `BottomSheetOutlet`) | `src/App.tsx` (`BottomSheetProvider`), `src/view/shell/index.tsx` (`BottomSheetOutlet`) | The provider sits in the native shell, not `App.tsx`, because Splito's `App.tsx` also serves web |
| `app.config.ts` (`react-native-edge-to-edge` plugin) | `app.config.js` | Same options (`enforceNavigationBarContrast: false`) |
| `package.json` (`react-native-edge-to-edge@1.8.1`) | `package.json` / `pnpm-lock.yaml` | Same version as upstream's lockfile |
| `scripts/android-smoke.ts` | `__e2e__/setupApp.yml`, `__e2e__/flows/*.yml` (Maestro) | Written for Splito: the same launch-clear-state-then-tap-by-testID steps over `adb` + `uiautomator` (Android SDK), because Maestro is not installed here |
