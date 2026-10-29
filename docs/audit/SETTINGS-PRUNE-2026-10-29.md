# Settings prune audit (F-251), 2026-10-29

Auditor: Opus. Branch `integrate/wB`. Rule: ARCHITECTURE § 26.1 "Customizable where it helps, never forced"
(owner 128): a setting exists only where people genuinely want different answers; no row for a detail nobody
changes, no switch that duplicates another control, no row just to hide a small UI element; every choice that
does exist is remembered (decision 90).

Sources read: `packages/sync/src/preferences.ts` (registry), `apps/client/src/components/settings/prefControls.tsx`,
`components/settings/sections.ts`, `screens/Settings/index.tsx`, `screens/Settings/SettingsSection.tsx`,
`screens/FriendsAndInvites/index.tsx`, ARCHITECTURE § 26 and decision log § 26.23 (rows 1-128). Compared with
Bluesky (`src/screens/Settings`: Appearance = Color mode, Dark theme, Font, Font size; Accessibility = Haptics,
alt text; no density, no swipe or list options) and Expensify (`src/pages/settings/Preferences`: notifications,
sounds, priority mode, language, payment currency, theme; nothing about split modes, keypads or rounding).

## Summary

| | Before | After |
|---|---|---|
| Registry keys | 60 | 44 (16 retired) |
| Controls rendered in Settings sections | 48 (+2 conditional sub-rows: Dark mode style, Round to) | 22 (+1 sub-row: Dark mode style) |
| Settings sections (pref pages) | 9 | 7 |
| Friends and invites "defaults" block | 6 rows (all 6 also rendered on Privacy) | 5 rows, rendered only there |

Verdicts: **keep** 28 keys with a row (6 of them move page), **keep (no row)** 9 keys that are remembered state
set where they act (`bill.merchantSetups` loses its row), **merge** 7 keys (key stays, Settings row goes; the
in-place control remembers it), **remove** 16 keys (key, row, reads and tests retired; the default below becomes
a constant). 28 + 9 + 7 + 16 = 60.

Sections after the prune, in order:

1. **Appearance**: Color mode (+ Dark mode style), Accent colour, Text size, Money colours, Animations, Haptics
   (Motion and haptics merged in; Bluesky splits these over Appearance and Accessibility, one page is enough at 6 rows).
2. **Navigation**: Bottom bar, Open on.
3. **Defaults**: Default currency, New bills start with, Tax classes.
4. **Categories**: the categories editor.
5. **Language and region**: Language, Timezone, Week starts on, Date format, Number format.
6. **Notifications**: New expenses, Payments, Invites, Reminders I set.
7. **Privacy**: Find me by email or phone, a "Friends and invites" link (replaces "Manage invite links"), the privacy text.

Gone as sections: **Motion and haptics** (merged into Appearance), **Sorting and filters** (every row merged into
its list's own filter or removed). Old URLs `/settings/motion` and `/settings/lists` must redirect (to
`/settings/appearance` and `/settings`) rather than show "This settings page doesn't exist" (owner 100: a copied
link lands somewhere sensible).

Merges need the in-place control to write the key first (decision 90, F-1413), otherwise removing the row would
lose the only way to persist the choice. Gate each merge on that write: `analyticsView` already does
(`screens/Analytics/index.tsx:51`), `itemizeAdjustmentModes` already does (`ExpenseComposer.tsx:116,540`); the
People filter, the Analytics period chip and the expense's round control do not yet.

Retiring a key is safe for old stored values: `prefFrom` only reads known keys, and `resetAllPrefs` skips rows
without a definition (`Object.hasOwn(PREFS, p.id)`). Device mirrors in `apps/client/src/storage/schema.ts` and
`state/preferences/mirror.tsx` must drop the same keys.

## Registry keys and their Settings rows

Legend: Row = the control in `PREF_CONTROLS` (null = no Settings row). Owner = decision-log row or § 26 rule
that names it (kept on that ground alone).

