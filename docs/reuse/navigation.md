# Reuse record - navigation and Search & Ask drawer (F-222, F-223)

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied.

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/NavFooterLinks.tsx` | `src/view/shell/desktop/RightNav.tsx` (footer links), `src/components/Link.tsx` (`InlineLinkText` hover/focus underline) | One component shared by the desktop/rail sidebar and the phone drawer: Feedback opens the Send feedback sheet (F-226); Help, Privacy, About open their Settings pages |
| `src/features/searchAsk/SearchAskBody.tsx` | `src/screens/Search/Shell.tsx` | The search shell moved from a page into a Dialog body (`Dialog.InnerFlatList`): one autofocused `SearchInput`, Cancel beside it on phones, recent searches while empty, grouped live results from the local index, arrow keys and Enter on web, a "Cmd K" hint on desktop. No autocomplete dropdown, advanced search, language admonition |
| `src/components/SearchAsk/SearchHistory.tsx` | `src/screens/Search/components/SearchHistory.tsx` | As in the former Search page row (docs/reuse/search.md); moved with the drawer |
| `src/components/SearchAsk/ResultRows.tsx` | `src/screens/Search/components/ModuleHeader.tsx`, `SearchProfileCard.tsx`, `SearchResults.tsx` | As in docs/reuse/search.md; moved with the drawer |
| `src/components/SearchAsk/useSearchAskHotkey.web.ts` | `src/components/Lightbox/Lightbox.web.tsx` | Window `keydown` listener: Cmd/Ctrl+K toggles the drawer, "/" opens it outside text fields |
| `src/components/SyncStatusDot.tsx` | `src/view/com/util/UserAvatar.tsx` (the alert badge pinned bottom-right on an avatar) | The sync-status dot (F-223): Bluesky's bottom-right badge geometry, scaled to the avatar, with a ring in the background colour; green / yellow / red from `lib/syncState.ts`, a pop between states (instant under reduced motion), the state as the avatar's accessibility label and a web hover tooltip |
| `src/components/settings/NavigationEditor.tsx` | `src/screens/SavedFeeds.tsx` (`PinnedFeedItem`, move up/down) | Bluesky's pinned list for the phone bottom bar: every shared nav item with a toggle and a drag handle, 2 to 5 tabs, Home fixed, arrows on wide web / screen readers |

Written for Splito (no Bluesky equivalent): `src/lib/routes/navigationItems.ts` (the one nav list), `src/lib/syncState.ts` and `useSyncDot.ts` (the dot's rule),
`src/components/SearchAsk/context.ts`, `hotkeyAction.ts`, `useSearchAskHotkey.ts`, `SearchAskButton.tsx`,
`src/features/searchAsk/SearchAskProvider.tsx`, `src/components/icons/Sparkles.tsx` (Lucide `Sparkles` through
`createIcon`).

Edited shared files: `navigation/Drawer.tsx`, `view/shell/desktop/LeftNav.tsx`, `view/shell/bottom-bar/*`,
`view/shell/index(.web).tsx`, `screens/{People,Groups,Analytics,Activity}`, `screens/Search/index.tsx` (now a
redirect), `components/TabGlyph.tsx`, `components/ListToolsHeader.tsx`, `components/settings/*`,
`packages/sync/src/preferences.ts` (`tabs` takes the shared items, group `navigation`).

Minimal shell (owner 81, ARCHITECTURE 26.4): `src/state/shell/minimal-mode.tsx` and
`src/lib/hooks/useMinimalShellTransform.ts` (Bluesky's, extended with a `scrollMode` shared value so the bottom bar and
FAB follow the header; `useShowShell` resets it), `src/components/Layout/MainScrollProvider.tsx` (writes `scrollMode`
beside the header mode; the forced-scroll flag now expires, otherwise it swallowed the first real scroll).
