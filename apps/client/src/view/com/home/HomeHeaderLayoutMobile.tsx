// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/home/HomeHeaderLayoutMobile.tsx
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'

import {PressableScale} from '#/motion/PressableScale'
import {useShellHeaderLayout} from '#/state/shell/shell-layout'
import {atoms as a, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import {NotificationsBell} from '#/components/NotificationsBell'

/*
 * Bluesky fixes this header to the top and slides it away on scroll (minimal
 * shell mode). Splito keeps navigation visible, so the header stays in flow
 * (Layout.Header.Outer is sticky on web). The account avatar takes the drawer
 * menu button's place on the left; Add friend and the notifications bell sit
 * on the right, with an empty slot on the left to keep the logo centred
 * (owner directive). The logo is the home link, inactive here
 * because this header is on People.
 */
/** People's one header action (owner header rule). */
export function AddFriendButton() {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  return (
    <Layout.Header.IconButton
      testID="people-add-friend"
      icon={PersonPlusIcon}
      label={l`Add friend`}
      onPress={() => navigation.navigate('AddFriend')}
    />
  )
}

export function HomeHeaderLayoutMobile({
  children,
}: {
  children: React.ReactNode
  tabBarAnchor: React.ReactElement | null | undefined
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {onLayout} = useShellHeaderLayout()

  return (
    <Animated.View style={[a.z_10, t.atoms.bg]} onLayout={onLayout}>
      <Layout.Header.Outer noBottomBorder>
        <HeaderAvatar />
        <Layout.Header.Slot />

        <View style={[a.flex_1, a.align_center]}>
          <PressableScale
            testID="logo"
            targetScale={0.9}
            accessibilityRole="link"
            accessibilityLabel={l`Splito - People`}
            aria-disabled={true}
            disabled={true}>
            <LogoMark size={30} />
          </PressableScale>
        </View>

        <AddFriendButton />
        <NotificationsBell />
      </Layout.Header.Outer>
      {children}
    </Animated.View>
  )
}
