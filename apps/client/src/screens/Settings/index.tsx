// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx
import {lazy, Suspense} from 'react'
import {View} from 'react-native'
import {type Feedback, resetAllPrefs} from '@splito/sync'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useRoute} from '@react-navigation/native'

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
import * as Layout from '#/components/Layout'
import {useTabLabels} from '#/components/settings/NavigationEditor'
import * as Prompt from '#/components/Prompt'
import {useHasLegacyStore} from '#/data/account'
import {requestLegacyOffer} from '#/features/account/LegacyDataOffer'
import {requestLogOut} from '#/features/account/LogOutPrompt'
import {useDemoMode} from '#/state/demo'
import {SETTINGS_SECTIONS, type SettingsSectionId, useSectionInfo} from '#/components/settings/sections'
import * as Toast from '#/components/Toast'
import {SignOut_Stroke2_Corner0_Rounded as SignOutIcon} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {useSession} from '#/state/session'

/*
 * Dev and e2e builds only (ARCHITECTURE 26.1): the demo rows and the data
 * behind them are loaded on demand under a condition Metro folds at build
 * time (`__DEV__` and the inlined `EXPO_PUBLIC_ENV`; an imported constant
 * would not fold), so a production bundle holds neither. `IS_DEV || IS_E2E`
 * in `#/env` says the same at run time.
 */
// Every build (owner 148), as a lazy chunk.
const DemoModeRows: ReturnType<typeof lazy> | null = lazy(() =>
  import('#/screens/Settings/DemoMode').then(m => ({default: m.DemoModeRows})),
)

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
  const {currentAccount} = useSession()
  const hasLegacyStore = useHasLegacyStore()
  const {demo: isDemo} = useDemoMode()
  const note = (useRoute().params as {note?: string} | undefined)?.note
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
                {currentAccount?.email ?? currentAccount?.phone ?? l`Your profile`} · <Trans>saved on this device</Trans>
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
          <SettingsList.PressableItem testID="settings-log-out" destructive label={l`Log out`} onPress={requestLogOut}>
            <SettingsList.ItemIcon icon={SignOutIcon} />
            <SettingsList.ItemText>
              <Trans>Log out</Trans>
            </SettingsList.ItemText>
          </SettingsList.PressableItem>
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
          {note === 'deleted-stay' && (
            <View testID="settings-deleted-note" style={[a.flex_row, a.gap_sm, a.px_xl, a.pb_sm]}>
              <InfoIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
              <Text style={[a.flex_1, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                <Trans>Deleted items now stay in their lists.</Trans>
              </Text>
            </View>
          )}
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
          {/* F-2104: while the pre-account database exists, ask again (the one-time offer after sign-in may have been put off). */}
          {hasLegacyStore && !isDemo && (
            <SettingsList.PressableItem testID="settings-move-legacy" label={l`Move this device’s older data`} onPress={requestLegacyOffer}>
              <SettingsList.ItemIcon icon={ImportIcon} />
              <SettingsList.ItemText>
                <Trans>Move this device’s older data</Trans>
              </SettingsList.ItemText>
            </SettingsList.PressableItem>
          )}
          <InstallAppItem />
          {/* Dev and e2e builds only: the demo mode switch (ARCHITECTURE 26.1). */}
          {DemoModeRows && (
            <Suspense fallback={null}>
              <DemoModeRows />
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
                Settings are saved on this device and follow you to your other
                devices once sync is on.
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
function useSectionSummary(): Partial<Record<SettingsSectionId, string>> {
  const {t: l} = useLingui()
  const [theme = 'system'] = usePref('theme')
  const [currency = 'INR'] = usePref('defaultCurrency')
  const [homeTab = 'home'] = usePref('startTab')
  const [tabs] = usePref('tabs')
  const tabCount = tabs && bottomBarItems(tabs).length
  const tabLabels = useTabLabels()
  const [categories] = usePref('categories')
  const [language = 'en'] = usePref('language')
  const [notifyComments = true] = usePref('notify.comments')
  const [notifyPayment = true] = usePref('notify.payment')
  const [notifyInvite = true] = usePref('notify.invite')
  const [findable = true] = usePref('privacy.findByContact')
  const visible = (categories ?? []).filter(c => !c.hidden).length
  const notifyOn = [notifyPayment, notifyComments, notifyInvite].filter(
    Boolean,
  ).length
  return {
    appearance: {system: l`System`, light: l`Light`, dark: l`Dark`}[theme],
    /* How many tabs the bottom bar holds, and where the app opens. */
    navigation:
      tabCount === undefined
        ? undefined
        : `${plural(tabCount, {one: '# tab', other: '# tabs'})} · ${tabLabels[homeTab]}`,
    /* The currency new expenses start in. */
    defaults: currency,
    categories: visible === 1 ? l`1 category` : l`${visible} categories`,
    regional: {en: 'English', hi: 'हिन्दी'}[language],
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
