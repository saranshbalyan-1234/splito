import {beforeEach, expect, test} from 'bun:test'

import {
  type Entry,
  flush,
  logger,
  pendingCount,
  recordFriction,
  recordIssue,
  recordMetric,
  resetTelemetryForTests,
  setDiagnosticsEnabled,
  setRemoteSink,
  setTelemetryIdentity,
} from './index'

let sent: Entry[] = []
beforeEach(() => {
  resetTelemetryForTests()
  sent = []
  setRemoteSink(entries => sent.push(...entries))
  setDiagnosticsEnabled(true)
  setTelemetryIdentity({installId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'})
})

test('recording only enqueues: nothing is sent until the drain', () => {
  logger.info('opened', {where: 'People'})
  recordMetric('expense.save', {outcome: 'saved', ms: 12})
  expect(sent).toEqual([])
  expect(pendingCount()).toBe(2)
  flush()
  expect(pendingCount()).toBe(0)
  expect(sent.map(e => e.kind)).toEqual(['log', 'metric'])
})

test('each entry keeps the time it was recorded, not the time it was sent', async () => {
  recordFriction('tap_while_busy')
  const recorded = Date.now()
  await new Promise(r => setTimeout(r, 30))
  flush()
  expect(Math.abs(sent[0]!.at - recorded)).toBeLessThan(20)
})

test('the drain runs by itself, in small slices, after recording', async () => {
  for (let i = 0; i < 50; i++) recordMetric('tab_switch', {ms: i})
  await new Promise(r => setTimeout(r, 200))
  expect(sent).toHaveLength(50)
})

test('events carry the opaque install id and never an email or a name', () => {
  setTelemetryIdentity({accountId: 'riya@example.com'})
  setTelemetryIdentity({accountId: 'Riya Sharma'})
  logger.error(new Error('Could not save riya@example.com'), {name: 'Riya', amount: 1200n, where: 'AddFriend.save'})
  recordIssue('store', {code: 'write'})
  flush()
  for (const e of sent) {
    expect(e.identity).toEqual({installId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'})
    expect(JSON.stringify(e)).not.toMatch(/riya|Riya|1200/)
  }
  expect(sent[0]!.metadata).toEqual({name: '[redacted]', amount: '[redacted]', where: 'AddFriend.save'})
  setTelemetryIdentity({accountId: 'acct_8f3a2b1c9d'})
  recordFriction('dead_link')
  flush()
  expect(sent.at(-1)!.identity).toEqual({installId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', accountId: 'acct_8f3a2b1c9d'})
})

test('with Send diagnostics off, nothing reaches the remote sink', () => {
  setDiagnosticsEnabled(false)
  logger.error('boom')
  recordMetric('export', {outcome: 'failed'})
  flush()
  expect(sent).toEqual([])
  setDiagnosticsEnabled(true)
  recordMetric('export', {outcome: 'saved'})
  flush()
  expect(sent).toHaveLength(1)
})

test('recording never throws, even when a sink or metadata does', () => {
  setRemoteSink(() => {
    throw new Error('sink down')
  })
  const hostile = {
    get where(): string {
      throw new Error('getter')
    },
  }
  expect(() => logger.warn('x', hostile as never)).not.toThrow()
  expect(() => recordMetric('m', hostile as never)).not.toThrow()
  expect(() => flush()).not.toThrow()
})

test('metric attributes are enums, booleans or numbers only', () => {
  recordMetric('expense.save', {outcome: 'saved', title: 'Dinner at Thalassa', isOffline: false})
  flush()
  expect(sent[0]!.attrs).toEqual({outcome: 'saved', isOffline: false})
})

test('the queue is bounded: a flood never grows memory without limit', () => {
  setRemoteSink(null)
  for (let i = 0; i < 5000; i++) recordMetric('m', {i})
  expect(pendingCount()).toBeLessThanOrEqual(500)
})
