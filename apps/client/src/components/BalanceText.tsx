import {Trans} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'

import {View} from 'react-native'

import {atoms as a, type TextStyleProp, useTheme} from '#/alf'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Text} from '#/components/Typography'
import {moneyGlyph, useMoneyStyle} from '#/components/MoneyDirection'

/**
 * One currency's balance in words, the amount emphasised, marked with an
 * arrow (in: money comes to you, out: you pay) and coloured by direction in
 * the `moneyPalette` colours. `subject` picks the
 * wording: a person ("owes you" / "you owe") or a group ("you are owed").
 */
export function BalanceText({
  amount,
  currency,
  locale,
  subject = 'person',
  isCompact = false,
  testID,
  style,
}: {
  /** The figure at the label's size, for rows whose title should lead. */
  isCompact?: boolean
  amount: bigint
  currency: string
  locale: string
  subject?: 'person' | 'group'
  testID?: string
} & TextStyleProp) {
  const t = useTheme()
  const money = useMoneyStyle()
  /* Arrow, word and figure: direction never rests on colour alone (F-1801). */
  const figure = `${moneyGlyph(amount)}\u00a0${formatAmount(magnitude(amount), currency, locale)}`
  const figureStyle = [
    isCompact ? a.text_sm : a.text_md,
    a.font_semi_bold,
    {fontVariant: ['tabular-nums' as const]},
    money.style(amount),
  ]

  return (
    <Text
      testID={testID}
      numberOfLines={1}
      style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium, style]}>
      {amount === ZERO ? (
        <Trans>settled up</Trans>
      ) : amount > ZERO ? (
        subject === 'person' ? (
          <Trans>
            owes you <Text style={figureStyle}>{figure}</Text>
          </Trans>
        ) : (
          <Trans>
            you are owed <Text style={figureStyle}>{figure}</Text>
          </Trans>
        )
      ) : (
        <Trans>
          you owe <Text style={figureStyle}>{figure}</Text>
        </Trans>
      )}
    </Text>
  )
}

/** A settled balance as a state: a muted pill with a check, never a bare grey word. */
export function SettledPill({testID}: {testID?: string}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_2xs,
        a.rounded_full,
        a.pl_xs,
        a.pr_sm,
        a.py_2xs,
        t.atoms.bg_contrast_50,
      ]}>
      <CheckIcon size="xs" fill={t.atoms.text_contrast_medium.color} />
      <Text
        style={[
          a.text_xs,
          a.font_semi_bold,
          a.leading_tight,
          t.atoms.text_contrast_medium,
        ]}>
        <Trans>Settled up</Trans>
      </Text>
    </View>
  )
}

/**
 * A balance as a right-aligned block, label over figure ("you are owed" /
 * "₹20,011.00"), as finance apps set amounts in a list; one block per
 * currency.
 */
export function BalanceBlock({
  amount,
  currency,
  locale,
  subject = 'person',
  testID,
}: {
  amount: bigint
  currency: string
  locale: string
  subject?: 'person' | 'group'
  testID?: string
}) {
  const t = useTheme()
  const money = useMoneyStyle()
  return (
    <View testID={testID} style={[a.align_end]}>
      <Text
        numberOfLines={1}
        style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
        {amount > ZERO ? (
          subject === 'person' ? (
            <Trans>owes you</Trans>
          ) : (
            <Trans>you are owed</Trans>
          )
        ) : (
          <Trans>you owe</Trans>
        )}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          a.text_md,
          a.font_semi_bold,
          a.leading_snug,
          {fontVariant: ['tabular-nums']},
          money.style(amount),
        ]}>
        {/* Arrow, word and figure: direction never rests on colour alone (F-1801). */}
        {`${moneyGlyph(amount)}\u00a0${formatAmount(magnitude(amount), currency, locale)}`}
      </Text>
    </View>
  )
}
