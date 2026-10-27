/* Lucide glyphs (ISC) for Settings rows; Bluesky's licensed glyphs are never copied. */
import {
  ALargeSmall,
  ArrowDownWideNarrow,
  ArrowLeftToLine,
  ArrowRightToLine,
  Banknote,
  BellRing,
  Calculator,
  CalendarDays,
  Clock,
  Coins,
  Contrast,
  Eye,
  EyeOff,
  Hash,
  History,
  Languages,
  LayoutGrid,
  Palette,
  Rows3,
  Sigma,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Split,
  TextSearch,
  Users,
  Vibrate,
} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

export const PhoneIcon = createIcon(Smartphone)
export const TextSizeIcon = createIcon(ALargeSmall)
export const PaletteIcon = createIcon(Palette)
export const DensityIcon = createIcon(Rows3)
export const SparklesIcon = createIcon(Sparkles)
export const VibrateIcon = createIcon(Vibrate)
export const TabsIcon = createIcon(LayoutGrid)
export const DefaultsIcon = createIcon(SlidersHorizontal)
export const CurrencyIcon = createIcon(Coins)
export const SplitIcon = createIcon(Split)
export const LanguageIcon = createIcon(Languages)
export const ClockIcon = createIcon(Clock)
export const CalendarIcon = createIcon(CalendarDays)
export const NumberIcon = createIcon(Hash)
export const SortIcon = createIcon(ArrowDownWideNarrow)
export const GroupsIcon = createIcon(Users)
export const SwipeLeftIcon = createIcon(ArrowLeftToLine)
export const SwipeRightIcon = createIcon(ArrowRightToLine)
export const NotifyIcon = createIcon(BellRing)
export const EyeIcon = createIcon(Eye)
export const EyeOffIcon = createIcon(EyeOff)
export const CashIcon = createIcon(Banknote)
export const KeypadIcon = createIcon(Calculator)
export const ShorthandIcon = createIcon(Sigma)
export const ContrastIcon = createIcon(Contrast)
/** Recently deleted: how long deleted items stay. */
export const BinIcon = createIcon(History)
export const SearchHistoryIcon = createIcon(TextSearch)
