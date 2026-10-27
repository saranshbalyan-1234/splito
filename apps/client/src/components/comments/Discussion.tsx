import {createContext, useContext, useState} from 'react'
import {View} from 'react-native'
import Animated, {FadeIn, LinearTransition} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Comment, type CommentTarget, type Entity} from '@splito/sync'

import {useTimeZone} from '#/locale/useDates'
import {
  commentLink,
  type Thread,
  useCommentActions,
  useThread,
} from '#/state/comments'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {
  CommentComposer,
  type Editing,
} from '#/components/comments/CommentComposer'
import {CommentRow} from '#/components/comments/CommentRow'
import {DateDivider} from '#/components/comments/DateDivider'
import {type CommentPerson} from '#/components/comments/mentions'
import {
  mergeTimeline,
  type TimelineLine,
  withDividers,
} from '#/components/comments/timeline'
import {Bubble_Stroke2_Corner2_Rounded as BubbleIcon} from '#/components/icons/Message'
import * as Prompt from '#/components/Prompt'
import {useAvatarName, useDisplayName} from '#/components/split/shared'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/** Comments that follow within this long from the same person cluster (Bluesky: 5 minutes). */
const CLUSTER_MS = 5 * 60 * 1000

interface DiscussionContext {
  targetType: CommentTarget
  targetId: string
  canComment: boolean
  people: ReadonlyArray<CommentPerson>
  thread: Thread | undefined
  me: string
  editing: Editing | null
  startEdit(comment: Entity<Comment>): void
  cancelEdit(): void
  askDelete(comment: Entity<Comment>): void
  editLast(): void
  submit(body: string, mentions: string[]): Promise<void>
}

const Context = createContext<DiscussionContext | null>(null)

function useDiscussion() {
  const ctx = useContext(Context)
  if (!ctx)
    throw new Error('Discussion parts must be inside a DiscussionProvider')
  return ctx
}

/** The words for a comment write that failed, in the user's terms. */
function useCommentError() {
  const {t: l} = useLingui()
  return (code: string) =>
    ({
      EMPTY_COMMENT: l`Write something first`,
      COMMENT_TOO_LONG: l`That comment is too long. Please shorten it.`,
      NOT_YOUR_COMMENT: l`You can only change your own comments`,
      NOT_FOUND: l`This comment or its expense no longer exists`,
      UNKNOWN_PERSON: l`Someone you mentioned is no longer in Splito`,
    })[code] ?? l`Couldn’t save the comment. Please try again.`
}

/**
 * Owns one discussion (F-1204): the thread read, the comment being edited and the
 * writes, so its timeline can sit in the page and its composer bar at the screen's
 * foot while sharing one state.
 */
export function DiscussionProvider({
  targetType,
  targetId,
  canComment,
  people,
  onSent,
  children,
}: {
  targetType: CommentTarget
  targetId: string
  /** False on a deleted expense: the thread shows, nothing is added. */
  canComment: boolean
  /** Who can be mentioned: the expense's participants. */
  people: ReadonlyArray<CommentPerson>
  /** After a comment is added (the page scrolls it into view). */
  onSent?: () => void
  children: React.ReactNode
}) {
  const {t: l} = useLingui()
  const thread = useThread(targetType, targetId)
  const actions = useCommentActions(targetType, targetId)
  const errorText = useCommentError()
  const [editing, setEditing] = useState<Editing | null>(null)
  const deletePrompt = Prompt.usePromptControl()
  const [toDelete, setToDelete] = useState<Entity<Comment> | null>(null)

  const startEdit = (c: Entity<Comment>) =>
    setEditing({id: c.id, body: c.data.body})
  const value: DiscussionContext = {
    targetType,
    targetId,
    canComment,
    people,
    thread,
    me: actions.me,
    editing,
    startEdit,
    cancelEdit: () => setEditing(null),
    askDelete: c => {
      setToDelete(c)
      deletePrompt.open()
    },
    editLast: () => {
      const last = thread?.comments.findLast(
        c => !c.deleted && c.data.authorId === actions.me,
      )
      if (last) startEdit(last)
    },
    submit: async (body, mentions) => {
      try {
        if (editing) await actions.edit(editing.id, body, mentions)
        else await actions.add(body, mentions)
        setEditing(null)
        onSent?.()
      } catch (e) {
        Toast.show(errorText((e as {code?: string}).code ?? ''), {
          type: 'error',
        })
        throw e
      }
    },
  }

  return (
    <Context.Provider value={value}>
      {children}
      <Prompt.Basic
        control={deletePrompt}
        title={l`Delete this comment?`}
        description={l`It disappears from the discussion for everyone. The edit history of the expense is not affected.`}
        confirmButtonCta={l`Delete`}
        confirmButtonColor="negative"
        onConfirm={() => {
          if (!toDelete) return
          if (editing?.id === toDelete.id) setEditing(null)
          void actions.remove(toDelete.id).catch(e =>
            Toast.show(errorText((e as {code?: string}).code ?? ''), {
              type: 'error',
            }),
          )
        }}
      />
    </Context.Provider>
  )
}

