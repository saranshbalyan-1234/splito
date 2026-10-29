import {parseMinor} from '@splito/domain'

import {type Answer} from './types'

/**
 * The chat as kept on this device (ARCHITECTURE 26.19, ruling: device-only,
 * capped at 200 messages, "Clear chat"). It is not ledger data: never in the
 * database, the outbox or a backup. Answers are stored as they were given, so
 * a reopened chat says what it said then, not what the books say now.
 */
export const MAX_MESSAGES = 200

export type AskMessage = {id: string; at: number} & ({role: 'user'; text: string} | {role: 'ask'; answer: Answer})

/* Money is bigint, which JSON cannot hold: it travels as {"$big": "123"}. */
const BIG = '$big'

export function encodeChat(messages: readonly AskMessage[]): string {
  return JSON.stringify(messages, (_k, v) => (typeof v === 'bigint' ? {[BIG]: v.toString()} : v))
}

/** The kept chat, or nothing at all when the stored text is not a chat (it is never half-trusted). */
export function decodeChat(raw: string | undefined): AskMessage[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw, (_k, v) => (v && typeof v === 'object' && typeof (v as Record<string, unknown>)[BIG] === 'string' ? parseMinor((v as Record<string, string>)[BIG]!) : v))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is AskMessage =>
        !!m && typeof m.id === 'string' && typeof m.at === 'number' && ((m.role === 'user' && typeof m.text === 'string') || (m.role === 'ask' && !!m.answer && typeof m.answer.kind === 'string')),
    )
  } catch {
    return []
  }
}

/** `added` after `messages`, keeping the newest `MAX_MESSAGES`. */
export function appendMessages(messages: readonly AskMessage[], ...added: AskMessage[]): AskMessage[] {
  return [...messages, ...added].slice(-MAX_MESSAGES)
}

/** Whether a day divider heads this message: the first, a new calendar day, or an hour of quiet. */
export function needsDivider(prev: AskMessage | undefined, message: AskMessage): boolean {
  if (!prev) return true
  const day = (t: number) => new Date(t).toDateString()
  return day(prev.at) !== day(message.at) || message.at - prev.at >= 60 * 60 * 1000
}
