export interface Person {
  id: string
  name: string
}

/** Someone who can be `@mentioned`: their name in the text, and the name their avatar's initials come from. */
export interface CommentPerson extends Person {
  avatarName: string
}

/** The `@query` being typed at the caret: where the `@` is and what follows it. */
export interface MentionToken {
  start: number
  query: string
}

const MAX_QUERY = 40

/** The `@` token the caret sits in (an `@` at a word start, no line break since), or null. */
export function activeMention(
  text: string,
  caret: number,
): MentionToken | null {
  const before = text.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at === -1) return null
  if (at > 0 && !/\s/.test(before[at - 1]!)) return null
  const query = before.slice(at + 1)
  if (query.length > MAX_QUERY || query.includes('\n')) return null
  return {start: at, query}
}

/** People whose name, or any word of it, starts with the query; whole-name matches first. */
export function matchPeople<P extends Person>(
  people: readonly P[],
  query: string,
  limit = 5,
): P[] {
  const q = query.toLocaleLowerCase()
  const rank = (p: P) => {
    const name = p.name.toLocaleLowerCase()
    if (name.startsWith(q)) return 0
    return name.split(/\s+/).some(w => w.startsWith(q)) ? 1 : -1
  }
  return people
    .map(p => ({p, r: rank(p)}))
    .filter(x => x.r >= 0)
    .sort((x, y) => x.r - y.r || x.p.name.localeCompare(y.p.name))
    .slice(0, limit)
    .map(x => x.p)
}

/** The text with the token replaced by `@Name ` and the caret just after it. */
export function insertMention(
  text: string,
  token: MentionToken,
  caret: number,
  name: string,
): {text: string; caret: number} {
  const rest = text.slice(caret)
  const insert = /^\s/.test(rest) ? `@${name}` : `@${name} `
  return {
    text: text.slice(0, token.start) + insert + rest,
    caret: token.start + insert.length,
  }
}
