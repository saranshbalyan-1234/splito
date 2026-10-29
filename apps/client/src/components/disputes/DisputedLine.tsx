import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'
import {formatAmount, ZERO} from '@splito/domain'

import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {DisputedIcon} from './icons'

/**
 * "of which ₹400 disputed" under a balance, one line per currency (26.20): the part of the balance that sits on
 * disputed or held records. The balance itself still counts them; this only says how much is being questioned.
 * Nothing for a currency with none.
 */
export function DisputedLine({amounts, testID = 'disputed-line'}: {amounts: ReadonlyArray<{currency: string; amount: bigint}>; testID?: string}) {
  const t = useTheme()
  const locale = useNumberLocale()
  const shown = amounts.filter(x => x.amount > ZERO)
  if (shown.length === 0) return null
  return (
    <View testID={testID} style={[a.gap_2xs]}>
      {shown.map(({currency, amount}) => {
        const figure = formatAmount(amount, currency, locale)
        return (
          <View key={currency} style={[a.flex_row, a.align_center, a.gap_xs]}>
            <DisputedIcon size="xs" fill={t.palette.yellow} />
            <Text testID={`${testID}-${currency}`} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium, {fontVariant: ['tabular-nums']}]}>
              <Trans>of which {figure} disputed</Trans>
            </Text>
          </View>
        )
      })}
    </View>
  )
}
