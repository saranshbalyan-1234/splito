// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/dms/MessageItem.tsx
import {memo} from 'react'
import {Pressable, View, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Comment, type Entity, mentionRanges} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {copyText} from '#/lib/sharing'
import {useTimeZone} from '#/locale/useDates'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {isOnlyEmoji} from '#/alf/typography'
import {atoms as a, platform, useBreakpoints, useTheme} from '#/alf'
import {
  ChainLink_Stroke2_Corner0_Rounded as LinkIcon,
  SquareBehindSquare_Stroke2_Corner2_Rounded as CopyIcon,
} from '#/components/icons/Invite'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const AVATAR_SIZE = 28
const BORDER_RADIUS = 20
const SQUARED_BORDER_RADIUS = 4
const CLUSTERED_GAP = 2

export interface CommentRowProps {
  comment: Entity<Comment>
  /** Who can be `@mentioned` (the expense's participants), to find the names in the text. */
  people: ReadonlyArray<{id: string; name: string}>
  authorName: string
  /** The author's own name, for the avatar initials. */
  avatarName: string
  isMine: boolean
  /** Neighbours from the same person within a few minutes cluster, as in Bluesky's chats. */
  isFirstInCluster: boolean
  isLastInCluster: boolean
  onEdit(comment: Entity<Comment>): void
  onDelete(comment: Entity<Comment>): void
  /** The web path of what this discussion hangs on, for Copy link. */
  link: string
}

/**
 * One comment, as a Bluesky group-chat message: my comments on the right in the
 * accent colour, others' on the left with their avatar and name, neighbours
 * clustered. A deleted comment keeps its place as a quiet line. The long-press /
 * right-click menu offers only what is allowed: Copy and Copy link for anyone,
 * Edit and Delete on my own.
 */
