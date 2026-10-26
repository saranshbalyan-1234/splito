/* Lucide glyphs (ISC) for the category icon names stored in the `categories` preference. */
import {
  Bed,
  Car,
  Circle,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Ticket,
  Utensils,
} from 'lucide-react-native'
import {View} from 'react-native'

import {atoms as a} from '#/alf'
import {createIcon} from '#/components/icons/lucide'

const ICONS = {
  utensils: createIcon(Utensils),
  car: createIcon(Car),
  bed: createIcon(Bed),
  'shopping-bag': createIcon(ShoppingBag),
  ticket: createIcon(Ticket),
  receipt: createIcon(ReceiptText),
  'shopping-cart': createIcon(ShoppingCart),
  circle: createIcon(Circle),
}

/**
 * A category's glyph in its own colour on a soft tint of it, the size of
 * Bluesky's row avatars. Unknown icon names fall back to a circle.
 */
export function CategoryIcon({
  icon,
  color,
  size = 40,
}: {
  icon: string
  color: string
  size?: number
}) {
  const Icon = ICONS[icon as keyof typeof ICONS] ?? ICONS.circle
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        a.rounded_full,
        a.flex_shrink_0,
        /* 8-digit hex: the category colour at 14% over the surface. */
        {width: size, height: size, backgroundColor: `${color}24`},
      ]}>
      <Icon size={size >= 40 ? 'md' : 'sm'} fill={color} />
    </View>
  )
}
