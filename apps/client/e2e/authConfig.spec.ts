import {spawnSync} from 'node:child_process'
import {join} from 'node:path'

import {expect, test} from '@playwright/test'

/*
 * F-250: production has no dev sign-in, so a production build is refused until the auth HTTP client exists; the review site is
 * a PREVIEW build, which has the labelled dev account. Expo evaluates `app.config.ts` for every export, prebuild and EAS
 * build, and that is where the check runs. A stage or prod tier never carries a development, e2e or preview build.
 */
const CWD = join(__dirname, '..')
const expoConfig = (env: Record<string, string>) =>
  spawnSync('npx', ['expo', 'config', '--json'], {
    cwd: CWD,
    encoding: 'utf8',
    env: {...process.env, EXPO_NO_TELEMETRY: '1', CI: '1', EXPO_PUBLIC_ENV: '', EXPO_PUBLIC_TIER: '', EXPO_PUBLIC_AUTH_API_URL: '', NODE_ENV: 'development', ...env},
  })
/** `expo export` is what sets NODE_ENV=production (an export with no build kind is a release); the config is read before any bundling. */
const exportRefused = (env: Record<string, string>) => {
  const r = spawnSync('npx', ['expo', 'export', '-p', 'web', '--output-dir', join(CWD, 'node_modules/.cache/auth-config-refused')], {
    cwd: CWD,
    encoding: 'utf8',
    timeout: 60_000,
    env: {...process.env, EXPO_NO_TELEMETRY: '1', CI: '1', EXPO_PUBLIC_ENV: '', EXPO_PUBLIC_TIER: '', EXPO_PUBLIC_AUTH_API_URL: '', ...env},
  })
  return r.status !== 0 && /refused|cannot be/.test(r.stderr + r.stdout)
}
const refused = (env: Record<string, string>) => {
  const r = expoConfig(env)
  return r.status !== 0 && /refused|cannot be/.test(r.stderr + r.stdout)
}

test('a production build is refused, with or without an auth URL', () => {
  expect(refused({EXPO_PUBLIC_ENV: 'production'})).toBe(true)
  expect(refused({EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AUTH_API_URL: 'https://auth.splito.app'})).toBe(true)
})

test('an export or tier build with no kind is a production build too', () => {
  expect(exportRefused({})).toBe(true)
  for (const tier of ['stage', 'prod']) expect(refused({EXPO_PUBLIC_TIER: tier}), tier).toBe(true)
  expect(refused({EXPO_PUBLIC_ENV: 'testflight'})).toBe(true)
})

test('a stage or prod tier never carries a development, e2e or preview build', () => {
  for (const kind of ['development', 'e2e', 'preview'])
    for (const tier of ['stage', 'prod']) expect(refused({EXPO_PUBLIC_ENV: kind, EXPO_PUBLIC_TIER: tier}), `${kind} ${tier}`).toBe(true)
})

test('preview, e2e and development builds need no auth URL', () => {
  for (const kind of ['preview', 'e2e', 'development']) expect(expoConfig({EXPO_PUBLIC_ENV: kind}).status, kind).toBe(0)
  expect(expoConfig({EXPO_PUBLIC_ENV: 'preview', EXPO_PUBLIC_TIER: 'dev'}).status).toBe(0)
  expect(expoConfig({EXPO_PUBLIC_TIER: 'dev'}).status).toBe(0)
})
