import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {passwordStrength} from '#/lib/auth/password'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/** Three bars and a word under a new password: how strong it is (owner 141). Nothing is shown for an empty field. */
export function StrengthMeter({password}: {password: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  if (!password) return null
  const strength = passwordStrength(password)
  const label = [l`Too short: use at least 8 characters`, l`Weak`, l`Fair`, l`Strong`][strength]!
  const color = strength === 3 ? t.palette.positive_500 : strength === 0 ? t.palette.negative_500 : t.palette.primary_500
  return (
    <View testID="password-strength" accessibilityLabel={label} style={[a.gap_xs]}>
      <View style={[a.flex_row, a.gap_xs]}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[a.flex_1, a.rounded_full, {height: 4, backgroundColor: i <= strength ? color : t.palette.contrast_100}]} />
        ))}
      </View>
      <Text testID="password-strength-label" style={[a.text_sm, t.atoms.text_contrast_medium]}>
        {label}
      </Text>
    </View>
  )
}
