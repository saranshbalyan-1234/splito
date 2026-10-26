import {View} from 'react-native'
import {
  BedDouble,
  Car,
  Circle,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Ticket,
  Utensils,
} from 'lucide-react-native'

import {usePref} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {createIcon} from '#/components/icons/lucide'
import {Banknote_Stroke2_Corner0_Rounded as BanknoteIcon} from '#/components/icons/Money'

/* Lucide glyphs (ISC) for the default category icon names in the preferences registry. */
const GLYPHS = {
  utensils: createIcon(Utensils),
  car: createIcon(Car),
  bed: createIcon(BedDouble),
  'shopping-bag': createIcon(ShoppingBag),
  ticket: createIcon(Ticket),
  receipt: createIcon(Receipt),
  'shopping-cart': createIcon(ShoppingCart),
  circle: createIcon(Circle),
} as const

const SIZE = 42

/**
 * The leading tile of a history row, in the place Bluesky puts an avatar:
 * the expense's category glyph, or a banknote for a recorded payment.
 */
export function EntryIcon({
  category,
  isPayment = false,
}: {
  category?: string
  isPayment?: boolean
}) {
  const t = useTheme()
  const [categories] = usePref('categories')
  const icon = categories?.find(c => c.id === category)?.icon
  const Glyph = isPayment
    ? BanknoteIcon
    : (GLYPHS[icon as keyof typeof GLYPHS] ?? GLYPHS.receipt)

  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        isPayment ? a.rounded_full : {borderRadius: 10},
        isPayment
          ? {backgroundColor: t.palette.primary_50}
          : t.atoms.bg_contrast_50,
        {width: SIZE, height: SIZE},
      ]}>
      <Glyph
        size="md"
        fill={
          isPayment ? t.palette.primary_500 : t.atoms.text_contrast_high.color
        }
      />
    </View>
  )
}
