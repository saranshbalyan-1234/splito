import {DomainError, isContactEmail} from '@splito/domain'

import {requireLive, write} from './mutations'
import {type Store} from './store'
import {type Entity, type MutationCtx} from './types'

export type FeedbackType = 'bug' | 'idea' | 'question' | 'other'
export const FEEDBACK_TYPES: FeedbackType[] = ['bug', 'idea', 'question', 'other']

/**
 * saved: kept on this device only (no feedback endpoint yet).
 * queued: in the outbox as `FEEDBACK_SUBMIT_OP`, waiting for the server.
 * sent: the server acknowledged it. Only the sync loop may set queued/sent.
 */
export type FeedbackStatus = 'saved' | 'queued' | 'sent'

/** Outbox op type reserved for the backend feedback endpoint (M2). Nothing enqueues it yet. */
export const FEEDBACK_SUBMIT_OP = 'feedback.submit'

export const FEEDBACK_MIN_LENGTH = 10
export const FEEDBACK_MAX_LENGTH = 5000

/**
 * Everything "Include app info" attaches. A whitelist: amounts, names, notes
 * and receipts can never ride along, whatever the caller passes.
 */
export interface FeedbackAppInfo {
  version: string
  platform: string
  os: string
  language: string
  /** Route path of the screen feedback was opened from, e.g. `/settings`. */
  screen: string
}
const APP_INFO_KEYS = ['version', 'platform', 'os', 'language', 'screen'] as const satisfies readonly (keyof FeedbackAppInfo)[]

/**
 * The picked picture, kept inside the record as a downscaled JPEG data URI on
 * every platform (blob URLs die with the tab; picker cache files can be purged).
 */
export interface FeedbackAttachment {
  uri: string
  mime: string
  width: number
  height: number
}

export interface Feedback {
  type: FeedbackType
  message: string
  attachment: FeedbackAttachment | null
  appInfo: FeedbackAppInfo | null
  replyEmail: string | null
  status: FeedbackStatus
  createdAt: number
}

export type FeedbackInput = Pick<Feedback, 'type' | 'message' | 'attachment' | 'appInfo' | 'replyEmail'>

function cleanAppInfo(info: FeedbackAppInfo | null): FeedbackAppInfo | null {
  if (!info) return null
  return Object.fromEntries(APP_INFO_KEYS.map(k => [k, String(info[k] ?? '').slice(0, 200)])) as unknown as FeedbackAppInfo
}

/** Saves feedback on this device (entity + history, no outbox op until the endpoint exists). */
export async function saveFeedback(store: Store, ctx: MutationCtx, input: FeedbackInput): Promise<Entity<Feedback>> {
  if (!FEEDBACK_TYPES.includes(input.type)) throw new DomainError('INVALID_FEEDBACK_TYPE')
  const message = input.message.trim()
  if (message.length < FEEDBACK_MIN_LENGTH) throw new DomainError('FEEDBACK_TOO_SHORT')
  if (message.length > FEEDBACK_MAX_LENGTH) throw new DomainError('FEEDBACK_TOO_LONG')
  const replyEmail = input.replyEmail?.trim() || null
  if (replyEmail && !isContactEmail(replyEmail)) throw new DomainError('INVALID_EMAIL')
  const data: Feedback = {
    type: input.type,
    message,
    attachment: input.attachment,
    appInfo: cleanAppInfo(input.appInfo),
    replyEmail,
    status: 'saved',
    createdAt: ctx.now(),
  }
  return store.transaction(tx => write(tx, ctx, 'feedback', ctx.newId(), data, false, null))
}

/** Tombstones a feedback record with its content stripped, so the message, email and picture are not kept in the tombstone. Local only: the server never had it. */
export async function deleteFeedback(store: Store, ctx: MutationCtx, id: string): Promise<void> {
  await store.transaction(async tx => {
    const f = await requireLive<Feedback>(tx, 'feedback', id)
    await write(tx, ctx, 'feedback', id, {...f.data, message: '', attachment: null, appInfo: null, replyEmail: null}, true, null)
  })
}

/** "Your feedback": live records, newest first. */
export function sortFeedback(all: Entity<Feedback>[]): Entity<Feedback>[] {
  return all.filter(f => !f.deleted).sort((a, b) => b.data.createdAt - a.data.createdAt)
}

export async function loadFeedback(store: Store): Promise<Entity<Feedback>[]> {
  return sortFeedback(await store.getAll<Feedback>('feedback'))
}

/** Mail clients and `mailto:` handlers choke on very long links, so the draft carries the start of a long message. */
export const FEEDBACK_MAIL_MESSAGE_MAX = 1500

const TYPE_NAMES: Record<FeedbackType, string> = {bug: 'Bug', idea: 'Idea', question: 'Question', other: 'Other'}

/**
 * A `mailto:` draft to the support address with the message and app info.
 * The picture is only mentioned: mail drafts can't carry attachments.
 * Support reads English, so the draft is not translated.
 */
export function feedbackMailto(f: Feedback, to: string): string {
  const message = f.message.length > FEEDBACK_MAIL_MESSAGE_MAX ? `${f.message.slice(0, FEEDBACK_MAIL_MESSAGE_MAX)}... (shortened; the full text is saved in the app)` : f.message
  const lines = [message, '', '---', `Type: ${TYPE_NAMES[f.type]}`]
  if (f.appInfo) {
    const i = f.appInfo
    lines.push(`Version: ${i.version}`, `Platform: ${i.platform}`, `OS: ${i.os}`, `Language: ${i.language}`, `Screen: ${i.screen}`)
  }
  if (f.attachment) lines.push('A screenshot is saved with this feedback on my device (please ask if you need it).')
  if (f.replyEmail) lines.push(`Reply to: ${f.replyEmail}`)
  const q = (v: string) => encodeURIComponent(v)
  return `mailto:${to}?subject=${q(`Splito feedback: ${TYPE_NAMES[f.type]}`)}&body=${q(lines.join('\n'))}`
}
