/* Lucide glyphs (ISC) for the Activity feed: row actions, and the kind badges on avatars. */
import {
  AlarmClock,
  Archive,
  Banknote,
  BellRing,
  CheckCheck,
  CircleCheck,
  CircleDot,
  Eye,
  EyeOff,
  Handshake,
  MessageSquare,
  Pencil,
  Send,
  Plus,
  RotateCcw,
  Trash2,
  UserRoundCheck,
  UserRoundMinus,
  UserRoundPlus,
  Users,
} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

/* A tick marks read; a dot - the unread mark itself - marks unread. */
export const MarkReadIcon = createIcon(CircleCheck)
export const MarkUnreadIcon = createIcon(CircleDot)
/** "Mark all read": the double tick messaging apps use for read. */
export const MarkAllReadIcon = createIcon(CheckCheck)
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
/** A write-off ("Call it even"): a debt let go, not money that moved. */
export const WriteOffBadge = createIcon(Handshake, BADGE)
export const FriendAcceptedBadge = createIcon(UserRoundCheck, BADGE)
export const RequestSentBadge = createIcon(Send, BADGE)
/** Remind: a friendly nudge shared with someone. */
export const NudgeBadge = createIcon(BellRing, BADGE)
/** Remind me: a notification scheduled for myself. */
export const ReminderSetBadge = createIcon(AlarmClock, BADGE)
/** A comment on an expense or a payment. */
export const CommentBadge = createIcon(MessageSquare, BADGE)
