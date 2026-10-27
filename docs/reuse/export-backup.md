# Reuse record - export, backup/restore and Friends and invites hub (F-2001, F-2007, F-621)

Upstream: `bluesky-social/social-app@4e4ad9c` (MIT) and `Expensify/App@44387bc7` (MIT).
Paths are relative to `apps/client/`. Icons are Lucide through `createIcon`; no artwork, icon or logo is copied.

## Bluesky search (what was searched, copied, written from scratch)

- Searched `src/screens/Settings/components/ExportCarDialog.tsx`, `SettingsList.tsx`, `src/screens/Messages/components/IncomingRequestListItem.tsx`.
- Copied/adapted: the Settings list layout and rows (`SettingsList`, already in Splito) for the new Export, Import and Friends and invites rows; the request row (`RequestRow`, from the JoinRequests row) for friend, requested and removed rows.
- Bluesky's CAR export is a server download of a repo; Splito has no server, so the export is built on the device (from scratch, below).

## Expensify search (best of both)

| Expensify | Used for | Winner and why |
|---|---|---|
| `src/libs/ExportOnyxState/` | A JSON dump of local state with sensitive keys removed | Splito's backup keeps everything the person wrote, versioned and checksummed, because it must restore (Expensify's is a support dump only) |
| `src/libs/actions/ImportOnyxState.ts`, `src/components/ImportOnyxState/` | Pick a JSON file, validate, then apply | Same flow: pick, validate, preview, apply. Splito adds merge or replace and one-transaction rollback |
| `src/components/ReportPDFDownloadModal.tsx` | PDF of a report from a modal | Same idea (a modal that offers a PDF); Splito renders HTML to PDF on the device (expo-print) or the browser's Save as PDF |
| `src/libs/fileDownload/` | Per-platform file saving | Same split: `saveFile.ts` (cache file + share sheet) and `saveFile.web.ts` (download) |

## Adapted files

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/screens/FriendsAndInvites/index.tsx` | `src/screens/Settings/Settings.tsx` (settings page frame and rows) | One scrolling list of sections; rows are Splito's request rows |

## Written from scratch (no Bluesky equivalent)

- `packages/sync/src/backup.ts`: the versioned backup, validation, migration chain, preview, merge/replace.
- `packages/domain/src/statement.ts`: statements with a running balance per currency (money stays in the domain).
- `src/lib/export/*`: CSV and print-ready HTML, `saveFile`, `printHtml`, `pickFile` (web and native files).
- `src/data/exportLedger.ts`: the paged ledger read an export needs.
- `src/features/export/*`: the Export sheet and Import sheet. `src/features/friends/RemoveFriendDialog.tsx`.
- `packages/sync/src/friends.ts`: `removeFriend`, `restoreFriend`, `friendOpenBalances`.
