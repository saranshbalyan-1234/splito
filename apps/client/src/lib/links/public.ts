/**
 * The pages a signed-out device may show (ARCHITECTURE 26.15: "only the intro, the Continue flow, language and the legal and
 * help pages; public invite pages stay public and lead to sign-in"). One allowlist, read by `LoggedOutApp` and the link hold.
 */
export type PublicPage = 'help' | 'privacy' | 'about' | 'join'

/** The path of a link or address, without scheme, host, query or hash (`splito://settings/help` and `https://splito.app/settings/help` alike). */
function pathOf(input: string) {
  const text = input.trim().split('#')[0]!.split('?')[0]!
  const scheme = text.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i)
  if (!scheme) return text.startsWith('/') ? text : `/${text}`
  if (scheme[1]!.toLowerCase() === 'splito') return `/${scheme[2]!.replace(/^\/+/, '')}`
  const rest = scheme[2]!
  const slash = rest.indexOf('/')
  return slash === -1 ? '/' : rest.slice(slash)
}

/** The public page an address or link names, or null. `/join/<token>` is matched exactly (a near-miss is not public). */
export function publicPageFor(input: string): PublicPage | null {
  const path = pathOf(input).replace(/\/+$/, '')
  const settings = path.match(/^\/settings\/(help|privacy|about)$/)
  if (settings) return settings[1] as PublicPage
  return /^\/join\/[A-Za-z0-9_-]{6,64}$/.test(path) ? 'join' : null
}

/** The address a public page has on web. */
export const publicPath = (page: Exclude<PublicPage, 'join'>) => `/settings/${page}`
