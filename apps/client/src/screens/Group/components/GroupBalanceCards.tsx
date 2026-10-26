import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'
import {magnitude, ZERO} from '@splito/domain'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'

/**
 * My balance in a group: one card with a cell per currency (never added
 * together), as People's summary. Settle up is the page header's action
 * (owner header rule), so the card has none of its own.
 */
export function GroupBalanceCards({
  openCurrencies,
  mine,
  locale,
}: {
  openCurrencies: string[]
  mine: Record<string, bigint>
  locale: string
}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const isSettled = openCurrencies.length === 0

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_1, a.flex_row, a.flex_wrap]}>
        {isSettled ? (
          <View
            testID="group-my-balance"
            style={[a.flex_row, a.align_center, a.gap_sm, a.px_lg, a.py_md]}>
            <CheckIcon size="md" fill={t.palette.positive_600} />
            <Text style={[a.flex_1, a.text_md, a.leading_snug]}>
              <Trans>You’re settled up in this group.</Trans>
            </Text>
          </View>
        ) : (
          openCurrencies.map((currency, i) => {
            const net = mine[currency]!
            return (
              <View
                key={currency}
                testID={`group-my-balance-${currency}`}
                style={[
                  a.px_lg,
                  a.py_md,
                  {flexBasis: 140, flexGrow: 1},
                  i > 0 && [a.border_l, t.atoms.border_contrast_low],
                ]}>
                <Text
                  numberOfLines={1}
                  style={[
                    a.text_sm,
                    a.font_medium,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {net > ZERO ? (
                    <Trans>You are owed</Trans>
                  ) : (
                    <Trans>You owe</Trans>
                  )}
                </Text>
                <View style={a.pt_2xs}>
                  <AnimatedAmount
                    minor={magnitude(net)}
                    currency={currency}
                    locale={locale}
                    style={[
                      gtMobile ? a.text_3xl : a.text_2xl,
                      a.font_bold,
                      a.leading_tight,
                      {
                        color:
                          net > ZERO
                            ? t.palette.positive_600
                            : t.palette.negative_500,
                      },
                    ]}
                  />
                </View>
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}
