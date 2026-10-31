/**
 * The initials every avatar draws, from one rule (F-274 finding 13). A person
 * ("person") takes the first letters of the first and last words, so a single
 * word gives one letter. A group ("group") takes the first letters of the first
 * two words, or the first two letters of a single word ("Goa" gives "GO"), and
 * reads "?" when the name is empty.
 */
export function initials(
  name: string | undefined,
  mode: 'person' | 'group' = 'person',
) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (mode === 'group') {
    if (words.length === 0) return '?'
    const letters =
      words.length > 1
        ? [Array.from(words[0]!)[0], Array.from(words[1]!)[0]]
        : Array.from(words[0]!).slice(0, 2)
    return letters.join('').toUpperCase()
  }
  if (words.length === 0) return ''
  const first = Array.from(words[0]!)[0] ?? ''
  const last = words.length > 1 ? (Array.from(words.at(-1)!)[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** FNV-1a hash of a name (trimmed, lower-cased), stable across sessions: every avatar hue is picked from it. */
export function nameHash(name: string | undefined) {
  let h = 0x811c9dc5
  for (const ch of (name ?? '').trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
