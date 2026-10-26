// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useMe} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {ChartPie_Stroke2_Corner0_Rounded as ChartPieIcon} from '#/components/icons/ChartPie'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon} from '#/components/icons/Settings'
import * as Layout from '#/components/Layout'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'

/*
 * Bluesky's Settings index, as Splito's Profile page (opened from the header
 * avatar menu): the account block, then rows. Account switching, moderation,
 * sign-out and developer options are removed; sign-in arrives with sync, and
 * its row says so.
 */
export function ProfileScreen() {
  const {t: l} = useLingui()
  const me = useMe()

  return (
    <Layout.Screen testID="screen-profile">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Profile</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <View
            style={[
              a.px_xl,
              a.pt_md,
              a.pb_md,
              a.w_full,
              a.gap_2xs,
              a.align_center,
              {minHeight: 160},
            ]}>
            {me ? (
              <ProfilePreview name={me.data.name} />
            ) : (
              <ProfilePreviewPlaceholder />
            )}
          </View>
          <SettingsList.Divider />
          <SettingsList.LinkItem
            testID="profile-analytics"
            to="/analytics"
            label={l`Analytics`}>
            <SettingsList.ItemIcon icon={ChartPieIcon} />
            <SettingsList.ItemText>
              <Trans>Analytics</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            testID="profile-settings"
            to="/settings"
            label={l`Settings`}>
            <SettingsList.ItemIcon icon={SettingsIcon} />
            <SettingsList.ItemText>
              <Trans>Settings</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            testID="profile-about"
            to="/settings/about"
            label={l`About`}>
            <SettingsList.ItemIcon icon={InfoIcon} />
            <SettingsList.ItemText>
              <Trans>About</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.Divider />
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={CloudIcon} />
            <SettingsList.ItemText>
              <Trans>Sign in and sync</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeText>
              <Trans>Coming with sync</Trans>
            </SettingsList.BadgeText>
          </SettingsList.Item>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

function ProfilePreview({name}: {name: string}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()

  return (
    <>
      <UserAvatar size={80} name={name} type="user" />

      <View
        style={[
          a.flex_row,
          a.gap_xs,
          a.align_center,
          a.justify_center,
          a.w_full,
        ]}>
        <Text
          emoji
          testID="profileHeaderDisplayName"
          numberOfLines={1}
          style={[
            a.pt_sm,
            t.atoms.text,
            gtMobile ? a.text_4xl : a.text_3xl,
            a.font_bold,
          ]}>
          {name}
        </Text>
      </View>
      <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>Saved on this device</Trans>
      </Text>
    </>
  )
}

function ProfilePreviewPlaceholder() {
  return (
    <Shimmer
      testID="profile-loading"
      style={[a.w_full, a.gap_2xs, a.align_center]}>
      <Skeleton.Circle size={80} />
      <Skeleton.Text style={[a.text_3xl, a.mt_sm, {width: 160}]} />
      <Skeleton.Text style={[a.text_md, {width: 140}]} />
    </Shimmer>
  )
}
