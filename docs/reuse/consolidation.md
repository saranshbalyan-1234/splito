# Splito reuse audit (F-274, owner 210, ARCHITECTURE § 26.1)

Read-only audit of `/Users/saransh/Desktop/Splito-Handoff/splito`, branch `main`, 2026-10-31. Client line numbers
are at `8995803`. Test line numbers are at `defb14f`: main moved during the audit when c-paidby merged
`e2e/composer.ts` and fix/integration added `e2e/pinClock.ts`. Re-check a line range before editing it.

Paths are relative to `apps/client/src` unless they start with `packages/` or `e2e`. F-274 acceptance 1 wants
this file at `docs/reuse/consolidation.md`; copy it there when committing.

Each finding gives, in order:
- **Files**: each copy, with line ranges.
- **Dup**: what the copies duplicate, and how they differ.
- **Shared**: the proposed shared piece.
- **Risk**: what could break when merging.
- **E**: effort (S, M or L).
- **Overlap**: which running builder touches the same files.

"Disagree" means the copies already show the user different things or behave differently.

Builders running now:
- **nohome**: Home removal, Profile, Settings
- **personlink**: PersonLink
- **joins**: group join requests
- **refresh**: pull to refresh
- **search**: search
- **anim**: animated icons and empty art
- **perf**: perf sweep
- **paidby**: Paid by (merged)

---

## Tier 1: copies that already disagree, or a bug (ranked)

**1. A friend's open balance reads "settled up" while it is still open.**
- Files:
  - Correct version: screens/People/components/PersonRow.tsx:113-157.
  - Wrong: screens/FriendsAndInvites/index.tsx:237-260 (`useOpenBalances` and the FriendRow detail).
  - Wrong: features/friends/RemoveFriendDialog.tsx:50-54 and 100, 117-127.
  - Also: lib/remind/owed.ts:20-23, screens/Person/index.tsx:222-248, packages/sync/src/friends.ts:358-376.
- Dup: "one friend's open currencies", computed 5 times. PersonRow draws owed and owe lines when a currency is
  open but nets to zero (+500 direct, -500 in a group). FriendRow and RemoveFriendDialog pass `b.total` (0) to
  BalanceText, so it prints "settled up". The dialog then blocks removal while saying "settled up".
- Shared: domain `openBalancesWith(rows, personId, {includeGroups})`, a client `useOpenBalances(id)` and
  `<OpenBalanceLines>` in components/BalanceText.tsx.
- Risk: the `balance-*-owed/-owe` testIDs appear on hub rows.
- E: S. Overlap: personlink, nohome, joins.

**2. The wire contract rejects op types that sync emits.**
- Files: packages/contracts/src/index.ts:43-51 and 62-75 (opType pattern at :69, verified);
  packages/sync/src/types.ts:1-13 and 58-74.
- Dup: entity types and the op shape are declared twice. Contracts lists 5 types. Its pattern
  `^[a-z]+\.[a-z]+$` refuses `friendRequest.send`, `inviteLink.create` and `groups.hidden`, so those ops fail with
  VALIDATION once M2 sync is on.
- Shared: contracts derives its enum from sync's `ENTITY_TYPES` (or the reverse), plus a parity test over every
  opType sync emits.
- Risk: the apps/api tests pin the enum; widening the regex is a protocol decision.
- E: S. Overlap: joins.

**3. The outbox op is hand-built 4 times, and the tombstone payloads differ.**
- Files: packages/sync/src/mutations.ts:185-199, preferences.ts:338-352, friends.ts:230-244, backup.ts:461-475.
- Dup: the same 13-field `tx.enqueue` literal. Backup sends `{deleted:true}`, while `tombstonePayload`
  (mutations.ts:146-149) keeps `deletedWithGroup`. `putPref` (preferences.ts:322-336) writes no history row, which
  bypasses the entity + history + outbox rule.
- Shared: `enqueueOp(tx, ctx, {entityType, entityId, opType, baseVersion, payload})` in mutations.ts.
- Risk: restore payloads change; adding pref history grows the history table.
- E: S. Overlap: joins, nohome.

**4. `Intl.ListFormat` is used without a guard; it can crash on phones.**
- Files: components/split/ExpenseComposer.tsx:670-671 (raw `new Intl.ListFormat`, verified) versus
  view/shell/desktop/LeftNav.tsx:437-442 (`joinList`, guarded; its comment says Hermes lacks the API).
  locale/i18n.ts loads no listformat polyfill (verified).
- Dup: two ways of joining names. If Hermes lacks the API, the resolve-dispute prompt throws.
- Shared: `joinList(items, locale)` in locale/; use it in both. Also replace the hand `.join(', ')` at
  Settle/index.tsx:219 and statementText.ts:35.
- Risk: none. Check on a device.
- E: S. Overlap: nohome (LeftNav side only).

**5. The row "more actions" menu is built 4 ways, and the same gesture works on some rows only.**
- Files: features/disputes/RowMenu.tsx:19-85; features/hidden/HideItem.tsx:63-117 (`IS_NATIVE` at :111, verified);
  components/activity/ActivityItem.tsx:272-300, 326; components/comments/CommentRow.tsx:196-222.
- Dup:
  - Long-press on phone-width web works in RowMenu and CommentRow, but not in HideRow or ActivityItem.
  - The Menu key and Shift+F10 work only in ActivityItem and CommentRow.
  - The "..." button is hidden on phones in RowMenu but always shown in HideMenu.
- Bluesky: src/components/ContextMenu, PostControls/PostMenu.
- Shared: components/RowMenu.tsx with `useRowMenuTrigger(control)` returning
  `{onLongPress, onContextMenu, onKeyDown, accessibilityActions}`, plus `<RowMenuButton gtMobileOnly>`.
- Risk: e2e that long-press or right-click rows.
- E: M. Overlap: personlink, anim (ActivityItem, CommentRow).

**6. The Ask chat's day divider ignores the Timezone preference.**
- Files: features/searchAsk/AskChat.tsx:282-305; components/comments/DateDivider.tsx:13-58;
  components/activity/SectionHeader.tsx:49-71.
- Dup: "Today / Yesterday / weekday / date", 3 times.
  - AskChat uses the device `Date` and `toDateString`, so it is wrong across time zones and DST and has no weekday
    branch.
  - Comments uses `i18n.date` and ignores the Date format preference.
  - Activity uses `formatDay`.
- Bluesky: src/components/dms/DateDivider.tsx.
- Shared: `useDayLabel(day|at)` in locale/useDates.ts on top of `useFormatDay({relative:true})`. AskChat imports
  the comments DateDivider (move it to components/DateDivider).
- Risk: label wording changes.
- E: S. Overlap: anim (AskChat).

**7. Friend-request Accept and Decline are written twice and behave differently.**
- Files: screens/People/components/RequestsSection.tsx:111-163 (IncomingRow);
  components/activity/ActivityItem.tsx:1326-1377 (FriendRequestActions); data/hooks.ts:461-468
  (`useAnswerFriendRequest`, which IncomingRow bypasses).
- Dup: they differ after Accept (People navigates, Activity stays), while busy (People never disables the buttons),
  and in the toast name.
- Shared: export `<IncomingActions>` beside `OutgoingActions`, built on `useAnswerFriendRequest`, and render it from
  ActivityItem.
- Risk: testIDs `request-accept` and `activity-request-accept`; navigate-on-accept needs a ruling.
- E: S. Overlap: personlink, anim.

**8. One settle-up payment is shown two ways (Group "who owes whom" and the Settle row).**
- Files: screens/Group/components/GroupRows.tsx:142-242 (OweRow) with Group/index.tsx:770-800;
  screens/Settle/components/TransferRow.tsx:25-140.
