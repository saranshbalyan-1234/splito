const DEVANAGARI_DIGITS = '०१२३४५६७८९'
const MARKS = /[̀-ͯ]/g
const POSSESSIVE = /['’]s\b/g
const APOSTROPHE = /['’`]/g
/* Words, and numbers with their separators ("1,200", "1.5k", "4b"). */
const TOKEN = /[\p{L}\p{N}\p{M}]+(?:[.,][\p{L}\p{N}\p{M}]+)*/gu

/** Lower case, accents off, Devanagari digits as ASCII: "Pastéis" and "१२००" fold to "pasteis" and "1200". */
export function fold(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[०-९]/g, d => String(DEVANAGARI_DIGITS.indexOf(d)))
    .normalize('NFD')
    .replace(MARKS, '')
    .toLowerCase()
}

/** A question as words: folded, possessives and apostrophes dropped ("Riya's" -> "riya"). */
export function tokens(s: string): string[] {
  return fold(s).replace(POSSESSIVE, '').replace(APOSTROPHE, '').match(TOKEN) ?? []
}

/** Whether `words` holds `phrase` (space-separated words) as a run. */
export function hasPhrase(words: readonly string[], phrase: string): boolean {
  const n = phrase.split(' ').length
  if (n === 1) return words.includes(phrase)
  const padded = ` ${words.join(' ')} `
  return padded.includes(` ${phrase} `)
}

/** Whether `words` holds any of `phrases`. */
export function hasAny(words: readonly string[], phrases: readonly string[]): boolean {
  return phrases.some(p => hasPhrase(words, p))
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, saat: 7, aath: 8, nau: 9, das: 10,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
}

/** A small whole number written as digits or as a word (English, Hindi), or undefined. */
export function wholeNumber(word: string): number | undefined {
  if (/^\d{1,3}$/.test(word)) return Number(word)
  return NUMBER_WORDS[word]
}
