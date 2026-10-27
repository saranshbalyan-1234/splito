# Reuse: local database schema v2 (F-117)

Upstream searched: bluesky-social/social-app@4e4ad9c (MIT) at `/Users/saransh/Desktop/Splito-Handoff/upstream/social-app`
(`src/`, `modules/`): `indexedDB`, `expo-sqlite`, `idb`, pending and optimistic row states, persisted-state migrations.
Expensify App (MIT) is not in the local upstream folder; its `OfflineWithFeedback` / `pendingAction` idea (a row carries
its own offline state and is drawn from it) is the model for the per-row sync marker, written new here.

Bluesky has no local relational database: its state is react-query caches plus MMKV-persisted JSON
(`src/state/persisted/`, with a zod schema and a version-by-version migrate step), so there is no store, index or
projection code to copy. What was taken is the pattern, not code:

| Splito | Pattern from | Notes |
|---|---|---|
| `packages/sync/src/migrate.ts`, `sqlStore.ts` / `idbStore.ts` open | `src/state/persisted/index.ts` (version stamp, ordered migrate on load) | A stamped schema version and ordered, idempotent steps; written new for relational rows (`PRAGMA user_version`, `onupgradeneeded`) |
| `apps/client/src/data/projections.ts` (`Controls.reload`, `MORE`) | `src/state/queries/` infinite queries (`fetchNextPage`) | A pager asks its projection for the next page |
| `apps/client/src/features/searchAsk/SearchAskBody.tsx` results (`onEndReached`, `onEndReachedThreshold`, a `Show more` button as the list footer) | `src/screens/Hashtag.tsx` (`onEndReached` + `ListFooterComponent`) | The pattern, not the code: the first page of a search shows at once, the next is read by cursor at the end of the list or on tap; Bluesky's footer is a spinner, here it is a button (and "Calculating totals…" in the heading while the rest is counted) |
| `apps/client/src/screens/Person`, `Group`, `Activity` `onEndReached` | `src/view/com/util/List` `onEndReached` + feed paging | Rows already loaded appear a page at a time; past the last, the next page is read by cursor |

Written from scratch (no Bluesky equivalent): everything in `packages/sync` for the schema (`schema.ts`, `core.ts`,
`ledgerProjection.ts`, `txRows.ts`, `engine.ts`), the balance sums (`recordEffects` and `balanceRowsFromNets` in
`packages/domain`), `data/historyMerge.ts`, `data/ledgerQueries.ts`, `components/SyncStatus.tsx`, `lib/sync/rowStatus.ts`.
No Bluesky icon glyphs, illustrations or assets were copied (the marker is a plain dot).
