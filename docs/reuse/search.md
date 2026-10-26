# Reuse record - search stream (F-1401)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied. Merge these rows into `docs/REUSE_MAP.md`.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/screens/Search/index.tsx` | `src/screens/Search/Shell.tsx` | Header (Back, centred "Search" per owner header rules) then the search box, recent searches while empty, results below. Local: results update on every keystroke from a prebuilt index instead of Bluesky's submit-and-fetch; the query reaches the URL (`/search?q=`) on submit as upstream. No autocomplete dropdown, advanced-search dialog, language admonition, share button or soft reset. Web: arrow keys move through results, Enter opens, Escape clears |
| `src/screens/Search/components/SearchHistory.tsx` | `src/screens/Search/components/SearchHistory.tsx` | Term rows, remove button, "Clear all" behind `Prompt.Basic` kept; the recent-profiles strip and filter-count chips dropped. Adds "Try searching for" example queries where Bluesky shows Explore, and Bluesky's signed-out search line when there is no history |
| `src/screens/Search/components/ResultRows.tsx` | `src/screens/Search/components/ModuleHeader.tsx` (section heading), `src/screens/Search/components/SearchProfileCard.tsx` (row press/hover), `src/screens/Search/SearchResults.tsx` (`EmptyState` / "No results found for ...") | Section headings carry a count and, for expenses, one total per currency. Rows: expense (category tile, title, payer and group, matched note or item, total and date), person, group. Query matches are drawn bold in the accent (Bluesky has no highlight) |
| `src/components/icons/MagnifyingGlass.tsx` (`MagnifyingGlass_Filled_Stroke2_Corner0_Rounded`) | Bluesky's export name only | Lucide `Search` at stroke 3 for the lit nav item; Bluesky's glyph is not copied |

Written for Splito (no Bluesky equivalent): `packages/sync/src/search.ts` (local index: sorted vocabulary
with word-prefix lookup, per-currency sorted totals for amount queries, date maps for day/month words,
highlight ranges), `packages/domain` `sumByCurrency`, `src/screens/Search/model.ts`,
`useSearchIndex.ts`, `scrollRowIntoView(.web).ts`.

Edited shared files: `navigation/Navigation.tsx` (route), `navigation/Drawer.tsx` (row),
`view/shell/desktop/LeftNav.tsx` (nav item), `routes.ts`, `lib/routes/types.ts`, `lib/routes/section.ts`,
`storage/schema.ts` (`searchHistory`), `components/settings/prefControls.tsx` + `icons.ts`
(`rememberSearches` row), `data/demoData.ts` + `data/demo.ts` (notes on three demo expenses),
`e2e/shell.spec.ts` (nav lists).
