# Bluesky and Expensify scouting: best of both, per feature (2026-10-27)

Owner rule: ARCHITECTURE § 26.1 "Best of both, per feature" (decision row 85): "make sure to pull features from Expensify and Bluesky whatever you think is better for user experience and features". For each feature this file compares the two apps, names the winner for Splito users and why, and records Splito's status. Expensify is the default reference for money and expense flows; Bluesky is the default for shell, navigation, social, lists, motion and client code. The visual language is always Bluesky's: an Expensify flow is rebuilt from Bluesky components, and no licensed artwork, icons or logos are copied.

The decisions are carried into `docs/BACKLOG.md`: 18 new features (16 in **Batch 4d**, F-1211 in Batch 13 and F-1412 in Batch 21) and 18 amended todo items. See [Decisions](#decisions).

## Sources

- **Bluesky:** `/Users/saransh/Desktop/Splito-Handoff/upstream/social-app`, commit `4e4ad9c` (2026-10-24). Paths below are relative to that root.
- **Expensify App:** the brief named `upstream/App`, but that folder does not exist (`upstream/` only holds `social-app`). This file uses the newest local full checkout instead: `/Users/saransh/Documents/Codex/2026-10-24/task/app-a60491fd`. It is not a git repo, so there is no commit hash. It is recent: it has GPS distance, odometer photos, Insights and the Submit plan. Paths are relative to the repo root, so they match a fresh clone. Key paths were checked to exist. **Before copying code, clone Expensify App into `upstream/App`** so reuse rows can cite a commit.
- **Splito:** `m1-foundation` docs at `2fccba3` (ARCHITECTURE § 26, BACKLOG, COMPLETION_MATRIX), and code on `integrate/wA` (`d297db2`, Wave A merged).

## Legend

- **Splito:** *built* = done or built on a branch; *F-xxx* = already planned in BACKLOG (todo); *NEW F-xxx* = added by this pass; *amend F-xxx* = existing item changed because the other app does it better; *excluded* = deliberately left out (reason given).
- **Winner:** EX = Expensify, BS = Bluesky, = = equivalent or Splito already goes further.
- **E** = effort (S/M/L), **I** = impact (1-10), **B** = needs backend (y/n).

## 1. Expensify inventory

### 1.1 Creating expenses and splits

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Global create menu with **Quick action** (repeat last action with the last person or group) | `src/pages/inbox/sidebar/FloatingActionButtonAndPopover.tsx`, `.../FABPopoverContent/menuItems/QuickActionMenuItem.tsx`, `src/libs/QuickActionUtils.ts` | FAB opens the composer only (`src/view/com/util/fab/`) | NEW F-235 | EX: one long-press reaches Scan, Record payment, Create group and "Add expense in Goa trip" without changing the tap behaviour § 26.6 fixes | S | 7 | n |
| Expense start tabs (Manual / Scan / Distance), last tab remembered | `src/pages/iou/request/IOURequestStartPage.tsx`, `CONST.TAB.IOU_REQUEST_TYPE` | none | amend F-501 | EX: scanning becomes a tab of the same Add expense sheet instead of a separate path | S | 6 | n |
| Step flow amount → participants → confirmation, same screens reused for edit | `src/pages/iou/request/step/IOURequestStepAmount.tsx`, `DynamicIOURequestStepParticipants.tsx`, `IOURequestStepConfirmation/` | composer | built (F-301/F-302 one-sheet composer) | = Splito's one-sheet composer with sentence defaults (F-314) is faster for friends; keep it | - | - | n |
| Big number pad replacing the OS keyboard, tappable currency symbol | `src/components/BigNumberPad.tsx`, `MoneyRequestAmountInput.tsx` | none | built (`components/split/AmountKeypad.tsx`, adapted from BigNumberPad) | EX, already taken; Splito adds the calculator column | - | - | n |
| Participant selector: recents, contacts, add any email/phone inline, selected-count footer | `src/pages/iou/request/MoneyRequestParticipantsSelector.tsx`, `ParticipantSelectorFooter.tsx` | `src/components/dialogs/SearchablePeopleList.tsx` | built (PeopleDialog) + F-617 big-group picker + F-602 contacts | = | - | - | n |
| Import phone contacts into the selector | `src/pages/iou/request/ImportContactButton/index.native.tsx`, `src/libs/ContactImport/` | Find contacts flow (`src/components/contacts/`) | F-602 (done in feat/friend-invites) | = | - | - | n |
| Split with custom per-person shares, auto-rebalance | `src/components/MoneyRequestConfirmationList/SplitBillController.tsx`, `src/libs/actions/IOU/Split.ts` | none | built (F-302: equal, exact, percent, shares, adjustments; F-401 itemize) | = Splito goes further (shares, itemize with portions; Expensify has amount only) | - | - | n |
| **Split an existing expense into several** (Amount / Percentage / Date range; "Make splits even") | `src/pages/iou/DynamicSplitExpensePage.tsx`, `DynamicSplitExpenseCreateDateRangePage.tsx`, `src/libs/SplitExpenseUtils.ts` | none | NEW F-319 | EX: one card charge or supermarket bill that is part personal, part flat, part trip becomes correct parts without re-typing; date-range split spreads an annual bill over months | M | 7 | n |
| **Track** a personal expense, share it later ("Submit to a friend", "Share it") / **move** expense | `src/pages/TrackExpensePage.tsx`, `src/libs/actions/IOU/TrackExpense.ts`, bulk "move" in `src/components/BulkActionBar/` | none | NEW F-318 | EX: logging first and deciding who shares later is how people really use it; Splito has personal expenses but no way to move one into a group or to a friend | S | 7 | n |
| Edit later: every field a tappable row that opens just that step; change posted as a system row ("changed amount from X to Y") | `src/components/ReportActionItem/MoneyRequestView.tsx`, `src/libs/ModifiedExpenseMessage.ts` | none (no post editing) | NEW F-321 + amend F-1204 | EX: fixing a date or category is one tap, not re-opening the whole form | S | 6 | n |
| Bulk edit many expenses | `src/pages/Search/SearchEditMultiple/`, `src/libs/actions/IOU/BulkEdit.ts` | none | F-1405 (amend) | EX: adopt its selection mode and action set | - | - | n |
| Inline cell editing on wide screens | `src/components/EditableCell`, `src/libs/actions/TransactionInlineEdit.ts` | none | F-1408 | = already planned | - | - | n |
| **Merge two expenses** (pick fields and receipt to keep) | `src/pages/TransactionMerge/`, `src/libs/MergeTransactionUtils.ts` | none | amend F-504 | EX: the natural end of a duplicate warning is a merge, not only "keep both" | - | - | n |
| Duplicate an expense | `src/libs/actions/IOU/Duplicate.ts` | none | F-309 | = | - | - | n |
| Expense-added growl with action | `src/components/ExpenseAddedGrowl.tsx` | composer success toast with View (`src/view/com/composer/Composer.tsx`) | built (Toast with action in `ExpenseComposer.tsx`) | BS toast component, already used | - | - | n |
| Send money / pay someone P2P with wallet and KYC | `src/libs/actions/IOU/SendMoney.ts`, `src/pages/EnablePayments/`, `src/components/KYCWall` | none | excluded (F-2223 sandbox stays) | regulated money movement; UPI hand-off (F-1103/F-1104) covers India | L | - | y |

### 1.2 Receipts and SmartScan

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Camera scan page with flash, gallery, permission prompt | `src/pages/iou/request/step/IOURequestStepScan/index.tsx`, `.../CameraPermission` | camera button in composer (`photos/OpenCameraBtn.tsx`) | F-501 | EX flow on Bluesky components | - | - | n |
| **Multi-scan** with thumbnail strip, remove, first-time explainer | `.../IOURequestStepScan/components/MultiScanContext.tsx`, `MultiScanEducationalModal.tsx`, `ReceiptPreviews` | gallery strip (`photos/Gallery.tsx`) | amend F-501 | EX: batch mode exists in F-501 but without the strip and explainer that make it usable | S | 7 | n |
| Skip-confirmation fast scan ("scan now, details later") | `.../components/ScanSkipConfirmation.tsx` | none | F-503 Review Inbox | = | - | - | n |
| **Scanning pending state** (shimmer "Receipt scanning…", fill fields meanwhile, retry on failure) | `src/libs/ReceiptUtils.ts`, `src/components/PulsingView.tsx`, `src/hooks/useRestartOnReceiptFailure.ts` | upload progress (`src/state/videoProgress.ts`) | amend F-502 | EX: OCR never blocks the user | S | 7 | n |
| Receipt viewer: zoom, pan, PDF, replace, download, crop | `src/pages/media/`, `src/components/MultiGestureCanvas`, `src/components/ReceiptCropView` | Lightbox: pinch zoom, swipe to dismiss, pager (`src/components/Lightbox/`) | amend F-312 | BS Lightbox for gestures and motion; EX actions (replace, download, PDF) | S | 6 | n |
| Receipt hover-zoom on web | `src/components/ReceiptHoverZoom/index.web.tsx` | none | amend F-312 | EX | S | 4 | n |
| Drag and drop / paste a receipt on web | `src/components/ReceiptScanDropZone/`, `src/hooks/useReceiptScanDrop.tsx` | composer "Drop to add images", paste (`text-input/TextInput.web.tsx`) | F-501 criterion 4 | = BS overlay component, EX drop targets | - | - | n |
| **E-receipts** (generated receipt image for expenses without a photo) | `src/components/EReceipt.tsx`, `DistanceEReceipt.tsx` | none | NEW F-1507 | EX: a shareable picture of one expense ("you owe me 450 for dinner") for WhatsApp; Splito's cards (F-1502) are summaries only | S | 6 | n |
| Receipt audit badge / consumer violations (missing category, receipt, future date, duplicate) | `src/components/ReceiptAudit.tsx`, `src/components/ViolationMessages.tsx` | none | F-311 anomaly guard, F-504, F-505 missing-receipt nudge | = | - | - | n |
| Forward receipts by email / SMS | `src/components/ReceiptAlternativeMethods.tsx` | none | F-2219 | = | - | - | y |
| Share into the app from other apps | `src/pages/Share/ShareRootPage.tsx` | `modules/Share-with-Bluesky`, `modules/expo-receive-android-intents` | F-509 | BS native modules, EX destination screen | - | - | n |

### 1.3 Expense types

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Distance with map waypoints, reorder, reuse previous route | `src/pages/iou/request/step/IOURequestStepDistanceMap.tsx`, `IOURequestStepReuseRoute.tsx` | none | amend F-709 | EX: km per rider from a route instead of typing | S | 4 | n |
| Odometer photos, live GPS tracking | `IOURequestStepDistanceOdometer.tsx`, `IOURequestStepDistanceGPS/` | none | excluded | background location and battery cost for a niche road-trip case; typed or routed km is enough | L | 3 | n |
| Per diem, time (hours × rate) | `IOURequestStepPerDiemWorkspace.tsx`, `IOURequestStepHours.tsx` | none | excluded | workspace-configured corporate types | - | - | - |

### 1.4 Fields, categories, rules

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Category picker with recents and inline create | `src/components/CategoryPicker`, `DynamicIOURequestStepCategoryCreate.tsx` | none | built (F-307) + F-1406 | = | - | - | n |
| Multi-level tags | `src/components/TagPicker`, `src/libs/TagUtils.ts` | none | F-1404 | = | - | - | n |
| Merchant, markdown description, date picker | `DynamicIOURequestStepMerchant.tsx`, `DynamicIOURequestStepDescription.tsx` | `forms/DateField` | built + F-514 merchant cleanup | = | - | - | n |
| Attendees, billable, reimbursable | `MoneyRequestAttendeeSelector.tsx`, `MoneyRequestConfirmationListFooter/fieldGroups` | none | participants built; F-1310 reimbursable | = | - | - | n |
| Tax on an expense: per-expense tax field and workspace tax rates | `MoneyRequestConfirmationListFooter/fieldGroups` (tax row), `src/pages/workspace/taxes` | none | F-401 (tax, tip, service, discount) and F-403 (being rewritten on m1-foundation as "Tax classes and scoped, stacked charges", decision row 86); not touched by this pass | = Splito's itemize adjustments already go further; Expensify's tax rates are workspace (corporate) config, so nothing to take | - | - | n |
| **Merchant rule suggestion banner** ("always use Food for Swiggy?") | `src/components/MerchantRuleSuggestionBanner.tsx`, `src/pages/settings/Rules` | none | amend F-516 | EX: rules get made at the moment of the edit, not in a settings screen | S | 6 | n |

### 1.5 Chat, comments, threads

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Every expense has a thread mixing comments and system changes | `src/pages/inbox/report/ReportActionsList.tsx`, `src/libs/ModifiedExpenseMessage.ts` | thread view (`src/screens/PostThread/`) | amend F-1204 (+ F-1202 history) | EX model (one timeline), BS rows and composer (§ 26.20) | - | 8 | n |
| Composer: markdown, emoji, @mentions, per-chat drafts | `src/pages/inbox/report/ReportActionCompose/`, `src/components/MentionSuggestions` | DM composer, `text-input/*/Autocomplete.tsx`, `src/state/messages/message-drafts.tsx` | F-1204 | BS (already the rule) | - | - | n |
| Edit / delete own comments, Up-arrow edits last | `ReportActionItemMessageEdit.tsx`, `.../useLastEditableAction.ts` | none (no edit) | F-1204 + amend F-1407 | EX | - | - | n |
| Long-press / right-click context menu, hover mini toolbar | `src/pages/inbox/report/ContextMenu/` | `src/components/ContextMenu/`, `dms/MessageContextMenu.tsx` | amend F-1204 | BS component (blurred iOS backdrop), EX action list (copy, edit, delete, react, copy link) | - | - | n |
| Emoji reactions with who-reacted list | `src/components/Reactions/`, `src/pages/inbox/report/ReactionList/` | `dms/EmojiReactionPicker.tsx`, `dms/ReactionsDialog.tsx` | amend F-1207 / F-2209 | BS picker and dialog; extend to comments and expenses (EX) | - | - | n |
| Thread replies to a comment | `ReportActionItemThread.tsx`, `RepliesDivider.tsx` | thread replies | excluded | one flat thread per expense is enough; nesting adds noise | - | - | - |
| Unread marker line, "New messages" jump counter | `src/components/UnreadActionIndicator.tsx`, `FloatingMessageCounter.tsx` | `dms/NewMessagesPill.tsx` | amend F-2208 | EX line + BS pill | S | 6 | y |
| Typing indicator | `ReportTypingIndicator.tsx` | none | excluded | real-time presence for low value; Bluesky also skips it | - | - | y |
| Group chats, rooms, trip rooms | `src/pages/NewChatPage/`, `TripChatNameEditPage.tsx` | group chats (`src/screens/Messages/`) | NEW F-1211 (group discussion, not chat) | both apps have it; Splito takes a group-level thread inside the group page, not a messenger | M | 5 | n (shared via F-2208) |
| Tasks in chat | `src/pages/tasks/` | none | excluded | F-809 shopping list and F-807 bills board cover household to-dos | - | - | - |
| Private notes per chat | `src/pages/PrivateNotes/` | none | F-1410 | = | - | - | n |
| Flag comment as offensive | `DynamicFlagCommentPage.tsx` | report flow (`moderation/ReportDialog/`) | excluded | private friend groups; F-1210 flags cover money disputes | - | - | - |

### 1.6 Hold, duplicates, violations

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| **Hold with required reason**, explainer, "Pay only" non-held | `src/pages/iou/DynamicHoldReasonPage.tsx`, `src/libs/actions/IOU/Hold.ts`, `ProcessMoneyReportHoldMenu.tsx` | none | amend F-1210 | EX: "don't count this until the refund lands" is common among friends; settle "without held" is the right default | S | 7 | n |
| **Review duplicates**: Keep all / Keep selected, then field-by-field resolve | `src/pages/TransactionDuplicate/`, `useReviewDuplicatesNavigation.tsx` | none | amend F-504 | EX: two people logging the same dinner offline is Splito's top sync collision | S | 8 | n |

### 1.7 Reports, payments, settling

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Report preview cards with thumbnail carousel | `src/components/ReportActionItem/MoneyRequestReportPreview/` | none | excluded | group page and right column already show recent expenses (F-208, F-224) | - | - | - |
| Pay / settle button with method dropdown and animated check | `src/components/SettlementButton/`, `AnimatedSettlementButton.tsx` | `src/components/anim/AnimatedCheck.tsx` | built (F-1101, F-1103) + F-1704 success check | = | - | - | n |
| Cancel payment with reason | `CONST.CANCEL_PAYMENT_REASONS` | none | built (repayment delete with history, F-1101 crit. 3) | = | - | - | n |
| Wallet, bank accounts, KYC | `src/pages/settings/Wallet/`, `src/components/KYCWall` | none | excluded | regulated; Splito never holds money | - | - | y |
| CSV statement import | `src/pages/settings/Wallet/ImportTransactionsSpreadsheetPage.tsx` | none | F-522 | = | - | - | n |
| Export CSV / PDF / share report / report QR | `src/libs/actions/Report/index.ts`, `ReportPDFDownloadModal.tsx` | export my data (`ExportCarDialog.tsx`) | F-2007, F-2001, F-1503 | = | - | - | n |
| Payment reminders | none (only KYC "sendReminder") | none | F-1118, F-1111, F-1119, F-2210 | Splito already ahead | - | - | - |

### 1.8 Multi-currency

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Currency picker with recents | `src/components/CurrencySelectionList`, `IOURequestStepCurrencyModal.tsx` | `src/components/Select` | built (F-1001) | = | - | - | n |
| Default payment currency | `src/pages/settings/Preferences/PaymentCurrencyPage.tsx` | none | built (`defaultCurrency`) | = | - | - | n |
| Locale symbol placement, server conversion | `src/libs/CurrencyUtils.ts` | none | F-1002..F-1011 (offline rates, card rate, trip rate book) | Splito ahead (offline FX) | - | - | n |

### 1.9 Search

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Search router (Cmd+K typeahead, recent searches) | `src/components/Search/SearchRouter/` | search history (`src/screens/Search/components/SearchHistory.tsx`) | built (F-222 Search & Ask drawer) | = | - | - | n |
| **Filter-syntax autocomplete** (`category:`, `from:`), negation | `src/components/Search/SearchAutocompleteList.tsx`, `src/libs/SearchAutocompleteUtils.ts` | none | amend F-1402 | EX: operators are discoverable while typing instead of memorised | S | 6 | n |
| Type menu with suggested to-do searches | `src/pages/Search/SearchTypeMenuWide.tsx` | none | amend F-1403 | EX built-in views ("Unsettled with me", "Missing receipts", "On hold", "Possible duplicates") | S | 6 | n |
| Advanced filters page | `src/pages/Search/SearchAdvancedFiltersPage` | `Search/components/AdvancedSearchDialog/` | built (F-206 filters) + F-1402 | = | - | - | n |
| Natural-language filter | `src/pages/Search/SearchNLFilterPage.tsx` | none | F-2301 Ask Splito | = | - | - | n |
| Saved searches (save, rename, delete) | `src/pages/Search/SearchSavePage.tsx`, `SavedSearchList.tsx` | saved feeds (`src/screens/SavedFeeds.tsx`) | F-1403 + NEW F-1412 | EX save flow + BS pin-as-tab | - | - | n |
| Column chooser, sortable columns | `src/pages/Search/SearchColumnsPage.tsx` | none | F-1408 | = | - | - | n |
| **Selection mode and bulk actions** (hold, move, merge, split, duplicate, delete, export) | `src/components/BulkActionBar/`, `src/libs/actions/MobileSelectionMode.ts` | none | amend F-1405 | EX | - | - | n |
| Charts / Insights with drill-down | `src/components/Search/SearchChartView.tsx`, `src/pages/Insights/` | none | F-1301, F-1303 (tap a segment) | = | - | - | n |

### 1.10 Navigation, inbox, attention

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Inbox All / To-do / Unread tabs | `src/pages/inbox/sidebar/InboxTabSelector.tsx` | notification filter pills (`Notifications/components/TabPills.tsx`) | NEW F-229 + F-1212 | EX concept, BS pills | - | - | n |
| **Priority mode "Most recent" vs "Focus"** | `src/pages/settings/Preferences/PriorityModePage.tsx`, `src/libs/SidebarUtils.ts` | none | NEW F-229 | EX: with 30 friends and 12 groups, Focus shows only what is unsettled or changed | M | 7 | n |
| **GBR / RBR attention dots**, bold unread rows | `src/components/LHNOptionsList/OptionRowLHN`, `src/libs/ReportAttributesUtils.ts` | unread dot on notifications | NEW F-229 | EX: rows say "needs you" (green) or "something failed" (red) with text, never colour alone | - | - | n |
| Mark all as read (Shift+Esc) | `CONST.KEYBOARD_SHORTCUTS.MARK_ALL_MESSAGES_AS_READ` | none | built (Activity header) + amend F-1407 | EX shortcut | - | - | n |
| **Home "For you" to-dos**, Recently added, Your spend | `src/pages/home/HomePage.tsx`, `src/pages/home/ForYouSection` | none | NEW F-230 | EX: one card says what to do next (settle with Riya, 2 scans to confirm, rent due) | M | 8 | n |
| Concierge side panel | `src/components/SidePanel/` | none | F-2301 Ask Splito | = | - | - | n |
| Deep links | `src/libs/actions/Link.ts` | `src/routes.ts`, `src/lib/hooks/useIntentHandler.ts` | built (routes) | BS | - | - | n |

### 1.11 Onboarding and education

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| **Purpose picker** ("Split with friends", "Track personal spend"…) | `src/pages/OnboardingPurpose/BaseOnboardingPurpose.tsx` | interests step (`src/screens/Onboarding/`) | amend F-211 | EX: one question (Trip / Flat / Couple / Friends / Just me) sets defaults and the first group template | S | 7 | n |
| **Guided setup tasks** checked off automatically | `src/libs/buildOnboardingMessages.ts`, `src/libs/actions/Onboarding.ts`, `src/pages/home/GettingStartedSection` | ProgressGuide (`src/components/ProgressGuide/`) | NEW F-231 | BS card, toasts and animated check; EX task list (add friend, first expense, group, settle, UPI handle) | S | 7 | n |
| Test drive with demo receipt | `src/components/TestDrive/` | none | F-218 sample group | = | - | - | n |
| **Product-training tooltips** anchored to the element, shown once | `src/components/ProductTrainingContext/TOOLTIPS.ts` | NUX queue with 3 h snooze (`src/components/dialogs/nuxs/index.tsx`, `src/state/queries/nuxs/`) | amend F-219 | both: EX anchored tooltips for "tap here", BS queue so only one announcement shows and the rest wait | S | 6 | n |
| Feature-training modals, welcome modals | `src/components/FeatureTraining/` | `src/components/dialogs/nuxs/*Announcement*` | amend F-219 | BS | - | - | n |
| Proactive store-review prompt | `src/components/ProactiveAppReviewModalManager.tsx` | none | F-1913 | = | - | - | n |

### 1.12 Offline, feedback, polish

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Optimistic UI, pending greyed rows, failed rows with retry / dismiss | `src/components/OfflineWithFeedback.tsx`, `DotIndicatorMessage.tsx` | shadows + toggle queue (`src/state/cache/post-shadow.ts`, `src/lib/hooks/useToggleMutationQueue.ts`) | decision row 79 per-row `syncStatus`, F-223, F-2109 | = Splito is local-first; failed sync goes to Needs attention | - | - | y |
| Offline banner | `src/components/OfflineIndicator.tsx` | network status (`src/state/session/network.ts`) | F-223 avatar dot | = the dot replaces a banner (§ 26.7) | - | - | n |
| Skeleton loaders | `src/components/Skeletons/`, `OptionsListSkeletonView.tsx` | `src/components/Skeleton.tsx` | built (Skeleton, ComposerSkeleton, activity LoadingSkeleton) | BS | - | - | n |
| Lottie animations, confirmation page, celebrations | `src/components/LottieAnimations/`, `src/components/ConfirmationPage/` | splash outro, CountWheel, AnimatedCheck | F-1704, F-1208 "All square" | EX page illustrations (own art, never theirs), BS micro-motion | - | - | n |
| Haptics and sounds | `src/libs/HapticFeedback`, `src/libs/Sound` | `src/lib/haptics/index.ts` | built (`lib/haptics`) + F-1705 | BS (intent-named) | - | - | n |
| Keyboard shortcuts page (Cmd+J) | `src/pages/settings/DynamicKeyboardShortcutsPage.tsx`, `CONST.KEYBOARD_SHORTCUTS` | `n`, `/` hotkeys (`src/lib/hotkeys/index.tsx`) | amend F-1407 | both | - | - | n |
| Accessibility: focus management, high contrast | `src/libs/Accessibility/`, `HighContrastModeSwitcher.tsx` | `src/state/a11y.tsx`, `FocusScope` | F-1806, F-1815 | = | - | - | n |

### 1.13 Profile, settings, growth

| Feature | Expensify path | Bluesky equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Custom status with clear-after | `src/pages/settings/Profile/CustomStatus/` | live-now ring (`src/features/liveNow/`) | excluded | social presence with no money value | - | - | - |
| Profile basics, pronouns, timezone, avatar crop | `src/pages/settings/Profile/` | edit profile dialog, avatar creator | F-214 (amend), F-1701 timezone | BS avatar creator | - | - | n |
| Contact methods, 2FA, merge accounts | `src/pages/settings/Profile/Contacts/`, `src/pages/settings/Security/` | 2FA, app passwords | F-2102, F-2212, F-2215 | = later backend | - | - | y |
| Per-chat notification preference (immediately / daily / mute) | `src/pages/settings/Report/DynamicNotificationPreferencePage.tsx` | per-type matrix (`src/screens/Settings/NotificationSettings/`) | amend F-2202 | both: BS per-type push/in-app matrix + EX per-group mode | - | 7 | y |
| **Troubleshoot** (clear cache, export state, debug) | `src/pages/settings/Troubleshoot/TroubleshootPage.tsx` | About: system log, clear image cache (`src/screens/Settings/AboutSettings.tsx`) | NEW F-236 | EX for a local-first app where support can't see the server: export diagnostics, rebuild projections | S | 5 | n |
| QR code share (profile, chat) | `src/pages/ShareCodePage.tsx`, `src/components/QRShare/` | themed invite QR card + scanner (`src/features/inviteFriends/`) | F-619 done + NEW F-620 | BS themes, save to Photos, in-app scanner | M | 6 | n |
| Referral program | `src/components/ReferralProgramCTA.tsx` | invite friends announcement | excluded | growth marketing, no user value before launch | - | - | - |
| Workspace invite / join page | `src/pages/workspace/WorkspaceJoinUserPage.tsx` | group chat join links (`src/state/queries/join-links.ts`) | F-619, F-2105 | = | - | - | y |

### 1.14 Corporate and enterprise (excluded)

Workspaces and roles (`src/pages/workspace/`), approval chains (`src/libs/WorkflowUtils.ts`), workspace rules (`src/pages/workspace/rules`), accounting integrations (`src/pages/workspace/accounting`), company cards and Expensify Card (`src/pages/workspace/companyCards`, `expensifyCard`), travel booking (`src/pages/Travel`), invoices (`src/libs/actions/IOU/SendInvoice.ts`), business reimbursement accounts, per-diem / tax / report-field config, subscription, Copilot, domains and SAML. None help friends, flats or trips beyond what Splito already plans (F-1310 reimbursable claims covers the one personal use).

## 2. Bluesky inventory

### 2.1 Composer and drafts

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| **Drafts list** with Save draft / Keep editing / Discard on close | `src/view/com/composer/drafts/DraftsButton.tsx`, `DraftsListDialog.tsx`, `DraftItem.tsx`, `drafts/state/` | one draft per chat | NEW F-320 (F-302 keeps one draft) | BS: closing a half-done expense saves it instead of losing it or forcing a choice; several drafts for a busy trip day | S | 7 | n |
| Character counter ring | `char-progress/CharProgress.tsx` | exceeded-length warning | excluded | titles and notes rarely hit limits | - | - | - |
| Thread of several posts ("Add another") | `Composer.tsx`, `state/composer.ts` | none | F-309 Save and add another | = | - | - | n |
| Success toast with View | `Composer.tsx` | ExpenseAddedGrowl | built | BS | - | - | n |
| Image picker, camera, crop, alt text, require alt text | `photos/Gallery.tsx`, `photos/ImageAltTextDialog.tsx` | receipt crop | amend F-312 (alt text) | BS | S | 4 | n |
| Web paste and drag-drop overlay; Cmd/Ctrl+Enter submits | `text-input/TextInput.web.tsx` | ReceiptScanDropZone | F-501 crit. 4 + amend F-1407 | BS | - | - | n |
| @mention autocomplete, emoji picker | `text-input/*/Autocomplete.tsx`, `src/components/EmojiPicker/` | MentionSuggestions | F-1204 | BS | - | - | n |
| GIF picker, link cards, content labels, threadgate, language suggestion | `src/features/gifPicker/`, `ExternalEmbed.tsx`, `labels/`, `threadgate/`, `SuggestedLanguage.tsx` | link previews | excluded (link previews in F-2216) | social-only | - | - | - |

### 2.2 Threads and activity

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Thread view, inline reply prompt, tombstones | `src/screens/PostThread/` | report thread | F-1204 | BS rows (§ 26.20) | - | - | n |
| Hide reply, mute thread | `src/state/threadgate-hidden-replies.tsx`, `src/state/cache/thread-mutes.tsx` | mute chat | NEW F-1212 (mute a group or person in Activity) | BS | - | - | n |
| **Grouped notification rows** ("alice and 3 others") with expandable avatar stack | `src/screens/Notifications/components/NotificationItem/Item/`, `src/state/queries/notifications/grouped/` | none | NEW F-1212 | BS: a 12-expense import or a busy trip day reads as one row | M | 6 | n |
| Filter tabs as scrollable pills | `Notifications/components/TabPills.tsx` | Inbox tabs | NEW F-1212 (F-1201 has All / From others) | BS | - | - | n |
| Seen snapshot, "Load new" pill | `Notifications/index.tsx` (`useSessionSeenAt`), `components/RefreshPill.tsx`, `src/components/NewPostsPill/` | FloatingMessageCounter | NEW F-1212 + amend F-2208 | BS | - | - | n |
| Unread badge synced across web tabs | `src/state/queries/notifications/unread.tsx`, `src/lib/broadcast/` | UnreadIndicatorUpdater | built (F-202) + F-110 | = | - | - | n |
| Per-type notification settings (push vs in-app) | `src/screens/Settings/NotificationSettings/` | per-chat preference | amend F-2202 | both | - | - | y |
| "Keep me posted" subscriptions to one account | `src/components/activity-notifications/` | none | excluded | per-group notify mode (F-2202) covers it | - | - | - |

### 2.3 Moderation analogues

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Hide post for me, mute account | `src/components/PostControls/PostMenu/PostMenuItems.tsx`, `src/state/preferences/hidden-posts.tsx` | mute chat | built (Activity hide, F-1201) + NEW F-1212 mute | BS | - | - | n |
| Muted words, block, report, mod lists, content warnings | `src/components/dialogs/MutedWords.tsx`, `src/components/moderation/` | flag comment | excluded | public-network safety tools; Splito groups are private (F-1609 hides personal items) | - | - | - |

### 2.4 Profile and people

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Profile header with pull-to-stretch avatar | `src/screens/Profile/Header/` | none | built (Person / Group headers, F-207 / F-208) | BS | - | - | n |
| Edit profile dialog, discard on unsaved changes | `Profile/Header/EditProfileDialog.tsx` | profile pages | built (§ 26.8 "Discard changes?") | BS | - | - | n |
| **Avatar creator** (emoji + colour) | `src/screens/Onboarding/StepProfile/AvatarCreatorItems.tsx`, `AvatarCreatorCircle.tsx` | default avatars | amend F-214 | BS: friends without photos get a recognisable face in two taps | S | 5 | n |
| Known followers, suggested follows | `src/components/KnownFollowers.tsx`, `Profile/Header/SuggestedFollows.tsx` | none | excluded | social graph; "Friends already on Splito" is F-2217 | - | - | - |
| Profile tabs with empty-state CTAs | `src/view/com/pager/PagerWithHeader.tsx` | none | built (F-203, F-210) | BS | - | - | n |
| Pinned post | `src/state/queries/pinned-post.ts` | pin chat | F-611 pinned group note, F-221 pin | = | - | - | n |
| **Hover cards** on web (500 ms open, 150 ms close) | `src/components/ProfileHoverCard/index.web.tsx` | none | NEW F-234 | BS: on desktop, hovering a name shows the balance and Settle / Add expense without leaving the list | S | 5 | n |

### 2.5 Search

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Recent searches and profiles with remove and Clear all | `src/screens/Search/components/SearchHistory.tsx` | recent searches | built (F-222 drawer recents) | BS | - | - | n |
| Result tabs, advanced dialog, explore modules | `src/screens/Search/SearchResults.tsx`, `AdvancedSearchDialog/`, `Explore.tsx` | Search page | built (grouped results) + F-1402 | = | - | - | n |
| SearchInput, searchable people picker | `src/components/forms/SearchInput.tsx`, `src/components/dialogs/SearchablePeopleList.tsx` | participant selector | built | BS | - | - | n |

### 2.6 Feel: haptics, gestures, lists

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Intent-named haptics | `src/lib/haptics/index.ts` | HapticFeedback | built + F-1705 | BS | - | - | n |
| **Swipe actions on list rows** with threshold haptic | `src/lib/custom-animations/GestureActionView.tsx`, `src/screens/Messages/components/ChatListItem.tsx` | none | NEW F-232 (Activity rows only today) | BS: swipe a friend to Settle or Remind, an expense to Delete or Duplicate | M | 7 | n |
| Swipe to reply | `src/components/dms/SwipeToReply.tsx` | none | excluded | flat comment thread has no reply target | - | - | - |
| Full-screen swipe back, drawer swipe, pager swipe | `src/Navigation.tsx`, `src/view/shell/index.tsx`, `src/view/com/pager/Pager.tsx` | none | built (F-201, F-203) | BS | - | - | n |
| Pull to refresh | `src/view/com/util/List.tsx` | none | NEW F-233 | BS: refreshes rates and, once signed in, syncs; honest "Up to date" when nothing to do | S | 5 | n |
| **Tap the active tab to scroll to top** | `emitSoftReset` in `src/view/shell/bottom-bar/BottomBar.tsx`, `src/state/events.ts` | none | NEW F-233 | BS: muscle memory from every social app | S | 5 | n |
| "New posts" pill with facepile | `src/components/NewPostsPill/` | FloatingMessageCounter | NEW F-1212 / amend F-2208 | BS | - | - | n |
| Header and bottom bar hide on scroll | `src/state/shell/minimal-mode.tsx` | none | built (§ 26.4, decision 81) | BS | - | - | n |
| Scroll restoration, anchor correction | `src/lib/hooks/useWebScrollRestoration.ts`, `src/features/followingV2/home/anchorCorrection.ts` | none | F-116 web robustness | BS | - | - | n |
| Drag-to-reorder lists | `src/components/DraggableList/` | none | built (Settings > Navigation) + F-221 | BS | - | - | n |

### 2.7 Building blocks

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Toasts with Undo / View | `src/components/Toast/` | growl | built | BS | - | - | n |
| Prompt, Dialog, Menu, ContextMenu, Select, Tooltip, Admonition | `src/components/Prompt.tsx`, `Dialog/`, `Menu/`, `ContextMenu/`, `Tooltip/` | modals | built (Prompt, Dialog, Menu, Admonition, FormSheet) | BS | - | - | n |
| Policy update overlay, logged-out welcome modal | `src/components/PolicyUpdateOverlay/`, `WelcomeModal.tsx` | welcome modals | excluded | no account is needed to use Splito; policy changes go through F-215 | - | - | - |

### 2.8 Onboarding, auth, accounts

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Onboarding steps with direction-aware slide, persisted step | `src/screens/Onboarding/index.tsx`, `src/components/ScreenTransition.tsx` | purpose picker | F-211 (amend) | BS mechanics + EX purpose question | - | - | n |
| **ProgressGuide** card + milestone toasts | `src/state/shell/progress-guide.tsx`, `src/components/ProgressGuide/` | GettingStartedSection | NEW F-231 | BS | - | - | n |
| **NUX queue** (one dialog, server record, 3 h snooze) | `src/components/dialogs/nuxs/index.tsx`, `src/state/queries/nuxs/` | ProductTrainingContext | amend F-219 | BS | - | - | n |
| Signup and login screens | `src/screens/Signup/`, `src/screens/Login/` | sign-in pages | built (F-225, Wave A) | BS (decision 65) | - | - | n |
| Multiple accounts and switcher | `src/components/dialogs/SwitchAccount.tsx` | none | F-2229 | BS | - | - | y |
| Email verification nudge | `src/state/shell/reminders.ts` | contact method validation | F-2102 | = | - | - | y |
| Find contacts: OTP, matches, invite by SMS | `src/components/contacts/FindContactsFlow.tsx` | ImportContactButton | F-602, F-618, F-2217 | = | - | - | y |
| Age assurance | `src/ageAssurance/` | none | excluded | legal requirement for a public network only | - | - | - |

### 2.9 Sharing and invites

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| **Themed QR card** (6 themes), Save QR to camera roll, Copy link | `src/features/inviteFriends/InviteFriendsDialogInner.tsx`, `themes.ts`, `components/ThemedQrCard.tsx` | ShareCodePage | NEW F-620 | BS | M | 6 | n |
| **In-app QR scanner** | `src/features/inviteFriends/InviteScannerScreen.tsx` | none | NEW F-620 | BS: scan a friend's invite or a UPI QR to save their handle without leaving the app | - | - | n |
| Starter packs (shareable curated set of people) | `src/components/StarterPack/`, `src/screens/StarterPack/` | none | F-606 group templates, F-612 duplicate group | = | - | - | n |
| Share menu (copy link, share sheet, send to recent chat) | `src/components/PostControls/ShareMenu/` | share report | built (`lib/sharing.ts`) | BS | - | - | n |
| Share extension, App Clip, Android intents | `modules/Share-with-Bluesky`, `modules/BlueskyClip`, `modules/expo-receive-android-intents` | ShareRootPage | F-509, F-2218 | BS modules | - | - | n |

### 2.10 Chat analogues

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Message reactions, who reacted, context menu, date dividers | `src/components/dms/` | Reactions, ContextMenu | amend F-1204, F-1207 | BS components | - | - | n |
| Group chat invite modes, join requests | `src/screens/Messages/JoinRequests.tsx`, `components/InviteLinkDialog.tsx` | workspace join | built (F-619 "approve each join") | = | - | - | n |
| Pending send queue with batch retry | `src/state/messages/convo/agent.ts` | OfflineWithFeedback | amend F-2208 | BS | - | - | y |

### 2.11 Settings, accessibility, language, web, motion

| Feature | Bluesky path | Expensify equivalent | Splito | Winner and why | E | I | B |
|---|---|---|---|---|---|---|---|
| Settings structure (Account, Privacy, Notifications, Appearance, Accessibility, Languages, About) | `src/screens/Settings/Settings.tsx` | Preferences, Profile, Security | built (F-1701) | BS | - | - | n |
| Appearance: colour mode, Dim / Dark, font, size | `src/screens/Settings/AppearanceSettings.tsx` | theme | built (F-1701), F-1710 font | BS | - | - | n |
| Accessibility: require alt text, larger badges, disable haptics | `src/screens/Settings/AccessibilitySettings.tsx` | high contrast | F-1704 `haptics` pref, F-1806, amend F-312 | BS | - | - | n |
| **AppLanguageDropdown** on web splash, signup, logged-out nav card, right column | `src/components/AppLanguageDropdown.tsx`; rendered in `src/view/com/auth/SplashScreen.web.tsx:186`, `src/screens/Signup/index.tsx:226`, `src/view/shell/NavSignupCard.tsx:69`, `src/view/shell/desktop/RightNav.tsx:152` | language page only | NEW F-1816 | BS: a visitor picks Hindi before reading a single form; Splito has the language only in Settings and onboarding | S | 7 | n |
| Language settings (app, primary, content languages) | `src/screens/Settings/LanguageSettings.tsx` | `src/pages/settings/Preferences/` | built (F-1810) | = | - | - | n |
| App icon picker | `src/screens/Settings/AppIconSettings/` | none | F-1707 | BS | - | - | n |
| Export my data, deactivate, delete account | `src/screens/Settings/components/ExportCarDialog.tsx`, `DeleteAccountDialog.tsx` | close account | F-2001, F-2213 | = | - | - | n |
| Web hotkeys `n` (new) and `/` (search), disabled under dialogs | `src/lib/hotkeys/index.tsx` | KEYBOARD_SHORTCUTS | amend F-1407 | both | - | - | n |
| Saved / pinned feeds become reorderable home tabs | `src/screens/SavedFeeds.tsx`, `src/view/com/pager/` | saved searches | NEW F-1412 | BS: pin "Goa trip" or "Unsettled" as a Home tab next to Friends | M | 5 | n |
| Bookmarks with Undo | `src/screens/Bookmarks.tsx` | none | F-316 favourites | = | - | - | n |
| Lightbox | `src/components/Lightbox/` | receipt viewer | amend F-312 | BS | - | - | n |
| RightNav footer links | `src/view/shell/desktop/RightNav.tsx` | none | built in LeftNav (§ 26.3) | = | - | - | n |
| CountWheel, animated icons, PressableScale, splash outro | `src/lib/custom-animations/CountWheel.tsx`, `PressableScale.tsx`, `src/Splash.tsx` | payment animations | F-1704, F-1711 | BS | - | - | n |
| Relative time ticking each minute, compact counts | `src/lib/hooks/useTimeAgo.ts`, `src/view/com/util/numeric/format.ts` | none | built (Activity), F-1010 compact amounts | BS | - | - | n |
| Inline translation | `src/lib/translation/` | none | excluded | comments between friends who share a language; F-1111 drafts reminders in the friend's language | - | - | - |
| Live now, interests, trending, feature flags | `src/features/liveNow/`, `src/lib/interests.ts`, `src/analytics/` | none | excluded | social or ops-only | - | - | - |

## Decisions

### New features (all front end; Batch 4d unless noted)

| ID | Title | Source | E | I |
|---|---|---|---|---|
| F-230 | "For you" to-do card on Home and the right column | EX | M | 8 |
| F-1816 | App language dropdown on web splash, sign-up and right column | BS | S | 7 |
| F-235 | FAB long-press quick menu with Quick action | EX | S | 7 |
| F-318 | Move an expense to another group, friend or non-group | EX | S | 7 |
| F-320 | Drafts: several unfinished expenses, Save draft on close | BS | S | 7 |
| F-231 | Getting started checklist with milestone toasts | BS + EX | S | 7 |
| F-229 | Focus mode and attention markers on Home and Groups | EX | M | 7 |
| F-232 | Swipe actions on friend, group and expense rows | BS | M | 7 |
| F-319 | Split one expense into several | EX | M | 7 |
| F-321 | Edit one field from the expense page | EX | S | 6 |
| F-1507 | Expense image card (e-receipt) | EX | S | 6 |
| F-620 | Themed invite QR card, Save to Photos, in-app QR scanner | BS | M | 6 |
| F-1212 | Grouped Activity rows, filter pills, new-items pill, mute | BS | M | 6 |
| F-233 | Tap the active tab to scroll to top; pull to refresh | BS | S | 5 |
| F-234 | Hover cards for people and groups on web | BS | S | 5 |
| F-236 | Troubleshoot: diagnostics, repair and caches | EX + BS | S | 5 |
| F-1211 | Group discussion thread (Batch 13) | EX + BS | M | 5 |
| F-1412 | Pin saved views and groups as Home tabs (Batch 21) | BS | M | 5 |

### Amended existing items (todo items only; done items got new features instead)

F-211 (EX purpose picker; hands off to F-231), F-219 (BS NUX queue + EX anchored tooltips), F-214 (BS avatar creator), F-312 (BS Lightbox, EX viewer actions and hover zoom, alt text), F-501 (EX scan tab and multi-scan strip), F-502 (EX scanning state), F-504 (EX review duplicates and merge), F-516 (EX rule suggestion banner), F-709 (EX route of stops), F-1204 (EX one timeline, BS/EX context menu, BS date dividers), F-1207 (reactions on comments and expenses, who reacted), F-1210 (EX hold with reason), F-1402 (EX operator autocomplete, negation), F-1403 (EX built-in to-do views), F-1405 (EX selection mode and action bar), F-1407 (BS `n`, EX Cmd+J, Shift+Esc, Cmd+Enter, Up arrow), F-2202 (BS per-type matrix + EX per-group mode), F-2208 (EX unread line, BS new-comments pill and send queue).

### Deliberately excluded

Listed with reasons in the tables above: Expensify P2P send money, wallet and KYC; odometer and GPS tracking; per diem and time; report preview carousels; nested comment replies; typing indicators; tasks; flag as offensive; custom status; referral; every corporate feature in § 1.14. Bluesky character counter; GIF picker, link cards, labels, threadgate, language suggestion; swipe to reply; "keep me posted" subscriptions; muted words, block, report, mod lists, content warnings; known followers and suggested follows; policy overlay and welcome modal; age assurance; inline translation; live now, interests, trending.
