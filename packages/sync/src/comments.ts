import {DomainError} from '@splito/domain'

import {requireLive, write} from './mutations'
import {type Key} from './schema'
import {type Page, type Store} from './store'
import {type Entity, type MutationCtx} from './types'

/** What a comment hangs on (F-1204): an expense or a recorded payment. */
export type CommentTarget = 'expense' | 'repayment'
export const COMMENT_TARGETS: readonly CommentTarget[] = ['expense', 'repayment']

export const COMMENT_MAX_LENGTH = 2000

export interface Comment {
  targetType: CommentTarget
  targetId: string
  /** The person who wrote it (the local "me" until sync brings others'). */
  authorId: string
  /** Plain text. Empty on a tombstone: the text lives on in the earlier history versions only. */
  body: string
  /** People `@mentioned` in `body` (ids), so a reader can tell who was tagged. */
  mentions: string[]
  /** Epoch ms of the last edit; null if never edited. */
  editedAt: number | null
}

export interface CommentInput {
  /** Makes a retried save idempotent: the same id never records a second comment. */
  id?: string
  targetType: CommentTarget
  targetId: string
  body: string
  mentions?: string[]
}

function cleanBody(body: string): string {
  const b = body.trim()
  if (!b) throw new DomainError('EMPTY_COMMENT')
  // ponytail: UTF-16 length, not graphemes; an emoji-heavy comment hits the cap a little early.
  if (b.length > COMMENT_MAX_LENGTH) throw new DomainError('COMMENT_TOO_LONG')
  return b
}

/** Writes one comment: entity, history row and outbox op in one transaction. */
export async function createComment(store: Store, ctx: MutationCtx, input: CommentInput): Promise<Entity<Comment>> {
  if (!COMMENT_TARGETS.includes(input.targetType)) throw new DomainError('INVALID_COMMENT_TARGET')
  const body = cleanBody(input.body)
  const mentions = [...new Set(input.mentions ?? [])]
  const id = input.id ?? ctx.newId()
  return store.transaction(async tx => {
    const existing = await tx.get<Comment>('comment', id)
    if (existing) return existing
    await requireLive(tx, input.targetType, input.targetId)
    for (const pid of mentions) await requireLive(tx, 'person', pid, 'UNKNOWN_PERSON')
    const data: Comment = {targetType: input.targetType, targetId: input.targetId, authorId: ctx.actor, body, mentions, editedAt: null}
    return write(tx, ctx, 'comment', id, data, false, 'comment.create')
  })
}

/** Edits my own comment as a new version. An unchanged body writes nothing. Needs the target still live. */
export async function editComment(store: Store, ctx: MutationCtx, id: string, input: {body: string; mentions?: string[]}): Promise<Entity<Comment>> {
  const body = cleanBody(input.body)
  return store.transaction(async tx => {
    const c = await requireLive<Comment>(tx, 'comment', id)
    if (c.data.authorId !== ctx.actor) throw new DomainError('NOT_YOUR_COMMENT')
    // A deleted expense or payment is read-only: its thread can be tidied (delete) but not rewritten.
    await requireLive(tx, c.data.targetType, c.data.targetId)
    const mentions = [...new Set(input.mentions ?? c.data.mentions)]
    if (body === c.data.body && mentions.join() === c.data.mentions.join()) return c
    for (const pid of mentions) await requireLive(tx, 'person', pid, 'UNKNOWN_PERSON')
    return write(tx, ctx, 'comment', id, {...c.data, body, mentions, editedAt: ctx.now()}, false, 'comment.update')
  })
}

/**
 * Deletes my own comment: a tombstone, never a hard delete. The text is cleared
 * on the live row; every earlier version stays in the history. Deleting twice is a no-op.
 */
export async function deleteComment(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await store.transaction(async tx => {
    const c = await tx.get<Comment>('comment', id)
    if (!c) throw new DomainError('NOT_FOUND')
    if (c.data.authorId !== ctx.actor) throw new DomainError('NOT_YOUR_COMMENT')
    if (c.deleted) return
    await write(tx, ctx, 'comment', id, {...c.data, body: '', mentions: []}, true, 'comment.delete')
  })
}

export const COMMENT_PAGE = 30

/** One target's comments (tombstones included) newest first, by cursor over `byTarget`. */
export function listComments(
  store: Store,
  targetType: CommentTarget,
  targetId: string,
  q: {after?: Key | null; limit?: number} = {},
): Promise<Page<Entity<Comment>>> {
  return store.page<Comment>('comment', {index: 'byTarget', eq: [targetType, targetId], dir: 'prev', after: q.after, limit: q.limit ?? COMMENT_PAGE})
}

/**
 * How many live comments a target has. The index count says zero without reading a
 * row (the common case on a list); otherwise the target's few rows are read to leave
 * the tombstones out.
 */
export async function commentCount(store: Store, targetType: CommentTarget, targetId: string): Promise<number> {
  if ((await store.count('comment', {index: 'byTarget', eq: [targetType, targetId]})) === 0) return 0
  let live = 0
  let after: Key | null = null
  do {
    const page: Page<Entity<Comment>> = await listComments(store, targetType, targetId, {after, limit: 100})
    live += page.items.filter(c => !c.deleted).length
    after = page.next
  } while (after)
  return live
}

export interface MentionRange {
  start: number
  end: number
  personId: string
}

const WORD = /[\p{L}\p{N}_]/u

/**
 * Where the kept `mentions` sit in `body` as `@Name`, for highlighting. A name only
 * counts at a word end, so `@Ri` does not light up inside `@Riyanka`.
 */
export function mentionRanges(body: string, people: ReadonlyArray<{id: string; name: string}>, mentions: readonly string[]): MentionRange[] {
  const lower = body.toLocaleLowerCase()
  const out: MentionRange[] = []
  const names = people.filter(p => mentions.includes(p.id) && p.name).sort((x, y) => y.name.length - x.name.length)
  for (const p of names) {
    const needle = `@${p.name.toLocaleLowerCase()}`
    for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + 1)) {
      const end = i + needle.length
      const next = body[end]
      if (next !== undefined && WORD.test(next)) continue
      if (out.some(r => i < r.end && end > r.start)) continue
      out.push({start: i, end, personId: p.id})
    }
  }
  return out.sort((x, y) => x.start - y.start)
}
