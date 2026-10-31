import {redirectOldPath, ROUTE_PATHS, router, type RouteName} from '#/routes'
import {startPage} from '#/lib/routes/startTab'
import {LINK_SCHEME, TIER_HOSTS} from './hosts'
import {
  ENTITY_QUERY_KEYS,
  isEntityId,
  isPageSheet,
  isValidPathParam,
  PAGE_TABS,
  PREF_TABS,
  pathParamNames,
  QUERY_KEYS,
  QUERY_SHEETS,
  type PageName,
} from './table'

/**
 * The one link resolver (ARCHITECTURE 14, 26.3; F-254): `https://<tier host>/<path>`, `splito://<path>`, a bare
 * path and a notification's URL all come out the same: a page, its params, and the sheets open on top of it.
 * Pure (no React, no navigation) so a table test can pin every route. Links only navigate: nothing here, or in
 * what reads its result, performs an action.
 */
export type LinkTarget = {
  name: PageName
  /** Path params, `tab`, and the page's list state (`sort`, `currency`, ...), all strings. */
  params: Record<string, string>
  /** The sheets open over the page, outermost first (`['record-payment', 'currency']`); empty for the page alone. */
  sheets: string[]
  /** Query that belongs to the sheet, not the page (`q` and `mode` of Search & Ask). */
  query: Record<string, string>
}

export type Resolved = {isKnown: boolean; target: LinkTarget}

/** Where a link that names nothing goes: the start tab (owner 198: there is no Home page). */
const home = (): LinkTarget => ({name: startPage(), params: {}, sheets: [], query: {}})

const SAFE_VALUE = /^[A-Za-z0-9_.,:~ -]{1,64}$/
/** Free text a link may carry: a search question, an expense title. Control characters never. */
const FREE_TEXT: Record<string, number> = {q: 200, title: 120}

/** `scheme://rest` or a trusted https host -> `/rest?query`; a bare path as is; anything else null. */
function toPathAndQuery(input: string): string | null {
  const text = input.trim().split('#')[0]!
  const scheme = text.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i)
  if (!scheme) return text.startsWith('/') ? text : `/${text}`
  const [, proto, rest] = scheme
  if (proto!.toLowerCase() === LINK_SCHEME) return `/${rest!.replace(/^\/+/, '')}`
  if (proto!.toLowerCase() !== 'https' && proto!.toLowerCase() !== 'http') return null
  const slash = rest!.search(/[/?]/)
  const host = (slash === -1 ? rest! : rest!.slice(0, slash)).toLowerCase().replace(/:\d+$/, '')
  if (!(Object.values(TIER_HOSTS) as string[]).includes(host)) return null
  return slash === -1 ? '/' : rest!.slice(slash).replace(/^(?=\?)/, '/')
}

function cleanQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of new URLSearchParams(search)) {
    if (!/^\w{1,24}$/.test(key) || key in out) continue
    const max = FREE_TEXT[key]
    // eslint-disable-next-line no-control-regex
    const value = max ? raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : raw
    if (max ? value !== '' : SAFE_VALUE.test(value)) out[key] = value
  }
  return out
}

/** Resolves a link to its screen. Anything unknown, malformed or from another host opens the start tab. */
export function resolveLink(input: string): Resolved {
  const pathAndQuery = toPathAndQuery(input)
  if (pathAndQuery === null) return {isKnown: false, target: home()}
  const qIndex = pathAndQuery.indexOf('?')
  const pathname = qIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, qIndex)
  const search = qIndex === -1 ? '' : pathAndQuery.slice(qIndex + 1)
  const old = redirectOldPath(pathname + (search ? `?${search}` : ''))
  const oldQ = old.indexOf('?')
  const segs = (oldQ === -1 ? old : old.slice(0, oldQ)).split('/').filter(Boolean)
  const query = cleanQuery([search, oldQ === -1 ? '' : old.slice(oldQ + 1)].filter(Boolean).join('&'))
  /* The bare address is the start tab (owner 198), with a global sheet if the query names one (`/?drawer=menu`). */
  if (segs.length === 0) return finish(startPage(), {}, [], query)

  for (let i = segs.length; i >= 0; i--) {
    const [matched, pathParams] = router.matchPath(`/${segs.slice(0, i).join('/')}`)
    if (matched === 'NotFound') continue
    const name = matched as RouteName
    let rest = segs.slice(i)

    /* `/groups/filters` reads as a group called "filters"; no id is, so it is the Groups list's own sheet. */
    if (name === 'Group' && pathParams.groupId === 'filters') return finish('Groups', {}, ['filters', ...rest], query)
    /* `/people/filters` likewise is the People list's own sheet. */
    if (name === 'Person' && pathParams.personId === 'filters') return finish('People', {}, ['filters', ...rest], query)
    if (Object.entries(pathParams).some(([k, v]) => !isValidPathParam(k, v))) return {isKnown: false, target: home()}
    if (name === 'Search') {
      if (rest.length > 0) continue
      const {q, mode} = query
      return {
        isKnown: true,
        target: {name: startPage(), params: {}, sheets: ['search'], query: {...(q ? {q} : {}), ...(mode === 'ask' ? {mode} : {})}},
      }
    }
    const params: Record<string, string> = {...pathParams}
    const tabs = (PAGE_TABS as Record<string, readonly string[]>)[name]
    if (tabs && rest[0] && tabs.includes(rest[0])) {
      params.tab = rest[0]
      rest = rest.slice(1)
    }
    return finish(name as PageName, params, rest, query)
  }
  return {isKnown: false, target: home()}
}

