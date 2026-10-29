import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {useDevCode} from '#/lib/auth/devCodes'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/** Dev and e2e builds: where a real build would send an email or SMS, the dev AuthClient's last code is shown here. Draws nothing in production (no dev code is ever set). */
export function DevBanner() {
  const t = useTheme()
  const sent = useDevCode()
  if (!sent) return null
  return (
    <View testID="dev-banner" role="status" style={[a.px_lg, a.py_sm, a.flex_row, a.gap_sm, a.justify_center, a.flex_wrap, {backgroundColor: t.palette.primary_100}]}>
      <Text style={[a.text_sm, a.font_semi_bold, {color: t.palette.primary_900}]}>
        <Trans>Dev build: code for {sent.to} is</Trans>
      </Text>
      <Text testID="dev-code" selectable style={[a.text_sm, a.font_bold, {color: t.palette.primary_900}]}>
        {sent.code}
      </Text>
    </View>
  )
}
