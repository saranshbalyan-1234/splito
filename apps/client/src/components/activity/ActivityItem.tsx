// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Notifications/components/NotificationItem/Item/Root.tsx (+ Item/Avatar.tsx, Item/text.tsx; actions from src/screens/Messages/components/ChatListItem.tsx)
import {useState} from 'react'
import {
  type AccessibilityActionEvent,
  Pressable,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import {type I18n} from '@lingui/core'
import {defineMessage} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {expenseNet, formatAmount, magnitude, ZERO} from '@splito/domain'
import {type ActivityEvent, type SwipeAction} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {GestureActionView} from '#/lib/custom-animations/GestureActionView'
import {type GestureActions} from '#/lib/custom-animations/GestureActionView.shared'
import {dateDiff, formatDateDiff} from '#/lib/hooks/useTimeAgo'
import {type NavigationProp} from '#/lib/routes/types'
import {useRowPadding} from '#/state/preferences/density'
import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {hexToRgb, rgbToHex} from '#/alf/util/colorGeneration'
import {Button, ButtonIcon} from '#/components/Button'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {type Props as SVGIconProps} from '#/components/icons/common'
import * as Menu from '#/components/Menu'
import {SubtleHover} from '#/components/SubtleHover'
import {Text} from '#/components/Typography'
import {IS_NATIVE, IS_WEB, IS_WEB_TOUCH_DEVICE} from '#/env'
import {
  AddedBadge,
  ArchivedBadge,
  DeletedBadge,
  EditedBadge,
  FriendAddedBadge,
  FriendRemovedBadge,
  GroupBadge,
  PaymentBadge,
  RestoredBadge,
} from './icons'
import {daysAgo} from './feed'
import {type ActivityActions, type RowAction} from './useActivityActions'
import {type ActivitySnapshot} from './useActivityFeed'

/** The size of the row's avatar, for anything that stands in for it. */
export const AVATAR_SIZE = 44
/*
 * Splito avatars are initials, not photos, so the badge is a little smaller
 * than upstream's (24) and sits further out on the corner, clear of the
 * letters; it overhangs the slot's bottom into the row's padding.
 */
const BADGE_SIZE = 20
const BADGE_ICON_SIZE = 12
/** The ring around the badge, in the row's colour, sets it apart from the avatar. */
const BADGE_RING = 2
const BADGE_OVERHANG = 4
/** The space the avatar sits in, with room for the badge on its corner. */
export const SLOT_SIZE = {
  width: AVATAR_SIZE + 10,
  height: AVATAR_SIZE + 6,
}
/** Where the badge sits in the slot, shared with the loading skeleton. */
export const BADGE_POSITION = {
  end: 0,
  bottom: -BADGE_OVERHANG,
  padding: BADGE_RING,
} as const
const PREVIEW_AVATAR_SIZE = 28
const MAX_PREVIEW_AVATARS = 6
const ACTION_BUTTON_SIZE = 32
/** The web buttons' distance from the row's end. */
const ACTIONS_RIGHT = 12
/** The swipe distance that commits an action, as Bluesky's chat list. */
const SWIPE_THRESHOLD = 120

/** What a change's badge says by colour: added (primary), removed (negative), changed (neutral). */
type BadgeTone = 'primary' | 'negative' | 'neutral'

/**
 * The background of a row, faintly tinted while unread; the dot carries
 * the state. Light themes use `primary_25`; dark themes mix 7% of the
 * accent into the page colour, as the inverted palette's tints read too
 * strong there. Opaque, so the avatar badge's ring can take it.
 */
export function useRowBackgroundColor(isRead: boolean) {
  const t = useTheme()
  if (isRead) return t.atoms.bg.backgroundColor
  if (t.scheme === 'light') return t.palette.primary_25
  const bg = hexToRgb(String(t.atoms.bg.backgroundColor))
  const tint = hexToRgb(t.palette.primary_500)
  if (!bg || !tint) return t.palette.primary_25
  const mix = (x: number, y: number) => x + (y - x) * 0.07
  return rgbToHex(mix(bg.r, tint.r), mix(bg.g, tint.g), mix(bg.b, tint.b))
}

/**
 * One change in the Activity feed, laid out as Bluesky's notification rows:
 * a badged avatar, the headline, a money line and the time. Pressing it opens
 * what it's about and marks it read. Its actions come from the `swipeLeft` /
 * `swipeRight` preferences: swipes on native, buttons on hover or focus on
 * web, and every action in the row menu (long press on native) and as
 * screen-reader actions.
 */
export function ActivityItem({
  event,
  isRead,
  snapshot,
  me,
  locale,
  swipeLeft,
  swipeRight,
  actions,
  style,
}: {
  event: ActivityEvent
  isRead: boolean
  snapshot: ActivitySnapshot
  me: string
  locale: string
  swipeLeft: SwipeAction
  swipeRight: SwipeAction
  actions: ActivityActions
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const haptics = useHaptics()
  const {gtMobile} = useBreakpoints()
  const backgroundColor = useRowBackgroundColor(isRead)
  const rowPadding = useRowPadding()
  const rowPaddingTop = (rowPadding as {paddingTop?: number}).paddingTop ?? 12
  const menuControl = Menu.useMenuControl()
  const [isHovered, setIsHovered] = useState(false)
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const content = useDescribe(event, snapshot, me, locale, navigation)

  const menuActions = (['markRead', 'hide', 'delete'] as const).filter(x =>
    actions.isAvailable(x, event),
  )
  // The swipe actions as buttons, in the menu's order (destructive last).
  const quickActions = menuActions.filter(
    x => x === swipeLeft || x === swipeRight,
  )
  const run = (action: RowAction) => void actions.perform(action, event, isRead)

  const gestureAction = (action: SwipeAction) => {
    if (action === 'none' || !actions.isAvailable(action, event)) return
    const {color, icon} = actions.info(action, isRead)
    return {color, icon, threshold: SWIPE_THRESHOLD, action: () => run(action)}
  }
  const gestureActions: GestureActions = {
    leftFirst: gestureAction(swipeLeft),
    rightFirst: gestureAction(swipeRight),
  }

  const open = () => {
    if (!isRead) void actions.perform('markRead', event, isRead)
    content.open?.()
  }
  const openMenu = () => {
    haptics.longPress()
    menuControl.open()
  }
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    const name = e.nativeEvent.actionName
    if (name === 'longpress' || name === 'magicTap') openMenu()
    else if (menuActions.includes(name as RowAction)) run(name as RowAction)
  }

  /*
   * Web shows the actions while the row is hovered or has focus, and always
   * on touch screens and phone widths, where there is no hover (Bluesky's
   * chat list does the same with its menu button).
   */
  const isAlwaysShown = IS_WEB_TOUCH_DEVICE || !gtMobile
  const isShowingActions =
    isAlwaysShown || isHovered || isFocusWithin || menuControl.isOpen
  const webQuickActions = isAlwaysShown ? [] : quickActions
  /* Room kept clear for the buttons, so they never cover the text. */
  const actionsInset =
    ACTIONS_RIGHT + (webQuickActions.length + 1) * (ACTION_BUTTON_SIZE + 4)

  const menu = (
    <Menu.Outer>
      <Menu.Group>
        {menuActions.map(action => {
          const {label, icon} = actions.info(action, isRead)
          return (
            <Menu.Item
              key={action}
              testID={`activity-menu-${action}`}
              label={label}
              onPress={() => run(action)}>
              <Menu.ItemIcon icon={icon} />
              <Menu.ItemText>{label}</Menu.ItemText>
            </Menu.Item>
          )
        })}
      </Menu.Group>
    </Menu.Outer>
  )

  return (
    <GestureActionView actions={gestureActions}>
      <View
        testID={`activity-${event.kind}`}
        /*
         * Hover and keyboard focus are web only; the row reveals its buttons
         * on either. Focus from a click doesn't count, so a clicked row
         * doesn't keep its buttons once the pointer leaves.
         */
        {...(IS_WEB
          ? {
              onPointerEnter: () => setIsHovered(true),
              onPointerLeave: () => setIsHovered(false),
              onFocus: (e: {target?: unknown}) =>
                setIsFocusWithin(
                  (e.target as Element | undefined)?.matches?.(
                    ':focus-visible',
                  ) ?? true,
                ),
              onBlur: () => setIsFocusWithin(false),
            }
          : {})}
        style={[a.relative, {backgroundColor}, style]}>
        <Pressable
          accessibilityRole={content.open ? 'link' : 'button'}
          accessibilityHint={
            content.open ? l`Opens what changed` : l`Marks it as read`
          }
          accessibilityActions={
            IS_NATIVE
              ? [
                  ...menuActions.map(name => ({
                    name,
                    label: actions.info(name, isRead).label,
                  })),
                  {name: 'longpress', label: l`More actions`},
                ]
              : undefined
          }
          onAccessibilityAction={onAccessibilityAction}
          onPress={open}
          onLongPress={IS_NATIVE ? openMenu : undefined}
          style={[
            a.flex_row,
            a.align_start,
            a.gap_lg,
            a.w_full,
            a.px_lg,
            rowPadding,
            {backgroundColor},
            IS_WEB && {paddingRight: actionsInset},
          ]}>
          <SubtleHover hover={isHovered} />
          <Avatar
            name={content.avatarName}
            shape={content.avatarShape}
            icon={content.icon}
            tone={content.tone}
            ringColor={backgroundColor}
          />
          <View style={[a.flex_1, a.gap_xs]}>
            <Text
              style={[a.text_md, a.leading_snug, t.atoms.text]}
              numberOfLines={3}>
              {content.headline}
            </Text>
            {content.detail}
            <Timestamp at={event.at} />
          </View>
          {!isRead && (
            <View
              testID="activity-unread-dot"
              accessibilityRole="image"
              accessibilityLabel={l`Unread`}
              style={[
                a.absolute,
                a.rounded_full,
                {width: 8, height: 8, backgroundColor: t.palette.primary_500},
                // In the gutter left of the avatar, level with its centre, as mail apps mark unread.
                {left: 4, top: rowPaddingTop + AVATAR_SIZE / 2 - 4},
              ]}
            />
          )}
        </Pressable>
        {IS_WEB ? (
          <View
            testID="activity-actions"
            style={[
              a.absolute,
              a.flex_row,
              a.align_center,
              a.gap_xs,
              // On the headline's line, so a long row never stacks them oddly.
              {top: rowPaddingTop - 6, right: ACTIONS_RIGHT},
              {opacity: isShowingActions ? 1 : 0},
              a.transition_opacity,
            ]}>
            {webQuickActions.map(action => {
              const {label, icon} = actions.info(action, isRead)
              return (
                <Button
                  key={action}
                  testID={`activity-action-${action}`}
                  label={label}
                  size="small"
                  shape="round"
                  variant="ghost"
                  color="secondary"
                  // Blends into the unread tint; hover still highlights it.
                  style={a.bg_transparent}
                  onPress={() => run(action)}>
                  <ButtonIcon icon={icon} />
                </Button>
              )
            })}
            <Menu.Root control={menuControl}>
              <Menu.Trigger label={l`More actions`}>
                {({props}) => (
                  <Button
                    testID="activity-menu"
                    label={props.accessibilityLabel}
                    {...props}
                    size="small"
                    shape="round"
                    variant="ghost"
                    color="secondary"
                    style={a.bg_transparent}>
                    <ButtonIcon icon={DotsIcon} />
                  </Button>
                )}
              </Menu.Trigger>
              {menu}
            </Menu.Root>
          </View>
        ) : (
          <Menu.Root control={menuControl}>{menu}</Menu.Root>
        )}
      </View>
    </GestureActionView>
  )
}

/** Everything that differs by kind: who's pictured, the sentence, the money line, where it goes. */
function useDescribe(
  event: ActivityEvent,
  snapshot: ActivitySnapshot,
  me: string,
  locale: string,
  navigation: NavigationProp,
): {
  avatarName: string | undefined
  avatarShape: 'circle' | 'square'
  icon: React.ComponentType<SVGIconProps>
  tone: BadgeTone
  headline: React.ReactNode
  detail?: React.ReactNode
  /** Opens what the change is about; undefined when nothing is left to open. */
  open?: () => void
} {
  const t = useTheme()
  const {t: l} = useLingui()
  const nameOf = (id: string) =>
    snapshot.people.get(id)?.data.name ?? l`Someone`
  const shownName = (id: string) => (id === me ? l`You` : nameOf(id))
  const actor = <Strong>{shownName(event.actor)}</Strong>
  const actorAvatar = event.actor === me ? nameOf(me) : nameOf(event.actor)
  const groupName = (id: string | null) =>
    id ? snapshot.groups.get(id)?.data.name : undefined
  const money = (amount: bigint, currency: string) =>
    formatAmount(amount, currency, locale)

  switch (event.entityType) {
    case 'expense': {
      const e = event.data
      const subject = <Strong>{e.title}</Strong>
      const net = expenseNet(e, me)
      const total =
        event.kind === 'expense.edited' &&
        event.prev &&
        event.prev.total !== e.total
          ? `${money(event.prev.total, event.prev.currency)} → ${money(e.total, e.currency)}`
          : money(e.total, e.currency)
      const isDeleted = event.kind === 'expense.deleted'
      const figure = (
        <Text
          style={[
            a.text_sm,
            a.font_semi_bold,
            {
              color:
                net > ZERO ? t.palette.positive_600 : t.palette.negative_500,
              fontVariant: ['tabular-nums'],
            },
          ]}>
          {money(magnitude(net), e.currency)}
        </Text>
      )
      return {
        avatarName: actorAvatar,
        avatarShape: 'circle',
        icon: {
          'expense.created': AddedBadge,
          'expense.edited': EditedBadge,
          'expense.deleted': DeletedBadge,
          'expense.restored': RestoredBadge,
        }[event.kind],
        tone:
          event.kind === 'expense.created' || event.kind === 'expense.restored'
            ? 'primary'
            : event.kind === 'expense.deleted'
              ? 'negative'
              : 'neutral',
        headline: {
          'expense.created': (
            <Trans>
              {actor} added {subject}
            </Trans>
          ),
          'expense.edited': (
            <Trans>
              {actor} edited {subject}
            </Trans>
          ),
          'expense.deleted': (
            <Trans>
              {actor} deleted {subject}
            </Trans>
          ),
          'expense.restored': (
            <Trans>
              {actor} restored {subject}
            </Trans>
          ),
        }[event.kind],
        detail: (
          <Detail>
            <Text
              style={[
                a.text_sm,
                t.atoms.text_contrast_medium,
                {fontVariant: ['tabular-nums']},
                isDeleted && {textDecorationLine: 'line-through'},
              ]}>
              {total}
            </Text>
            {groupName(e.groupId) ? (
              <>
                <Dot />
                {groupName(e.groupId)}
              </>
            ) : null}
            {isDeleted ? null : (
              <>
                <Dot />
                {net === ZERO ? (
                  <Trans>not involved</Trans>
                ) : net > ZERO ? (
                  <Trans>you lent {figure}</Trans>
                ) : (
                  <Trans>you borrowed {figure}</Trans>
                )}
              </>
            )}
          </Detail>
        ),
        open: () => navigation.push('Expense', {expenseId: event.entityId}),
      }
    }
    case 'person': {
      const subject = <Strong>{event.data.name}</Strong>
      const isAdded = event.kind === 'person.added'
      return {
        avatarName: event.data.name,
        avatarShape: 'circle',
        icon: isAdded ? FriendAddedBadge : FriendRemovedBadge,
        tone: isAdded ? 'primary' : 'negative',
        headline: isAdded ? (
          <Trans>
            {actor} added {subject} as a friend
          </Trans>
        ) : (
          <Trans>
            {actor} removed {subject} from friends
          </Trans>
        ),
        // A removed friend has no page left to open.
        open: isAdded
          ? () => navigation.push('Person', {personId: event.entityId})
          : undefined,
      }
    }
    case 'group': {
      const g = event.data
      const subject = <Strong>{g.name}</Strong>
      const oldName = <Strong>{event.prev?.name}</Strong>
      const isRenamed =
        event.kind === 'group.edited' &&
        event.prev &&
        event.prev.name !== g.name
      const members = g.members.filter(m => m.leftAt === null)
      return {
        avatarName: g.name,
        avatarShape: 'square',
        icon:
          event.kind === 'group.archived'
            ? ArchivedBadge
            : event.kind === 'group.deleted'
              ? DeletedBadge
              : event.kind === 'group.edited'
                ? EditedBadge
                : GroupBadge,
        tone:
          event.kind === 'group.created'
            ? 'primary'
            : event.kind === 'group.deleted'
              ? 'negative'
              : 'neutral',
        headline: isRenamed ? (
          <Trans>
            {actor} renamed {oldName} to {subject}
          </Trans>
        ) : (
          {
            'group.created': (
              <Trans>
                {actor} created the group {subject}
              </Trans>
            ),
            'group.edited': (
              <Trans>
                {actor} updated the group {subject}
              </Trans>
            ),
            'group.archived': (
              <Trans>
                {actor} archived the group {subject}
              </Trans>
            ),
            'group.deleted': (
              <Trans>
                {actor} deleted the group {subject}
              </Trans>
            ),
          }[event.kind]
        ),
        detail:
          event.kind === 'group.created' ? (
            <View style={[a.flex_row, a.align_center, a.gap_sm, a.pt_2xs]}>
              {members.slice(0, MAX_PREVIEW_AVATARS).map(m => (
                <UserAvatar
                  key={m.personId}
                  type="user"
                  size={PREVIEW_AVATAR_SIZE}
                  name={nameOf(m.personId)}
                />
              ))}
              {members.length > MAX_PREVIEW_AVATARS ? (
                <Text
                  style={[
                    a.text_sm,
                    a.font_semi_bold,
                    t.atoms.text_contrast_medium,
                  ]}>
                  +{members.length - MAX_PREVIEW_AVATARS}
                </Text>
              ) : null}
            </View>
          ) : undefined,
        open:
          event.kind === 'group.deleted'
            ? undefined
            : () => navigation.push('Group', {groupId: event.entityId}),
      }
    }
    case 'repayment': {
      const r = event.data
      const from = <Strong>{shownName(r.from)}</Strong>
      const to = <Strong>{nameOf(r.to)}</Strong>
      const other = r.from === me ? r.to : r.from
      return {
        avatarName: nameOf(r.from),
        avatarShape: 'circle',
        icon:
          event.kind === 'repayment.removed'
            ? DeletedBadge
            : event.kind === 'repayment.edited'
              ? EditedBadge
              : PaymentBadge,
        tone:
          event.kind === 'repayment.recorded'
            ? 'primary'
            : event.kind === 'repayment.removed'
              ? 'negative'
              : 'neutral',
        headline:
          event.kind === 'repayment.recorded' ? (
            r.to === me ? (
              <Trans>{from} paid you</Trans>
            ) : (
              <Trans>
                {from} paid {to}
              </Trans>
            )
          ) : event.kind === 'repayment.edited' ? (
            <Trans>{actor} edited a payment</Trans>
          ) : (
            <Trans>{actor} removed a payment</Trans>
          ),
        detail: (
          <Detail>
            {event.kind === 'repayment.recorded'
              ? null
              : `${shownName(r.from)} → ${r.to === me ? l`you` : nameOf(r.to)}`}
            {event.kind === 'repayment.recorded' ? null : <Dot />}
            <Text
              style={[
                a.text_sm,
                t.atoms.text_contrast_medium,
                {fontVariant: ['tabular-nums']},
                event.kind === 'repayment.removed' && {
                  textDecorationLine: 'line-through',
                },
              ]}>
              {money(r.amount, r.currency)}
            </Text>
            {groupName(r.groupId) ? (
              <>
                <Dot />
                {groupName(r.groupId)}
              </>
            ) : null}
          </Detail>
        ),
        open: () =>
          r.groupId
            ? navigation.push('Group', {groupId: r.groupId})
            : navigation.push('Person', {personId: other}),
      }
    }
  }
}

/** A name or title, emphasised inside the headline. */
function Strong({children}: {children: React.ReactNode}) {
  return (
    <Text style={[a.text_md, a.leading_snug, a.font_semi_bold]}>
      {children}
    </Text>
  )
}

/** The muted line under the headline: amount, group and what it means for you. */
function Detail({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text
      numberOfLines={2}
      style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
      {children}
    </Text>
  )
}

function Dot() {
  return <> &middot; </>
}

/**
 * When a change happened, with the full date on hover: relative today
 * ("7m ago"); on earlier days the time of day, as the day's header already
 * says which day ("1d ago" under "Saturday" would contradict it).
 */
function Timestamp({at}: {at: number}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const date = new Date(at)
  const isToday = daysAgo(at, Date.now()) === 0
  return (
    <TimeElapsed
      // TimeElapsed only re-formats on its minute tick; a language switch remounts it.
      key={i18n.locale}
      timestamp={date.toISOString()}
      timeToString={isToday ? formatTimeAgo : formatTimeOfDay}>
      {({timeElapsed}) => (
        <Text
          title={i18n.date(date, {dateStyle: 'medium', timeStyle: 'short'})}
          style={[
            a.self_start,
            a.text_sm,
            // Secondary text, at AA contrast on both the plain and the unread row.
            t.atoms.text_contrast_medium,
          ]}>
          {timeElapsed}
        </Text>
      )}
    </TimeElapsed>
  )
}

function formatTimeOfDay(i18n: I18n, timestamp: string) {
  return i18n.date(new Date(timestamp), {timeStyle: 'short'})
}

function formatTimeAgo(i18n: I18n, timestamp: string) {
  const diff = dateDiff(timestamp, Date.now())
  const formatted = formatDateDiff({diff, i18n})
  // "now", and dates over a year old, read fine on their own
  if (diff.unit === 'now' || (diff.unit === 'month' && diff.value >= 12)) {
    return formatted
  }
  return i18n._(
    defineMessage({
      message: `${formatted} ago`,
      comment:
        'How long ago an activity happened, e.g. "7m ago". The time is already abbreviated and translated.',
    }),
  )
}

/**
 * The avatar of who or what the change is about, with a badge overlapping
 * its bottom-end corner that says what kind of change it is.
 */
function Avatar({
  name,
  shape,
  icon: Icon,
  tone,
  ringColor,
}: {
  name: string | undefined
  shape: 'circle' | 'square'
  icon: React.ComponentType<SVGIconProps>
  tone: BadgeTone
  ringColor: string
}) {
  const t = useTheme()
  return (
    <View style={SLOT_SIZE}>
      <UserAvatar
        type={shape === 'square' ? 'list' : 'user'}
        size={AVATAR_SIZE}
        name={name}
      />
      {/*
       * The ring is a padded circle behind the badge rather than a border on
       * it, so the badge's anti-aliased edge doesn't show the ring through.
       */}
      <View
        style={[
          a.absolute,
          a.rounded_full,
          BADGE_POSITION,
          {backgroundColor: ringColor},
        ]}>
        <View
          style={[
            a.rounded_full,
            a.align_center,
            a.justify_center,
            {
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              backgroundColor:
                tone === 'primary'
                  ? t.palette.primary_500
                  : tone === 'negative'
                    ? t.palette.negative_500
                    : t.palette.contrast_500,
            },
          ]}>
          <Icon width={BADGE_ICON_SIZE} fill={t.palette.white} />
        </View>
      </View>
    </View>
  )
}
