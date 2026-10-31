import {describe, expect, test} from 'bun:test'

import {setStartTab} from '#/lib/routes/startTab'
import {ROUTE_PATHS, type RouteName} from '#/routes'
import {TIER_HOSTS} from './hosts'
import {buildPath, type LinkTarget, resolveLink, touchesRealData} from './resolve'
import {GLOBAL_SHEETS, PAGE_TABS, SETTINGS_SECTION_SHEETS, SHEETS} from './table'

const ID = '3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77'
const sample = (path: string, section = 'regional') => path.replace(/:(\w+)/g, (_m, key: string) => (key === 'section' ? section : key === 'code' ? 'k3j9x2m4q8w1z5v7' : key === 'step' ? '2' : ID))
const forms = (path: string) => [
  `https://${TIER_HOSTS.prod}${path}`,
  `https://${TIER_HOSTS.dev}${path}`,
  `splito:/${path}`,
  `splito://${path.replace(/^\//, '')}`,
  path,
]

describe('route table: every route parses from https, splito:// and a bare path to one screen', () => {
  for (const name of Object.keys(ROUTE_PATHS) as RouteName[]) {
    test(name, () => {
      const path = sample(ROUTE_PATHS[name])
      const results = forms(path).map(resolveLink)
      for (const r of results) expect(r).toEqual(results[0]!)
      expect(results[0]!.isKnown).toBe(true)
      /* Search is not a page: the old route opens the Search & Ask sheet over the start tab. */
      expect(results[0]!.target.name).toBe(name === 'Search' ? 'People' : name)
    })
  }
})

describe('every tab, sheet and picker', () => {
  for (const [name, tabs] of Object.entries(PAGE_TABS)) {
    for (const tab of tabs.slice(1)) {
      test(`${name} tab ${tab}`, () => {
        const path = `${sample(ROUTE_PATHS[name as RouteName])}/${tab}`
        const r = resolveLink(path)
        expect(r.isKnown).toBe(true)
        expect(r.target.params.tab).toBe(tab)
        expect(buildPath(r.target)).toBe(path)
        for (const f of forms(path)) expect(resolveLink(f)).toEqual(r)
      })
    }
  }
  for (const [name, chains] of Object.entries(SHEETS)) {
    for (const chain of chains) {
      test(`${name} sheet ${chain}`, () => {
        const section = Object.entries(SETTINGS_SECTION_SHEETS).find(([, list]) => list.includes(chain))?.[0]
        const base = sample(ROUTE_PATHS[name as RouteName], section).replace(/\/$/, '')
        const path = `${base}/${chain}`
        const r = resolveLink(path)
        expect(r.isKnown).toBe(true)
        expect(r.target.name as string).toBe(name)
        expect(r.target.sheets).toEqual(chain.split('/'))
        expect(buildPath(r.target)).toBe(path)
        for (const f of forms(path)) expect(resolveLink(f)).toEqual(r)
      })
    }
  }
  test('every picker has its parent sheet listed', () => {
    for (const chains of Object.values(SHEETS)) {
      for (const chain of chains as readonly string[]) {
        const parts = chain.split('/')
        if (parts.length > 1) expect(chains as readonly string[]).toContain(parts.slice(0, -1).join('/'))
      }
    }
  })
  test('global sheets', () => {
    expect(GLOBAL_SHEETS).toEqual(['search', 'feedback', 'install'])
    // There is no side drawer (owner 217): an old `?drawer=menu` opens the page alone.
    const old = resolveLink('/groups?drawer=menu')
    expect(old.target).toMatchObject({name: 'Groups', sheets: []})
    expect(buildPath(old.target)).toBe('/groups')
    const search = resolveLink('splito://search?q=dinner%20out&mode=ask')
    expect(search.target).toMatchObject({name: 'People', sheets: ['search'], query: {q: 'dinner out', mode: 'ask'}})
    expect(buildPath(search.target)).toBe('/search?mode=ask&q=dinner+out')
    expect(resolveLink('/feedback').isKnown).toBe(false)
    expect(resolveLink('/settings/regional?feedback=new').target.sheets).toEqual(['feedback'])
  })
})

describe('list state', () => {
  test('page state travels as query and round-trips', () => {
    const r = resolveLink('https://splito.app/groups?sort=name&show=owed&currency=EUR&settled=1')
    expect(r.target.params).toEqual({sort: 'name', show: 'owed', currency: 'EUR', settled: '1'})
    expect(buildPath(r.target)).toBe('/groups?currency=EUR&settled=1&show=owed&sort=name')
    const sheet = resolveLink(`/people/${ID}/filters?groups=0`)
    expect(sheet.target).toMatchObject({name: 'Person', params: {personId: ID, groups: '0'}, sheets: ['filters']})
  })
  test('the old Group ?tab=rules link opens the rules sheet', () => {
    expect(resolveLink(`/groups/${ID}?tab=rules`).target).toMatchObject({name: 'Group', sheets: ['rules'], params: {groupId: ID}})
  })
  test('default tab prints no segment and a stray tab value is dropped', () => {
    expect(buildPath({name: 'Group', params: {groupId: ID, tab: 'expenses'}, sheets: [], query: {}})).toBe(`/groups/${ID}`)
    expect(resolveLink(`/groups/${ID}?tab=bogus`).target.params).toEqual({groupId: ID})
  })
})

