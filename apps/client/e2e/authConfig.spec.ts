import {spawnSync} from 'node:child_process'
import {join} from 'node:path'

import {expect, test} from '@playwright/test'

/*
 * F-250 acc 6: production has no dev sign-in, so a release build without the real auth API refuses to build. Expo
 * evaluates `app.config.ts` for every export, prebuild and EAS build, and that is where the check runs.
 */
const CWD = join(__dirname, '..')
const expoConfig = (env: Record<string, string>) =>
  spawnSync('npx', ['expo', 'config', '--json'], {cwd: CWD, encoding: 'utf8', env: {...process.env, EXPO_NO_TELEMETRY: '1', CI: '1', EXPO_PUBLIC_AUTH_API_URL: '', ...env}})

test('a production build without EXPO_PUBLIC_AUTH_API_URL fails to build', () => {
  const result = expoConfig({EXPO_PUBLIC_ENV: 'production'})
  expect(result.status).not.toBe(0)
  expect(result.stderr + result.stdout).toContain('EXPO_PUBLIC_AUTH_API_URL')
})

test('a stage or prod tier build without it fails too', () => {
  for (const tier of ['stage', 'prod']) expect(expoConfig({EXPO_PUBLIC_TIER: tier}).status, tier).not.toBe(0)
})

test('production with the https auth API URL builds, and dev and e2e builds need none', () => {
  expect(expoConfig({EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AUTH_API_URL: 'https://auth.splito.app'}).status).toBe(0)
  expect(expoConfig({EXPO_PUBLIC_ENV: 'e2e'}).status).toBe(0)
  expect(expoConfig({EXPO_PUBLIC_TIER: 'dev'}).status).toBe(0)
})
