/* Lucide glyphs (ISC) used by the expense flow, in Bluesky's icon prop API (see `createIcon`). */
import {
  Baby,
  Bed,
  Book,
  Briefcase,
  Calculator,
  Calendar,
  Car,
  ChevronDown,
  ChevronLeft,
  Shapes,
  Coffee,
  Coins,
  Delete,
  Dog,
  Dumbbell,
  Folder,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  Heart,
  History,
  House,
  Minus,
  Music,
  Phone,
  Pill,
  Plane,
  ReceiptText,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  StickyNote,
  Tag,
  Ticket,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Zap,
} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

export const CalendarIcon = createIcon(Calendar)
export const WalletIcon = createIcon(Wallet)
export const NotesIcon = createIcon(StickyNote)
export const CalculatorIcon = createIcon(Calculator)
export const GroupIcon = createIcon(Users)
/** A group picked for an expense: the container the expense files into. */
export const FolderIcon = createIcon(Folder)
export const ChevronDownIcon = createIcon(ChevronDown)
export const ChevronLeftIcon = createIcon(ChevronLeft)
export const HistoryIcon = createIcon(History)
export const MinusIcon = createIcon(Minus)
/** Backspace on the amount keypad. */
export const DeleteIcon = createIcon(Delete)
/** Cash rounding (F-402). */
export const CoinsIcon = createIcon(Coins)
export const ReceiptIcon = createIcon(ReceiptText)

/**
 * Category glyphs by the `icon` name stored in the categories preference.
 * Unknown names fall back to a plain circle, so a category from a newer
 * client still renders.
 */
const CATEGORY_ICONS = {
  utensils: createIcon(Utensils),
  car: createIcon(Car),
  bed: createIcon(Bed),
  'shopping-bag': createIcon(ShoppingBag),
  ticket: createIcon(Ticket),
  receipt: createIcon(ReceiptText),
  'shopping-cart': createIcon(ShoppingCart),
  /* "Other": a plain circle read as an empty, broken tile, so it draws Lucide shapes. */
  circle: createIcon(Shapes),
  coffee: createIcon(Coffee),
  plane: createIcon(Plane),
  home: createIcon(House),
  gift: createIcon(Gift),
  heart: createIcon(Heart),
  music: createIcon(Music),
  gamepad: createIcon(Gamepad2),
  dumbbell: createIcon(Dumbbell),
  book: createIcon(Book),
  briefcase: createIcon(Briefcase),
  fuel: createIcon(Fuel),
  pill: createIcon(Pill),
  shirt: createIcon(Shirt),
  baby: createIcon(Baby),
  dog: createIcon(Dog),
  wifi: createIcon(Wifi),
  zap: createIcon(Zap),
  phone: createIcon(Phone),
  film: createIcon(Film),
  tag: createIcon(Tag),
} as const

export function categoryIcon(name: string) {
  return (
    CATEGORY_ICONS[name as keyof typeof CATEGORY_ICONS] ?? CATEGORY_ICONS.circle
  )
}
