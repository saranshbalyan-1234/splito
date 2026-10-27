// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx
import {lazy, Suspense} from 'react'
import {View} from 'react-native'
import {type Feedback, type PrefGroup, resetAllPrefs} from '@splito/sync'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {bottomBarItems} from '#/lib/routes/navigationItems'
import {useEntities, useMe, usePref} from '#/data/hooks'
import {useExportSheet} from '#/features/export/ExportSheet'
import {useImportSheet} from '#/features/export/ImportSheet'
import {useOpenFeedback} from '#/features/feedback/FeedbackProvider'
import {useData} from '#/data/StoreProvider'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {InstallAppItem} from '#/screens/Settings/components/InstallAppItem'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as ResetIcon} from '#/components/icons/ArrowRotate'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {CircleQuestion_Stroke2_Corner2_Rounded as HelpIcon} from '#/components/icons/CircleQuestion'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {FileExport_Stroke2_Corner0_Rounded as ExportIcon, Upload_Stroke2_Corner0_Rounded as ImportIcon} from '#/components/icons/Export'
import {Inbox_Stroke2_Corner0_Rounded as InboxIcon} from '#/components/icons/Feedback'
import {Message_Stroke2_Corner0_Rounded as MessageIcon, PeopleGroup_Stroke2_Corner0_Rounded as FriendsIcon} from '#/components/icons/Invite'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {useTabLabels} from '#/components/settings/NavigationEditor'
import * as Prompt from '#/components/Prompt'
import {SETTINGS_SECTIONS, useSectionInfo} from '#/components/settings/sections'
import * as Toast from '#/components/Toast'
import {SignIn_Stroke2_Corner0_Rounded as SignInIcon} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {useSession} from '#/state/session'

/*
 * Dev and e2e builds only (ARCHITECTURE 26.1): the demo rows and the generator
 * behind them are loaded on demand under a condition Metro folds at build
 * time (`__DEV__` and the inlined `EXPO_PUBLIC_ENV`; an imported constant
 * would not fold), so a production bundle holds neither. `IS_DEV || IS_E2E`
 * in `#/env` says the same at run time.
 */
const DemoDataRows =
  __DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e'
    ? lazy(() => import('#/screens/Settings/DemoData').then(m => ({default: m.DemoDataRows})))
    : null

/**
 * Bluesky's Settings list, one row per preferences-registry group, then
 * About and "Reset all settings". Account rows (switch account, sign out,
 * privacy) arrive with sign-in.
 */
