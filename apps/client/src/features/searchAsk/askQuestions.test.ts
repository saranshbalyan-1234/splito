import {readFileSync} from 'node:fs'
import {expect, test} from 'bun:test'
import {DEFAULT_CATEGORIES} from '@splito/sync'

import {parseQuestion} from '#/lib/ask/parse'
import {type Vocab} from '#/lib/ask/types'

/*
 * Every question Ask Splito offers is sent back to the parser as typed, in
 * the language it is shown in; so each must read as a real intent in English
 * and in the Hindi catalogue.
 */

const OFFERED: Array<[msgid: string, intent: string]> = [
  ['Who owes me the most?', 'ranking'],
  ['Whom do I owe the most?', 'ranking'],
  ['What does {name} owe me?', 'balance'],
  ['How much did I spend this month?', 'spend'],
  ['How much did I spend on {name} this month?', 'spend'],
  ['How much did I spend on food this month?', 'spend'],
  ['Show my {name} spending by day', 'trend'],
  ['Who owes whom in {name}?', 'groupBalance'],
  ['Show my spending by category this year', 'spend'],
  ["Split last night's dinner 3 ways", 'split'],
]

const vocab: Vocab = {
  people: [{id: 'p', name: 'Riya Sharma'}],
  groups: [{id: 'g', name: 'Goa trip'}],
  categories: DEFAULT_CATEGORIES.map(c => ({id: c.id, name: c.name})),
}

function catalogue(lang: 'en' | 'hi'): Map<string, string> {
  const po = readFileSync(new URL(`../../locale/locales/${lang}/messages.po`, import.meta.url), 'utf8')
  const out = new Map<string, string>()
  for (const m of po.matchAll(/msgid "((?:[^"\\]|\\.)*)"\nmsgstr "((?:[^"\\]|\\.)*)"/g)) out.set(m[1]!, m[2]!)
  return out
}

for (const lang of ['en', 'hi'] as const) {
  test(`every offered question reads as its intent in ${lang}`, () => {
    const cat = catalogue(lang)
    for (const [msgid, intent] of OFFERED) {
      const text = cat.get(msgid)
      expect(text, `${lang}: ${msgid} is translated`).toBeTruthy()
      const name = msgid.includes('on {name}') ? 'Food' : msgid.includes('Show my {name}') || msgid.includes('whom in') ? 'Goa trip' : 'Riya Sharma'
      const question = (text || msgid).replace('{name}', name)
      const parsed = parseQuestion(question, vocab)
      expect(parsed.kind, `${lang}: ${question}`).toBe(intent)
    }
  })
}
