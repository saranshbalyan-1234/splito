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
import {type ActivityEvent, requestName, type SwipeAction} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {GestureActionView} from '#/lib/custom-animations/GestureActionView'
import {type GestureActions} from '#/lib/custom-animations/GestureActionView.shared'
import {dateDiff, formatDateDiff} from '#/lib/hooks/useTimeAgo'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useRowPadding} from '#/state/preferences/density'
import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {hexToRgb, rgbToHex} from '#/alf/util/colorGeneration'
import {Button, ButtonIcon} from '#/components/Button'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {type Props as SVGIconProps} from '#/components/icons/common'
import * as Menu from '#/components/Menu'
import {RequestAction} from '#/components/people/RequestRow'
import {SubtleHover} from '#/components/SubtleHover'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {moneyGlyph, useMoneyStyle} from '#/components/MoneyDirection'
import {IS_NATIVE, IS_WEB, IS_WEB_TOUCH_DEVICE} from '#/env'
import {
  AddedBadge,
  ArchivedBadge,
  DeletedBadge,
  EditedBadge,
  FriendAcceptedBadge,
  FriendAddedBadge,
  FriendRemovedBadge,
  GroupBadge,
  PaymentBadge,
  RequestSentBadge,
  RestoredBadge,
  WriteOffBadge,
} from './icons'
import {useTimeZone, useToday} from '#/locale/useDates'
import {dayOf, daysAgo, writeOffParties} from './feed'
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
 * The background of a row, faintly tinted while unread; the accent bar on
 * the row's edge carries the state. Light themes use `primary_25`; dark
 * themes mix 6% of the
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
  /* 6%: enough to read as unread on Dim and Black without turning the row navy. */
  const mix = (x: number, y: number) => x + (y - x) * 0.06
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
  const [menuAt, setMenuAt] = useState({x: 0, y: 0})
  const [isHovered, setIsHovered] = useState(false)
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const content = useDescribe(event, snapshot, me, locale, navigation, actions)
  /* A request awaiting an answer is one line: the answers on the right in place of "...", whose items are long-press / right-click (ARCHITECTURE 26.18). */
  const isRequestRow = !!content.actions

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
        {...(IS_WEB && isRequestRow
          ? {
              onContextMenu: (e: {
                preventDefault(): void
                clientX: number
                clientY: number
                currentTarget: Element
              }) => {
                e.preventDefault()
                const box = e.currentTarget.getBoundingClientRect()
                setMenuAt({x: e.clientX - box.left, y: e.clientY - box.top})
                haptics.longPress()
                menuControl.open()
              },
              /* Keyboard: the Menu key or Shift+F10 on the row, or on its Accept / Decline, opens the same menu. */
              onKeyDown: ((e: {
                key: string
                shiftKey: boolean
                preventDefault(): void
                currentTarget: Element
              }) => {
                if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10'))
                  return
                e.preventDefault()
                const box = e.currentTarget.getBoundingClientRect()
                setMenuAt({x: box.width / 2, y: box.height})
                menuControl.open()
              }) as never,
            }
          : {})}
        style={[
          a.relative,
          isRequestRow ? [a.flex_row, a.align_center] : undefined,
          {backgroundColor},
          style,
        ]}>
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
            isRequestRow ? [a.flex_1, {minWidth: 0}] : a.w_full,
            a.px_lg,
            rowPadding,
            {backgroundColor},
            {
              paddingRight: isRequestRow
                ? a.gap_md.gap
                : IS_WEB
                  ? actionsInset
                  : ACTIONS_RIGHT + ACTION_BUTTON_SIZE + 4,
            },
          ]}>
          <SubtleHover hover={isHovered} />
          <Avatar
            name={content.avatarName}
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
                // An accent bar on the row's leading edge, clear of the avatar and the sidebar's border.
                {
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: t.palette.primary_500,
                },
              ]}
            />
          )}
        </Pressable>
        {content.actions ? (
          <View
            testID="activity-request-actions"
            style={[a.flex_row, a.align_center, a.gap_xs, a.flex_shrink_0, a.pr_lg]}>
            {content.actions}
          </View>
        ) : null}
        {/*
         * The "..." is on every row, so its actions are discoverable; on web
         * with a mouse the quick actions join it on hover or focus. A request
         * row has no "...": Accept / Decline take its place and the menu opens
         * on long-press or right-click.
         */}
        {isRequestRow ? (
          <Menu.Root control={menuControl}>
            {IS_WEB ? (
              /* An invisible anchor where the right-click landed. */
              <Menu.Trigger label={l`More actions`}>
                {({props}) => (
                  <Pressable
                    {...props}
                    accessible={false}
                    pointerEvents="none"
                    style={[
                      a.absolute,
                      {left: menuAt.x, top: menuAt.y, width: 1, height: 1, opacity: 0},
                    ]}
                  />
                )}
              </Menu.Trigger>
            ) : null}
            {menu}
          </Menu.Root>
        ) : (
        <View
          testID="activity-actions"
          style={[
            a.absolute,
            a.flex_row,
            a.align_center,
            a.gap_xs,
            // On the headline's line, so a long row never stacks them oddly.
            {top: rowPaddingTop - 6, right: ACTIONS_RIGHT},
          ]}>
          {IS_WEB && webQuickActions.length > 0 && (
            <View
              testID="activity-quick-actions"
              style={[
                a.flex_row,
                a.align_center,
                a.gap_xs,
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
            </View>
          )}
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
        )}
      </View>
    </GestureActionView>
  )
}

