import {
  type Comment,
  type CommentTarget,
  COMMENT_PAGE,
  commentCount,
  createComment,
  deleteComment,
  editComment,
  type Entity,
  type Key,
  listComments,
  touches,
} from '@splito/sync'

import {useMutationCtx, useProjection, useStore} from '#/data/hooks'
import {INVITE_HOST} from '#/data/friends'
import {MORE, type Query, shareRows} from '#/data/projections'

/**
 * Comment reads and writes for the discussion under an expense or a payment
 * (F-1204). Components never touch the store (ARCHITECTURE 1); they come here.
 */

export interface Thread {
  /** Oldest first: the newest `COMMENT_PAGE`s, tombstones included (they keep the conversation's order). */
  comments: Entity<Comment>[]
  /** Older comments exist than the pages loaded so far. */
  hasEarlier: boolean
  loadEarlier(): void
}

const threadQueries = new Map<string, Query<Thread>>()

function threadQuery(type: CommentTarget, id: string): Query<Thread> {
  const key = `comments:${type}:${id}`
  let q = threadQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: change => touches(change, 'comment'),
      loader: (store, controls) => {
        let want = COMMENT_PAGE
        const loadEarlier = () => {
          want += COMMENT_PAGE
          controls.reload(MORE)
        }
        return async (_change, prev) => {
          // Newest first by cursor over `byTarget`, as far as was asked: never the whole thread.
          const rows: Entity<Comment>[] = []
          let after: Key | null = null
          let isDone = false
          while (rows.length < want && !isDone) {
            const page = await listComments(store, type, id, {
              after,
              limit: Math.min(COMMENT_PAGE, want - rows.length),
            })
            rows.push(...page.items)
            after = page.next
            isDone = !after
          }
          const comments = shareRows(prev?.comments, rows.reverse())
          return prev &&
            comments === prev.comments &&
            prev.hasEarlier === !isDone
            ? prev
            : {comments, hasEarlier: !isDone, loadEarlier}
        }
      },
    }
    threadQueries.set(key, q)
  }
  return q
}

/** The discussion of one expense or payment, live. Undefined while the first page loads. */
export function useThread(type: CommentTarget, id: string): Thread | undefined {
  return useProjection(threadQuery(type, id))
}

const countQueries = new Map<string, Query<number>>()

/** How many live comments one expense or payment has (0 costs an index count). Undefined while loading. */
export function useCommentCount(
  type: CommentTarget,
  id: string,
): number | undefined {
  const key = `comment-count:${type}:${id}`
  let q = countQueries.get(key)
  if (!q) {
    q = {
      key,
      isTouchedBy: change => touches(change, 'comment'),
      loader: store => () => commentCount(store, type, id),
    }
    countQueries.set(key, q)
  }
  return useProjection(q)
}

/** The writes of one discussion, with the author's id (the local "me"). */
export function useCommentActions(type: CommentTarget, id: string) {
  const store = useStore()
  const ctx = useMutationCtx()
  return {
    me: ctx.actor,
    add: (body: string, mentions: string[]) =>
      createComment(store, ctx, {
        targetType: type,
        targetId: id,
        body,
        mentions,
      }),
    edit: (commentId: string, body: string, mentions: string[]) =>
      editComment(store, ctx, commentId, {body, mentions}),
    remove: (commentId: string) => deleteComment(store, ctx, commentId),
  }
}

/** The web path of an expense or payment, for "Copy link". Opens it on a device that holds it. */
export function commentLink(type: CommentTarget, id: string): string {
  return `${INVITE_HOST}/${type === 'expense' ? 'expense' : 'payment'}/${id}`
}
