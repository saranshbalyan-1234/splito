/*
 * Which build may sign in how (ARCHITECTURE 26.15, F-250). Read by `app.config.ts` (every `expo export`, `expo prebuild`
 * and EAS build evaluates it) and by `src/lib/auth/authConfig.test.ts`.
 *
 * Build kinds, from `EXPO_PUBLIC_ENV`:
 *  - development: local `expo start`, the dev client. Dev account allowed.
 *  - e2e: the Playwright build. Dev account and the `__splitoTest` hooks.
 *  - preview: the owner's review site (Render). The labelled dev account, no e2e hooks, `noindex`.
 *  - production: everything else (`production`, a stage/prod tier build, or no value in a production export). It has no
 *    dev sign-in, so it refuses to build until the auth HTTP client exists (`AUTH_HTTP_CLIENT_READY`), then needs https.
 * A stage or prod tier never carries a development, e2e or preview kind: a release cannot hold the dev account.
 */

/** Flip to true in the change that ships the real HTTP AuthClient (F-2101/F-2102); until then no production build exists. */
const AUTH_HTTP_CLIENT_READY = false

const KINDS = ['development', 'e2e', 'preview', 'production']

/** @param {Record<string, string | undefined>} env @returns {'development' | 'e2e' | 'preview' | 'production'} */
function buildKind(env) {
  const value = env.EXPO_PUBLIC_ENV
  if (value && KINDS.includes(value)) return /** @type {'development' | 'e2e' | 'preview' | 'production'} */ (value)
  /* No (or an unknown) value: an export is a release, `expo start` is development. */
  if (value === undefined || value === '') {
    const isReleaseTier = env.EXPO_PUBLIC_TIER === 'stage' || env.EXPO_PUBLIC_TIER === 'prod'
    return env.NODE_ENV === 'production' || isReleaseTier ? 'production' : 'development'
  }
  return 'production'
}

/** @param {Record<string, string | undefined>} env @returns {boolean} */
function isReleaseBuild(env) {
  return buildKind(env) === 'production' || env.EXPO_PUBLIC_TIER === 'stage' || env.EXPO_PUBLIC_TIER === 'prod'
}

/** What is wrong with this build's auth config, or null. @param {Record<string, string | undefined>} env @returns {string | null} */
function authConfigProblem(env) {
  const kind = buildKind(env)
  const isReleaseTier = env.EXPO_PUBLIC_TIER === 'stage' || env.EXPO_PUBLIC_TIER === 'prod'
  if (kind !== 'production' && isReleaseTier) {
    return `A ${env.EXPO_PUBLIC_TIER} tier build cannot be a ${kind} build: it would ship the dev account.`
  }
  if (!isReleaseBuild(env)) return null
  if (!AUTH_HTTP_CLIENT_READY) {
    return 'A production build is refused until the auth HTTP client exists: production has no dev sign-in. Use EXPO_PUBLIC_ENV=preview for the review site.'
  }
  const url = env.EXPO_PUBLIC_AUTH_API_URL
  if (!url) return 'EXPO_PUBLIC_AUTH_API_URL is not set: a production build needs the real auth API (ARCHITECTURE 26.15).'
  try {
    if (new URL(url).protocol !== 'https:') return 'EXPO_PUBLIC_AUTH_API_URL must be https.'
  } catch {
    return `EXPO_PUBLIC_AUTH_API_URL is not a URL: "${url}".`
  }
  return null
}

/** Throws when the build is not allowed. @param {Record<string, string | undefined>} env */
function assertAuthConfig(env) {
  const problem = authConfigProblem(env)
  if (problem) throw new Error(problem)
}

module.exports = {authConfigProblem, assertAuthConfig, isReleaseBuild, buildKind, AUTH_HTTP_CLIENT_READY}