/** Everything that differs by kind: the badge, the sentence, the money line, where it goes. */
function useDescribe(
  event: ActivityEvent,
  snapshot: ActivitySnapshot,
  me: string,
  locale: string,
  navigation: NavigationProp,
  actions: ActivityActions,
): {
  avatarName: string | undefined
  icon: React.ComponentType<SVGIconProps>
  tone: BadgeTone
  headline: React.ReactNode
  detail?: React.ReactNode
  /** Buttons under the row (Accept / Decline), siblings of its pressable (section 2). */
  actions?: React.ReactNode
  /** Opens what the change is about; undefined when nothing is left to open. */
  open?: () => void
} {
  const t = useTheme()
  const {t: l} = useLingui()
  const nameOf = (id: string) =>
    snapshot.people.get(id)?.data.name ?? l`Someone`
  const shownName = (id: string) => (id === me ? l`You` : nameOf(id))
  const actor = <Strong>{shownName(event.actor)}</Strong>
  // The row's avatar is always who made the change (owner rule 6), never who it is about.
  const actorAvatar = nameOf(event.actor)
  const groupName = (id: string | null) =>
    id ? snapshot.groups.get(id)?.data.name : undefined
  const money = (amount: bigint, currency: string) =>
    formatAmount(amount, currency, locale)
  const moneyStyle = useMoneyStyle()

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
            {fontVariant: ['tabular-nums']},
            moneyStyle.style(net),
          ]}>
          {`${moneyGlyph(net)}\u00a0${money(magnitude(net), e.currency)}`}
        </Text>
      )
      return {
        avatarName: actorAvatar,
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
    case 'friendRequest': {
      const r = event.data
      const current = snapshot.requests.get(event.entityId)?.data ?? r
      const friendName = current.personId
        ? (snapshot.people.get(current.personId)?.data.name ??
          requestName(current))
        : requestName(current)
      const subject = <Strong>{friendName}</Strong>
      const openPerson = current.personId
        ? () => navigation.push('Person', {personId: current.personId!})
        : () => navigation.navigate('People')
      if (event.kind === 'friendRequest.received') {
        const isPending = current.status === 'pending'
        return {
          avatarName: friendName,
          icon: FriendAddedBadge,
          tone: 'primary',
          headline: <Trans>{subject} sent you a friend request</Trans>,
          detail: (
            <Detail>
              {current.status === 'accepted' ? (
                <Trans>You’re friends now</Trans>
              ) : current.status === 'declined' ? (
                <Trans>You declined</Trans>
              ) : (
                <Trans>Accept to split expenses together</Trans>
              )}
            </Detail>
          ),
          actions: isPending ? (
            <FriendRequestActions
              name={friendName}
              onAnswer={accept => actions.answerRequest(event.entityId, accept)}
            />
          ) : undefined,
          open: openPerson,
        }
      }
      if (event.kind === 'friendRequest.accepted') {
        return {
          avatarName: friendName,
          icon: FriendAcceptedBadge,
          tone: 'primary',
          headline:
            r.direction === 'outgoing' ? (
              <Trans>{subject} accepted your friend request</Trans>
            ) : (
              <Trans>You accepted {subject}’s friend request</Trans>
            ),
          detail: (
            <Detail>
              <Trans>You can now split anything together</Trans>
            </Detail>
          ),
          open: openPerson,
        }
      }
      return {
        avatarName: nameOf(event.actor),
        icon: RequestSentBadge,
        tone: 'neutral',
        headline:
          r.reach === 'invited' ? (
            <Trans>
              {actor} invited {subject} to Splito
            </Trans>
          ) : (
            <Trans>
              {actor} sent {subject} a friend request
            </Trans>
          ),
        open: openPerson,
      }
    }
    case 'person': {
      const subject = <Strong>{event.data.name}</Strong>
      const isAdded = event.kind === 'person.added'
      return {
        avatarName: actorAvatar,
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
      /* A member who left in this change, and whoever was handed admin (F-615). */
      const leaver = g.members.find(
        m =>
          m.leftAt !== null &&
          event.prev?.members?.some(p => p.personId === m.personId && p.leftAt === null),
      )
      const newAdmin = g.members.find(
        m =>
          m.role === 'admin' &&
          event.prev?.members?.some(p => p.personId === m.personId && p.role !== 'admin'),
      )
      return {
        avatarName: actorAvatar,
        icon:
          event.kind === 'group.archived' || event.kind === 'group.unarchived'
            ? ArchivedBadge
            : event.kind === 'group.deleted'
              ? DeletedBadge
              : event.kind === 'group.restored'
                ? RestoredBadge
                : event.kind === 'group.edited'
                  ? EditedBadge
                  : event.kind === 'group.memberLeft'
                    ? FriendRemovedBadge
                    : GroupBadge,
        tone:
          event.kind === 'group.created' || event.kind === 'group.restored'
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
            'group.restored': (
              <Trans>
                {actor} restored the group {subject}
              </Trans>
            ),
            'group.unarchived': (
              <Trans>
                {actor} unarchived the group {subject}
              </Trans>
            ),
            'group.memberLeft': leaver ? (
              leaver.personId === event.actor ? (
                <Trans>
                  {actor} left {subject}
                </Trans>
              ) : (
                <Trans>
                  {actor} removed <Strong>{nameOf(leaver.personId)}</Strong> from{' '}
                  {subject}
                </Trans>
              )
            ) : (
              <Trans>
                {actor} updated the group {subject}
              </Trans>
            ),
          }[event.kind]
        ),
        detail:
          event.kind === 'group.memberLeft' && leaver ? (
            <Detail>
              {leaver.exit === 'settled'
                ? l`Settled up first`
                : leaver.exit === 'forgiven'
                  ? l`Balance written off`
                  : leaver.exit === 'kept'
                    ? l`Left with a balance still open`
                    : l`Nothing owed`}
              {newAdmin ? <Dot /> : null}
              {newAdmin ? l`${nameOf(newAdmin.personId)} is now admin` : null}
            </Detail>
          ) : event.kind === 'group.created' ? (
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
        avatarName: actorAvatar,
        icon:
          event.kind === 'repayment.removed'
            ? DeletedBadge
            : event.kind === 'repayment.restored'
              ? RestoredBadge
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
          ) : event.kind === 'repayment.restored' ? (
            <Trans>{actor} restored a payment</Trans>
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
    case 'writeoff': {
      const w = event.data
      const debtor = <Strong>{nameOf(w.from)}</Strong>
      const creditor = <Strong>{nameOf(w.to)}</Strong>
      const other = w.from === me ? w.to : w.from
      const isRemoved = event.kind === 'writeoff.removed'
      // Told from whoever recorded it, the avatar on the row (audit m5).
      const parties = writeOffParties(w, event.actor)
      const counterpart =
        parties.kind === 'pair' ? (
          <Strong>{nameOf(parties.other)}</Strong>
        ) : null
      // Who let whom off: the headline alone does not say which way.
      const direction =
        w.to === me ? (
          <Trans>You let {debtor} off</Trans>
        ) : w.from === me ? (
          <Trans>{creditor} let you off</Trans>
        ) : (
          <Trans>
            {creditor} let {debtor} off
          </Trans>
        )
      return {
        avatarName: actorAvatar,
        icon: isRemoved
          ? DeletedBadge
          : event.kind === 'writeoff.restored'
            ? RestoredBadge
            : WriteOffBadge,
        tone: isRemoved ? 'negative' : 'primary',
        headline: isRemoved ? (
          <Trans>{actor} undid a write-off</Trans>
        ) : event.kind === 'writeoff.restored' ? (
          <Trans>{actor} restored a write-off</Trans>
        ) : parties.kind === 'third' ? (
          <Trans>
            {actor} called it even between {debtor} and {creditor}
          </Trans>
        ) : parties.other === me ? (
          <Trans>{actor} called it even with you</Trans>
        ) : (
          <Trans>
            {actor} called it even with {counterpart}
          </Trans>
        ),
        detail: (
          <Detail>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {direction}
            </Text>
            <Dot />
            <Text
              style={[
                a.text_sm,
                t.atoms.text_contrast_medium,
                {fontVariant: ['tabular-nums']},
                isRemoved && {textDecorationLine: 'line-through'},
              ]}>
              {money(w.amount, w.currency)}
            </Text>
            {groupName(w.groupId) ? (
              <>
                <Dot />
                {groupName(w.groupId)}
              </>
            ) : null}
            {w.note ? (
              <>
                <Dot />
                {w.note}
              </>
            ) : null}
          </Detail>
        ),
        open: () =>
          w.groupId
            ? navigation.push('Group', {groupId: w.groupId})
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
  const tz = useTimeZone()
  const today = useToday()
  const date = new Date(at)
  const isToday = daysAgo(dayOf(at, tz), today) === 0
  return (
    <TimeElapsed
      // TimeElapsed only re-formats on its minute tick; a language switch remounts it.
      key={i18n.locale}
      timestamp={date.toISOString()}
      timeToString={
        isToday
          ? formatTimeAgo
          : (i18n, timestamp) => formatTimeOfDay(i18n, timestamp, tz)
      }>
      {({timeElapsed}) => (
        <Text
          title={i18n.date(date, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: tz,
          })}
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

function formatTimeOfDay(i18n: I18n, timestamp: string, timeZone: string) {
  return i18n.date(new Date(timestamp), {timeStyle: 'short', timeZone})
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
 * The avatar of who made the change, with a badge overlapping
 * its bottom-end corner that says what kind of change it is.
 */
function Avatar({
  name,
  icon: Icon,
  tone,
  ringColor,
}: {
  name: string | undefined
  icon: React.ComponentType<SVGIconProps>
  tone: BadgeTone
  ringColor: string
}) {
  const t = useTheme()
  return (
    <View style={SLOT_SIZE}>
      <UserAvatar type="user" size={AVATAR_SIZE} name={name} />
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

/** Accept / Decline on a request row; the same mutations as People > Requests. */
function FriendRequestActions({
  name,
  onAnswer,
}: {
  name: string
  onAnswer: (accept: boolean) => Promise<void>
}) {
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const [isBusy, setIsBusy] = useState(false)
  const act = async (accept: boolean) => {
    if (isBusy) return
    setIsBusy(true)
    try {
      await onAnswer(accept)
      if (accept) {
        haptics.success()
        Toast.show(l`You and ${name} are friends now`, {type: 'success'})
      } else {
        haptics.confirm()
        Toast.show(l`Request declined. ${name} isn’t told.`)
      }
    } catch (e) {
      haptics.error()
      logger.error(e, {where: 'ActivityItem.friendRequest'})
      Toast.show(l`That didn’t work. Please try again.`, {type: 'error'})
      setIsBusy(false)
    }
  }
  return (
    <>
      <RequestAction
        testID="activity-request-accept"
        label={l`Accept ${name}’s friend request`}
        text={l({message: 'Accept', context: 'button'})}
        icon={CheckIcon}
        color="primary"
        disabled={isBusy}
        onPress={() => void act(true)}
      />
      <RequestAction
        testID="activity-request-decline"
        label={l`Decline ${name}’s friend request`}
        text={l({message: 'Decline', context: 'button'})}
        icon={XIcon}
        disabled={isBusy}
        onPress={() => void act(false)}
      />
    </>
  )
}