/** Splits the query into the page's, the sheet's and a global sheet's, then checks the sheet chain is one the table lists. */
function finish(name: PageName, params: Record<string, string>, chain: string[], query: Record<string, string>): Resolved {
  const pageQuery = {...query}
  const tabs = (PAGE_TABS as Record<string, readonly string[]>)[name]
  /* The old `?tab=balances` still names a tab; `?tab=rules` (Settle up's "Edit rules") is the Payment rules sheet. */
  const queryTab = pageQuery.tab
  delete pageQuery.tab
  if (queryTab && !params.tab && tabs?.includes(queryTab)) params.tab = queryTab
  let sheets = chain
  if (sheets.length > 0 && !isPageSheet(name, sheets, params)) return {isKnown: false, target: home()}
  if (name === 'Group' && queryTab === 'rules' && sheets.length === 0) sheets = ['rules']
  /* `?drawer=menu` opens the side drawer over the page, unless a sheet is already named. */
  for (const [id, value] of Object.entries(QUERY_SHEETS)) {
    if (pageQuery[id] === value && sheets.length === 0) sheets = [id]
    delete pageQuery[id]
  }
  /* Only the keys this page reads survive, and an id in them must look like one. */
  const allowed = QUERY_KEYS[name] ?? []
  const kept = Object.fromEntries(
    Object.entries(pageQuery).filter(([k, v]) => allowed.includes(k) && (!(ENTITY_QUERY_KEYS as readonly string[]).includes(k) || isEntityId(v))),
  )
  return {isKnown: true, target: {name, params: {...kept, ...params}, sheets, query: {}}}
}

/** A target's URL path (with its query): the inverse of `resolveLink`, which is also the address bar's text. */
export function buildPath(target: LinkTarget): string {
  const {name, params, sheets, query} = target
  const search = new URLSearchParams()
  const add = (record: Record<string, string>, skip: readonly string[] = []) => {
    for (const key of Object.keys(record).sort()) if (!skip.includes(key) && record[key] !== undefined && record[key] !== '') search.set(key, record[key]!)
  }
  const finishUrl = (path: string) => (search.size > 0 ? `${path}?${search}` : path)

  if (sheets[0] === 'search') {
    add(query)
    return finishUrl('/search')
  }
  const fixed = pathParamNames(name)
  let path = ROUTE_PATHS[name].replace(/:(\w+)/g, (_m, key: string) => encodeURIComponent(params[key] ?? '')).replace(/\/$/, '')
  const tabs = (PAGE_TABS as Record<string, readonly string[]>)[name]
  if (tabs && params.tab && (params.tab !== tabs[0] || PREF_TABS.includes(name)) && tabs.includes(params.tab)) path += `/${params.tab}`
  add(params, [...fixed, 'tab'])
  const queryId = sheets.length === 1 ? (sheets[0] as keyof typeof QUERY_SHEETS) : undefined
  if (queryId && queryId in QUERY_SHEETS) search.set(queryId, QUERY_SHEETS[queryId])
  else if (sheets.length > 0) path += `/${sheets.join('/')}`
  add(query)
  return finishUrl(path || '/')
}

/** Whether the target names something on this device by id: in demo mode such a link asks to switch back first (F-254). */
export function touchesRealData(target: LinkTarget): boolean {
  /* An invite code is looked up in the directory (demo mode has its own, with its own sample invites), not in the ledger. */
  if (target.name === 'Invite') return false
  return pathParamNames(target.name).some(key => key !== 'section') || !!target.params.personId || !!target.params.groupId
}
