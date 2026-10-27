# Reuse: Deleted items in place (F-1203) and Call it even (F-1113)

Upstream: bluesky-social/social-app@4e4ad9c (MIT). Expensify App (MIT) was searched for money entry; nothing
was copied beyond the existing composer patterns already in use. The Recently deleted screen is gone (owner 103).

| Splito file | Upstream source | What was copied | What changed |
|---|---|---|---|
| `src/features/hidden/HideItem.tsx` (`HideMenu`) | `src/screens/Messages/ConversationSettings/MemberMenu.tsx` (row with a "..." menu as a sibling of the row link) | Ghost round "..." trigger + `Menu.Outer` with one item | Item is Hide / Unhide on a deleted row; the preference is personal (`lists.hiddenItems`, `groups.hidden`) |
| `src/features/hidden/ShowHidden.tsx` | Splito `screens/Person/components/HistoryFilterDialog.tsx` (itself a `FormSheet` + `Toggle.Item`) | Filter sheet with an Apply footer and a switch | One "Show hidden" switch shared by People, Groups, a group's Expenses and a person's history |
| `src/features/settlement/CallItEvenDialog.tsx` | Splito `components/people/RecordPaymentDialog.tsx` (itself on Bluesky `Dialog` + `TextField` + `SegmentedControl`) | Whole form: sentence card with avatars, currency switch, amount field with suffix, note, success check, toast with Undo | Write-off semantics (`writeOffParts`, `createWriteOffs`), over-balance error, "Clears:" line |
| `src/screens/Group/components/GroupRows.tsx` (`OweRow` menu) | `src/components/Menu` usage in Bluesky rows (e.g. `src/screens/Messages/components/ChatListItem.tsx` overflow) | Ghost round "..." trigger + `Menu.Outer` with one item | Item is "Call it even" |

Written from scratch (no Bluesky equivalent): `packages/domain` write-off kind and `writeOffParts`;
`packages/sync` `createWriteOffs`, `deleteWriteOff`, `restoreWriteOff`, `restorePerson`, `setItemHidden`, the
`lists.hiddenItems` and `lists.showHidden` preferences, the tombstone party rows and search terms (schema v4);
`data/hiddenItems.ts`.
