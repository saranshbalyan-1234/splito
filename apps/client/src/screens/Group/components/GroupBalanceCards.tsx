import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {magnitude, ZERO} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import {currencyName} from '#/components/people/ledger'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'

/**
 * My balance in a group, one card per currency (never added together), in
 * the same card as a friend's balance: direction, currency, the amount.
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
  const {i18n} = useLingui()

  if (openCurrencies.length === 0) {
    return (
      <View
        testID="group-my-balance"
        style={[
          a.flex_row,
          a.align_center,
          a.gap_sm,
          a.px_lg,
          a.py_md,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <CheckIcon size="md" fill={t.palette.positive_600} />
        <Text style={[a.flex_1, a.text_md, a.leading_snug]}>
          <Trans>You’re settled up in this group.</Trans>
        </Text>
      </View>
    )
  }

  return (
    <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
      {openCurrencies.map(currency => {
        const net = mine[currency]!
        return (
          <View
            key={currency}
            testID={`group-my-balance-${currency}`}
            style={[
              a.rounded_md,
              a.border,
              t.atoms.border_contrast_low,
              a.px_lg,
              a.py_md,
              {flexBasis: 280, flexGrow: 1},
            ]}>
            <View
              style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
              <Text
                style={[
                  a.text_sm,
                  a.font_semi_bold,
                  t.atoms.text_contrast_medium,
                ]}>
                {net > ZERO ? (
                  <Trans>You are owed</Trans>
                ) : (
                  <Trans>You owe</Trans>
                )}
              </Text>
              <View
                style={[
                  a.rounded_xs,
                  a.px_xs,
                  {paddingVertical: 1},
                  t.atoms.bg_contrast_50,
                ]}>
                <Text
                  accessibilityLabel={currencyName(currency, i18n.locale)}
                  style={[
                    a.text_xs,
                    a.font_semi_bold,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {currency}
                </Text>
              </View>
            </View>
            <View style={a.pt_xs}>
              <AnimatedAmount
                minor={magnitude(net)}
                currency={currency}
                locale={locale}
                style={[
                  a.text_3xl,
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
      })}
    </View>
  )
}
