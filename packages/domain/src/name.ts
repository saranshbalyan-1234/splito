/**
 * A person's name as it is saved and shown (owner 181): trimmed, inner
 * whitespace collapsed, and the first code point of every word upper-cased
 * (locale-aware). A word starts after a space or a hyphen; the rest of each
 * word stays as typed ("McDonald", "D'Souza", "d'souza" -> "D'souza"). Scripts
 * without letter case (Devanagari) come back unchanged. Only for people:
 * group names, expense titles and emails are not names.
 */
export function capitalizeName(name: string): string {
  // `.` with the u flag is a whole code point, so a surrogate pair is never split.
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(
      /(^|[ -])(.)/gsu,
      (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase(),
    )
}
