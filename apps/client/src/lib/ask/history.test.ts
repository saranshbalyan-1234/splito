import {expect, test} from 'bun:test'

import {appendMessages, type AskMessage, decodeChat, encodeChat, MAX_MESSAGES, needsDivider} from './history'

const user = (n: number, at = n): AskMessage => ({id: `u${n}`, at, role: 'user', text: `question ${n}`})
const ask = (n: number): AskMessage => ({
  id: `a${n}`,
  at: n,
  role: 'ask',
  answer: {kind: 'spend', measure: 'share', period: {kind: 'month', from: '2026-10-01', to: '2026-10-31', offset: 0}, currencies: [{currency: 'INR', share: 123456789012345n, paid: 0n, total: 5n, count: 2, slices: []}]},
})

test('a chat round-trips with its money exact', () => {
  const chat = [user(1), ask(2), user(3)]
  const back = decodeChat(encodeChat(chat))
  expect(back).toEqual(chat)
  const a = back[1] as Extract<AskMessage, {role: 'ask'}>
  expect(a.answer.kind === 'spend' && typeof a.answer.currencies[0]!.share).toBe('bigint')
})

test('only the newest 200 messages are kept', () => {
  let chat: AskMessage[] = []
  for (let i = 0; i < MAX_MESSAGES + 25; i++) chat = appendMessages(chat, user(i))
  expect(chat).toHaveLength(MAX_MESSAGES)
  expect(chat[0]!.id).toBe('u25')
  expect(chat.at(-1)!.id).toBe(`u${MAX_MESSAGES + 24}`)
  expect(appendMessages(chat, user(1000), ask(1001)).slice(-2).map(m => m.id)).toEqual(['u1000', 'a1001'])
})

test('stored text that is not a chat is dropped, not half-read', () => {
  expect(decodeChat(undefined)).toEqual([])
  expect(decodeChat('not json')).toEqual([])
  expect(decodeChat('{"a":1}')).toEqual([])
  expect(decodeChat(JSON.stringify([{id: 'x'}, {id: 'ok', at: 1, role: 'user', text: 'hi'}, {id: 'b', at: 2, role: 'ask'}]))).toEqual([{id: 'ok', at: 1, role: 'user', text: 'hi'}])
})

test('a day divider heads the first message, a new day and an hour of quiet', () => {
  const t = (iso: string) => Date.parse(iso)
  const m = (at: number): AskMessage => ({id: String(at), at, role: 'user', text: 'x'})
  expect(needsDivider(undefined, m(t('2026-10-27T10:00:00')))).toBe(true)
  expect(needsDivider(m(t('2026-10-27T10:00:00')), m(t('2026-10-27T10:20:00')))).toBe(false)
  expect(needsDivider(m(t('2026-10-27T10:00:00')), m(t('2026-10-27T11:30:00')))).toBe(true)
  expect(needsDivider(m(t('2026-10-27T23:50:00')), m(t('2026-10-28T00:10:00')))).toBe(true)
})
