import {Trans} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'

import {atoms as a, type TextStyleProp, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * One currency's balance in words, the amount emphasised and coloured by
 * direction (green: money comes to you, red: you pay). `subject` picks the
 * wording: a person ("owes you" / "you owe") or a group ("you are owed").
 */
export function BalanceText({
  amount,
  currency,
  locale,
  subject = 'person',
  testID,
  style,
}: {
  amount: bigint
  currency: string
  locale: string
  subject?: 'person' | 'group'
  testID?: string
} & TextStyleProp) {
  const t = useTheme()
  const figure = formatAmount(magnitude(amount), currency, locale)
  const figureStyle = [
    a.text_md,
    a.font_semi_bold,
    {
      color: amount > ZERO ? t.palette.positive_600 : t.palette.negative_500,
      fontVariant: ['tabular-nums' as const],
    },
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
