import {ActivityIndicator, View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {useDemoProgress} from '#/state/demo'
import {IS_WEB} from '#/env'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * While a switch runs. The first switch on seeds a year of data into the separate demo database: that runs behind a
 * small progress pill and the app stays usable on the store it is on (the seed never touches it). Only the swap
 * itself, and switching off, cover the whole app, sheets and dialogs included (the shell draws this after them): the
 * store changes under the screens, so nothing can be touched for that moment.
 */
export function Busy() {
  const t = useTheme()
  const done = useDemoProgress()
  if (done !== null)
    return (
      <View
        testID="demo-progress"
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        style={[IS_WEB ? a.fixed : a.absolute, a.inset_0, a.align_center, a.justify_end, {zIndex: 10_000, paddingBottom: 96}]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm, a.rounded_full, a.px_lg, a.py_sm, a.shadow_md, t.atoms.bg_contrast_25]}>
          <ActivityIndicator size="small" />
          <Text testID="demo-busy-text" style={[a.text_sm, a.font_semi_bold]}>
            <Trans>Setting up the demo… {Math.round(done * 100)}%</Trans>
          </Text>
        </View>
      </View>
    )
  return (
    <View
      testID="demo-busy"
      accessibilityViewIsModal
      style={[IS_WEB ? a.fixed : a.absolute, a.inset_0, a.align_center, a.justify_center, {zIndex: 10_000}]}>
      <View style={[a.absolute, a.inset_0, {backgroundColor: t.palette.black, opacity: 0.5}]} />
      <View style={[a.rounded_md, a.p_xl, a.gap_md, a.align_center, t.atoms.bg]}>
        <ActivityIndicator />
        <Text testID="demo-busy-text" style={[a.text_md, a.font_semi_bold]}>
          <Trans>Switching…</Trans>
        </Text>
      </View>
    </View>
  )
}

export default Busy
