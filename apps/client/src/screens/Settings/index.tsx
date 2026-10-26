// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx
import {View} from 'react-native'
import {resetAllPrefs} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {useData} from '#/data/StoreProvider'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as ResetIcon} from '#/components/icons/ArrowRotate'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import {SETTINGS_SECTIONS, useSectionInfo} from '#/components/settings/sections'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

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
  const resetPrompt = Prompt.usePromptControl()

  return (
    <Layout.Screen testID="screen-settings">
      <Layout.Header.Outer>
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
            </SettingsList.LinkItem>
          ))}
          <SettingsList.Divider />
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

      <Prompt.Basic
        control={resetPrompt}
        title={l`Reset all settings?`}
        description={l`Theme, tabs, categories, language and every other setting go back to how Splito starts. Your people, groups and expenses stay as they are.`}
        confirmButtonCta={l`Reset all`}
        confirmButtonColor="negative"
        onConfirm={() => {
          void resetAllPrefs(store, ctx).then(() => {
            haptics.success()
            Toast.show(l`Settings reset`)
          })
        }}
      />
    </Layout.Screen>
  )
}
