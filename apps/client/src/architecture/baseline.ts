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
    'apps/client/src/components/icons/HomeOpen.tsx': 1,
    'apps/client/src/components/icons/Settings.tsx': 1,
    'apps/client/src/components/icons/UserCircle.tsx': 3,
    'apps/client/src/components/icons/lucide.tsx': 1,
    'apps/client/src/view/com/util/UserAvatar.tsx': 8,
    'apps/client/src/view/shell/index.tsx': 4,
    'apps/client/src/view/shell/index.web.tsx': 3,
  },
  rnModal: {},
  expoHaptics: {},
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
    'apps/client/src/components/people/EntryIcon.tsx': 1,
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
    'apps/client/src/screens/Settings/index.tsx': 2,
  },
  moneyFullRead: {},
  attribution: {},
}