let CommentRow = ({
  comment,
  people,
  authorName,
  avatarName,
  isMine,
  isFirstInCluster,
  isLastInCluster,
  onEdit,
  onDelete,
  link,
}: CommentRowProps): React.ReactNode => {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const haptics = useHaptics()
  const timeZone = useTimeZone()
  const {gtMobile} = useBreakpoints()
  const control = Menu.useMenuControl()
  const {body, mentions, editedAt} = comment.data
  const isDeleted = comment.deleted
  const isEmojiOnly = !isDeleted && isOnlyEmoji(body)

  const squaredBottom = !isLastInCluster
  const squaredTop = !isFirstInCluster
  const radius = {
    [isMine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']:
      squaredBottom ? SQUARED_BORDER_RADIUS : BORDER_RADIUS,
    [isMine ? 'borderTopRightRadius' : 'borderTopLeftRadius']: squaredTop
      ? SQUARED_BORDER_RADIUS
      : BORDER_RADIUS,
  }

  const parts: React.ReactNode[] = []
  let at = 0
  for (const r of mentionRanges(body, people, mentions)) {
    if (r.start > at) parts.push(body.slice(at, r.start))
    parts.push(
      <Text
        key={r.start}
        testID="comment-mention"
        style={[
          a.text_md,
          a.font_semi_bold,
          isMine
            ? {color: t.palette.white, textDecorationLine: 'underline' as const}
            : {color: t.palette.primary_500},
        ]}>
        {body.slice(r.start, r.end)}
      </Text>,
    )
    at = r.end
  }
  if (at < body.length) parts.push(body.slice(at))

  const time = i18n.date(comment.createdAt, {timeStyle: 'short', timeZone})
  const label = isDeleted
    ? l`${authorName}: deleted comment`
    : l`${authorName}: ${body}`
  const canAct = !isDeleted

  const actions = {
    copy: () => void copyText(body),
    link: () => void copyText(link),
    edit: () => onEdit(comment),
    del: () => onDelete(comment),
  }
  /* Screen readers get the same actions from the rotor / TalkBack menu, no gesture needed. */
  const a11yActions = canAct
    ? [
        {name: 'copy', label: l`Copy text`},
        {name: 'link', label: l`Copy link`},
        ...(isMine
          ? [
              {name: 'edit', label: l`Edit`},
              {name: 'del', label: l`Delete`},
            ]
          : []),
      ]
    : []

  return (
    <Menu.Root control={control}>
      <View
        testID={`comment-${comment.id}`}
        style={[
          platform<ViewStyle | undefined>({
            android: a.mx_sm,
            ios: a.mx_md,
            web: a.mx_lg,
          }),
          isFirstInCluster ? a.mt_md : {marginTop: CLUSTERED_GAP},
        ]}>
        <View
          style={[
            a.flex_row,
            a.align_end,
            a.gap_sm,
            isMine ? a.justify_end : a.justify_start,
          ]}>
          {IS_WEB && gtMobile && canAct && isMine ? <RowMenuButton /> : null}
          {!isMine ? (
            <View style={{width: AVATAR_SIZE}}>
              {isLastInCluster ? (
                <UserAvatar size={AVATAR_SIZE} name={avatarName} type="user" />
              ) : null}
            </View>
          ) : null}
          <View
            style={[
              a.flex_shrink,
              {maxWidth: IS_WEB ? ('80%' as const) : ('85%' as const)},
              isMine ? a.align_end : a.align_start,
            ]}>
            {!isMine && isFirstInCluster && !isDeleted && !isEmojiOnly ? (
              <Text
                emoji
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.pb_2xs,
                  {paddingLeft: 12},
                ]}>
                {authorName}
              </Text>
            ) : null}
            <Pressable
              testID="comment-bubble"
              accessible
              accessibilityRole="text"
              accessibilityLabel={label}
              accessibilityHint={canAct ? l`Long press for options` : ''}
              accessibilityActions={a11yActions}
              onAccessibilityAction={e =>
                actions[e.nativeEvent.actionName as keyof typeof actions]?.()
              }
              onLongPress={
                canAct ? () => (haptics.longPress(), control.open()) : undefined
              }
              // @ts-expect-error web only
              onContextMenu={
                canAct && IS_WEB
                  ? (e: Event) => (e.preventDefault(), control.open())
                  : undefined
              }
              delayLongPress={300}
              style={[
                !isEmojiOnly && [
                  a.py_sm,
                  a.px_md,
                  a.rounded_xl,
                  radius,
                  isDeleted
                    ? [a.border, t.atoms.border_contrast_medium]
                    : {
                        backgroundColor: isMine
                          ? t.palette.primary_500
                          : t.palette.contrast_50,
                      },
                ],
                isEmojiOnly && (IS_WEB ? a.py_xs : a.py_2xs),
              ]}>
              {isDeleted ? (
                <Text
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    a.italic,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>This comment was deleted</Trans>
                </Text>
              ) : (
                <Text
                  emoji
                  selectable
                  style={[
                    a.text_md,
                    a.leading_snug,
                    isMine && !isEmojiOnly && {color: t.palette.white},
                    isEmojiOnly && {fontSize: 36, lineHeight: 44},
                  ]}>
                  {parts}
                </Text>
              )}
            </Pressable>
            {isLastInCluster && !isDeleted ? (
              <Text
                testID="comment-meta"
                style={[
                  a.text_xs,
                  a.pt_2xs,
                  t.atoms.text_contrast_medium,
                  isMine ? a.text_right : {paddingLeft: 12},
                ]}>
                {editedAt !== null ? l`${time} · Edited` : time}
              </Text>
            ) : null}
          </View>
          {/* Web: the same menu from a focusable button (keyboard and screen readers), quiet until the row is hovered or focused. */}
          {IS_WEB && gtMobile && canAct && !isMine ? <RowMenuButton /> : null}
        </View>
      </View>
      <Menu.Outer>
        <Menu.Group>
          <Menu.Item
            testID="comment-copy"
            label={l`Copy text`}
            onPress={actions.copy}>
            <Menu.ItemText>
              <Trans>Copy text</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={CopyIcon} position="right" />
          </Menu.Item>
          {isMine ? (
            <Menu.Item
              testID="comment-edit"
              label={l`Edit`}
              onPress={actions.edit}>
              <Menu.ItemText>
                <Trans>Edit</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={PencilIcon} position="right" />
            </Menu.Item>
          ) : null}
          <Menu.Item
            testID="comment-copy-link"
            label={l`Copy link`}
            onPress={actions.link}>
            <Menu.ItemText>
              <Trans>Copy link</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={LinkIcon} position="right" />
          </Menu.Item>
          {isMine ? (
            <Menu.Item
              testID="comment-delete"
              label={l`Delete`}
              destructive
              onPress={actions.del}>
              <Menu.ItemText>
                <Trans>Delete</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={TrashIcon} position="right" />
            </Menu.Item>
          ) : null}
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}
CommentRow = memo(CommentRow)
export {CommentRow}

function RowMenuButton() {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Menu.Trigger label={l`Comment options`}>
      {({props, state}) => (
        <Pressable
          testID="comment-menu"
          {...props}
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_full,
            {width: 28, height: 28},
            t.atoms.bg_contrast_25,
            // Quiet, not hidden: a keyboard or screen-reader user lands on it by tabbing.
            {
              opacity:
                state.hovered || state.focused || state.pressed ? 1 : 0.35,
            },
          ]}>
          <DotsIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
        </Pressable>
      )}
    </Menu.Trigger>
  )
}
