// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx
import {lazy, Suspense} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {bottomBarItems} from '#/lib/routes/navigationItems'
import {useMe, usePref} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {InstallAppItem} from '#/screens/Settings/components/InstallAppItem'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {CircleQuestion_Stroke2_Corner2_Rounded as HelpIcon} from '#/components/icons/CircleQuestion'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {FileExport_Stroke2_Corner0_Rounded as ExportIcon} from '#/components/icons/Export'
import {PeopleGroup_Stroke2_Corner0_Rounded as FriendsIcon} from '#/components/icons/Invite'
import * as Layout from '#/components/Layout'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {TabScreen} from '#/components/TabScreen'
import {useTabLabels} from '#/components/settings/NavigationEditor'
import {SETTINGS_SECTIONS, type SettingsSectionId, useSectionInfo} from '#/components/settings/sections'
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
 * Settings, a tab of its own (owner 206): Bluesky's Settings list, one row per preferences-registry group, then one
 * "Support" row and one "Your data" row (owners 204, 205) that open their own pages. Account rows (switch account,
 * privacy) arrive with sign-in; Log out is on Profile (owner 202).
 */
export function SettingsScreen() {
  const {t: l} = useLingui()
  const t = useTheme()
  const sections = useSectionInfo()
  const summary = useSectionSummary()
  const me = useMe()
  const {currentAccount} = useSession()

  return (
    <TabScreen testID="screen-settings">
      <Layout.Header.Outer>
        <HeaderAvatar />
        <Layout.Header.Slot />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Settings</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <SearchAskButton edge />
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
          {/* One row each (owners 204, 205): the pages hold the items. */}
          <SettingsList.LinkItem testID="settings-support" to="/settings/support" label={l`Support`}>
            <SettingsList.ItemIcon icon={HelpIcon} />
            <SettingsList.ItemText>
              <Trans>Support</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem testID="settings-data" to="/settings/data" label={l`Your data`}>
            <SettingsList.ItemIcon icon={ExportIcon} />
            <SettingsList.ItemText>
              <Trans>Your data</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <InstallAppItem />
          {/* Dev and e2e builds only: the demo mode switch (ARCHITECTURE 26.1). */}
          {DemoModeRows && (
            <Suspense fallback={null}>
              <DemoModeRows />
            </Suspense>
          )}
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

    </TabScreen>
  )
}

/** Each page's current state at a glance, shown at the end of its row (as Bluesky's settings rows do). */
function useSectionSummary(): Partial<Record<SettingsSectionId, string>> {
  const {t: l} = useLingui()
  const [theme = 'system'] = usePref('theme')
  const [currency = 'INR'] = usePref('defaultCurrency')
  const [startTab = 'people'] = usePref('startTab')
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
        : `${plural(tabCount, {one: '# tab', other: '# tabs'})} · ${tabLabels[startTab]}`,
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
