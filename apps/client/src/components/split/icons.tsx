/* Lucide glyphs (ISC) used by the expense flow, in Bluesky's icon prop API (see `createIcon`). */
import {
  Calculator,
  Calendar,
  ChevronDown,
  ChevronLeft,
  Coins,
  Folder,
  History,
  Minus,
  ReceiptText,
  StickyNote,
  Users,
  Wallet,
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
/** Cash rounding (F-402). */
export const CoinsIcon = createIcon(Coins)
export const ReceiptIcon = createIcon(ReceiptText)
