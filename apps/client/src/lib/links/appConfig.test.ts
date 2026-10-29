import {expect, test} from 'bun:test'

import config, {linkClaims} from '../../../app.config'
import {APP_PATHS, LINK_SCHEME, TIER_HOSTS, type Tier} from './hosts'

/** The release-config check (ARCHITECTURE 14): each tier claims only its own host, and only app paths. */
for (const tier of Object.keys(TIER_HOSTS) as Tier[]) {
  test(`${tier} build claims ${TIER_HOSTS[tier]} and no other host`, () => {
    const claims = linkClaims(tier)
    expect(claims.ios.associatedDomains).toEqual([`applinks:${TIER_HOSTS[tier]}`])
    const hosts = claims.android.intentFilters.flatMap(f => f.data.map(d => d.host))
    expect(new Set(hosts)).toEqual(new Set([TIER_HOSTS[tier]]))
    expect(claims.android.intentFilters.every(f => f.autoVerify)).toBe(true)
    expect(claims.android.intentFilters[0]!.data.map(d => d.pathPrefix)).toEqual([...APP_PATHS])
  })
}

test('app paths exclude auth callbacks and downloads, and the scheme is splito', () => {
  for (const p of APP_PATHS) expect(p).not.toMatch(/auth|callback|download|\.well-known/)
  expect(config.scheme).toBe(LINK_SCHEME)
  expect(LINK_SCHEME).toBe('splito')
})
