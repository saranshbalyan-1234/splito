# Reuse record - settings stream

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied. Merge these rows into `docs/REUSE_MAP.md`.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/screens/Settings/index.tsx` | `src/screens/Settings/Settings.tsx` | One row per preferences-registry group, About, and a confirmed "Reset all settings"; account, moderation, sign-out and developer rows removed (no accounts before sync) |
| `src/screens/Settings/SettingsSection.tsx` | `src/screens/Settings/AppearanceSettings.tsx` (screen frame) | One route renders every group page from the registry; About and an honest not-found page |
| `src/components/settings/PrefSection.tsx` | `src/screens/Settings/AppearanceSettings.tsx` (`AppearanceToggleButtonGroup`) | Title row without the portal trick, plus a Reset action (Bluesky's settings `BadgeButton` style) when the value is not the default |
| `src/components/settings/controls.tsx` | `src/screens/Settings/ThreadPreferences.tsx` (radio and checkbox groups) | Generic over registry keys; select trigger styled as Bluesky's native `Select.Trigger` |
| `src/components/settings/OptionDialog.tsx` | `src/components/dialogs/LanguageSelectDialog.tsx` | Single choice (radios) that applies and closes; recents and error boundary removed |
| `src/components/settings/TabsEditor.tsx` | `src/screens/SavedFeeds.tsx` (`PinnedFeedItem`, move up/down) | Tabs instead of feeds; arrows on web and for screen readers, drag elsewhere; visibility checkbox |
| `src/components/settings/AboutSettings.tsx` | `src/screens/Settings/AboutSettings.tsx` | Version, local-data note and licences; OTA and support links removed |
| `src/components/forms/SegmentedControl.tsx` | `src/components/forms/SegmentedControl.tsx` | `aria-checked` / `aria-selected` added, because React Native Web drops `accessibilityState.selected` |
| `src/components/forms/SearchInput.tsx` | `src/components/forms/SearchInput.tsx` | Global search hotkey removed (`#/state/events` does not exist here) |
| `src/components/DraggableList/index.tsx` | `src/components/DraggableList/index.tsx` | - |
| `src/components/DraggableList/index.web.tsx` | `src/components/DraggableList/index.web.tsx` | - |

## Patterns and values (no code copied)

| Source | Where it is used | What was taken |
|---|---|---|
| `src/style.css` (`input:focus { outline: 0 }`) | `public/index.html` | Inputs draw their own focus ring |
| `@bsky.app/alf` `createThemes`, `DEFAULT_PALETTE` primary ramp | `src/alf/swatches.ts` | Accent palettes keep Bluesky's ramp lightness ratios around the chosen colour |
| `src/alf/util/colorGeneration.ts` (`lighten`, `hexToRgb`, `contrastRatio`) | `src/alf/swatches.ts`, `src/components/settings/AccentPicker.tsx` | Used in place |
