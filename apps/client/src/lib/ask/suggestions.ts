import {type Suggestion} from './types'

/**
 * The question a suggestion stands for, per language, as plain strings (no
 * Lingui): the chat shows the one in the user's language and sends it as the
 * next question, so each must parse (tested). The chat's own catalogue
 * (AskChat.tsx) carries the translated display copy.
 */
export function suggestionText(s: Suggestion, lang: 'en' | 'hi'): string {
  const hi = lang === 'hi'
  switch (s.key) {
    case 'owedMost':
      return hi ? 'किसने मुझे सबसे ज्यादा देना है' : 'Who owes me the most?'
    case 'iOweMost':
      return hi ? 'मुझे किसको सबसे ज्यादा देना है' : 'Whom do I owe the most?'
    case 'balanceWith':
      return hi ? `${s.name} ka balance kitna hai` : `What does ${s.name} owe me?`
    case 'spendMonth':
      return hi ? 'इस महीने मेरा खर्च कितना है' : 'How much did I spend this month?'
    case 'spendCategory':
      return hi ? `${s.name} पर इस महीने कितना खर्च किया` : `How much did I spend on ${s.name} this month?`
    case 'groupByDay':
      return hi ? `${s.name} का मेरा खर्च हर दिन` : `Show my ${s.name} spending by day`
    case 'groupOwes':
      return hi ? `${s.name} mein kaun kisko kitna dena hai` : `Who owes whom in ${s.name}?`
    case 'byCategory':
      return hi ? 'इस साल श्रेणी के हिसाब से मेरा खर्च' : 'Show my spending by category this year'
    case 'split':
      return hi ? '1200 ko 4 mein baato' : 'Split 1200 4 ways'
  }
}
