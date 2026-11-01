// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx
import {lazy, Suspense} from 'react'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {bottomBarItems} from '#/lib/routes/navigationItems'
import {usePref} from '#/data/hooks'
import {InstallAppItem} from '#/screens/Settings/components/InstallAppItem'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {CircleQuestion_Stroke2_Corner2_Rounded as HelpIcon} from '#/components/icons/CircleQuestion'
import {FileExport_Stroke2_Corner0_Rounded as ExportIcon} from '#/components/icons/Export'
import {PeopleGroup_Stroke2_Corner0_Rounded as FriendsIcon} from '#/components/icons/Invite'
import {useTabLabels} from '#/components/settings/NavigationEditor'
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
  useSectionInfo,
} from '#/components/settings/sections'
import {Text} from '#/components/Typography'

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
 * The Settings list (owner 220: it is part of Profile, not a screen or a tab of its own): Bluesky's Settings list, one
 * row per preferences-registry group, then one "Support" row and one "Your data" row (owners 204, 205) that open their
 * own pages. Account rows (switch account, privacy) arrive with sign-in. Rendered by Profile, between the person's
 * sections and Log out.
 */
export function SettingsRows({leading}: {leading?: React.ReactNode} = {}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const sections = useSectionInfo()
  const summary = useSectionSummary()

  return (
    <SettingsList.Container>
      {/* Profile puts Payment details first (owner 228); an absent prop keeps the list as it was. */}
      {leading}
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
          <SettingsList.ItemText>{sections[id].title}</SettingsList.ItemText>
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
      <SettingsList.LinkItem
        testID="settings-support"
        to="/settings/support"
        label={l`Support`}>
        <SettingsList.ItemIcon icon={HelpIcon} />
        <SettingsList.ItemText>
          <Trans>Support</Trans>
        </SettingsList.ItemText>
      </SettingsList.LinkItem>
      <SettingsList.LinkItem
        testID="settings-data"
        to="/settings/data"
        label={l`Your data`}>
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
    </SettingsList.Container>
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
  const visible = (categories ?? []).filter(c => !c.hidden).length
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
