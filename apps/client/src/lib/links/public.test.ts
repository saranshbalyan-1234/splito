import {expect, test} from 'bun:test'

import {publicPageFor} from './public'

test('help, privacy and about are public, whichever way the link is written', () => {
  for (const page of ['help', 'privacy', 'about'] as const) {
    expect(publicPageFor(`/settings/${page}`)).toBe(page)
    expect(publicPageFor(`/settings/${page}/`)).toBe(page)
    expect(publicPageFor(`https://splito.app/settings/${page}?x=1`)).toBe(page)
    expect(publicPageFor(`splito://settings/${page}`)).toBe(page)
  }
})

test('/join/<token> is public and nothing near it is', () => {
  expect(publicPageFor('/join/abc123def456')).toBe('join')
  expect(publicPageFor('https://splito.app/join/abc123def456')).toBe('join')
  for (const no of ['/join', '/join/', '/join/abc', '/join/abc123def456/extra', '/joined/abc123def456', '/settings', '/settings/regional', '/settings/helpful', '/groups'])
    expect(publicPageFor(no), no).toBeNull()
})