| # | Key | Section today | Row | Verdict | Reason | Owner | Default after / code to retire |
|---|---|---|---|---|---|---|---|
| 1 | `theme` | Appearance | Color mode | keep | People differ; named in § 26.1's list. | § 26.1 (row 128) | - |
| 2 | `darkTheme` | Appearance | Dark mode style (under Color mode) | keep | Owner chose Dim default with Black as the option. | row 38, § 26.11 | - |
| 3 | `accent` | Appearance | Accent colour | keep | Owner: accent changes recolour the logo; emerald is an optional accent. | row 49, § 26.11 | - |
| 4 | `textScale` | Appearance | Text size | keep | Accessibility; Bluesky's Font size. | - | - |
| 5 | `density` | Appearance | List density | **remove** | Small layout detail; neither Bluesky nor Expensify offers it. | - | `comfortable` (rows `a.py_md`). Retire `state/preferences/density.ts` (`useRowPadding` -> `a.py_md` in `screens/Groups/components/GroupRow.tsx`, `screens/People/components/PersonRow.tsx`, `components/activity/ActivityItem.tsx`), `state/preferences/mirror.tsx:49,72`, `storage/schema.ts:21`, `packages/sync/test/preferences.test.ts` |
| 6 | `moneyPalette` | Appearance | Money colours | keep | Colour vision genuinely differs; colour-blind and mono palettes are an accessibility need. | - | Shorten wording (see below). |
| 7 | `motion` | Motion | Animations | keep, **move** to Appearance | Named in § 26.1 and § 26.10. | § 26.1, § 26.10 | group `appearance` |
| 8 | `haptics` | Motion | Haptics | keep, **move** to Appearance | Bluesky offers it (Accessibility > Haptics); some people dislike vibration. | - | group `appearance` |
| 9 | `shakeToFeedback` | Motion | Shake to send feedback | **remove** | Default off, phones only, duplicates Send feedback in Settings and the drawer; assistant's spec line, not an owner ask. | - (row 53 asked for feedback, not shake) | no shake. Retire `features/feedback/FeedbackProvider.tsx:22,30`, `features/feedback/useShake.ts`, `useShake.web.ts`, `packages/sync/test/feedback.test.ts`, `e2e/feedback.spec.ts:142`; drop the last sentence of § 26.15 Feedback |
| 10 | `feedback.includeAppInfo` | Privacy | none | keep (no row) | Remembers the Send feedback sheet's switch where it acts. | decision 90 | - |
| 11 | `tabs` | Navigation | Bottom bar editor | keep | Owner asked for it. | rows 70, 84, 127 | - |
| 12 | `homeTab` | Navigation | Open on | keep | Named in § 26.1's list ("home tab"). | § 26.1 (row 128) | Drop the redundant description. |
| 13 | `defaultCurrency` | Defaults | Default currency | keep | Named in § 26.1's list. | § 26.1 (row 128) | - |
| 14 | `itemizeAdjustmentModes` | Defaults | Itemize charges | **merge** into the bill's Amount / % toggle | The toggle on each charge already writes it (`ExpenseComposer.tsx:116,540`); the row duplicates that control. | row 41 asked for the toggle, § 26.13 | key stays; delete `ItemizeChargesPref` |
| 15 | `defaultSplitMode` | Defaults | Default split | **remove** | Equal is the start everywhere (Splitwise, Expensify); the split chips are one tap away. | - | `equal`. Retire `screens/AddExpense.tsx:39` and the `mode` it passes on |
| 16 | `split.roundCash` | Defaults | Round shares to cash | **merge** into the expense's round control | The split editor already has a per-expense round control (`SplitEditor.tsx:221`); it should remember on/off for the next expense instead of a Settings switch. | - | key stays, written by the round control; delete `RoundCashPref` |
| 17 | `split.roundTo` | Defaults | Round to (sub-row) | **merge** into the expense's round control | Same control picks the unit; remember it per currency there. | - | key stays, written per currency by the round control; delete `RoundToPref` |
| 18 | `amount.keypad` | Defaults | Amount keypad | **remove** | Expensify always uses its number pad; a keyboard-vs-pad switch is a detail nobody changes. | - | `true`. Retire `components/split/ExpenseComposer.tsx:132`, the comment in `components/split/fields.tsx:107`, `e2e/amount.spec.ts` toggling, `preferences.test.ts`. Keep the system keyboard for screen readers if `fields.tsx` does not already. |
| 19 | `analyticsPeriod` | Defaults | Analytics period | **merge** into Analytics' period chip | The chip is the control; it should write the key (decision 90) and the row goes. | - | key stays; `screens/Analytics/useReport.ts:94` reads it, the period chip writes it; delete `AnalyticsPeriodPref` |
| 20 | `analyticsView` | Defaults | Analytics view | **merge** into Analytics' Charts / Table toggle | Already written by the toggle (`screens/Analytics/index.tsx:51`); the row is a duplicate. | § 26.16 (toggle in the filter row) | key stays; delete `AnalyticsViewPref` |
| 21 | `pwa.installHintDismissed` | Defaults | none | keep (no row) | App state, not a choice. Move it out of group `defaults` so "Reset this page" there does not re-show the hint. | § 26.21 | - |
| 22 | `analyticsScope` | Defaults | none | keep (no row) | Remembered on Analytics' scope chip. | row 67, § 26.16 | - |
| 23 | `categories` | Categories | Categories editor | keep | A collection people really shape (§ 26.1 collections). | § 26.1 | - |
| 24 | `bill.taxClasses` | Defaults | Tax classes editor | keep | Owner's tax-class bills; § 26.13 says the list lives in Settings. | row 86, § 26.13 | - |
| 25 | `bill.chargePresets` | Defaults | none | keep (no row) | Chosen with the setup chips on a bill. | row 86 | - |
| 26 | `bill.defaultPreset` | Defaults | New bills start with | keep | Genuinely regional (Restaurant India vs US tip vs EU VAT). | row 86 (presets) | Shorten wording. |
| 27 | `bill.serviceChargeDefault` | Defaults | Service charge on new bills | **remove** | Duplicates `bill.defaultPreset` (Restaurant India already carries 10 % service). | - | `0`. Retire `components/split/SplitEditor.tsx:97-98` and its use, `packages/sync/test/bill.test.ts`, `SERVICE_CHARGE_CHOICES` if then unused |
| 28 | `bill.roundOffSpread` | Defaults | Bill round-off goes to | **remove** | A few paise of round-off; nobody changes who carries it. | - | `shares`. Retire `components/split/charges/Reconciliation.tsx:41` (use `'shares'` at :180), `e2e/charges.spec.ts`, `bill.test.ts` |
| 29 | `bill.rememberPerMerchant` | Defaults | Charges per merchant | **remove** | Suggestions only appear for merchants you explicitly saved with "Save as preset"; a switch to silence them is not needed. | row 86 asked for the memory, not a switch | `true`. Retire `components/split/charges/ChargesSection.tsx:96,242`, `bill.test.ts` |
| 30 | `bill.merchantSetups` | Defaults | Remembered merchants (count + Reset) | keep key, **remove row** | Data, not a choice; the row only counts it. Reset all still clears it. | row 86 | delete `MerchantSetupsPref`; set `PREF_CONTROLS` entry to null |
| 31 | `language` | Language and region | Language | keep | Owner asked. | row 3 | Shorten wording. |
| 32 | `timezone` | Language and region | Timezone | keep | Owner asked. | row 4 | Shorten wording. |
| 33 | `weekStart` | Language and region | Week starts on | keep | Differs by region (Mon / Sun / Sat); drives weekly Analytics. | - | - |
| 34 | `dateFormat` | Language and region | Date format | keep | Expats and travellers differ from their locale. | - | - |
| 35 | `numberLocale` | Language and region | Number format | keep | Lakh vs international grouping genuinely differs. | - | - |
| 36 | `amount.shorthand` | Language and region | Amount shortcuts | **remove** | Parsing 2k / 1.5L / 1cr never hurts; no one turns it off. | - | `true`. Retire `components/split/ExpenseComposer.tsx:131`, `components/split/charges/ChargesSection.tsx:99`, `preferences.test.ts` |
| 37 | `peopleSort` | Sorting and filters | Sort people by | **merge** into the People filter sheet | The filter's Sort is the control; it must write the key on Apply (decision 90). | § 26.1 "list filters and sorts", § 26.12, row 90 | key stays; `screens/People/index.tsx:77` reads, filter Apply writes; delete `PeopleSortPref`; update `e2e/people.spec.ts:294`, `perf/save.spec.ts:157` only if they drove the row |
| 38 | `includeGroupsDefault` | Sorting and filters | Include groups | **merge** into the People filter sheet | Same: the filter's Include groups switch is the control. | row 31, row 90, § 26.12 | key stays; `screens/People/index.tsx:79`, `screens/Person/index.tsx:120` read, filter Apply writes; delete `IncludeGroupsPref`; `e2e/people.spec.ts:102` |
| 39 | `groups.showInactiveFold` | Sorting and filters | Inactive groups | **remove** | A switch just to hide the Inactive fold, the exact case § 26.1 rules out. | row 89 asked for the fold, not a switch | fold always shown. Retire `screens/Groups/index.tsx:79,130`; drop the parenthetical in § 26.12 |
| 40 | `groups.hidden` | Sorting and filters | none | keep (no row) | Set from a group's menu. | row 89 | - |
| 41 | `lists.hiddenItems` | Sorting and filters | none | keep (no row) | Set from a deleted item's Hide. | rows 105, 106 | - |
| 42 | `lists.showHidden` | Sorting and filters | none | keep (no row) | The lists' Show hidden filter. | row 105 | - |
| 43 | `showSyncStatus` | Sorting and filters | Sync status | **remove** | A switch to hide a 7 px dot; owner 111/120 already govern row sync marks. | - | dots shown as today (`true`). Retire `components/SyncStatus.tsx:39`, `state/preferences/mirror.tsx:52,65,74`, `storage/schema.ts:27`, `e2e/sync-status.spec.ts` toggling |
| 44 | `swipeLeft` | Sorting and filters | Swipe left on Activity | **remove** | Every action is also on the row menu; neither reference app makes gestures configurable. | - | `delete`. Retire `screens/Activity.tsx:53`, `e2e/activity.spec.ts`, `docs/reuse/activity.md` line |
| 45 | `swipeRight` | Sorting and filters | Swipe right on Activity | **remove** | Same. | - | `markRead`. Retire `screens/Activity.tsx:54`; keep the `SwipeAction` type only if `ActivityItem` still needs it |
| 46 | `rememberSearches` | Sorting and filters | Recent searches | **remove** | The Search & Ask drawer already has "Clear all" (`SearchAskBody.tsx:361`); Bluesky has no switch either. | - | `true`. Retire `features/searchAsk/SearchAskBody.tsx:124-130,147` |
| 47 | `notify.expense` | Notifications | New expenses | keep | Standard notification choice. | § 26.1 | - |
| 48 | `notify.payment` | Notifications | Payments | keep | Same. | § 26.1 | - |
| 49 | `notify.invite` | Notifications | Invites | keep | Same. | § 26.1 | - |
| 50 | `notify.reminders` | Notifications | Reminders I set | keep | "Reminders" is named in § 26.1's list. | § 26.1 (row 128) | Shorten the web description. |
| 51 | `notify.recurring` | Notifications | none | **remove** | Placeholder for a feature that does not exist (F-306); no reader. Add it with the feature. | - | n/a. Retire the registry line and its null control |
| 52 | `notify.digest` | Notifications | none | **remove** | Same: no digest feature, no reader. | - | n/a. Same |
| 53 | `sendDiagnostics` | Privacy | none | keep (no row) | Telemetry opt-out is a genuine privacy choice; its row arrives with a vendor (A-046). | § 16.1 | - |
| 54 | `comments.showHistory` | Sorting and filters | Edit history in discussions | **remove** | Hides a small UI element; Expensify always shows history in the thread. | row 59 asked for comments, not this switch | `true`. Retire `screens/Expense/index.tsx:247`, `screens/Repayment/index.tsx:113` (pass `true` or drop the prop in `components/comments/Discussion.tsx:168-198`), delete `components/comments/CommentsPref.tsx`, `packages/sync/test/comments.test.ts`, `e2e/comments.spec.ts` toggling |
| 55 | `privacy.findByContact` | Privacy | Find me by email or phone | keep (Privacy only) | Owner's consent model; § 26.18 says Privacy keeps it. Remove it from Friends and invites' block (duplicate). | row 52, § 26.18 | `screens/FriendsAndInvites/index.tsx:41` drop from `DEFAULT_PREFS` |
| 56 | `privacy.friendRequestsFrom` | Privacy | Who can send me friend requests | keep, **move** to Friends and invites only | § 26.18 lists it in that page's defaults; rendering it on both pages is a duplicate. | § 26.18, row 83 | new non-section group (e.g. `invites`) |
| 57 | `invites.defaultMaxUses.friend` | Privacy | Friend invite links work for | keep, **move** to Friends and invites only | Owner asked for link limits and for defaults on that page. | rows 52, 83 | group `invites`; off the Privacy page |
| 58 | `invites.defaultMaxUses.group` | Privacy | Group invite links work for | keep, **move** | Same; group links need a different default (25 vs 1). | rows 52, 83 | same |
| 59 | `invites.approveJoins` | Privacy | Approve group joins | keep, **move** | Same. | rows 83, § 26.18 | same |
| 60 | `invites.defaultExpiry` | Privacy | New invite links expire after | keep, **move** | Same. | rows 52, 83 | same |

