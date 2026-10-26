// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/AppearanceSettings.tsx (screen frame)
import {Fragment} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {type PrefGroup, resetPref} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'

import {useHaptics} from '#/lib/haptics'
import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {useData} from '#/data/StoreProvider'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as ResetIcon} from '#/components/icons/ArrowRotate'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import {
  AboutSettings,
  HelpSettings,
  PrivacySettings,
} from '#/components/settings/AboutSettings'
import {PREF_CONTROLS} from '#/components/settings/prefControls'
import {
  isSettingsSection,
  prefsIn,
  useSectionInfo,
} from '#/components/settings/sections'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * One Settings page. Pages are generated from the preferences registry: the
 * route's section is a registry group, and each preference in it renders its
 * control, in registry order. `/settings/about`, `/help` and `/privacy` are
 * the pages that are not groups.
 */
export function SettingsSectionScreen() {
  const {t: l} = useLingui()
  const {section} =
    useRoute<RouteProp<AllNavigatorParams, 'SettingsSection'>>().params
  const sections = useSectionInfo()

  if (section === 'about') {
    return (
      <Frame title={l`About`}>
        <AboutSettings />
      </Frame>
    )
  }
  if (section === 'help') {
    return (
      <Frame title={l`Help`}>
        <HelpSettings />
      </Frame>
    )
  }
  if (section === 'privacy') {
    return (
      <Frame title={l`Privacy`}>
        <PrivacySettings />
      </Frame>
    )
  }
  if (!isSettingsSection(section)) {
    return (
      <Frame title={l`Settings`}>
        <NotFound />
      </Frame>
    )
  }
  return (
    <Frame title={sections[section].title}>
      <Section group={section} title={sections[section].title} />
    </Frame>
  )
}

function Frame({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <Layout.Screen testID="screen-settings-section">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <Layout.Content>
          <SettingsList.Container>{children}</SettingsList.Container>
        </Layout.Content>
      </Layout.Screen>
    </LayoutAnimationConfig>
  )
}

function Section({group, title}: {group: PrefGroup; title: string}) {
  const {t: l} = useLingui()
  const {store, ctx} = useData()
  const haptics = useHaptics()
  const resetPrompt = Prompt.usePromptControl()
  const keys = prefsIn(group)
  const controls = keys.flatMap(key => {
    const Control = PREF_CONTROLS[key]
    return Control ? [{key, Control}] : []
  })

  return (
    <>
      {group === 'notifications' && (
        <Notice>
          <Trans>
            Notifications start once you sign in and turn on sync. Your choices
            are saved now and apply from then.
          </Trans>
        </Notice>
      )}
      {controls.map(({key, Control}, i) => (
        <Fragment key={key}>
          {i > 0 && <SettingsList.Divider />}
          <Control />
        </Fragment>
      ))}
      <SettingsList.Divider />
      <SettingsList.PressableItem
        testID="settings-section-reset"
        destructive
        label={l`Reset ${title}`}
        onPress={() => resetPrompt.open()}>
        <SettingsList.ItemIcon icon={ResetIcon} />
        <SettingsList.ItemText>
          <Trans>Reset this page</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>

      <Prompt.Basic
        control={resetPrompt}
        title={l`Reset ${title}?`}
        description={l`Everything on this page goes back to how Splito starts.`}
        confirmButtonCta={l`Reset`}
        confirmButtonColor="negative"
        onConfirm={() => {
          void (async () => {
            for (const key of keys) await resetPref(store, ctx, key)
            haptics.success()
            Toast.show(l`${title} reset`)
          })()
        }}
      />
    </>
  )
}

/** An honest note at the top of a page, in Bluesky's info-admonition style. */
function Notice({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <View style={[a.px_xl, a.pt_xs, a.pb_md]}>
      <View
        style={[
          a.flex_row,
          a.gap_sm,
          a.p_md,
          a.rounded_sm,
          a.border,
          t.atoms.border_contrast_low,
          t.atoms.bg_contrast_25,
        ]}>
        <InfoIcon size="md" fill={t.palette.primary_500} />
        <Text
          style={[
            a.flex_1,
            a.text_sm,
            a.leading_snug,
            t.atoms.text_contrast_high,
          ]}>
          {children}
        </Text>
      </View>
    </View>
  )
}

function NotFound() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  return (
    <View style={[a.px_xl, a.py_5xl, a.gap_md, a.align_center]}>
      <Text style={[a.text_xl, a.font_bold, a.text_center]}>
        <Trans>This settings page doesn't exist</Trans>
      </Text>
      <Text style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
        <Trans>It may have moved. Everything is still in Settings.</Trans>
      </Text>
      <Button
        label={l`Go to Settings`}
        onPress={() => navigation.navigate('Settings')}
        size="small"
        color="primary">
        <ButtonText>
          <Trans>Go to Settings</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
