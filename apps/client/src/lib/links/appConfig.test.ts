import {expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import config, {linkClaims} from '../../../app.config'
import {APP_PATHS, LINK_SCHEME, TIER_HOSTS, type Tier, tierFrom} from './hosts'

/** The release-config check (ARCHITECTURE 14, `docs/RELEASE_CHECKLIST.md`): each tier claims only its own host, and only app paths. */
for (const tier of Object.keys(TIER_HOSTS) as Tier[]) {
  test(`${tier} build claims ${TIER_HOSTS[tier]} and no other host`, () => {
    const claims = linkClaims(tier)
    expect(claims.ios.associatedDomains).toEqual([`applinks:${TIER_HOSTS[tier]}`])
    const hosts = claims.android.intentFilters.flatMap(f => f.data.map(d => d.host))
    expect(new Set(hosts)).toEqual(new Set([TIER_HOSTS[tier]]))
    expect(claims.android.intentFilters.every(f => f.autoVerify)).toBe(true)
    const claimed = claims.android.intentFilters[0]!.data.map(d => ('path' in d ? d.path : d.pathPrefix))
    expect(claimed).toEqual([...APP_PATHS])
    expect(claimed).toContain('/')
    expect(claimed).toContain('/notifications')
  })
}

test('app paths exclude auth callbacks and downloads, and the scheme is splito', () => {
  for (const p of APP_PATHS) expect(p).not.toMatch(/auth|callback|download|\.well-known/)
  expect(config.scheme).toBe(LINK_SCHEME)
  expect(LINK_SCHEME).toBe('splito')
})

test('an unknown tier fails the build instead of claiming a host', () => {
  expect(tierFrom(undefined)).toBe('prod')
  expect(tierFrom('stage')).toBe('stage')
  expect(() => tierFrom('staging')).toThrow(/EXPO_PUBLIC_TIER/)
})

test('every EAS build profile sets the tier it ships to', () => {
  const eas = JSON.parse(readFileSync(join(import.meta.dir, '../../../eas.json'), 'utf8')) as {build: Record<string, {env?: Record<string, string>}>}
  for (const tier of Object.keys(TIER_HOSTS)) expect(eas.build[tier]?.env?.EXPO_PUBLIC_TIER).toBe(tier)
})
