import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Shapes_Stroke2_Corner0_Rounded as ShapesIcon} from '#/components/icons/Shapes'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {HeaderBell} from '#/features/notifications/HeaderBell'

/**
 * Temporary body for routes whose feature stream has not landed yet: the
 * header rule set plus an honest note. Every file that renders this carries
 * a `STUB-OWNER` comment naming the stream that replaces it. Pushed routes
 * get Back; top-level routes get the avatar, their `action` and the bell.
 */
export function StubScreen({
  testID,
  title,
  canGoBack = true,
  action,
  icon: Icon = ShapesIcon,
}: {
  testID: string
  title: string
  canGoBack?: boolean
  /** A top-level page's one header action (a `Layout.Header.ActionButton`). */
  action?: React.ReactNode
  /** Shown above the note, in the muted style of Bluesky's empty states. */
  icon?: React.ComponentType<SVGIconProps>
}) {
  const t = useTheme()
  return (
    <Layout.Screen testID={testID}>
      <Layout.Header.Outer>
        {canGoBack ? (
          <Layout.Header.BackButton />
        ) : (
          <>
            <HeaderAvatar />
            <Layout.Header.Slot />
          </>
        )}
        <Layout.Header.Content>
          <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
        </Layout.Header.Content>
        {canGoBack ? (
          <Layout.Header.Slot />
        ) : (
          <>
            {action ?? <Layout.Header.Slot />}
            <HeaderBell />
          </>
        )}
      </Layout.Header.Outer>
      <View style={[a.px_xl, a.pt_5xl, a.pb_2xl, a.gap_xs, a.align_center]}>
        <Icon
          size="3xl"
          style={[a.mb_md, {color: t.atoms.text_contrast_low.color}]}
        />
        <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
          <Trans>This screen is being built</Trans>
        </Text>
        <Text style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
          <Trans>Your data is safe on this device.</Trans>
        </Text>
      </View>
    </Layout.Screen>
  )
}
