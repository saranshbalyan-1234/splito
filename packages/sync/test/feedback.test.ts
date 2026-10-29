import {beforeEach, expect, test} from 'bun:test'
import {DomainError} from '@splito/domain'

import {
  deleteFeedback,
  type Feedback,
  type FeedbackInput,
  FEEDBACK_MAIL_MESSAGE_MAX,
  feedbackMailto,
  isValidEmail,
  loadFeedback,
  saveFeedback,
  sortFeedback,
} from '../src/feedback'
import {ensureMe} from '../src/mutations'
import {getPref, PREFS} from '../src/preferences'
import {openSqlStore} from '../src/sqlStore'
import {type Store} from '../src/store'
import {type MutationCtx} from '../src/types'
import {bunExecutor} from './bunExecutor'

let s: Store
let ctx: MutationCtx
let n = 0
beforeEach(async () => {
  n = 0
  s = await openSqlStore(bunExecutor(':memory:'))
  ctx = {deviceId: 'dev1', actor: 'me', now: () => 1000 + n * 10, newId: () => 'id' + ++n}
  await ensureMe(s, ctx, 'Me')
})

const appInfo = {version: '1.0.0', platform: 'web', os: 'macOS', language: 'en', screen: '/settings'}
const input = (over: Partial<FeedbackInput> = {}): FeedbackInput => ({
  type: 'bug',
  message: '  The total is off by one rupee  ',
  attachment: null,
  appInfo,
  replyEmail: null,
  ...over,
})

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.catch(x => x)
  expect(e).toBeInstanceOf(DomainError)
  expect((e as DomainError).code).toBe(code)
}

test('saves feedback on the device: status saved, trimmed, with history, nothing queued', async () => {
  const outboxBefore = (await s.outbox()).length
  const fb = await saveFeedback(s, ctx, input({replyEmail: ' me@example.com '}))
  expect(fb.type).toBe('feedback')
  expect(fb.data.status).toBe('saved')
  expect(fb.data.message).toBe('The total is off by one rupee')
  expect(fb.data.replyEmail).toBe('me@example.com')
  expect(fb.data.createdAt).toBeGreaterThan(0)
  expect(await s.history('feedback', fb.id)).toHaveLength(1)
  // No backend endpoint yet: nothing may wait in the outbox pretending to send.
  expect((await s.outbox()).length).toBe(outboxBefore)
  // A row nothing will ever send is `local`, not `pending` (schema v3 keeps it in its own `feedback` store).
  expect(fb.syncStatus).toBe('local')
  expect((await s.get('feedback', fb.id))!.syncStatus).toBe('local')
  expect((await s.syncCounts()).feedback!.pending).toBe(0)
  await deleteFeedback(s, ctx, fb.id)
  expect((await s.get('feedback', fb.id))!.syncStatus).toBe('local')
})

test('validates type, message length and reply email', async () => {
  await fails(saveFeedback(s, ctx, input({message: ' too short '})), 'FEEDBACK_TOO_SHORT')
  await fails(saveFeedback(s, ctx, input({message: 'x'.repeat(5001)})), 'FEEDBACK_TOO_LONG')
  await fails(saveFeedback(s, ctx, input({type: 'rant' as never})), 'INVALID_FEEDBACK_TYPE')
  await fails(saveFeedback(s, ctx, input({replyEmail: 'not-an-email'})), 'INVALID_EMAIL')
  expect((await saveFeedback(s, ctx, input({replyEmail: '   '}))).data.replyEmail).toBeNull()
})

test('app info keeps only the whitelisted fields (never amounts, names or notes)', async () => {
  const leaky = {...appInfo, amount: '500', name: 'Asha', notes: 'secret'} as never
  const fb = await saveFeedback(s, ctx, input({appInfo: leaky}))
  expect(Object.keys(fb.data.appInfo!).sort()).toEqual(['language', 'os', 'platform', 'screen', 'version'])
  expect((await saveFeedback(s, ctx, input({appInfo: null}))).data.appInfo).toBeNull()
})

test('Your feedback lists newest first and hides deleted', async () => {
  const a = await saveFeedback(s, ctx, input())
  const b = await saveFeedback(s, ctx, input({type: 'idea', message: 'Please add a dark logo'}))
  expect((await loadFeedback(s)).map(f => f.id)).toEqual([b.id, a.id])
  await deleteFeedback(s, ctx, a.id)
  expect((await loadFeedback(s)).map(f => f.id)).toEqual([b.id])
  await fails(deleteFeedback(s, ctx, a.id), 'NOT_FOUND')
  expect(sortFeedback([])).toEqual([])
})

test('a deleted feedback tombstone keeps no message, picture, email or app info', async () => {
  const fb = await saveFeedback(
    s,
    ctx,
    input({attachment: {uri: 'data:image/jpeg;base64,AAAA', mime: 'image/jpeg', width: 10, height: 10}, replyEmail: 'me@example.com'}),
  )
  await deleteFeedback(s, ctx, fb.id)
  const t = (await s.getAll<Feedback>('feedback')).find(f => f.id === fb.id)!
  expect(t.deleted).toBe(true)
  expect(t.data).toMatchObject({message: '', attachment: null, appInfo: null, replyEmail: null})
  const latest = (await s.history('feedback', fb.id)).at(-1)!
  expect(JSON.stringify(latest.data)).not.toContain('AAAA')
})

test('email draft carries the message and app info, notes the attachment, never embeds it', async () => {
  const fb = await saveFeedback(
    s,
    ctx,
    input({
      attachment: {uri: 'data:image/jpeg;base64,AAAA', mime: 'image/jpeg', width: 10, height: 10},
      replyEmail: 'me@example.com',
    }),
  )
  const url = feedbackMailto(fb.data, 'feedback@splito.app')
  expect(url.startsWith('mailto:feedback@splito.app?subject=')).toBe(true)
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1))
  expect(params.get('subject')).toBe('Splito feedback: Bug')
  const body = params.get('body')!
  expect(body).toContain('The total is off by one rupee')
  expect(body).toContain('Version: 1.0.0')
  expect(body).toContain('Screen: /settings')
  expect(body).toContain('Reply to: me@example.com')
  expect(body).toContain('screenshot')
  expect(body).not.toContain('base64')
  // mailto wants %20, not +, for spaces.
  expect(url).not.toContain('+')
})

test('isValidEmail', () => {
  expect(isValidEmail('a@b.co')).toBe(true)
  expect(isValidEmail('a@b')).toBe(false)
  expect(isValidEmail('a b@c.com')).toBe(false)
})

test('a very long message is shortened in the email draft only', async () => {
  const fb = await saveFeedback(s, ctx, input({message: 'x'.repeat(FEEDBACK_MAIL_MESSAGE_MAX + 500)}))
  const body = new URLSearchParams(feedbackMailto(fb.data, 'a@b.co').split('?')[1]).get('body')!
  expect(body).toContain('shortened')
  expect(body.length).toBeLessThan(FEEDBACK_MAIL_MESSAGE_MAX + 400)
  expect(fb.data.message.length).toBe(FEEDBACK_MAIL_MESSAGE_MAX + 500)
})

test('"Include app info" starts on and stays on this device', async () => {
  expect(await getPref(s, 'feedback.includeAppInfo')).toBe(true)
  expect(PREFS['feedback.includeAppInfo'].scope).toBe('device')
})
