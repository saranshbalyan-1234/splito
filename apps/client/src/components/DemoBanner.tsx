import {ActivityIndicator, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {useDemoMode, useDemoProgress} from '#/state/demo'
import {IS_WEB} from '#/env'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {ButtonText} from '#/components/Button'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * "Demo mode · Switch back" (ARCHITECTURE 26.1), drawn once by the shell above
 * every screen while the app is on the separate demo database, so nobody
 * mistakes the sample data for their own. The button turns demo mode off; the
 * store swap itself takes the app back to the first tab. Dev and e2e builds
 * only: loaded on demand (the `demoStaticImport` rule).
 */
export function Banner() {
  const {t: l} = useLingui()
  const insets = useSafeAreaInsets()
  const {busy, setDemo} = useDemoMode()

  const switchBack = () => setDemo(false).catch(() => Toast.show(l`Couldn’t switch back. Try again.`, {type: 'error'}))

  // The shell hides the top inset from what is below, so the banner is what clears the status bar.
  return (
    <View testID="demo-banner" style={[a.px_md, a.pb_xs, {paddingTop: insets.top + 8}]}>
      <Admonition.Outer type="tip">
        <Admonition.Row style={a.align_center}>
          <Admonition.Icon />
          <Admonition.Content style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
            <Admonition.Text>
              <Trans>Demo mode ·</Trans>
            </Admonition.Text>
            <Admonition.Button testID="demo-banner-switch-back" label={l`Switch back`} color="secondary" disabled={busy} onPress={switchBack}>
              <ButtonText>
                <Trans>Switch back</Trans>
              </ButtonText>
            </Admonition.Button>
          </Admonition.Content>
        </Admonition.Row>
      </Admonition.Outer>
    </View>
  )
}

/**
 * Covers the whole app while a switch or reset runs (the first one seeds a year of
 * data), sheets and dialogs included: the shell draws it after them. The store changes
 * under the screens when it ends; nothing typed meanwhile may land in either database,
 * so nothing can be touched until it is done.
 */
export function Busy() {
  const t = useTheme()
  const done = useDemoProgress()
  return (
    <View
      testID="demo-busy"
      accessibilityViewIsModal
      style={[IS_WEB ? a.fixed : a.absolute, a.inset_0, a.align_center, a.justify_center, {zIndex: 10_000}]}>
      <View style={[a.absolute, a.inset_0, {backgroundColor: t.palette.black, opacity: 0.5}]} />
      <View style={[a.rounded_md, a.p_xl, a.gap_md, a.align_center, t.atoms.bg]}>
        <ActivityIndicator />
        <Text testID="demo-busy-text" style={[a.text_md, a.font_semi_bold]}>
          {done === null ? <Trans>Switching…</Trans> : <Trans>Setting up the demo… {Math.round(done * 100)}%</Trans>}
        </Text>
      </View>
    </View>
  )
}

export default Banner
