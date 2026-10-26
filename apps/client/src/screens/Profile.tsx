// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx
import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {useMe} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Accessibility_Stroke2_Corner2_Rounded as AccessibilityIcon} from '#/components/icons/Accessibility'
import {Bell_Stroke2_Corner0_Rounded as NotificationIcon} from '#/components/icons/Bell'
import {BulletList_Stroke2_Corner0_Rounded as ListIcon} from '#/components/icons/BulletList'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import {PaintRoller_Stroke2_Corner2_Rounded as PaintRollerIcon} from '#/components/icons/PaintRoller'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as SlidersIcon} from '#/components/icons/SettingsSlider'
import {Shapes_Stroke2_Corner0_Rounded as ShapesIcon} from '#/components/icons/Shapes'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

/*
 * Bluesky's Settings index, as Splito's Profile tab. Account switching,
 * moderation, sign-out and developer options are removed. The rows are the
 * preference registry's groups; their pages are not built yet, so the rows
 * are plain items (no chevron, no press) until they are.
 */
export function ProfileScreen() {
  const me = useMe()

  return (
    <Layout.Screen testID="screen-profile">
      <Layout.Header.Outer>
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
            {me && <ProfilePreview name={me.data.name} />}
          </View>
          <SettingsList.Divider />
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={PaintRollerIcon} />
            <SettingsList.ItemText>
              <Trans>Appearance</Trans>
            </SettingsList.ItemText>
          </SettingsList.Item>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={AccessibilityIcon} />
            <SettingsList.ItemText>
              <Trans>Motion</Trans>
            </SettingsList.ItemText>
          </SettingsList.Item>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={SlidersIcon} />
            <SettingsList.ItemText>
              <Trans>Defaults</Trans>
            </SettingsList.ItemText>
          </SettingsList.Item>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={ShapesIcon} />
            <SettingsList.ItemText>
              <Trans>Categories</Trans>
            </SettingsList.ItemText>
          </SettingsList.Item>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={EarthIcon} />
            <SettingsList.ItemText>
              <Trans>Regional</Trans>
            </SettingsList.ItemText>
          </SettingsList.Item>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={ListIcon} />
            <SettingsList.ItemText>
              <Trans>Lists</Trans>
            </SettingsList.ItemText>
          </SettingsList.Item>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={NotificationIcon} />
            <SettingsList.ItemText>
              <Trans>Notifications</Trans>
            </SettingsList.ItemText>
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
