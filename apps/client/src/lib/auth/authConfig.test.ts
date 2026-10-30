import {expect, test} from 'bun:test'

import {authConfigProblem, AUTH_HTTP_CLIENT_READY, buildKind} from '../../../auth-config'

const URL = 'https://auth.splito.app'

test('the build kind comes from EXPO_PUBLIC_ENV; a missing one is development to start and production to export', () => {
  for (const k of ['development', 'e2e', 'preview', 'production'] as const) expect(buildKind({EXPO_PUBLIC_ENV: k})).toBe(k)
  expect(buildKind({})).toBe('development')
  expect(buildKind({NODE_ENV: 'production'})).toBe('production')
  expect(buildKind({EXPO_PUBLIC_ENV: 'testflight'})).toBe('production')
})

test('production refuses to build outright until the HTTP auth client exists', () => {
  expect(AUTH_HTTP_CLIENT_READY).toBe(false)
  for (const env of [{EXPO_PUBLIC_ENV: 'production'}, {EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AUTH_API_URL: URL}, {NODE_ENV: 'production'}, {EXPO_PUBLIC_TIER: 'prod'}, {EXPO_PUBLIC_TIER: 'stage'}, {EXPO_PUBLIC_ENV: 'testflight'}])
    expect(authConfigProblem(env), JSON.stringify(env)).toContain('refused')
})

test('preview, e2e and development build without an auth URL', () => {
  for (const k of ['preview', 'e2e', 'development']) expect(authConfigProblem({EXPO_PUBLIC_ENV: k})).toBeNull()
  expect(authConfigProblem({EXPO_PUBLIC_ENV: 'preview', EXPO_PUBLIC_TIER: 'dev'})).toBeNull()
  expect(authConfigProblem({})).toBeNull()
})

test('a stage or prod tier never carries a development, e2e or preview build', () => {
  for (const k of ['development', 'e2e', 'preview'])
    for (const tier of ['stage', 'prod']) expect(authConfigProblem({EXPO_PUBLIC_ENV: k, EXPO_PUBLIC_TIER: tier}), `${k} ${tier}`).toContain('cannot be')
})
