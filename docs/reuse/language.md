# Reuse record - language dropdown (F-1816, F-112)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide; no Bluesky glyphs or artwork are copied.

Best of both (ARCHITECTURE 26.1): Bluesky's `AppLanguageDropdown` over `Select` won. Expensify App's
equivalent (`src/pages/settings/Preferences/LanguagePage.tsx` at `44387bc7`) is a full Preferences page
with a radio list, which Splito already has as Settings > Language; it has no footer dropdown.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/AppLanguageDropdown.tsx` | `src/components/AppLanguageDropdown.tsx` | Writes the `language` preference instead of Bluesky's language prefs; no feed reset; hidden by the device preference `rightColumn.languageDropdown`; testIDs |
| `src/components/Select/index.tsx` | `src/components/Select/index.tsx` | Re-exports `Sheet.tsx`, so web can reuse Bluesky's sheet at phone width |
| `src/components/Select/Sheet.tsx` | `src/components/Select/index.tsx` | Bluesky's native Select (a Dialog sheet) unchanged except `any` replaced by `SelectedItem` / `unknown` (lint) and an `ItemProps.testID`; items are `role="radio"` with `aria-checked`; the sheet is a `FormSheet` (picker: cross only, a choice applies at once, ARCHITECTURE 26.8) instead of a bare Dialog with a FlatList |
| `src/components/Select/index.web.tsx` | `src/components/Select/index.web.tsx` | Picks Bluesky's Radix dropdown (`Radix.tsx`) on rail and desktop and the sheet under 800 px (ARCHITECTURE 26.8: every phone modal is a bottom sheet) |
| `src/components/Select/Radix.tsx` | `src/components/Select/index.web.tsx` | Bluesky's Radix select unchanged except `any` replaced and an `ItemProps.testID` |
| `src/components/Select/types.ts` | `src/components/Select/types.ts` | `SelectedItem` replaces `any`; `ItemProps.testID` |
| `src/locale/languages.ts` | `src/locale/languages.ts` | Only the languages Splito ships (English, Hindi), named in their own script plus English; one list for the dropdown and Settings |