## Settings rows that are not preferences

| Row (screen) | Verdict | Reason | Owner |
|---|---|---|---|
| Account > Sign in (signed out only) | keep until F-250, then replace with the signed-in account row + Log out | Under owner 125 Settings never renders signed out, so this row becomes unreachable. | rows 44, 125 |
| Account > Profile | keep; fix subtitle | "Your profile · saved on this device" goes stale once sign-in is required. | § 26.15 |
| Account > Friends and invites | keep | Owner asked. | row 83 |
| Preferences > one row per section | keep, 9 -> 7 | See sections above. Remove the `motion` and `lists` entries from `useSectionSummary` (`screens/Settings/index.tsx`). | - |
| Support > Send feedback, Your feedback, Help, About | keep | Owner asked; Bluesky placement. | row 53, § 26.15 |
| Data > Export, Import | keep | Owner asked. | row 59 |
| Data > Install app | keep | PWA rule. | row 58, § 26.21 |
| Data > Demo mode (dev/e2e only) | keep | Owner asked. | rows 94, 95, 99 |
| Data > Reset all settings | keep | - | - |
| Each page > Reset this page | keep | Cheap and harmless; on pages left with 1-3 rows it adds little, a later pass may drop it. | - |
| Privacy > Manage invite links | **merge** into a "Friends and invites" link | Invite links already live on the Friends and invites page; one link to that page is enough. | row 83 |
| Privacy > the six pref rows | **shrink** to Find me by email or phone | The other five render again on Friends and invites (`FriendsAndInvites/index.tsx:40-47`); duplicates. | § 26.18 |
| Settings footer "Settings are saved on this device. Once you sign in, they follow you..." | reword | Stale under owner 125 (always signed in). | row 125 |

