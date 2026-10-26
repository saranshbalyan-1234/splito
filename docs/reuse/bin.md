# Reuse: Recently deleted bin (F-1203) and Call it even (F-1113)

Upstream: bluesky-social/social-app@4e4ad9c (MIT). Expensify App (MIT) was searched for money entry; nothing
was copied beyond the existing composer patterns already in use.

| Splito file | Upstream source | What was copied | What changed |
|---|---|---|---|
| `apps/client/src/screens/RecentlyDeleted/index.tsx` | `src/screens/Settings/AppPasswords.tsx` | Screen frame (Layout header with Back), tip `Admonition` at the top, item list with fade in/out and layout transitions, delete confirmation via `Prompt.Basic` with a negative CTA, `EmptyState` with a glyph | Rows are Splito history rows (category tile, title, byline, struck amount, days left) in Bluesky `List`; restore sheet instead of inline delete; Lucide icons |
| `apps/client/src/screens/RecentlyDeleted/components/RestoreDialog.tsx` | Splito `FormSheet` (Bluesky `Dialog`) and `components/people/PaymentDetailsDialog.tsx` | Sheet layout, details table, negative-subtle destructive button | Restore as the footer primary; "Delete forever" hands over to the prompt after close |
| `apps/client/src/components/people/CallItEvenDialog.tsx` | Splito `components/people/RecordPaymentDialog.tsx` (itself on Bluesky `Dialog` + `TextField` + `SegmentedControl`) | Whole form: sentence card with avatars, currency switch, amount field with suffix, note, success check, toast with Undo | Write-off semantics (`writeOffParts`, `createWriteOffs`), over-balance error, "Clears:" line |
| `apps/client/src/screens/Group/components/GroupRows.tsx` (`OweRow` menu) | `src/components/Menu` usage in Bluesky rows (e.g. `src/screens/Messages/components/ChatListItem.tsx` overflow) | Ghost round "..." trigger + `Menu.Outer` with one item | Item is "Call it even" |
| `apps/client/src/navigation/Drawer.tsx` (one row) | already Bluesky `Drawer.tsx` `MenuItem` | Row API unchanged | New "Recently deleted" row |

Written from scratch (no Bluesky equivalent): `packages/domain` write-off kind and `writeOffParts`;
`packages/sync` `createWriteOffs`, `deleteWriteOff`, `restoreWriteOff`, `purgeDeleted`, `loadBin`, the
`history.binDays` preference; `screens/RecentlyDeleted/useBin.ts` and `describe.ts`.
