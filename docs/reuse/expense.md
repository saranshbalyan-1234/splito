# Reuse record - expense stream

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every copied file starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/forms/SegmentedControl.tsx` | `src/components/forms/SegmentedControl.tsx` | `scrollable` prop: items keep their natural width and the row scrolls sideways (six split modes on a phone); `#/` import for Button |
| `src/components/forms/SearchInput.tsx` | `src/components/forms/SearchInput.tsx` | Focus-search hotkey removed (no global search event in Splito) |
| `src/components/icons/MagnifyingGlass.tsx` | (export name of `src/components/icons/MagnifyingGlass.tsx`) | Lucide `Search` glyph under Bluesky's export name; no Bluesky glyph copied |
| `src/components/Composer/TopBar.tsx` (shell file, edited) | `src/view/com/composer/Composer.tsx (ComposerTopBar)` | Optional `saveLabel` / `cancelHint` so Edit expense, Add friend and New group reuse the bar |

Patterns followed without copying a file (written for Splito, shaped on upstream):

| Splito file | Upstream pattern |
|---|---|
| `src/components/split/ExpenseComposer.tsx` | `src/view/com/composer/Composer.tsx`: avatar-beside-text layout (category tile in the avatar slot), footer counter (split readout), "Save draft? / Keep editing / Discard" prompt copy and actions |
| `src/components/split/pickers.tsx`, `PeopleDialog.tsx` | `src/components/dialogs/LanguageSelectDialog.tsx`: title, search, Toggle rows with bottom rules, Done button |
| `src/screens/Expense/index.tsx` | Post thread header menu (`...` with Edit/Delete) and Toast with Undo action (`src/screens/Profile/components/GermButton.tsx`) |
