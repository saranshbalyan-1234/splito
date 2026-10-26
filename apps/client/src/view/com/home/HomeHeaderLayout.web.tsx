// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/home/HomeHeaderLayout.web.tsx
import {type JSX} from 'react'
import {View} from 'react-native'

import {useShellHeaderLayout} from '#/state/shell/shell-layout'
import {
  AddFriendButton,
  HomeHeaderLayoutMobile,
} from '#/view/com/home/HomeHeaderLayoutMobile'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import * as Layout from '#/components/Layout'
import {NotificationsBell} from '#/components/NotificationsBell'

export function HomeHeaderLayout(props: {
  children: React.ReactNode
  tabBarAnchor: JSX.Element | null | undefined
}) {
  const {gtMobile} = useBreakpoints()
  if (!gtMobile) {
    return <HomeHeaderLayoutMobile {...props} />
  } else {
    return <HomeHeaderLayoutDesktopAndTablet {...props} />
  }
}

/*
 * Bluesky's desktop home header is the centred logo above the feed tabs.
 * Splito's row adds the account avatar on the left, and Add friend and the
 * notifications bell on the right (owner header rule), then the sticky slot for the tabs. The logo
 * here is a mark, not a link: the sidebar's logo is the home link.
 */
function HomeHeaderLayoutDesktopAndTablet({
  children,
  tabBarAnchor,
}: {
  children: React.ReactNode
  tabBarAnchor: JSX.Element | null | undefined
}) {
  const t = useTheme()
  const {onLayout} = useShellHeaderLayout()

  return (
    <>
      {/* Bordered like every other page's header, so the bar and avatar hold still across tabs. */}
      <Layout.Header.Outer>
        {/* Empty slots as wide as the action, bell and avatar on the right, so the title stays centred. */}
        <Layout.Header.Slot />
        <Layout.Header.Slot />
        <Layout.Header.Slot />
        <Layout.Header.Content>
          <View role="img" aria-label="Splito" style={[a.align_center]}>
            <LogoMark size={30} />
          </View>
        </Layout.Header.Content>
        <AddFriendButton />
        <NotificationsBell />
        <HeaderAvatar />
      </Layout.Header.Outer>
      {tabBarAnchor}
      {children ? (
        <Layout.Center
          style={[a.sticky, a.z_10, a.align_center, t.atoms.bg, {top: 0}]}
          onLayout={onLayout}>
          {children}
        </Layout.Center>
      ) : null}
    </>
  )
}