describe('unknown and unsafe links open the start tab', () => {
  const home: LinkTarget = {name: 'People', params: {}, sheets: [], query: {}}
  for (const bad of [
    '/no/such/page',
    `/groups/${ID}/settle/extra`,
    `/groups/${ID}/nope`,
    `/people/${ID}/record-payment/nope`,
    `/groups/${ID}/record-payment`,
    `https://evil.example/people/${ID}`,
    `https://splito.app.evil.example/people/${ID}`,
    'javascript:alert(1)',
    `ftp://splito.app/people/${ID}`,
    '/people/a%20b',
    '/people/' + 'x'.repeat(65),
    'splito://',
    '',
  ]) {
    test(bad || '(empty)', () => {
      const r = resolveLink(bad)
      if (bad === '' || bad === 'splito://') expect(r.target).toEqual(home)
      else expect(r).toEqual({isKnown: false, target: home})
    })
  }
  test('control characters and long text in free-text params are cleaned or capped', () => {
    const q = resolveLink(`/search?q=${encodeURIComponent('a\u0000b' + 'x'.repeat(300))}`).target.query.q!
    expect(q.length).toBe(200)
    expect(q.startsWith('ab')).toBe(true)
    expect(resolveLink('/groups?sort=<script>').target.params).toEqual({})
  })
  test('old paths redirect', () => {
    expect(resolveLink('/notifications').target.name).toBe('Activity')
    expect(resolveLink('/settings/recently-deleted').target).toMatchObject({name: 'SettingsSection', params: {section: 'data', note: 'deleted-stay'}})
    /* Export and Import moved under Your data (owner 205). */
    expect(resolveLink('/settings/export').target).toMatchObject({name: 'SettingsSection', params: {section: 'data'}, sheets: ['export']})
    expect(resolveLink('/settings/import').target).toMatchObject({name: 'SettingsSection', params: {section: 'data'}, sheets: ['import']})
  })
})

test('links only navigate: no URL carries a command', () => {
  const t = resolveLink(`/people/${ID}?action=settle&delete=1&confirm=yes`).target
  // Only the keys a page reads survive: no `action`, nothing that could read as a command.
  expect(t.params).toEqual({personId: ID})
})

test('real-data links: ids ask in demo mode, generic pages do not', () => {
  expect(touchesRealData(resolveLink('/groups').target)).toBe(false)
  expect(touchesRealData(resolveLink('/settings/regional').target)).toBe(false)
  expect(touchesRealData(resolveLink(`/groups/${ID}/balances`).target)).toBe(true)
  expect(touchesRealData(resolveLink(`/expense/new?personId=${ID}`).target)).toBe(true)
  // An invite code is the directory's, not the ledger's: demo mode has its own sample invites.
  expect(touchesRealData(resolveLink(`/invite/k3j9x2m4q8w1z5v7`).target)).toBe(false)
  expect(touchesRealData(resolveLink(`/invites/k3j9x2m4q8w1z5v7/share`).target)).toBe(true)
})

test('/people is the People tab (F-256) with its list state; person pages are /people/:id', () => {
  for (const path of ['/people', '/people/']) {
    expect(resolveLink(path)).toEqual({isKnown: true, target: {name: 'People', params: {}, sheets: [], query: {}}})
  }
  expect(resolveLink(`/people/${ID}`).target.name).toBe('Person')
  const list = resolveLink('/people?sort=name&show=owesYou&currency=EUR&groups=0&settled=1&hidden=1&junk=1')
  expect(list.target).toEqual({name: 'People', params: {sort: 'name', show: 'owesYou', currency: 'EUR', groups: '0', settled: '1', hidden: '1'}, sheets: [], query: {}})
  expect(buildPath(list.target)).toBe('/people?currency=EUR&groups=0&hidden=1&settled=1&show=owesYou&sort=name')
  expect(buildPath(resolveLink('/people/filters').target)).toBe('/people/filters')
  expect(resolveLink('/people/filters').target).toMatchObject({name: 'People', sheets: ['filters']})
})

test('there is no Home (owner 198): "/" is the start tab, the old /?overview= is Analytics, the old list state and /filters belong to People', () => {
  expect(resolveLink('/')).toEqual({isKnown: true, target: {name: 'People', params: {}, sheets: [], query: {}}})
  expect(resolveLink('/?overview=groups').target).toEqual({name: 'Analytics', params: {overview: 'groups'}, sheets: [], query: {}})
  expect(resolveLink('/?overview=direct&currency=EUR').target).toEqual({name: 'Analytics', params: {overview: 'direct', currency: 'EUR'}, sheets: [], query: {}})
  expect(buildPath(resolveLink('/?overview=groups').target)).toBe('/analytics?overview=groups')
  // Only the key is checked here; the page ignores a value it does not know.
  expect(resolveLink('/?junk=1').target).toEqual({name: 'People', params: {}, sheets: [], query: {}})
  // The start tab is whatever the person chose.
  setStartTab('activity')
  expect(resolveLink('/').target).toMatchObject({name: 'Activity'})
  expect(resolveLink('/no/such/page').target).toMatchObject({name: 'Activity'})
  setStartTab('people')
  expect(resolveLink('/?sort=name&show=owesYou').target).toEqual({name: 'People', params: {sort: 'name', show: 'owesYou'}, sheets: [], query: {}})
  expect(resolveLink('/?groups=0&settled=1').target).toMatchObject({name: 'People', params: {groups: '0', settled: '1'}})
  expect(resolveLink('/filters').target).toMatchObject({name: 'People', sheets: ['filters']})
})

