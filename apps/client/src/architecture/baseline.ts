import {type RuleName} from './rules'

/**
 * Per-file counts that existed when each rule was written. A count may only go
 * down: `rules.test.ts` fails on a rise, on a new file above 0, and on a count
 * that fell while this file still holds the old number (lower it here).
 */
export const BASELINE: Record<RuleName, Record<string, number>> = {
  rawColour: {
    'apps/client/src/components/Composer/index.web.tsx': 1,
    'apps/client/src/components/DraggableList/index.tsx': 1,
    'apps/client/src/components/DraggableList/index.web.tsx': 1,
    'apps/client/src/components/forms/SegmentedControl.tsx': 1,
    'apps/client/src/components/groups/GroupAvatar.tsx': 14,
    'apps/client/src/components/icons/ChartPie.tsx': 2,
    'apps/client/src/components/icons/ContactRound.tsx': 2, // the mask's black: cut-outs, not a theme colour (owner 216)
    'apps/client/src/components/icons/HomeOpen.tsx': 1,
    'apps/client/src/components/icons/Settings.tsx': 1,
    'apps/client/src/components/icons/UserCircle.tsx': 3,
    'apps/client/src/components/icons/lucide.tsx': 1,
    'apps/client/src/view/com/util/UserAvatar.tsx': 8,
  },
  rnModal: {},
  expoHaptics: {},
  rowMenuGesture: {
    'apps/client/src/components/comments/CommentRow.tsx': 1,
    'apps/client/src/components/split/SplitEditor.tsx': 1,
    'apps/client/src/components/split/charges/ItemClass.tsx': 1,
  },
  viewFiles: {},
  credentialAccess: {
    'apps/client/src/alf/util/useColorModeTheme.ts': 1,
  },
  consoleOutsideLogger: {
    'apps/client/src/components/Dialog/context.ts': 2,
    'apps/client/src/components/Toast/Toast.tsx': 1,
  },
  moneyArithmetic: {},
  rawNumberOnMoney: {},
  unlikeCurrencySum: {},
  layerDirection: {
    'apps/client/src/components/HeaderAvatar.tsx': 1,
    'apps/client/src/components/activity/useActivityActions.tsx': 1,
    'apps/client/src/components/activity/useActivityFeed.ts': 1,
    'apps/client/src/components/groups/AddMembersDialog.tsx': 1,
    'apps/client/src/components/groups/EditGroupDialog.tsx': 1,
    'apps/client/src/components/groups/RulesEditor.tsx': 1,
    'apps/client/src/components/people/EditFriendDialog.tsx': 1,
    'apps/client/src/components/people/PaymentDetailsDialog.tsx': 1,
    'apps/client/src/components/people/RecordPaymentDialog.tsx': 1,
    'apps/client/src/components/people/UpiPayDialog.tsx': 1,
    'apps/client/src/components/settings/AboutSettings.tsx': 1,
    'apps/client/src/components/settings/CategoriesEditor.tsx': 1,
    'apps/client/src/components/settings/PrefSection.tsx': 3,
    'apps/client/src/components/settings/prefControls.tsx': 1,
    'apps/client/src/components/split/DateDialog.tsx': 1,
    'apps/client/src/components/split/ExpenseComposer.tsx': 1,
    'apps/client/src/components/split/PeopleDialog.tsx': 1,
    'apps/client/src/components/split/shared.tsx': 1,
    'apps/client/src/components/split/useExpense.ts': 1,
    'apps/client/src/lib/routes/tabs.ts': 1,
  },
  siblingFeatures: {},
  packageBoundaries: {
    'packages/domain/src/money.ts': 1,
  },
  persistenceOutsideSync: {},
  storeAccess: {
    'apps/client/src/App.tsx': 1,
    'apps/client/src/components/settings/PrefSection.tsx': 2,
    'apps/client/src/screens/Settings/SettingsSection.tsx': 2,
    'apps/client/src/screens/Settings/components/DataSettings.tsx': 2,
  },
  moneyFullRead: {},
  hardDelete: {},
  /* Not links to a person: own avatars (header, drawer, Profile, Settings, a person's own page), selection rows and
   * dialogs whose whole row picks, an invitee / contact who is not a person yet, avatar previews. */
  personAvatarOutsideLink: {
    'apps/client/src/components/HeaderAvatar.tsx': 1,
    'apps/client/src/components/activity/ActivityItem.tsx': 1,
    'apps/client/src/components/comments/CommentComposer.tsx': 1,
    'apps/client/src/components/groups/AddMembersDialog.tsx': 1,
    'apps/client/src/components/groups/RulesEditor.tsx': 2,
    'apps/client/src/components/people/AvatarPreview.tsx': 1,
    'apps/client/src/components/people/PendingPeople.tsx': 1,
    'apps/client/src/components/people/RecordPaymentDialog.tsx': 2,
    'apps/client/src/components/people/RequestRow.tsx': 1,
    'apps/client/src/components/split/PayersDialog.tsx': 2,
    'apps/client/src/components/split/PeopleDialog.tsx': 1,
    'apps/client/src/components/split/SplitEditor.tsx': 3,
    'apps/client/src/components/split/pickers.tsx': 1,
    'apps/client/src/features/remind/RemindSheet.tsx': 1,
    'apps/client/src/features/settlement/CallItEvenDialog.tsx': 2,
    'apps/client/src/screens/AddFriend.tsx': 1,
    'apps/client/src/screens/CreateGroup.tsx': 2,
    'apps/client/src/screens/Group/index.tsx': 1, // the header's member stack is one control: it opens Members, not each face
    'apps/client/src/screens/Invites/Invite.tsx': 1,
    'apps/client/src/screens/Person/index.tsx': 1,
    'apps/client/src/screens/Profile/index.tsx': 1,
  },
  externalHandOff: {},
  clipboardOutsideSharing: {},
  timeFormatOutsideLocale: {
    'apps/client/src/components/activity/ActivityItem.tsx': 1, // a reminder fires on the device clock, so it is shown in the device's zone
    'apps/client/src/features/export/ImportSheet.tsx': 1, // the file's own export time, device zone
    'apps/client/src/features/remind/PersonReminders.tsx': 1, // device clock
    'apps/client/src/features/remind/RemindMeSheet.tsx': 1, // device clock
    'apps/client/src/features/searchAsk/AskChat.tsx': 2, // rolls out with P1-e (Ask and chat)
  },
  demoStaticImport: {},
  attribution: {},
}
