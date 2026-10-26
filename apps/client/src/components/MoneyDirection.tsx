import {ArrowDownLeft, ArrowUpRight} from 'lucide-react-native'
import {ZERO} from '@splito/domain'

import {device, useStorage} from '#/storage'
import {atoms as a, type TextStyleProp, useTheme} from '#/alf'
import {COLORBLIND_MONEY} from '#/alf/money'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {createIcon} from '#/components/icons/lucide'

/** Money coming to you: the arrow points in, down-left (as banking apps mark money received). */
export const ToYouIcon = createIcon(ArrowDownLeft)
/** Money leaving you: the arrow points out, up-right. */
export const FromYouIcon = createIcon(ArrowUpRight)

/** Inline arrows for figures inside a sentence ("owes you ↙ ₹500"). */
export const TO_YOU_GLYPH = '↙'
export const FROM_YOU_GLYPH = '↗'

/**
 * Colour and weight for a signed amount from my side (positive: comes to me),
 * per the `moneyPalette` preference (F-1801). Direction is never colour
 * alone: every caller pairs this with a word ("owes you"), a sign or an
 * arrow, so the default, colour-blind and monochrome palettes all read in
 * grayscale. Monochrome shows direction by arrow and weight only. Read from
 * the preference's device mirror, so a list of rows costs no store reads.
 */
export function useMoneyStyle() {
  const t = useTheme()
  const [palette = 'default'] = useStorage(device, ['moneyPalette'])
  const scheme = t.scheme === 'light' ? 'light' : 'dark'
  const incoming =
    palette === 'colorblind'
      ? COLORBLIND_MONEY[scheme].incoming
      : palette === 'mono'
        ? t.atoms.text.color
        : t.palette.positive_600
  const outgoing =
    palette === 'colorblind'
      ? COLORBLIND_MONEY[scheme].outgoing
      : palette === 'mono'
        ? t.atoms.text_contrast_high.color
        : t.palette.negative_500
  const isMono = palette === 'mono'
  return {
    incoming,
    outgoing,
    /** The colour of a signed amount; zero takes the plain text colour. */
    color: (v: bigint) =>
      v > ZERO ? incoming : v < ZERO ? outgoing : t.atoms.text.color,
    /** Colour, plus weight in monochrome (incoming bold, outgoing regular). */
    style: (v: bigint) => [
      {color: v > ZERO ? incoming : v < ZERO ? outgoing : t.atoms.text.color},
      isMono ? (v > ZERO ? a.font_bold : a.font_normal) : null,
    ],
  }
}

/**
 * The arrow beside a balance figure: in for money that comes to you, out
 * for money you pay; nothing for zero. Decorative: the words next to it say
 * the same to screen readers.
 */
export function MoneyArrow({
  amount,
  size = 'sm',
  style,
}: {amount: bigint; size?: SVGIconProps['size']} & TextStyleProp) {
  const money = useMoneyStyle()
  if (amount === ZERO) return null
  const Icon = amount > ZERO ? ToYouIcon : FromYouIcon
  return (
    <Icon
      size={size}
      fill={money.color(amount)}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}

/** "↙" or "↗" before a figure inside running text; empty for zero. */
export function moneyGlyph(amount: bigint) {
  return amount > ZERO ? TO_YOU_GLYPH : amount < ZERO ? FROM_YOU_GLYPH : ''
}
