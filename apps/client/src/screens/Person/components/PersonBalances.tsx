import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, type PersonSummary, ZERO} from '@splito/domain'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * One card per currency (never added together): who owes whom, the total,
 * and - when groups are included - what is direct and what each shared
 * group contributes. The People summary card's look. The caller places
 * and pads it.
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
        ]}>
        <CheckIcon size="md" fill={t.palette.positive_600} />
        <Text style={[a.flex_1, a.text_md, a.leading_snug]}>
          <Trans>You and {name} are settled up.</Trans>
        </Text>
      </View>
    )
  }

  return (
    <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
      {currencies.map(currency => (
        <BalanceCard
          key={currency}
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
  currency,
  balance,
  groupNames,
  locale,
}: {
  currency: string
  balance: PersonSummary['byCurrency'][string]
  groupNames: Map<string, string>
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
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
        {flexBasis: 280, flexGrow: 1},
        gtMobile && {maxWidth: 440},
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
          {/* The name is the page's heading, so the card only says which way. */}
          {total > ZERO ? (
            <Trans>Owes you</Trans>
          ) : total < ZERO ? (
            <Trans>You owe</Trans>
          ) : (
            <Trans>Settled up</Trans>
          )}
        </Text>
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
    <View
      style={[
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        a.px_lg,
        a.py_md,
        a.gap_sm,
      ]}>
      <Skeleton.Text style={[a.text_sm, {width: 120}]} />
      <Skeleton.Text style={[a.text_3xl, {width: 180}]} />
    </View>
  )
}