Not a prune item, flagged: § 26.1 says Settings stays "searchable" and F-251 acceptance 3 assumes a Settings search,
but no Settings search exists in the code. Either build it (Bluesky has none; Expensify has none) or drop the word
from § 26.1 and the acceptance line.

## Wording too long (rows that stay)

| Row | Today | Suggested |
|---|---|---|
| Dark mode style | description "Used whenever Splito is in dark mode." | no description |
| Money colours | description "Balances always show an arrow and words like “owes you”, so they read without colour too." + three hints of 7-10 words | description "Arrows and words always show the direction."; hints: "Green in, red out" / "Blue and orange" / "No colour" |
| Animations | reduced-motion description "Your device asks for reduced motion, so Splito keeps movement to gentle fades whatever you pick here." | "Your device asks for reduced motion, so movement stays gentle." |
| Haptics (web) | "Browsers can't vibrate. This applies in the Splito app on your phone." | "Phones only." |
| Open on | description "The tab Splito opens on." | no description |
| Default currency | "New expenses start in this currency. You can change it on any expense." | "New expenses start in this currency." |
| New bills start with | "The charge setup a new itemised bill opens with. You can change it on each bill." | "The charges a new itemised bill opens with." |
| Language | "Splito's language. Names, notes and amounts you enter stay as you typed them." | no description |
| Timezone | "Decides which day "today" is and where weeks and months begin in reports. Each expense keeps the date it happened." | "Sets which day is today. Expenses keep their own dates." |
| Number format | "How amounts are grouped and punctuated." | no description (the examples say it) |
| Reminders I set (web) | "On the web these alert you only while Splito is open; if it’s closed you’ll see them the next time you open it." | "On the web, only while Splito is open." |
| Find me by email or phone | title + label "Let people who know my email or number find me" + "They only learn that you’re on Splito, never anything else." | title + "They only learn you’re on Splito." |
| Who can send me friend requests | title | "Friend requests from" |
| Friend invite links work for | + "How many people can use a new friend link. You can change it on each link." | "Friend links work for", no description |
| Group invite links work for | title | "Group links work for" |
| New invite links expire after | title | "Links expire after" |
| Approve group joins | label "New group links make people wait until you let them in" | "Ask me before someone joins" |
| Notifications page notice | 38 words, says "once you sign in" (stale under owner 125) | "New expense, payment and invite alerts start once sync is on. Reminders work now." |
| Privacy page notice | "Finding and friend requests use Splito’s directory, which arrives with sign-in. Your choices are saved now and apply from then." | "Saved now; applies once the directory is live." |

## Doc edits that go with the prune

- § 26.15: drop "Preference 'Shake to send feedback' (phones, default off)."
- § 26.12: drop "(preference `groups.showInactiveFold`, default on)".
- § 26.18: Privacy keeps "Let people find me" plus a link to Friends and invites; the invite defaults and friend-request
  choice live only on Friends and invites (already what the rule says; the code renders them twice).
- BACKLOG F-251 status and `COMPLETION_MATRIX.md`; Lingui `--clean` for the retired strings; demo data has no seeded
  values for the retired keys (checked: none found).
