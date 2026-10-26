// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/home/HomeHeaderLayout.web.tsx
import {type JSX} from 'react'

import {useShellHeaderLayout} from '#/state/shell/shell-layout'
import {HomeHeaderLayoutMobile} from '#/view/com/home/HomeHeaderLayoutMobile'
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
 * Bluesky's desktop home header is the centred logo above the feed tabs.
 * Splito's logo already heads the sidebar, so the row holds only the account
 * avatar at its right (owner directive), then the sticky slot for the tabs.
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
        <Layout.Header.Content />
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