describe('Activity (F-1213, F-259): tab, types and one group in the address', () => {
  test('/activity/me and /activity/others are tabs; /activity/all is named explicitly (the bare path is the saved tab)', () => {
    for (const tab of ['all', 'me', 'others']) {
      const r = resolveLink(`/activity/${tab}`)
      expect(r.target).toMatchObject({name: 'Activity', params: {tab}})
      expect(buildPath(r.target)).toBe(`/activity/${tab}`)
    }
    expect(buildPath(resolveLink('/activity').target)).toBe('/activity')
  })

  test('?type=, ?group= and ?from= (the tab a pushed copy opened from) survive; a bad group id and unknown keys are dropped', () => {
    const r = resolveLink(`/activity/all?type=transactions&group=${ID}&from=people&x=1`)
    expect(r.target.params).toEqual({tab: 'all', type: 'transactions', group: ID, from: 'people'})
    expect(buildPath(r.target)).toBe(`/activity/all?from=people&group=${ID}&type=transactions`)
    expect(resolveLink('/activity?group=nope').target.params).toEqual({})
  })

  test('the Filters sheet is /activity/filters, with a tab before it', () => {
    expect(resolveLink('/activity/filters').target).toMatchObject({name: 'Activity', sheets: ['filters']})
    expect(resolveLink('/activity/others/filters?type=comments').target).toMatchObject({name: 'Activity', params: {tab: 'others', type: 'comments'}, sheets: ['filters']})
  })
})

test('every "See all" is Activity on All: transactions, disputed, requests, scoped to a group or friend', async () => {
  const {seeAllTransactionsPath, seeDisputedPath, seeRequestsPath, activityPath} = await import('./make')
  expect(seeAllTransactionsPath()).toBe('/activity?tab=all&type=transactions')
  expect(seeAllTransactionsPath({groupId: ID})).toBe(`/activity?tab=all&type=transactions&group=${ID}`)
  expect(buildPath(resolveLink(seeAllTransactionsPath({groupId: ID})).target)).toBe(`/activity/all?group=${ID}&type=transactions`)
  expect(resolveLink(seeAllTransactionsPath({groupId: ID})).target.params).toEqual({tab: 'all', type: 'transactions', group: ID})
  expect(seeDisputedPath()).toBe('/activity?tab=all&type=expenses%2Cpayments%2Cdisputes')
  expect(seeDisputedPath({groupId: ID})).toBe(`/activity?tab=all&type=expenses%2Cpayments%2Cdisputes&group=${ID}`)
  expect(seeRequestsPath()).toBe('/activity?tab=all&type=friends')
  expect(activityPath({personId: ID})).toBe(`/activity?tab=all&person=${ID}`)
  expect(resolveLink(activityPath({personId: ID, types: ['comments']})).target.params).toEqual({tab: 'all', type: 'comments', person: ID})
  expect(resolveLink('/activity?person=nope').target.params).toEqual({})
})

test('Support and Your data are Settings section pages; Export and Import are sheets of Your data (owners 204, 205)', () => {
  expect(resolveLink('/settings/support').target).toEqual({name: 'SettingsSection', params: {section: 'support'}, sheets: [], query: {}})
  expect(resolveLink('/settings/data').target).toEqual({name: 'SettingsSection', params: {section: 'data'}, sheets: [], query: {}})
  expect(resolveLink('/settings/data/export/period').target).toMatchObject({name: 'SettingsSection', params: {section: 'data'}, sheets: ['export', 'period']})
  // A sheet belongs to the page that hosts it: Export is not a sheet of Appearance or of the Settings tab.
  expect(resolveLink('/settings/appearance/export').isKnown).toBe(false)
  expect(resolveLink('/settings/export/period').target).toMatchObject({sheets: ['export', 'period']})
})

test('Profile is the page at /profile; /settings opens it, there is no Settings route (owner 220)', () => {
  expect(resolveLink('/profile').target).toEqual({name: 'Profile', params: {}, sheets: [], query: {}})
  for (const input of ['/settings', '/settings/', '/settings?x=1', 'https://splito.app/settings', 'splito://settings']) {
    expect(resolveLink(input).isKnown).toBe(true)
    expect(resolveLink(input).target.name).toBe('Profile')
  }
  // The section pages keep their addresses.
  expect(resolveLink('/settings/regional').target).toMatchObject({name: 'SettingsSection', params: {section: 'regional'}})
  expect(resolveLink('/settings/friends').target).toMatchObject({name: 'FriendsAndInvites'})
})
