import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

/**
 * Temporary body for routes whose feature stream has not landed yet: a
 * Bluesky header plus an honest note. Every file that renders this carries a
 * `STUB-OWNER` comment naming the stream that replaces it. Top-level routes
 * (no back button) carry the account avatar at the right, as every tab does.
 */
export function StubScreen({
  testID,
  title,
  canGoBack = true,
}: {
  testID: string
  title: string
  canGoBack?: boolean
}) {
  const t = useTheme()
  return (
    <Layout.Screen testID={testID}>
      <Layout.Header.Outer>
        {canGoBack ? <Layout.Header.BackButton /> : null}
        <Layout.Header.Content align={canGoBack ? 'platform' : 'left'}>
          <Layout.Header.TitleText>{title}</Layout.Header.TitleText>
        </Layout.Header.Content>
        {canGoBack ? <Layout.Header.Slot /> : <HeaderAvatar />}
      </Layout.Header.Outer>
      <View style={[a.px_xl, a.py_2xl, a.gap_xs, a.align_center]}>
        <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
          <Trans>This screen is being built</Trans>
        </Text>
        <Text
          style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
          <Trans>Your data is safe on this device.</Trans>
        </Text>
      </View>
    </Layout.Screen>
  )
}
