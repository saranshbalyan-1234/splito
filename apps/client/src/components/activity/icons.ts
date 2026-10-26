/* Lucide glyphs (ISC) for the Activity feed: row actions, and the kind badges on avatars. */
import {
  Archive,
  Banknote,
  Eye,
  EyeOff,
  Mail,
  MailOpen,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserRoundMinus,
  UserRoundPlus,
  Users,
} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

export const MarkReadIcon = createIcon(MailOpen)
export const MarkUnreadIcon = createIcon(Mail)
export const HideIcon = createIcon(EyeOff)
export const ShowIcon = createIcon(Eye)
export const DeleteIcon = createIcon(Trash2)

/* Badges are 14px on a 24px disc, so their strokes are heavier to stay legible. */
const BADGE = {strokeWidth: 2.75}
export const AddedBadge = createIcon(Plus, BADGE)
export const EditedBadge = createIcon(Pencil, BADGE)
export const DeletedBadge = createIcon(Trash2, BADGE)
export const RestoredBadge = createIcon(RotateCcw, BADGE)
export const FriendAddedBadge = createIcon(UserRoundPlus, BADGE)
export const FriendRemovedBadge = createIcon(UserRoundMinus, BADGE)
export const GroupBadge = createIcon(Users, BADGE)
export const ArchivedBadge = createIcon(Archive, BADGE)
export const PaymentBadge = createIcon(Banknote, BADGE)
