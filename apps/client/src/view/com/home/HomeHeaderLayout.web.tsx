// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/home/HomeHeaderLayout.web.tsx
import {type JSX} from 'react'
import {Trans} from '@lingui/react/macro'

import {useShellHeaderLayout} from '#/state/shell/shell-layout'
import {
  AddFriendButton,
  HomeHeaderLayoutMobile,
} from '#/view/com/home/HomeHeaderLayoutMobile'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import * as Layout from '#/components/Layout'

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
 * Bluesky's desktop home header heads the feed with its title, since the
 * sidebar already carries the logo. Splito's row adds Add friend and the
 * account avatar on the right (owner header rule), then the sticky slot for
 * the tabs.
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
        {/* Empty slots as wide as the action and avatar on the right, so the title stays centred. */}
        <Layout.Header.Slot />
        <Layout.Header.Slot />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>People</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <AddFriendButton />
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
