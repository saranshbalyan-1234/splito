import {expect, test} from 'bun:test'

import {authConfigProblem, isReleaseBuild} from '../../../auth-config'

const URL = 'https://auth.splito.app'

test('a production build refuses to build without the auth API URL', () => {
  expect(authConfigProblem({EXPO_PUBLIC_ENV: 'production'})).toContain('EXPO_PUBLIC_AUTH_API_URL is not set')
  expect(authConfigProblem({EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AUTH_API_URL: ''})).toContain('not set')
  expect(authConfigProblem({EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AUTH_API_URL: URL})).toBeNull()
})

test('stage and prod tier builds are release builds too; dev, e2e and plain local builds are not', () => {
  expect(isReleaseBuild({EXPO_PUBLIC_TIER: 'prod'})).toBe(true)
  expect(isReleaseBuild({EXPO_PUBLIC_TIER: 'stage'})).toBe(true)
  expect(isReleaseBuild({EXPO_PUBLIC_TIER: 'dev'})).toBe(false)
  expect(isReleaseBuild({EXPO_PUBLIC_ENV: 'e2e', EXPO_PUBLIC_TIER: 'prod'})).toBe(false)
  expect(isReleaseBuild({})).toBe(false)
  expect(authConfigProblem({EXPO_PUBLIC_ENV: 'e2e'})).toBeNull()
})

test('the URL must be https', () => {
  expect(authConfigProblem({EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AUTH_API_URL: 'http://auth.splito.app'})).toContain('https')
  expect(authConfigProblem({EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AUTH_API_URL: 'nope'})).toContain('not a URL')
})
