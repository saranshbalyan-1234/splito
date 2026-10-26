import {Trans} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'

import {atoms as a, type TextStyleProp, useTheme} from '#/alf'
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