export function SettingsScreen() {
  const {t: l} = useLingui()
  const t = useTheme()
  const {store, ctx} = useData()
  const haptics = useHaptics()
  const sections = useSectionInfo()
  const summary = useSectionSummary()
  const resetPrompt = Prompt.usePromptControl()
  const me = useMe()
  const {hasSession} = useSession()
  const [binDays] = usePref('history.binDays')
  const openFeedback = useOpenFeedback()
  const exportSheet = useExportSheet()
  const importSheet = useImportSheet()
  const feedbackCount = useEntities<Feedback>('feedback')?.length ?? 0

  return (
    <Layout.Screen testID="screen-settings">
      <Layout.Header.Outer>
        {/* A pushed page on every width (header rule set), sidebar item or not. */}
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Settings</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          {/* Account first, as Bluesky's settings open with the account (owner rule). */}
          <SectionTitle>
            <Trans>Account</Trans>
          </SectionTitle>
          {!hasSession && (
            <SettingsList.LinkItem
              testID="settings-sign-in"
              to="/signin"
              label={l`Sign in`}
              contentContainerStyle={[a.py_md]}>
              <SettingsList.ItemIcon icon={SignInIcon} />
              <View style={[a.flex_1, a.gap_2xs]}>
                <SettingsList.ItemText>
                  <Trans>Sign in</Trans>
                </SettingsList.ItemText>
                <Text
                  numberOfLines={1}
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>Back up and share with friends</Trans>
                </Text>
              </View>
            </SettingsList.LinkItem>
          )}
          <SettingsList.LinkItem
            testID="settings-profile"
            to="/profile"
            label={l`Profile`}
            contentContainerStyle={[a.py_md]}>
            <UserAvatar size={44} name={me?.data.name} type="user" />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text
                emoji
                numberOfLines={1}
                style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
                {me?.data.name ?? ''}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>Your profile · saved on this device</Trans>
              </Text>
            </View>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            testID="settings-friends"
            to="/settings/friends"
            label={l`Friends and invites`}>
            <SettingsList.ItemIcon icon={FriendsIcon} />
            <SettingsList.ItemText>
              <Trans>Friends and invites</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.Divider />
          <SectionTitle>
            <Trans>Preferences</Trans>
          </SectionTitle>
          {SETTINGS_SECTIONS.map(id => (
            <SettingsList.LinkItem
              key={id}
              testID={`settings-${id}`}
              to={`/settings/${id}`}
              label={sections[id].title}>
              <SettingsList.ItemIcon icon={sections[id].icon} />
              <SettingsList.ItemText>
                {sections[id].title}
              </SettingsList.ItemText>
              {summary[id] ? (
                <Text
                  testID={`settings-${id}-value`}
                  numberOfLines={1}
                  style={[
                    a.text_md,
                    a.text_right,
                    t.atoms.text_contrast_medium,
                    {maxWidth: '45%'},
                  ]}>
                  {summary[id]}
                </Text>
              ) : null}
            </SettingsList.LinkItem>
          ))}
          <SettingsList.Divider />
          <SectionTitle>
            <Trans>Support</Trans>
          </SectionTitle>
          <SettingsList.PressableItem
            testID="settings-send-feedback"
            label={l`Send feedback`}
            onPress={openFeedback}>
            <SettingsList.ItemIcon icon={MessageIcon} />
            <SettingsList.ItemText>
              <Trans>Send feedback</Trans>
            </SettingsList.ItemText>
          </SettingsList.PressableItem>
          <SettingsList.LinkItem
            testID="settings-your-feedback"
            to="/settings/feedback"
            label={l`Your feedback`}>
            <SettingsList.ItemIcon icon={InboxIcon} />
            <SettingsList.ItemText>
              <Trans>Your feedback</Trans>
            </SettingsList.ItemText>
            {feedbackCount > 0 ? (
              <SettingsList.BadgeText>{feedbackCount}</SettingsList.BadgeText>
            ) : null}
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            testID="settings-help"
            to="/settings/help"
            label={l`Help`}>
            <SettingsList.ItemIcon icon={HelpIcon} />
            <SettingsList.ItemText>
              <Trans>Help</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            testID="settings-about"
            to="/settings/about"
            label={l`About`}>
            <SettingsList.ItemIcon icon={InfoIcon} />
            <SettingsList.ItemText>
              <Trans>About</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.Divider />
          <SectionTitle>
            <Trans>Data</Trans>
          </SectionTitle>
          {/* Not a preference page: the bin itself, with its window setting on top. */}
          <SettingsList.LinkItem
            testID="settings-recently-deleted"
            to="/settings/recently-deleted"
            label={l`Recently deleted`}>
            <SettingsList.ItemIcon icon={TrashIcon} />
            <SettingsList.ItemText>
              <Trans>Recently deleted</Trans>
            </SettingsList.ItemText>
            {binDays ? (
              <Text
                testID="settings-recently-deleted-value"
                numberOfLines={1}
                style={[a.text_md, a.text_right, t.atoms.text_contrast_medium]}>
                {plural(binDays, {one: '# day', other: '# days'})}
              </Text>
            ) : null}
          </SettingsList.LinkItem>
          {/* F-2007 and F-2001: CSV, PDF and the full JSON backup out; a backup back in. */}
          <SettingsList.PressableItem
            testID="settings-export"
            label={l`Export`}
            onPress={exportSheet.open}>
            <SettingsList.ItemIcon icon={ExportIcon} />
            <SettingsList.ItemText>
              <Trans>Export</Trans>
            </SettingsList.ItemText>
          </SettingsList.PressableItem>
          <SettingsList.PressableItem
            testID="settings-import"
            label={l`Import`}
            onPress={importSheet.open}>
            <SettingsList.ItemIcon icon={ImportIcon} />
            <SettingsList.ItemText>
              <Trans>Import</Trans>
            </SettingsList.ItemText>
          </SettingsList.PressableItem>
          <InstallAppItem />
          {/* Dev and e2e builds only: the large demo set (ARCHITECTURE 26.1). */}
          {DemoDataRows && (
            <Suspense fallback={null}>
              <DemoDataRows />
            </Suspense>
          )}
          <SettingsList.PressableItem
            testID="settings-reset-all"
            destructive
            label={l`Reset all settings`}
            onPress={() => resetPrompt.open()}>
            <SettingsList.ItemIcon icon={ResetIcon} />
            <SettingsList.ItemText>
              <Trans>Reset all settings</Trans>
            </SettingsList.ItemText>
          </SettingsList.PressableItem>
          <View style={[a.flex_row, a.gap_sm, a.px_xl, a.pt_lg, a.pb_xl]}>
            <CloudIcon size="sm" fill={t.atoms.text_contrast_low.color} />
            <Text
              style={[
                a.flex_1,
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>
                Settings are saved on this device. Once you sign in, they follow
                you to your other devices.
              </Trans>
            </Text>
          </View>
        </SettingsList.Container>
      </Layout.Content>

      {exportSheet.element}
      {importSheet.element}
      <Prompt.Basic
        control={resetPrompt}
        title={l`Reset all settings?`}
        description={l`Theme, tabs, categories, language and every other setting go back to how Splito starts. Your people, groups and expenses stay as they are.`}
        confirmButtonCta={l`Reset all`}
        confirmButtonColor="negative"
        onConfirm={() => {
          resetAllPrefs(store, ctx).then(
            () => {
              haptics.success()
              Toast.show(l`Settings reset`)
            },
            () => Toast.show(l`Couldn’t reset settings. Please try again.`, {type: 'error'}),
          )
        }}
      />
    </Layout.Screen>
  )
}

/** Each page's current state at a glance, shown at the end of its row (as Bluesky's settings rows do). */
function useSectionSummary(): Partial<Record<PrefGroup, string>> {
  const {t: l} = useLingui()
  const [theme = 'system'] = usePref('theme')
  const [motion = 'full'] = usePref('motion')
  const [currency = 'INR'] = usePref('defaultCurrency')
  const [homeTab = 'people'] = usePref('homeTab')
  const [tabs] = usePref('tabs')
  const tabCount = tabs && bottomBarItems(tabs).length
  const tabLabels = useTabLabels()
  const [categories] = usePref('categories')
  const [language = 'en'] = usePref('language')
  const [sort = 'amount'] = usePref('peopleSort')
  const [notifyExpense = true] = usePref('notify.expense')
  const [notifyPayment = true] = usePref('notify.payment')
  const [notifyInvite = true] = usePref('notify.invite')
  const [findable = true] = usePref('privacy.findByContact')
  const visible = (categories ?? []).filter(c => !c.hidden).length
  const notifyOn = [notifyExpense, notifyPayment, notifyInvite].filter(
    Boolean,
  ).length
  return {
    appearance: {system: l`System`, light: l`Light`, dark: l`Dark`}[theme],
    motion: {full: l`Full`, reduced: l`Reduced`, off: l`Off`}[motion],
    /* How many tabs the bottom bar holds, and where the app opens. */
    navigation:
      tabCount === undefined
        ? undefined
        : `${plural(tabCount, {one: '# tab', other: '# tabs'})} · ${tabLabels[homeTab]}`,
    /* The currency new expenses start in. */
    defaults: currency,
    categories: visible === 1 ? l`1 category` : l`${visible} categories`,
    regional: {en: 'English', hi: 'हिन्दी'}[language],
    lists: {
      amount: l`By amount`,
      name: l`By name`,
      recent: l`Most recent`,
    }[sort],
    notifications: notifyOn === 3 ? l`On` : notifyOn === 0 ? l`Off` : l`Some`,
    privacy: findable ? l`Findable` : l`Hidden`,
  }
}

/** A group's small heading in the list, as Bluesky's settings sub-pages title their groups. */
function SectionTitle({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text
      accessibilityRole="header"
      style={[
        a.px_xl,
        a.pt_lg,
        a.pb_xs,
        a.text_sm,
        a.font_semi_bold,
        t.atoms.text_contrast_medium,
      ]}>
      {children}
    </Text>
  )
}
