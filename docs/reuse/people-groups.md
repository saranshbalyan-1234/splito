# Reuse record - people-groups stream

Upstream: `bluesky-social/social-app@4e4ad9c5f5cc584bd06473ab6f16318fd0bd8465` (MIT).
Every copied file below starts with `// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - <upstream path>`.
Paths are relative to `apps/client/`. Icons are Lucide (ISC, `LICENSES/lucide.txt`); no Bluesky
glyphs, illustrations, logos or `assets/images` are copied.

## Copied files

| Splito file | Upstream file | Splito changes |
|---|---|---|
| `src/components/Admonition.tsx` | `src/components/Admonition.tsx` | Emoji icon import path made absolute |
| `src/components/forms/SegmentedControl.tsx` | `src/components/forms/SegmentedControl.tsx` | Button import path made absolute |
| `src/components/forms/DateField/index.web.tsx` | `src/components/forms/DateField/index.web.tsx` | - |
| `src/components/forms/DateField/types.ts` | `src/components/forms/DateField/types.ts` | - |
| `src/components/forms/DateField/utils.ts` | `src/components/forms/DateField/utils.ts` | - |
| `src/components/forms/DateField/index.tsx` | `src/components/forms/DateField/index.tsx` | API only: native types the date (YYYY-MM-DD) until the native build adds `@expo/ui`'s picker |

## Layouts followed (Splito code, Bluesky structure)

| Splito file | Bluesky source of the layout |
|---|---|
| `src/screens/Person/index.tsx` | `src/screens/Profile/Header/ProfileHeaderStandard.tsx` (avatar row, then the balance cards) without the banner; the name and byline are the page header's title / subtitle and Settle up its action (owner header rule) |
| `src/screens/Group/index.tsx` | `src/screens/ProfileList/components/Header.tsx` (square list avatar beside the member stack and dates) with Bluesky's `TabBar`; the name and "Trip · 5 members" are the page header's title / subtitle and Settle up its action (owner header rule) |
| `src/components/ListToolsHeader.tsx` | `src/screens/Search/Shell.tsx` (search row: Bluesky `SearchInput` with its clear cross) and `src/view/com/util/List` section headings; Splito code for the icon-to-field width/opacity animation (Reanimated, instant under reduced motion) and the filter dot, as no Bluesky screen collapses its search to an icon |
| `src/screens/People/components/BalanceSummary.tsx` (Overview) | Bluesky section heading with a trailing link (`src/screens/Settings/components/SettingsList.tsx` LinkItem chevron) over People's balance card |
| `src/screens/Groups/components/GroupsFilterDialog.tsx` | Same dialog layout as People's filters (`FriendsFilterDialog`, `Choices` chips, `FormSheet.Actions`) |
| `src/components/people/HistoryRow.tsx`, `src/screens/Group/components/GroupRows.tsx`, `src/screens/Settle/components/TransferRow.tsx` | `src/components/ProfileCard.tsx` row (leading avatar, name, byline, trailing action) |
| `src/components/people/*Dialog.tsx`, `src/screens/Person/components/HistoryFilterDialog.tsx` | `src/components/dialogs/BirthDateSettings.tsx` (Dialog.Outer + ScrollableInner, `text_2xl` title, full-width large primary button, `Dialog.Close`) |
| `src/screens/AddFriend.tsx`, `src/screens/CreateGroup.tsx` | Bluesky settings form pages (`Layout.Screen` + header + `Layout.Content`, `TextField.LabelText` over each field) |
