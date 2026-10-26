import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, type PersonSummary, ZERO} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import {currencyName} from '#/components/people/ledger'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * One card per currency (never added together): who owes whom, the total,
 * and - when groups are included - what is direct and what each shared
 * group contributes. The People summary card's look.
 */
export function PersonBalances({
  name,
  summary,
  groupNames,
  locale,
}: {
  name: string
  summary: PersonSummary | undefined
  groupNames: Map<string, string>
  locale: string
}) {
  const t = useTheme()
  const byCurrency = summary?.byCurrency ?? {}
  const currencies = Object.keys(byCurrency)
    .filter(c => byCurrency[c]!.total !== ZERO || hasParts(byCurrency[c]!))
    .sort()

  if (currencies.length === 0) {
    return (
      <View style={[a.px_lg, a.pb_lg]}>
        <View
          testID="person-settled"
          style={[
            a.flex_row,
            a.align_center,
            a.gap_sm,
            a.px_lg,
            a.py_md,
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_low,
            {maxWidth: 480},
          ]}>
          <CheckIcon size="md" fill={t.palette.positive_600} />
          <Text style={[a.flex_1, a.text_md, a.leading_snug]}>
            <Trans>You and {name} are settled up.</Trans>
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[a.px_lg, a.pb_lg, a.flex_row, a.flex_wrap, a.gap_md]}>
      {currencies.map(currency => (
        <BalanceCard
          key={currency}
          name={name}
          currency={currency}
          balance={byCurrency[currency]!}
          groupNames={groupNames}
          locale={locale}
        />
      ))}
    </View>
  )
}

function hasParts(c: PersonSummary['byCurrency'][string]) {
  return Object.values(c.groups).some(v => v !== ZERO)
}

function BalanceCard({
  name,
  currency,
  balance,
  groupNames,
  locale,
}: {
  name: string
  currency: string
  balance: PersonSummary['byCurrency'][string]
  groupNames: Map<string, string>
  locale: string
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {total, direct, groups} = balance
  const color =
    total > ZERO
      ? t.palette.positive_600
      : total < ZERO
        ? t.palette.negative_500
        : t.atoms.text.color
  const parts = [
    ...(direct !== ZERO ? [{key: 'direct', label: l`Direct`, v: direct}] : []),
    ...Object.entries(groups)
      .filter(([, v]) => v !== ZERO)
      .map(([id, v]) => ({key: id, label: groupNames.get(id) ?? l`Group`, v}))
      .sort((x, y) => x.label.localeCompare(y.label)),
  ]
  // Direct-only balances need no breakdown; any group part explains the total.
  const showParts = parts.some(p => p.key !== 'direct')

  return (
    <View
      testID={`person-balance-${currency}`}
      style={[
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        a.px_lg,
        a.py_md,
        {flexBasis: 300, flexGrow: 1, maxWidth: 480},
      ]}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
        <Text
          testID={`person-direction-${currency}`}
          emoji
          numberOfLines={1}
          style={[
            a.flex_1,
            a.text_sm,
            a.font_semi_bold,
            t.atoms.text_contrast_medium,
          ]}>
          {total > ZERO ? (
            <Trans>{name} owes you</Trans>
          ) : total < ZERO ? (
            <Trans>You owe {name}</Trans>
          ) : (
            <Trans>Settled up</Trans>
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
            style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            {currency}
          </Text>
        </View>
      </View>
      <View style={a.pt_xs}>
        <AnimatedAmount
          testID={`person-total-${currency}`}
          minor={magnitude(total)}
          currency={currency}
          locale={locale}
          style={[a.text_3xl, a.font_bold, a.leading_tight, {color}]}
        />
      </View>
      {showParts && (
        <View
          style={[
            a.pt_md,
            a.mt_sm,
            a.gap_xs,
            a.border_t,
            t.atoms.border_contrast_low,
          ]}>
          {parts.map(part => (
            <View
              key={part.key}
              testID={`person-part-${currency}-${part.key}`}
              style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
              <Text
                emoji
                numberOfLines={1}
                style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
                {part.label}
              </Text>
              <Text
                style={[
                  a.text_sm,
                  a.font_semi_bold,
                  tabular,
                  {
                    color:
                      part.v > ZERO
                        ? t.palette.positive_600
                        : t.palette.negative_500,
                  },
                ]}>
                {(part.v > ZERO ? '+' : '−') +
                  formatAmount(magnitude(part.v), currency, locale)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/** Loading shape of the balance cards. */
export function PersonBalancesPlaceholder() {
  const t = useTheme()
  return (
    <View style={[a.px_lg, a.pb_lg]}>
      <View
        style={[
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
          a.px_lg,
          a.py_md,
          a.gap_sm,
          {maxWidth: 480},
        ]}>
        <Skeleton.Text style={[a.text_sm, {width: 120}]} />
        <Skeleton.Text style={[a.text_3xl, {width: 180}]} />
      </View>
    </View>
  )
}