/**
 * The expense page's one timeline (Expensify's single stream, Bluesky's rows):
 * comments merged in time order with the page's history lines, under date dividers.
 * `renderLine` draws a history line; `showHistory` is the `comments.showHistory` pref.
 */
export function DiscussionTimeline<H extends TimelineLine>({
  lines,
  showHistory,
  renderLine,
}: {
  lines: readonly H[]
  showHistory: boolean
  renderLine(line: H): React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const timeZone = useTimeZone()
  const {
    targetType,
    targetId,
    canComment,
    people,
    thread,
    me,
    startEdit,
    askDelete,
  } = useDiscussion()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const link = commentLink(targetType, targetId)

  const items = withDividers(
    mergeTimeline(thread?.comments ?? [], lines, {
      showHistory,
      hasEarlier: thread?.hasEarlier ?? false,
    }),
    timeZone,
  )
  const hasComments = (thread?.comments.length ?? 0) > 0

  return (
    <View testID="discussion" style={[a.pb_lg]}>
      {thread?.hasEarlier ? (
        <View style={[a.align_center, a.pt_md]}>
          <Button
            testID="comments-earlier"
            label={l`Show earlier comments`}
            size="small"
            color="secondary"
            onPress={thread.loadEarlier}>
            <ButtonText>
              <Trans>Show earlier comments</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : null}
      {items.map((item, i) => {
        if (item.kind === 'divider')
          return <DateDivider key={item.key} at={item.at} />
        if (item.kind === 'history')
          return <View key={item.key}>{renderLine(item.line)}</View>
        const c = item.comment
        const prev = items[i - 1]
        const next = items[i + 1]
        const clusters = (other: typeof prev, from: number, to: number) =>
          other?.kind === 'comment' &&
          other.comment.data.authorId === c.data.authorId &&
          Math.abs(to - from) <= CLUSTER_MS
        return (
          <Animated.View
            key={item.key}
            entering={FadeIn}
            layout={LinearTransition}>
            <CommentRow
              comment={c}
              people={people}
              authorName={name(c.data.authorId)}
              avatarName={avatarName(c.data.authorId)}
              isMine={c.data.authorId === me}
              isFirstInCluster={!clusters(prev, prev?.at ?? 0, item.at)}
              isLastInCluster={!clusters(next, item.at, next?.at ?? 0)}
              onEdit={startEdit}
              onDelete={askDelete}
              link={link}
            />
          </Animated.View>
        )
      })}
      {!hasComments && thread ? (
        <View
          testID="discussion-empty"
          style={[a.align_center, a.gap_sm, a.px_xl, a.pt_xl, a.pb_md]}>
          <View
            style={[
              a.align_center,
              a.justify_center,
              a.rounded_full,
              t.atoms.bg_contrast_50,
              {width: 44, height: 44},
            ]}>
            <BubbleIcon size="md" fill={t.atoms.text_contrast_medium.color} />
          </View>
          <Text style={[a.text_md, a.font_semi_bold, a.text_center]}>
            {canComment ? (
              <Trans>No comments yet</Trans>
            ) : (
              <Trans>No comments</Trans>
            )}
          </Text>
          {canComment ? (
            <Text
              style={[
                a.text_sm,
                a.leading_snug,
                a.text_center,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>
                Ask a question or leave a note about this. Use @ to mention
                someone.
              </Trans>
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** The composer bar, pinned at the screen's foot by the page; nothing on a deleted expense. */
export function DiscussionComposer() {
  const {canComment, people, editing, cancelEdit, submit, editLast} =
    useDiscussion()
  if (!canComment) return null
  return (
    <CommentComposer
      people={people}
      editing={editing}
      onCancelEdit={cancelEdit}
      onSubmit={submit}
      onEditLast={editLast}
    />
  )
}