- Dup: they disagree on four things:
  - words: "You owe Riya" versus "You pay Riya";
  - which avatar is shown (mine versus the other person's);
  - the arrow glyph (absent versus present);
  - third-party payments (one face versus from and to faces).
- Shared: `transferSentence(t, me, name)` and `<PlanPaymentRow>` in components/settle/, with the action and menu
  as props.
- Risk: `group-owe-*` and `transfer-*` testIDs; pass them through.
- E: M. Overlap: personlink.

**9. Balance wording is written outside BalanceText, and two wordings meet in one card.**
- Files:
  - Shared: components/BalanceText.tsx:45-67.
  - GroupRows.tsx:105-136 (MemberBalanceRow, a third-person re-implementation).
  - MemberExitDialog.tsx:132-142.
  - screens/Analytics/components/Charts.tsx:103-108 ("Owed to you" in the table, while the aside at :357 says
    "you are owed").
  - features/remind/RemindSheet.tsx:150-162 (no money colour).
  - GroupBalanceCards.tsx:77-81, PersonBalances.tsx:141-150, Home/components/Overview.tsx:242-248.
- Shared: BalanceText `subject: 'person'|'group'|'member'|'me'` plus a plain-string `balanceWords(l, amount,
  subject)`.
- Risk: Lingui ids change, so re-extract the catalogs.
- E: M. Overlap: personlink, nohome.

**10. List empty states are copied, and Group and Person show the wrong message under a filter.**
- Files: screens/People/index.tsx:208-270 and Groups/index.tsx:204-262 (the 4-way ladder);
  Group/index.tsx:550-566; Person/index.tsx:595-614.
- Dup: with "Disputed only" on and nothing disputed, Group says "No expenses in this group yet". Group and Person
  have no filtered-empty branch and no "Clear filters". The groups-empty button has no testID.
- Shared: `ListEmpty({illustration, query, hasAny, isAllSettled, onShowSettled, isFiltered, onClearFilters,
  empty})` in view/com/util/EmptyState.tsx.
- Risk: empty-state testIDs.
- E: M. Overlap: nohome, personlink.

**11. Category names are translated only in Settings, and the category tile has 3 shapes.**
- Files:
  - Names: components/settings/CategoryIcon.tsx:122-139 (the only one that translates);
    components/split/shared.tsx:40-49; screens/Expense/components/History.tsx:47-48;
    screens/Analytics/useReport.ts:329-338; view/shell/desktop/RecentTransactions.tsx:40-42; lib/ask/answer.ts:84.
  - Tiles: split/shared.tsx:55-78 (CategoryTile), components/people/EntryIcon.tsx:19-57,
    Analytics/components/CategoryIcon.tsx:17-55 (round, its own ICONS map).
- Dup: a Hindi user sees "Food" on Expense, Composer, Analytics and Ask. The fallbacks differ: raw id, a fake
  "Other", the real "other", or "". Tiles are round in Analytics and rounded squares elsewhere. The sidebar draws
  a blank tile for payments where Home shows a banknote.
- Shared: `useCategoryLookup()` in split/shared.tsx returning `(id) => {category, name}`; EntryIcon with a size as
  the only tile.
- Risk: e2e text and Hindi snapshots.
- E: S. Overlap: personlink (AskAnswer), nohome (RightNav).

**12. Name resolution bypasses `useDisplayName`, so deleted people show blank.**
- Files: shared split/shared.tsx:17-31 (`useDisplayName`, `useAvatarName`). Bypassed in:
  - Group/index.tsx:222-224, 713, 749, 783
  - Person/index.tsx:218-220
  - Settle/index.tsx:97-99
  - TransferRow.tsx:48-49
  - MemberExitDialog.tsx:99
  - Analytics/useReport.ts:328-331
  - features/export/statementText.ts:20 (an O(n) find)
  - AskAnswer.tsx:60-63
  - groups/RulesEditor.tsx:134, 219
  - ActivityItem.tsx:520-521
  - RecordPaymentDialog.tsx:169-172
  - PaymentDetailsDialog.tsx:112
  - HistoryRow.tsx:86
  - CallItEvenDialog.tsx:132-133
  - First names at RemindSheet.tsx:77, HistoryRow.tsx:88, ResultRows.tsx:235.
- Dup: Settle and useReport read `useEntities` (tombstones dropped), but decision 103 needs `useAllEntities`.
  Fallbacks differ: "Someone", '', undefined, '?'. "Not in a group" (statementText:21) versus "Non-group"
  (useReport:333).
- Shared: `useDisplayName()` also returns `nameOf(id)` and `firstName(id)`; move `useAvatarName` to state/me;
  `firstName` and `initials` go in packages/domain/name.ts.
- Risk: sorts keyed on ''; initials change.
- E: M. Overlap: personlink (most callers).

**13. Group avatars are drawn by two renderers, and the initials rules disagree.**
- Files: components/groups/GroupAvatar.tsx:12-53 (`initialsOf`, HUES, FNV); view/com/util/UserAvatar.tsx:29-61
  (`getInitials`, the same FNV loop); components/people/AvatarPreview.tsx:12-39 (via CreateGroup.tsx:156);
  components/split/pickers.tsx:283-287. Dead kind glyphs at split/icons.tsx:63-65.
- Dup: the Create group preview and the composer's group picker draw a solid-hue `UserAvatar type="list"`, and the
  created group then shows as a tinted GroupAvatar tile. "Goa" gives "G" in one and "GO" in the other.
- Bluesky: UserAvatar `type`.
- Shared: GroupAvatar is the only group tile, with one exported `nameHash` and `initials(name, mode)`.
- Risk: some initials change.
- E: S. Overlap: none.

**14. The filter trigger has 3 looks, and the filter sheets disagree.**
- Files:
  - Triggers: components/ListToolsHeader.tsx:143-178 (its dot is a verbatim copy of Activity.tsx:209-228);
    Group/index.tsx:513-535 (labelled "Filter · Disputed only"); Person/index.tsx:431-457 (labelled, with chips);
    chips at Activity.tsx:245-268 and Analytics/index.tsx:176-192.
  - Sheets: People FriendsFilterDialog.tsx:80-100 and Person HistoryFilterDialog.tsx:79-106 (the same "Include
    groups" switch, testID `filter-include-groups`); features/hidden/ShowHidden.tsx:46-70 (a subset of
    HistoryFilterDialog); ActivityFilterDialog.tsx:64-109 (hand chip rows).
- Dup: titles read "Filter" or "Filters". People says "Everyone / Owes you" and Groups says "All / You are owed".
  `deferBody` is missing in two sheets. HistoryFilterDialog.tsx:109-111 points to "Settings > Lists", which now
  redirects (stale).
- Shared: `FilterButton({activeCount, onPress, testID})` and `ActiveFilterChips`; `Choices` moves to
  components/forms; an `IncludeGroupsToggle`; ShowHiddenSheet folds into HistoryFilterDialog.
- Risk: sheet and dot testIDs.
- E: M. Overlap: nohome (ListToolsHeader, ListSortMenu, filter dialogs), personlink.

**15. There are 3 currency pickers and 2 currency-name helpers, one of which can throw.**
- Files: split/pickers.tsx:33-124 (English names, not virtualised); components/settings/prefControls.tsx:216-259
  (localised; its own `useCurrencyName`); features/export/ExportSheet.tsx:259-267;
  components/people/ledger.ts:150-159 (`currencyName`, whose fallback `getCurrency` throws UNKNOWN_CURRENCY
  inside the catch); Analytics FilterBar.tsx:46-77.
- Dup: in Hindi, Settings is localised while the composer, Create group and Export are not. Two different dialogs
  use testID `currency-dialog`.
- Shared: `CurrencyDialog({value, onSelect, allowAll?})` on OptionDialog; one non-throwing
  `currencyName(code, locale)` in locale/.
- Risk: currency e2e.
- E: M. Overlap: nohome (prefControls).

**16. One copy of the invite-links note loses its plural.**
- Files: screens/FriendsAndInvites/index.tsx:96-98 (`${n} expired, used or revoked links aren't shown`, verified)
  versus screens/Invites/InviteLinks.tsx:243-268 (`<Plural>`).
- Dup: "1 ... links aren't shown".
- Shared: export `InviteLinksEmpty` and `InactiveLinksNote` from InviteLinks.
- Risk: low.
- E: S. Overlap: perf, personlink.

**17. Sidebar money chips skip the colour-blind palette; the +/- chip and the signed figure are hand-built.**
- Files:
  - Chips: LeftNav.tsx:557-585 (`positive_600` and `negative_500`, verified; "settled" at :596; its own spoken
    strings at :507-512); Home/components/Recent.tsx:83-102; RecentTransactions.tsx:85-106; Expense/index.tsx:405-437.
  - Signed figure with an arrow: BalanceText.tsx:37, 146; GroupRows.tsx:89; TransferRow.tsx:106;
    ActivityItem.tsx:553; HistoryRow.tsx:331; AskCards.tsx:82 (a normal space, so the figure can wrap).
  - Signed figure with +/-: PersonBalances.tsx:191-192; AskAnswer.tsx:135-136; Recent.tsx:100;
    RecentTransactions.tsx:103-104; LeftNav.tsx:583-584.
- Shared: `<MoneyChip amount currency size>` and `signedFigure(amount, currency, locale, 'arrow'|'sign')` in
  components/MoneyDirection.tsx, both on `useMoneyStyle`.
- Risk: visual changes; chip testIDs move.
- E: S. Overlap: nohome, anim, personlink.

**18. The two "Recently active groups" lists pick different groups.**
- Files: screens/Home/components/Recent.tsx:139-191; LeftNav.tsx:449-600 (hand-built rows, not GroupRow).
- Dup: Home drops settled, deleted and never-active groups; the sidebar keeps them.
- Shared: `useRecentGroups(limit)` in data/.
- Risk: the sidebar content changes. This finding drops to low if Home's list is removed.
- E: S. Overlap: nohome, anim.

**19. Back-or-fallback is inlined in 6 screens, and one fallback is wrong.**
- Files: shared navigation/goBack.ts:24-56 and 90-94. Inlined in CreateGroup.tsx:68-71, AddFriend.tsx:175-178,
  EditExpense.tsx:26-29, AddExpense.tsx:44-47, Invites/CreateInvite.tsx:84-87 (falls back to `People`, verified,
  while PARENT says FriendsAndInvites), Expense/index.tsx:184-185. Hand-picked fallbacks at Person/index.tsx:700
  and Welcome/Replay.tsx:34.
- Bluesky: src/lib/hooks/useGoBack.ts.
- Shared: `useGoBack()` calling `goBack(navigation, backFallback(route))`.
- Risk: deep-link close targets change.
- E: S. Overlap: nohome (it is removing the hard-coded 'Home' fallbacks), perf, personlink.

**20. Hrefs are hand-built, and Recent payment rows open /activity.**
- Files: data/recentTransactionRows.ts:33, 36 (repayments get `/activity` although `/payment/:id` exists).
  Hand-built hrefs at Expense/index.tsx:337, GroupRows.tsx:316, Groups/components/GroupRow.tsx:97,
  PersonRow.tsx:166, Analytics ExpenseRow.tsx:61, HistoryRow.tsx:236, LeftNav.tsx:520, Settings/index.tsx:140,
  NavFooterLinks.tsx:52, Home/overviewScope.ts:26-31. There are three navigation styles (`Link href`,
  `navigate('Person')` at 12 sites, and `openLink.go`).
- Shared: `pathTo(name, params)` from lib/links/make.ts everywhere.
- Risk: the payment row changes destination.
- E: S. Overlap: nohome, personlink.

**21. `type=` is printed two ways for the same Activity filter.**
- Files: lib/links/make.ts:25-27 (`activityPath`); components/activity/urlState.ts:28-34 (`typesToParam`).
- Dup: `expenses,payments,disputes` versus `transactions,disputes`.
- Shared: `activityPath` calls `typesToParam`.
- Risk: e2e URL asserts.
- E: S. Overlap: nohome (lib/links).

**22. "Every open dispute" is paged by hand 3 times, with different sort orders.**
- Files: packages/sync/src/disputes.ts:438-448; data/hooks.ts:283-292 (also parses `status:disputed` at :270-277,
  outside the sync query parser); data/exportLedger.ts:75-84.
- Dup: ties come out in different orders.
- Shared: `openDisputeTargets(store)` in disputes.ts; the `status:` token moves into the sync parser.
- Risk: disputed search order.
- E: M. Overlap: search, refresh.

**23. The feed types are listed twice (this drifted once, F-1213 lesson 3).**
- Files: packages/sync/src/activity.ts:58 (`FEED_TYPES`, not exported); data/projections.ts:229-236.
- Shared: export `FEED_TYPES` or `isFeedChange`.
- Risk: none.
- E: S. Overlap: joins, refresh.

**24. "My balance rows" are read twice and "nets" are folded 4 times.**
- Files: packages/sync/src/friends.ts:359-376 versus data/ledgerQueries.ts:79-117. Nets fold at
  ledgerQueries.ts:65-69, friends.ts:368-370, groupLifecycle.ts:106-110, data/askSource.ts:25-30 (which also skips
  `groupNetsQuery`).
- Shared: `loadBalanceRows(store, me)` and `netsOfBalances(rows)` in packages/sync.
- Risk: none (a move).
- E: S. Overlap: joins, refresh.

**25. "Between me and this person" is written 3 ways.**
- Files: Person/index.tsx:227-235 (the disputed-only filter); components/people/ledger.ts:47-60 (`involvesPair`,
  unused); data/hooks.ts:200-224 (`usePairHistory`, which also needs `movesBalance`);
  packages/domain/src/statement.ts:89.
- Dup: the disputed-only list keeps records the normal history drops.
- Shared: `isPairRecord(entry, me, id, {includeGroups})` in domain.
- Risk: the disputed list gets shorter.
- E: S. Overlap: refresh (hooks).

**26. The DisputeRecord builder exists in the client and in sync.**
- Files: state/disputes.ts:163-176; packages/sync/src/disputes.ts:115-133; RaiseSheet.tsx:80-81 (recomputes
  members and keeps deleted groups).
- Dup: if they drift, buttons show for actions the mutation refuses.
- Shared: export a pure `disputeRecordOf(...)` from sync.
- Risk: low.
- E: S. Overlap: none.

**27. Dispute reason labels are copied.**
- Files: components/disputes/words.ts:14-26; ActivityItem.tsx:1047-1058.
- Shared: `useDisputeWords().reason`.
- E: S. Overlap: personlink, anim.

**28. A zero "my part" on an expense reads three ways.**
- Files: HistoryRow.tsx:285-334; ActivityItem.tsx:545-553, 612-618; Expense/index.tsx:405-444.
- Dup: "You paid your own share", "not involved" and "no balance change" for the same expense.
- Shared: `<MyPartText net isInvolved>` in components/people.
- Risk: ActivityItem may not know whether I am involved.
- E: S. Overlap: personlink, anim.

**29. There are 3 "Title  count" headers; the People and Groups header grows 8 px when loading ends; "See all" is
done 5 ways.**
- Files:
  - Headers: screens/People/components/SectionHeader.tsx:8-59 (minHeight 52, imported by 7 screens from a screen
    folder); ListToolsHeader.tsx:98-127 (minHeight 60); SearchAsk/ResultRows.tsx:69-150. The swap from loading to
    loaded is at People/index.tsx:159 to :178 and Groups :168 to :190.
  - See all: Home Recent.tsx:42-49, 118-125, 171-178 (SectionLink); Group/index.tsx:508-513, Person/index.tsx:425-430
    and Analytics/index.tsx:167-173 (the title is the link); RequestsSection.tsx:50-80 (both); sidebar
    RecentTransactions.tsx:108-144 and LeftNav.tsx:603-636 (verbatim copies, one `push` and one `navigate`).
  - Muted sub-headings, about 12 copies, some with role="header" and some without: activity/SectionHeader.tsx:88-93,
    HistoryRow.tsx:339-358, Settings/index.tsx:337-353, PersonReminders.tsx:52-54, split/shared.tsx:205-215,
    MemberExitDialog.tsx:400-408, GroupRows.tsx:42, DeleteGroupPrompt.tsx:80-82, LeftNav.tsx:490-500,
    RecentTransactions.tsx:35-37, ExportSheet.tsx:276, InstallHelpDialog.tsx:79.
- Bluesky: src/screens/Search/components/ModuleHeader.tsx.
- Shared: components/SectionHeader.tsx `{title, count?, countSuffix?, seeAll?: {href, label}, action?, right?}`
  with role header; `SidebarSeeAll`; `SubHeading` in Typography.
- Risk: ListToolsHeader's width math; `*-title`, `*-link` and `*-all` testIDs.
- E: M. Overlap: nohome, personlink.

**30. Choice-chip rows are hand-rolled about 9 times, with different accessibility and haptics.**
- Files: components/disputes/Chip.tsx:5-29 (only RaiseSheet uses it); FriendsFilterDialog.tsx:145-186 (`Choices`);
  ActivityFilterDialog.tsx:64-109; ChargeSheet.tsx:150-165, 235-290; ChargesSection.tsx:127-160;
  FeedbackSheet.tsx:180-205; RemindMeSheet.tsx:170-188 (no role or checked state); SplitEditor.tsx:130-150,
  1055-1070; Overview.tsx:133-167 (a raw Pressable).
- Bluesky: src/components/forms/ToggleButton.tsx (not copied).
- Shared: copy ToggleButton as components/forms/ChoiceChips `{type:'radio'|'checkbox', options, value, onChange}`
  with one haptic. Chip and Choices fold into it.
- Risk: e2e clicks by role.
- E: M. Overlap: nohome, paidby (merged).

**31. Export dates ignore the Date format preference.**
- Files: features/export/statementText.ts:58; ExportSheet.tsx:106.
- Shared: the existing `useFormatDay()` (locale/useDates.ts:71).
- Risk: export golden tests.
- E: S. Overlap: none.

**32. Percents are formatted two ways, and one chart rounds differently.**
- Files:
  - Suffix "%": ChargedBreakdown.tsx:52, 94; Expense/index.tsx:650; ChargesSection.tsx:66-70, 244;
    ExpenseComposer.tsx:731-734.
  - `style:'percent'`: ItemsBreakdown.tsx:58, Charts.tsx:45-48, DonutChart.tsx:66-69.
  - Input copies: split/form.ts:279-286 `percentText` equals chargeForm.ts:58-63 `bpText`.
  - Rounding: HBarList.tsx:84 rounds `fraction*100`, while Charts.tsx:194 uses `percentOf`.
- Dup: "18%" versus "18 %" in de and fr.
- Shared: `formatPercent` and `formatBasisPoints` in domain, next to `percentOf`.
- Risk: text only.
- E: S. Overlap: personlink.

**33. Three email checks accept different input.**
- Files: packages/domain/src/contact.ts:7-9 (`isEmail`, unused) and 37-42; packages/sync/src/feedback.ts:60-65.
- Shared: one domain `isEmail`.
- Risk: the feedback field accepts or refuses slightly different input.
- E: S. Overlap: none.

**34. The projection re-implements `splitItem` without its checks.**
- Files: packages/sync/src/ledgerProjection.ts:317-323 versus packages/domain/src/split.ts:135-143.
- Shared: call `splitItem`.
- Risk: the error type on bad data changes.
- E: S. Overlap: search, nohome.

**35. Open disputes on a record are read 4 ways, and one skips tombstones.**
- Files: disputes.ts:137-139; ledgerProjection.ts:297-300; mutations.ts:209-215 (`closeDisputesGone` has no
  deleted filter and writes `deleted:false`); core.ts:376 (intended).
- Shared: `openOn` is the one copy.
- Risk: none; the bug is latent.
- E: S. Overlap: joins, search.

**36. Not-found screens: 6 copies, with different wording.**
- Files: Expense/index.tsx:151-162, Repayment/index.tsx:117-128, Group/index.tsx:206-216, Person/index.tsx:202-212,
  Settle/index.tsx:153-163, Settings/SettingsSection.tsx:224-247 (bypasses EmptyState).
- Dup: "doesn't exist" versus "isn't on this device"; "Go to" versus "Back to". A missing group expense goes back
  to People.
- Shared: `NotFound({kind, onBack})` in EmptyState.tsx.
- Risk: `*-not-found` testIDs.
- E: S. Overlap: nohome, personlink.

**37. The Undo toast and "delete expense" are duplicated.**
- Files:
  - Undo toast: GroupLifecycle.tsx:72-83, 228-243; useActivityActions.tsx:127-138; HideItem.tsx:36-45;
    RemoveFriendDialog.tsx:62-79; Expense/index.tsx:186-203; CallItEvenDialog.tsx:240-248.
  - Delete: Expense/index.tsx:176-204 versus useActivityActions.tsx:94-106.
- Dup: `type:'success'` is missing in two copies; there are two catalog keys for Undo; the error text differs;
  only Activity plays haptics.
- Shared: `Toast.showUndo(message, onUndo)` and `useDeleteExpense()`.
- E: S. Overlap: personlink.

**38. The swipe and the launch animation ignore "Animations off".**
- Files: lib/custom-animations/GestureActionView.tsx:46; components/LaunchScreen/index.tsx:49 (reanimated
  `useReducedMotion`) versus motion/useShouldReduceMotion.
- Shared: use `useShouldReduceMotion`.
- E: S. Overlap: none.

**39. "Time ago" is rewritten twice beside Bluesky's helper.**
- Files: lib/deletedAge.ts:1-22 with DeletedMeta.tsx:39-56; RequestsSection.tsx:242-248 (`ago()` rounds, so
  1.6 days reads "2 days"); shared lib/hooks/useTimeAgo.ts:45-192.
- Shared: `dateDiff` and `formatDateDiff` with `floorTo` and `maxMonths` options.
- Risk: "Deleted ..." wording.
- E: S. Overlap: personlink, anim.

**40. The group byline is built 3 times, and one says "1 members".**
- Files: Groups/components/GroupRow.tsx:54-66; Group/index.tsx:350-363; ResultRows.tsx:364-379;
  split/pickers.tsx:262 (no plural, verified).
- Shared: `useGroupByline(group, {dates?})` in components/groups.
- E: S. Overlap: nohome, personlink.

**41. Open amounts in confirm dialogs are rendered 3 ways.**
- Files: RemoveFriendDialog.tsx:118-129; GroupLifecycle.tsx:313-319 (MakeInactivePrompt: a bare amount with no
  direction); MemberExitDialog.tsx:243-266.
- Shared: `OpenAmountsList` (from finding 1).
- E: S. Overlap: none.

## Tier 2: size and maintenance, plus small bugs

| # | Finding | Files | Shared piece | E | Overlap |
|---|---|---|---|---|---|
| 42 | Balance hero cell and settled card, 4 copies; the grid layouts differ | Overview.tsx:89-107, 237-283; GroupBalanceCards.tsx:48-99; PersonBalances.tsx:44-63, 117-163; Settle/index.tsx:562-584 | `BalanceFigure`, `SettledCard` in BalanceText.tsx | M | nohome (Overview moves to Analytics) |
| 43 | Person-picker row, 5 copies; avatar 36 or 32 px | split/PeopleDialog.tsx:185-213; PayersDialog.tsx:105-146; SplitEditor.tsx:272-322; groups/AddMembersDialog.tsx:144-160; CreateGroup.tsx:210-226; `rowStyle` pickers.tsx:18-27 copied inline | `<PersonOption control="checkbox\|radio">` | M | none |
| 44 | Labelled switch rows, about 10 copies; label weight differs | ShowSettledToggle.tsx:14-19; DisputedOnlyToggle.tsx:13-23; ShowHidden.tsx:23-33; FeedbackSheet.tsx:263-276; CreateInvite.tsx:249-266; RulesEditor.tsx:176-196; ChargeSheet.tsx:350-365; Settings/DemoMode.tsx:49-67; settings/controls.tsx:140-151; the two filter dialogs | `Toggle.SwitchRow({label, hint})` | S | nohome |
| 45 | "..." overflow trigger, 11 copies; margins and labels drift | Header: Expense/index.tsx:209-224, Group/index.tsx:609-624, Person/index.tsx:496-511, Repayment/index.tsx:90-105. Rows: HideItem.tsx:68-82, RowMenu.tsx:57-76, GroupRows.tsx:202-216 and 331-345, TransferRow.tsx:112-126, FriendsAndInvites.tsx:284-290, ActivityItem.tsx:464-478 | `Menu.OverflowTrigger({variant, label})` | S | personlink, anim |
| 46 | Two month calendars and 3 weekday-name helpers; the padding differs | split/DateDialog.tsx:48-277; Analytics RangeDialog.tsx:21-24, 56-242; prefControls.tsx:320-328 | `components/forms/MonthCalendar`, `monthGrid`, `weekdayNames` in locale/dates | M | nohome (prefControls) |
| 47 | LocalDate arithmetic outside domain, about 9 copies; `dayBefore` uses `Date.parse` | locale/dates.ts:68-70; data/analyticsQueries.ts:32-39; RangeDialog.tsx:21-24; lib/ask/period.ts:5-38; DateDialog.tsx:83; `utcDate` at useReport.ts:79-81, people/ledger.ts:105-107, AskAnswer.tsx:38; domain reports.ts:42-101 (private) | export `addMonths`, `lastDayOfMonth`, `daysBetween`, `utcDate` from domain date.ts | S | search (domain, other file) |
| 48 | Chart bucket labels in Analytics and Ask; Ask ignores the Date format | useReport.ts:273-317; AskAnswer.tsx:65, 342-349 | `bucketLabel(bucket, granularity, opts)` | S | personlink |
| 49 | Instant to local day: a new `Intl` formatter per comment | comments/timeline.ts:51-58 versus activity/feed.ts:89-92 | use `dayOf` / `todayIn` | S | none |
| 50 | Time-of-day format, 5 copies | CommentRow.tsx:112; Expense History.tsx:151; DisputeLine.tsx:63; Repayment/index.tsx:320-323; ActivityItem.tsx:1253-1255 | `useFormatTime()` | S | personlink |
| 51 | Chat bubble and composer copied twice from Bluesky DMs; max height 140 versus 120 | CommentRow.tsx:82-90, 227; AskChat.tsx:35-36, 329; AskAnswer.tsx:100-112; CommentComposer.tsx:36; AskComposer.tsx:16-20 | components/chat `Bubble`, `ChatField` | M | personlink, anim |
| 52 | The composer's `DetailRow` re-implements the Bluesky SettingsList row | split/fields.tsx:455-514 versus Settings/components/SettingsList.tsx:81-317 | build it from SettingsList pieces (move them to components/) | S | nohome |
| 53 | Money types spelled 10+ times under 3 names | schema.ts:370; mutations.ts:137, 183, 326; disputes.ts:34-35; groupLifecycle.ts:83, 187; ledgerProjection.ts:39, 195, 273, 434; data/ledgerQueries.ts:38-39; analyticsQueries.ts:27; demoSeed.ts:326 | `MONEY_TYPES`, `isMoneyType`, `touchesMoney` | S | joins, search, nohome |
| 54 | "Who is on a record" (payers plus sharers), about 15 copies; some dedupe, some don't | ledgerProjection.ts:59, 239-244; mutations.ts:339-344, 394; disputes.ts:120; search.ts:350, 369; backup.ts:383-388; domain reports.ts:308; client people/ledger.ts:58, split/form.ts:289, activity/useActivityFeed.ts:111, activity/feed.ts:153, state/disputes.ts:172, Expense/index.tsx:99, 308, data/hooks.ts:211 | `participantsOf(r)`, `isParticipant` in domain ledger.ts | S | joins, search |
| 55 | The disputed projections copy the balance write path | ledgerProjection.ts:100-109 / 336-344, 152-170 / 346-364; core.ts:133-139 / 159-165, 254-276, 280-286; `pairDebts` 330-333 | `writeNetSums`, `writePairSums`, `readNets`; `recordDebts` in domain | M | search, nohome |
| 56 | "Read every page" hand loop, about 12 copies | reminders.ts:99-130; groupLifecycle.ts:81-93; mutations.ts:323-336; backup.ts:288-296; comments.ts:106-116; disputes.ts:416-445; data/exportLedger.ts:27-47, 75-84; data/hooks.ts:285-290; data/analyticsQueries.ts:208-219 | `async function* pages(store, type, q)` in store.ts (keep the full-read-ok markers) | M | joins, refresh |
| 57 | Group index per money type, 4 copies; `useRecentTransactions` drops write-offs, `usePairHistory` keeps them | groupLifecycle.ts:74; exportLedger.ts:33; analyticsQueries.ts:78; data/hooks.ts:188-190, 215-239; mutations.ts:323-334 | `GROUP_INDEX`, `PERSON_TRANSFER_INDEXES` in schema.ts | S | refresh, joins |
| 58 | `expenseNet` is byte-identical to `personNet`; "a record's effect on me" is computed 3 more ways | domain ledger.ts:312-314, 410-412; reports.ts:248; statement.ts:75-77, 89 | keep `personNet`; `recordNetFor(r, me)` | S | personlink |
| 59 | Private domain helpers beside exported ones | `sum` at split.ts:54-58, charges.ts:61-65 (use `sumMinor`); `abs` at charges.ts:66 (use `magnitude`); `cmp` at ledger.ts:152, statement.ts:69; half-away rounding at adjustments.ts:12-14, charges.ts:118-122, calc.ts:295-297; `byDateDesc` at reports.ts:145 and client analyticsQueries.ts:199; `fraction` (6 decimals) versus `assignedFraction` (4 decimals) | `roundDiv`; export `byDateDesc` | S | search (calc.ts) |
| 60 | Clipboard and share written 4 ways; the same invite URL gets "Copied!" in one place and a toast in another | lib/sharing.ts:49-57; lib/remind/share.ts:14-24; invites/CopyTextButton.tsx:37-41; CommentRow.tsx:119-126 | `copyText(text, {toast?})`, `shareText` in lib/sharing (Bluesky src/lib/sharing.ts) | S | personlink (CommentRow) |
| 61 | Single-flight re-implemented, because the hook has no busy state | lib/hooks/useSingleFlight.ts:9-20; AddFriend.tsx:181-199; RequestsSection.tsx:91-107; CreateInvite.tsx:89-110; Invite.tsx:136-160 | `useSingleFlight()` returns `{run, isBusy}` | S | perf, personlink |
| 62 | Error toast, 15 copies | RaiseSheet.tsx:119; AnswerSheet.tsx:58; Expense/index.tsx:181, 196, 543; GroupLifecycle.tsx:463, 512; Person/index.tsx:393; Repayment:265; PeopleDialog:117; ExpenseComposer:263; Discussion:134, 155; DisputePanel:80; PaymentDetailsDialog:179 | `useErrorToast()` | S | personlink |
| 63 | Member and admin checks repeated; ActivityItem reads raw `role` without `normalizeRoles` (a legacy creator can show as "newly made admin") | `leftAt === null` 18 times (e.g. Group/index.tsx:339, 360, 364, GroupRow.tsx:60, pickers.tsx:262, ResultRows.tsx:372, formPick.ts:53, AddMembersDialog.tsx:70); admin checks at Group/index.tsx:189, 754, GroupLifecycle.tsx:109, 456, 503; ActivityItem.tsx:746-750 | `currentMembers`, `memberCount`, `isGroupAdmin` next to `groupAdmins` | S | joins, personlink |
| 64 | Pref defaults restated at call sites (`'INR'` 7 times, `'en'` 6 times, weekStart, categories) | useAskEngine.ts:25; Home/index.tsx:73; Recent.tsx:148; Groups/index.tsx:77; People/index.tsx:74; Settings/index.tsx:305; LeftNav.tsx:458 | `usePrefValue(key)` returning `PREFS[key].default` while loading | S | nohome |
| 65 | List-state URL pieces and the sort comparator duplicated | the currency regex at People/urlState.ts:15, Groups/urlState.ts:21, Analytics/urlState.ts:41; Analytics/urlState.ts:22, 38 skips `oneOf` and `Params`; overviewScope.ts:21-23 hand-encodes `scopeToParam`; People/sort.ts:57-81 equals Groups/filter.ts:103-126; filter assembly at People/index.tsx:78-102 and Groups/index.tsx:84-95 | `currencyParam`, `byBalanceThenName`, `useListFilters` in lib/links/listState.ts | M | nohome |
| 66 | Typed-row amount reading repeated | split/form.ts:418, 442-458, 703-716; charges/chargeForm.ts:126-141, 223-238; people/ledger.ts:115-126 | `readRowAmount(text, cur, mark, opts)` | M | none (paidby has merged) |
| 67 | History-line kind and markup copied; Repayment calls any later live version "restored" | Expense/components/History.tsx:49-58, 108-160; Repayment/index.tsx:166-186, 288-326 | `historyKind(row, prev)`; `HistoryLine` takes titles | S | none |
| 68 | "Keep unchanged rows" written twice; nested equality written twice | data/projections.ts:140-159 versus historyMerge.ts:67-85; ledgerQueries.ts:144-154 versus 239-249 | `shareBy`, `sameNested` | S | refresh |
| 69 | Id-list preference code written 3 ways | preferences.ts:215, 221, 226 (validators), 395; mutations.ts:318; groupLifecycle.ts:68; data/groupVisibility.ts:8-12 versus hiddenItems.ts:13-16; `isString` preferences.ts:86 versus `isStr` bill.ts:90 | `isIdList`, `setIdInPref`, `useIdSetPref` | S | nohome, joins |
| 70 | Small sync copies: `isInactive` (backup.ts:360 versus mutations.ts:74-76); group-field checks (mutations.ts:351-354 versus 374-377); spec lookups (sqlStore.ts:19, idbStore.ts:19, 24, txRows.ts:8, 48 versus schema.ts:372, 383-385); entity loads (ledgerProjection.ts:377, 406 versus core.ts:45-48); history reads (core.ts:97, 310, 324); text cleaners (mutations.ts:225-229, comments.ts:36-42, disputes.ts:104-109). Keep `checksum` versus `fnv1a64` apart: merging them would change the backup format | packages/sync/src | use the existing helper in each case | S | joins, search |
| 71 | Dead code and skeletons: `components/FeedCard.tsx` (never imported, verified); unused ProfileCard exports (ProfileCard.tsx:20-76, 107+); row skeletons at GroupRow.tsx:173-198, HistoryRow.tsx:360-375, Analytics ExpenseRow.tsx:123-147, PersonRow.tsx:264-290 (a hand bar); hero skeletons at Person/index.tsx:708-718, Profile.tsx:215-224, Group/index.tsx:374-381; card skeletons at PersonBalances.tsx:203-217 and Overview.tsx:315-334 | components/Skeleton.tsx | delete FeedCard; `Skeleton.ListRow`, `Hero`, `Card` | M | nohome, personlink |
| 72 | Notice boxes beside Admonition | Settings/SettingsSection.tsx:195-222; Settings/index.tsx:208-215; ImportSheet.tsx:206-216 | `Admonition` | S | nohome |
| 73 | Picker trigger copied with the wrong chevron | settings/controls.tsx:160-189 versus groups/GroupFields.tsx:104-116 | `PickerTrigger` | S | none |
| 74 | Unread badge, 4 copies, plus an unused one | BottomBar.tsx:189-200; BottomBarWeb.tsx:186-201; LeftNav.tsx:274-305; navigation/Drawer.tsx:283-315; SettingsList.tsx:319-357 (unused) | `UnreadBadge({count, placement})` | S | nohome, anim |
| 75 | The " - Demo" title suffix built twice | navigation/Navigation.tsx:265; Layout/Header/index.tsx:251 | `useDemoTag()` | S | nohome |
| 76 | Grey tags drawn by hand | PersonRow.tsx:45-60 (`ChipTag`); currency chip at GroupRows.tsx:45-56 and Overview.tsx:251-267 | `Pills.Tag` with `numberOfLines` and `emphasis` | S | personlink, nohome |
| 77 | Stat strip written twice | Analytics/components/Summary.tsx:34-98; Profile.tsx:255-297 | `StatStrip` | S | nohome |
| 78 | From-to avatar pair, 4 copies | RecordPaymentDialog.tsx:311-318; CallItEvenDialog.tsx:302-306; TransferRow.tsx:81-85; AskCards.tsx:139-147 | `PersonPair` | S | personlink |
| 79 | Inline "no matches" and compact empty text, 5 wordings; the two hub empties disagree with People | ScopeDialog.tsx:204-214; OptionDialog.tsx:138-146; pickers.tsx:113-121; FriendsAndInvites/index.tsx:87-98, 228-235; Discussion.tsx:252-288; AskChat.tsx:258-280 (a local `EmptyState`); People/index.tsx:213, 257; Groups/index.tsx:209; AskAnswer.tsx:385 | an EmptyState `compact` variant or `NoMatches({query})` | S | anim, personlink |
| 80 | Dead wrapper over the domain | components/groups/net.ts:1-40 (no importers, verified) | delete it | S | none |
| 81 | Small Bluesky bypasses | DemoBusyCover.tsx:25 (raw ActivityIndicator instead of Loader); RequestRow.tsx:101-165 (a hand-built tooltip; Bluesky has src/components/Tooltip); AskChat.tsx:196-198 (a ghost close button, not Dialog/CloseButton) | the existing pieces | S | personlink, anim |
| 82 | "Email or phone" field written twice; labels and maxLength differ | Login/ContactField.tsx:12-60; AddFriend.tsx:446-470 | `ContactField` | S | perf |

## Tests

| # | Finding | Copies | Shared piece | E | Overlap |
|---|---|---|---|---|---|
| T1 | Dev sign-in retyped about 17 times. language.spec:58 and e2e-pwa/pwa.spec:18 wait only for `screen-home`, so they break when Home goes | auth.spec 65, 126, 345-559 (15 copies); language.spec:57-58 (`openSplash` at :17-20 is a no-op); e2e-pwa/pwa.spec:14-18, 101 | `signInAsDev(page, path?)` in e2e/auth.ts | S | nohome |
| T2 | `openDemo` plus a per-spec ready wait, 37 copies in 24 files with 3 markers; 17 `home-overview` waits break when Home goes | e.g. friends:17-21, sheets:16-19, shell:37-40, homeLayout:20-25, scrollWeb:22-28, ask:14-17, perf/tapLatency:38-48, drawers:50-52, composer.ts:19 | `openDemo(page, path, {ready})` that waits for the screen itself | M | nohome |
| T3 | `goto` plus wait for `window.splito`: 14 local helpers, about 45 inline. tabTaps' copy also waits for Home | balances:13-16, callItEven:12-15, group:11-14, groupLifecycle:11-14, deletedInPlace:21-24, disputes:26-29, people:32-35, many-currency:22-25, remind:31-34, webNav:14-17, friendsHub:13-16, backup:14-17, tabTaps:26-30, animations:14-19, dates:26-30 | `openApp(page, path)` in e2e/app.ts | S | nohome (some specs) |
| T4 | Add-expense helpers bypass the new composer.ts | local `openAddExpense` in amount:10-16 and expense:8-15; about 30 direct compose clicks; `splitWith` (expense:17-23) retyped at amount:58-61, charges:46-49, 218-221, many-currency:226-229, sheetExit:17-19 | `composeButton`, `openAddExpense`, plus `pickPeople(page, names)` in composer.ts | S | none |
| T5 | Viewports defined in about 30 files in 4 shapes; drawers.spec:12 has PHONE at 375 px | `PHONE` in 21 files, `DESKTOP` in 19, 34 inline `setViewportSize` calls | e2e/viewports.ts with `PHONE`, `DESKTOP`, `LAPTOP`, `RAIL`, `SIZES`, and `SMALL_PHONE` for drawers | S | personlink (new spec) |
| T6 | Test-hook type and calls inlined | Hooks type in auth.ts:3-10, globalSignIn.ts:5, openDemo.ts:3, activityFilters:9, activityLinks:14 and about 20 casts; `seedAccount` at auth.spec:87, 285, 309, 326 and authShots:66; `openLink` at deeplinks:150 is bypassed in 4 places; pwa.spec:106 key list | e2e/hooks.ts | S | nohome |
| T7 | `type Splito` redeclared in 28 specs (181 `as unknown as` casts) | balances:6-11, callItEven:4-10, group:4-9, disputes:9-19 and others | export `SplitoDevTools` from data/devTools.ts | M | none |
| T8 | Seed fixtures copied; `seedA04` duplicated exactly | lists:22-61 equals people:38-76; A07 variants at group:17-44, groupLifecycle:17-44, shellFirst:47-60, webNav:22-40, deletedInPlace:30-39, tabTaps:134; the draft base retyped in 23 files | e2e/seed.ts, passing defaults as evaluate arguments | M | none |
| T9 | Activity locators copied; the scope disagrees on `.last()` | activityFilters:12-15 equals activityLinks:16-18; shell:48-52, tabTaps:161, activity:30 | e2e/activity.ts `activityScreen(page)` (with `.last()`) | S | none |
| T10 | `setPref` and `setMotion` copied | setMotion at animations:21-26 and tabTaps:32-37; setPref in about 10 places | `setPref(page, k, v)` in openDemo.ts | S | none |
| T11 | Open-screen helper copied; the drawer and Profile paths bypass nav.ts; android-smoke follows the old avatar to Settings path | shell:32-35 equals settings:9-12; about 38 inline pairs; avatar clicks in 11 places; scripts/android-smoke.ts:149 | `openScreen` in nav.ts; use `openDrawer` and `openProfile` | S | nohome |
| T12 | Synthetic touch written 3 ways; `new Touch` fails on WebKit | welcome:85-93, 109-117; nav.ts `openDrawer`; pullRefresh `finger()` | e2e/touch.ts (plain-Event form) | S | nohome, refresh |
| T13 | Unit tests copy the bun:sqlite executor; ctx and draft fixtures repeated | data/askSource.test.ts:44-65, analyticsQueries.test.ts:16-36, demoSeed.test.ts:31-58, demoCoverage.test.ts:264-281 versus `@splito/sync/test/bunExecutor`; `makeCtx` (storeV2Contract.ts:22, not exported) retyped in 17 files; "Dinner" drafts in 12; `ledgerOf` (projectionCheck.ts:15-26) equals `loadLedger` | `@splito/sync/testing` with `bunExecutor`, `makeCtx(over)`, `draft(over)`, `memStore()` | M | joins, search (their test files) |
| T14 | `databases()` defined 3 times; two copies are unsorted | auth.ts:15; demo-mode:110; welcome:15 | import from auth.ts | S | nohome |
| T15 | Clock pinned two ways | pinClock.ts versus activity.spec:50-53 | `pinClock` | S | none |
| T16 | Friends-filter opener copied | sheets:21-28; drawers:50-57; deletedInPlace:287 | `openFriendsFilters(page)` | S | nohome |
| T17 | Perf helpers copied | `median` at save:119, schema-v2:37, tapLatency:201; CPU throttle in 4 files; render counter at perf/save:25-73 and e2e-renders/renders:48-109 | perf/stats.ts | S/M | perf |
| T18 | Bundle scan copied; coverage differs | e2e/bundle.spec:11-21 (top level only, no wdyr marker); e2e-pwa/bundle.spec:11-30 (`walk` defined twice) | e2e/bundleScan.ts | S | none |

Checked and found clean:
- The Prompt confirms, the FormSheet scaffolds, and RemindMenuItems and RecordMenuItems are reused correctly.
- TabScreen, haptics, the screens' store reads (all through data/hooks) and the formatAmount locale are consistent.
- The idb and sql engines already share their query code through core.ts.
- Bluesky's `__e2e__` is Maestro and Jest, so there is nothing for Playwright to import.

---

## Consolidation order (slices)

Rules:
- Within a phase, no two slices share a file, so they can run in parallel.
- A later phase starts only after the builders it names have merged.
- Each slice: tests unchanged or better, 390 and 1440 px screenshots before and after, and an architecture test
  where the pattern can be enforced (F-274 acceptance 2 and 3).

### Phase 0: now (no running builder touches these files)

| Slice | Findings | Files it owns |
|---|---|---|
| P0-a Group avatar | 13 (except pickers.tsx) | groups/GroupAvatar, view/com/util/UserAvatar (export `nameHash` and `initials`), people/AvatarPreview, screens/CreateGroup, split/icons.tsx |
| P0-b Row menu core | 5 (core), 38 | new components/RowMenu.tsx, features/hidden/HideItem, features/disputes/RowMenu, lib/custom-animations/GestureActionView, LaunchScreen |
| P0-c Domain helpers | 33, 47 (domain side), 54 (domain), 58, 59 (not calc.ts), 32 (`formatPercent` added) | packages/domain (date, ledger, contact, split, charges, money, reports, statement, name), sync feedback.ts, client data/analyticsQueries.ts, lib/ask/period.ts, locale/dates.ts |
| P0-d Dates UI | 6 (except AskChat), 31, 46 (except prefControls), 49, 50 (DisputeLine only) | locale/useDates.ts, comments/DateDivider (to components/), comments/timeline.ts, export/statementText + ExportSheet, split/DateDialog, Analytics/RangeDialog, new forms/MonthCalendar, disputes/DisputeLine |
| P0-e Pickers and currency | 15 (except prefControls), 13 (pickers.tsx), 40 (pickers plural), 4 (`joinList` to locale/ + ExpenseComposer) | split/pickers.tsx, components/people/ledger.ts, locale/currencyName, new components/CurrencyDialog, split/ExpenseComposer.tsx |
| P0-f Expense history and category | 11, 67, 50 (History and Repayment) | split/shared.tsx (`useCategory`), settings/CategoryIcon, Expense/components/History, Repayment/index, Analytics/useReport (category only), Analytics/components/CategoryIcon, people/EntryIcon, lib/ask/answer |
| P0-g Sharing | 60 (except CommentRow) | lib/sharing, lib/remind/share, invites/CopyTextButton, remind/RemindSheet (copied branch only) |
| P0-h Chips and switches | 30, 44 (non-overlapping callers) | new forms/ChoiceChips (Bluesky ToggleButton), forms/Toggle `SwitchRow`, disputes/Chip, RaiseSheet, FeedbackSheet, RemindMeSheet, ChargeSheet, ChargesSection, SplitEditor, RulesEditor, ShowSettledToggle, DisputedOnlyToggle, ShowHidden, Invites/CreateInvite |
| P0-i E2E helpers | T3, T4, T5, T7, T8, T9, T10, T15, T17, T18 | new e2e/app.ts, viewports.ts, seed.ts, activity.ts; composer.ts; openDemo.ts (`setPref`); data/devTools.ts (type export); perf/*; bundle specs; only specs that nohome does not touch |
| P0-j Small and dead | 26, 73, 72 (ImportSheet only), 80, 81 (DemoBusyCover), 71 (delete FeedCard) | state/disputes.ts + sync disputes `disputeRecordOf` export, groups/GroupFields, export/ImportSheet, DemoBusyCover, delete groups/net.ts and FeedCard.tsx |
| P0-k Client unit-test fixtures | T13 (client side) | new packages/sync/test/testing.ts (export only), data/*.test.ts |

### Phase 1: after personlink, anim and perf merge

| Slice | Findings | Files it owns |
|---|---|---|
| P1-a Balance words and open balances | 1, 9, 16, 41 | BalanceText, new data `useOpenBalances`, lib/remind/owed, FriendsAndInvites, Invites/InviteLinks, RemoveFriendDialog, PersonRow, MemberExitDialog, Analytics/Charts, RemindSheet, GroupLifecycle |
| P1-b Money figures | 17 (except LeftNav), 32 (callers), 28 (HistoryRow) | MoneyDirection, RecentTransactions, PersonBalances, AskCards, HistoryRow, ChargedBreakdown, ItemsBreakdown, DonutChart, HBarList |
| P1-c Plan payment and group page | 8, 78, 40, 45 (Group header), 36 (Group), 63 | GroupRows, Group/index, Settle/index, Settle/TransferRow, RecordPaymentDialog, CallItEvenDialog, Groups/GroupRow (byline only), components/groups helpers |
| P1-d Requests and Activity rows | 7, 5 (rollout), 27, 28 (ActivityItem), 39, 61, 63 (ActivityItem role), 60 (CommentRow), 50 (Comment and Activity) | RequestsSection, RequestRow, ActivityItem, useActivityActions, CommentRow, DeletedMeta, lib/deletedAge, lib/hooks/useSingleFlight, Invites/Invite, AddFriend (single-flight only) |
| P1-e Ask and chat | 6 (AskChat), 48, 51, 79 (AskChat and AskAnswer), 81 (close button) | AskChat, AskAnswer, AskComposer, CommentComposer, new components/chat |
| P1-f Expense page | 37, 36 (Expense, Repayment, Person), 45 (Expense, Repayment, Person headers), 17 (Expense chip), 62 | Expense/index, Repayment/index (after P0-f), Person/index (not-found and header only), components/Toast `showUndo`, new `useDeleteExpense`, `useErrorToast` in split/shared |
| P1-g Picker rows | 43, 66 | PeopleDialog, PayersDialog, AddMembersDialog, split/form.ts, charges/chargeForm.ts (SplitEditor and CreateGroup rows after P0-a and P0-h) |

### Phase 2: after nohome and refresh merge

| Slice | Findings | Files it owns |
|---|---|---|
| P2-a List chrome | 29 (headers, See all, sub-headings), 14 (FilterButton and chips), 76 | new components/SectionHeader (old People path re-exports), ListToolsHeader, ListSortMenu, ResultRows, Activity.tsx, Analytics/index, Typography `SubHeading` |
| P2-b Filter sheets and empties | 14 (sheets), 10, 65, 79 (People and Groups) | FriendsFilterDialog, GroupsFilterDialog, HistoryFilterDialog, ActivityFilterDialog, People/index, Groups/index, Person/index (filter and empty), Group/index (filter and empty), screens/*/urlState, sort.ts, filter.ts, lib/links/listState, view/com/util/EmptyState `ListEmpty` |
| P2-c Shell | 17 (LeftNav), 18, 29 (`SidebarSeeAll`), 4 (LeftNav uses locale `joinList`), 74, 75 | LeftNav, RightNav, BottomBar*, navigation/Drawer, Layout/Header, navigation/Navigation, data `useRecentGroups` |
| P2-d Navigation and links | 19, 20, 21 | navigation/goBack (`useGoBack`), CreateGroup, AddFriend, EditExpense, AddExpense, CreateInvite, Welcome/Replay, lib/links/make, activity/urlState, data/recentTransactionRows, href call sites not owned by another Phase 2 slice (NavFooterLinks, Analytics ExpenseRow, Settings/index, overviewScope) |
| P2-e Settings | 52, 72, 36 (Settings NotFound), 44 (DemoMode), 15 and 46 (prefControls) | Settings/*, settings/prefControls, settings/controls, split/fields `DetailRow` |
| P2-f Overview and stats | 42, 77, 71 (skeletons) | Analytics Overview*, Summary, GroupBalanceCards, Profile, components/Skeleton, Groups GroupRow and Analytics ExpenseRow skeletons |
| P2-g E2E after nohome | T1, T2, T6, T11, T12, T14, T16 | e2e/auth.ts, globalSignIn.ts, nav.ts, openDemo.ts (`ready`), new e2e/hooks.ts and touch.ts, scripts/android-smoke.ts, the nohome specs |

### Phase 3: after joins and search merge (packages/sync)

| Slice | Findings | Files it owns |
|---|---|---|
| P3-a Ops and contract | 2, 3, 53, 69, 70 (mutations, backup) | packages/contracts, sync mutations, preferences, friends (enqueue), backup, schema |
| P3-b Reads | 22, 23, 24, 25, 35, 56, 57, 54 (sync callers) | sync disputes, activity, store.ts `pages`, groupLifecycle, reminders, comments, search parser; client data/hooks, projections, ledgerQueries, exportLedger, askSource, analyticsQueries |
| P3-c Projection | 34, 55, 68, 70 (core, ledgerProjection) | sync ledgerProjection, core, txRows, idb/sqlStore; client historyMerge |
| P3-d Package test fixtures | T13 (packages side) | packages/sync/test/* |

### Phase 4: last, as one sweep with nothing else running (it touches many files)

| Slice | Findings |
|---|---|
| P4-a Names | 12 (`useDisplayName` extension, `useAvatarName` moved to state/me, domain `firstName` and `initials`) |
| P4-b Pref defaults | 64 (`usePrefValue`) |
| P4-c Href sweep | 20, for anything still hand-built |

Do these first when slots are free: P0-e (it contains the possible phone crash, finding 4), P0-b, P0-d and
P0-a, which are user-visible and have no builder overlap. Then P1-a, which holds finding 1, the bug that shows
"settled up" on an open balance.

## Status

- **P0-b Row menu core, built on `c-p0bf` (2026-10-31).** `components/RowMenu.tsx` (`useRowMenuTrigger`, `RowMenu`) replaces
  the Hide and Dispute row menus (`features/hidden/HideItem` `HideRow`, `features/disputes/RowMenu`), and `ActivityItem` now
  uses the same trigger (long-press on phone-width web, right-click and the Menu key on every row, not only requests).
  `GestureActionView` and `LaunchScreen` read `useShouldReduceMotion`. Not done, left to P1-d as listed: `CommentRow` keeps its
  own handlers (they already work at phone width; baselined by the `rowMenuGesture` architecture rule), and the other "..."
  triggers (finding 45). `useRowMenuTrigger` does not return `accessibilityActions`: the row render functions only hand over
  `onLongPress`, so a screen-reader action would need their signature changed.
- **P0-f Expense history and category, built on `c-p0bf` (2026-10-31).** `useCategoryLookup` / `useCategory` in
  `components/split/shared.tsx` name categories in the UI language (a gone id is the real Other); `CategoryTile` is the one tile
  (`EntryIcon` and Analytics' `CategoryIcon` draw it, so Analytics rows are rounded squares with the full glyph set);
  `historyKind` and a `titles` prop on `HistoryLine` serve the expense and payment pages (a later live version of a payment is
  "edited", no longer "restored"); Ask answers name categories in the UI language and a gone category is Other.
