/*
 * The tier a build ships to, read from EXPO_PUBLIC_TIER: one function for `app.config.ts` (which Expo loads on its
 * own, so it cannot import the app's TypeScript) and for the app (`src/lib/links/hosts.ts`). Prod when unset (e2e and
 * local builds); anything else must be a tier in link-hosts.json, so a typo in a build profile fails the build
 * instead of claiming the wrong host.
 */
const hosts = require('./link-hosts.json')

/** @param {string | undefined} value @returns {'dev' | 'stage' | 'prod'} */
function tierFrom(value) {
  if (value === undefined || value === '') return 'prod'
  if (value in hosts.tiers) return /** @type {'dev' | 'stage' | 'prod'} */ (value)
  throw new Error(`EXPO_PUBLIC_TIER must be one of ${Object.keys(hosts.tiers).join(', ')}, got "${value}"`)
}

module.exports = {tierFrom}
