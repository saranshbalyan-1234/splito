/*
 * Production has no dev sign-in (ARCHITECTURE 26.15, F-250), so a release build without the real auth API would ship an
 * app nobody can sign in to. This is the one check, read by `app.config.ts` (every `expo export`, `expo prebuild` and
 * EAS build evaluates it) and by `scripts/auth-config.ts`/the e2e spec. A release build is `EXPO_PUBLIC_ENV=production`,
 * or a stage/prod tier profile that is not an e2e or development build.
 */

/** @param {Record<string, string | undefined>} env @returns {boolean} */
function isReleaseBuild(env) {
  if (env.EXPO_PUBLIC_ENV === 'production') return true
  const isDevelopmentBuild = env.EXPO_PUBLIC_ENV === 'e2e' || env.EXPO_PUBLIC_ENV === 'development'
  return !isDevelopmentBuild && (env.EXPO_PUBLIC_TIER === 'stage' || env.EXPO_PUBLIC_TIER === 'prod')
}

/** What is wrong with this build's auth config, or null. @param {Record<string, string | undefined>} env @returns {string | null} */
function authConfigProblem(env) {
  if (!isReleaseBuild(env)) return null
  const url = env.EXPO_PUBLIC_AUTH_API_URL
  if (!url) return 'EXPO_PUBLIC_AUTH_API_URL is not set: a release build has no dev sign-in, so it needs the real auth API (ARCHITECTURE 26.15).'
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return `EXPO_PUBLIC_AUTH_API_URL must be https, got "${parsed.protocol}".`
  } catch {
    return `EXPO_PUBLIC_AUTH_API_URL is not a URL: "${url}".`
  }
  return null
}

/** Throws when a release build lacks the auth API. @param {Record<string, string | undefined>} env */
function assertAuthConfig(env) {
  const problem = authConfigProblem(env)
  if (problem) throw new Error(problem)
}

module.exports = {authConfigProblem, assertAuthConfig, isReleaseBuild}
