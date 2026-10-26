import {View} from 'react-native'
import {type Category, DEFAULT_CATEGORIES} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'
import {
  Baby,
  Bed,
  Beer,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Circle,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  type LucideIcon,
  Music,
  PawPrint,
  Pizza,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Ticket,
  Train,
  Utensils,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react-native'

import {atoms as a, utils} from '#/alf'
import {createIcon} from '#/components/icons/lucide'

/*
 * Category glyphs by the id stored in the `categories` preference. Lucide
 * (ISC). Unknown ids fall back to a plain circle, so a category synced from a
 * newer app version still renders.
 */
const GLYPHS: Record<string, LucideIcon> = {
  utensils: Utensils,
  pizza: Pizza,
  coffee: Coffee,
  beer: Beer,
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  gift: Gift,
  car: Car,
  fuel: Fuel,
  bus: Bus,
  train: Train,
  plane: Plane,
  bed: Bed,
  house: House,
  zap: Zap,
  wifi: Wifi,
  receipt: Receipt,
  'heart-pulse': HeartPulse,
  dumbbell: Dumbbell,
  ticket: Ticket,
  film: Film,
  music: Music,
  'gamepad-2': Gamepad2,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  wrench: Wrench,
  baby: Baby,
  'paw-print': PawPrint,
  tag: Tag,
  circle: Circle,
}

/** Icon ids offered when re-iconing a category, in picker order. */
export const CATEGORY_ICON_IDS = Object.keys(GLYPHS)

const ICONS = Object.fromEntries(
  Object.entries(GLYPHS).map(([id, glyph]) => [id, createIcon(glyph)]),
)

/** The category's glyph on a soft tint of its colour, the way Splito shows a category everywhere. */
export function CategoryIcon({
  category,
  size = 36,
}: {
  category: Pick<Category, 'icon' | 'color'>
  size?: number
}) {
  const Icon = ICONS[category.icon] ?? ICONS.circle!
  return (
    <View
      style={[
        a.rounded_full,
        a.align_center,
        a.justify_center,
        {
          width: size,
          height: size,
          backgroundColor: utils.alpha(category.color, 0.16),
        },
      ]}>
      <Icon width={Math.round(size * 0.5)} fill={category.color} />
    </View>
  )
}

/**
 * A category's display name. Built-in categories the user has not renamed
 * show in the UI language; anything the user typed shows as typed.
 */
export function useCategoryName() {
  const {t: l} = useLingui()
  const builtIn: Record<string, string> = {
    food: l`Food`,
    transport: l`Transport`,
    stay: l`Stay`,
    shopping: l`Shopping`,
    entertainment: l`Entertainment`,
    bills: l`Bills`,
    groceries: l`Groceries`,
    other: l`Other`,
  }
  return (category: Pick<Category, 'id' | 'name'>) => {
    const stock = DEFAULT_CATEGORIES.find(c => c.id === category.id)
    return stock?.name === category.name
      ? (builtIn[category.id] ?? category.name)
      : category.name
  }
}

/** A bare category glyph, for pickers. */
export function CategoryGlyph({
  icon,
  size = 20,
  color,
}: {
  icon: string
  size?: number
  color: string
}) {
  const Icon = ICONS[icon] ?? ICONS.circle!
  return <Icon width={size} fill={color} />
}
