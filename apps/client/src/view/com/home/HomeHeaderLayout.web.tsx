// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/home/HomeHeaderLayout.web.tsx
import {type JSX} from 'react'
import {View} from 'react-native'

import {useShellHeaderLayout} from '#/state/shell/shell-layout'
import {HomeHeaderLayoutMobile} from '#/view/com/home/HomeHeaderLayoutMobile'
import {atoms as a, useBreakpoints, useGutters, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
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

/* The feeds link on the right is removed (no feeds); a matching spacer keeps the logo centred. */
function HomeHeaderLayoutDesktopAndTablet({
  children,
  tabBarAnchor,
}: {
  children: React.ReactNode
  tabBarAnchor: JSX.Element | null | undefined
}) {
  const t = useTheme()
  const {onLayout} = useShellHeaderLayout()
  const gutters = useGutters([0, 'base'])

  return (
    <>
      <Layout.Center>
        <View
          style={[a.flex_row, a.align_center, gutters, a.pt_md, t.atoms.bg]}>
          <View style={{width: 34}} />
          <View style={[a.flex_1, a.align_center, a.justify_center]}>
            <LogoMark size={28} />
          </View>
          <View style={{width: 34}} />
        </View>
      </Layout.Center>
      {tabBarAnchor}
      <Layout.Center
        style={[a.sticky, a.z_10, a.align_center, t.atoms.bg, {top: 0}]}
        onLayout={onLayout}>
        {children}
      </Layout.Center>
    </>
  )
}
