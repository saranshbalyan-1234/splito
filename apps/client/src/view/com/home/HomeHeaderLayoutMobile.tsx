// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/home/HomeHeaderLayoutMobile.tsx
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'

import {PressableScale} from '#/lib/custom-animations/PressableScale'
import {useShellHeaderLayout} from '#/state/shell/shell-layout'
import {atoms as a, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import * as Layout from '#/components/Layout'

/*
 * Bluesky fixes this header to the top and slides it away on scroll (minimal
 * shell mode). Splito keeps navigation visible, so the header stays in flow
 * (Layout.Header.Outer is sticky on web). The drawer menu button and feeds
 * link are removed; their slots stay so the logo keeps its centre position.
 * The logo is the home link, inactive here because this header is on People.
 */
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

        <Layout.Header.Slot />
      </Layout.Header.Outer>
      {children}
    </Animated.View>
  )
}
