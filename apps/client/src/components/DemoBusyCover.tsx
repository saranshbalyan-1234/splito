import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {useDemoProgress} from '#/state/demo'
import {IS_WEB} from '#/env'
import {atoms as a, useTheme} from '#/alf'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

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
        <Loader size="lg" />
        <Text testID="demo-busy-text" style={[a.text_md, a.font_semi_bold]}>
          {done === null ? <Trans>Switching…</Trans> : <Trans>Setting up the demo… {Math.round(done * 100)}%</Trans>}
        </Text>
      </View>
    </View>
  )
}

export default Busy
