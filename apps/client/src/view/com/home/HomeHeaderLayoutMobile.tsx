// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/home/HomeHeaderLayoutMobile.tsx
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {HidingHeader} from '#/lib/MainScrollProvider'
import {type NavigationProp} from '#/lib/routes/types'
import {PressableScale} from '#/motion/PressableScale'
import {atoms as a} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'

/*
 * As Bluesky, this header is fixed to the top and slides away on scroll down
 * (`HidingHeader`, Bluesky's minimal-shell behaviour). Add friend and the
 * account avatar sit on the right (owner: "move profile icon to top right"),
 * with as many empty slots on the left to keep the logo centred. The logo is the home link, inactive here because this
 * header is on People.
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
  const {t: l} = useLingui()

  return (
    <HidingHeader>
      <Layout.Header.Outer>
        {/* Empty slots as wide as the action and avatar on the right, so the logo stays centred. */}
        <Layout.Header.Slot />
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
        <HeaderAvatar />
      </Layout.Header.Outer>
      {children}
    </HidingHeader>
  )
}
