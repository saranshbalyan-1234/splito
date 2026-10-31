import {decimalMark} from '@splito/domain'
import {DEFAULT_CATEGORIES, type Group, type Person} from '@splito/sync'

import {storeAskSource} from '#/data/askSource'
import {useEntities, useMutationCtx, usePref, useStore} from '#/data/hooks'
import {answerIntent} from '#/lib/ask/answer'
import {useCategoryName} from '#/components/settings/CategoryIcon'
import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {parseQuestion} from '#/lib/ask/parse'
import {type Answer, type Vocab} from '#/lib/ask/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useToday} from '#/locale/useDates'

/**
 * Ask Splito's engine on this device's data (F-2301): `ask` parses a question
 * and answers it from the local store. The vocabulary (people, groups,
 * categories) is read when the question is asked, so it is always current.
 */
export function useAskEngine() {
  const store = useStore()
  const {actor: me} = useMutationCtx()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const [categoryPref = DEFAULT_CATEGORIES] = usePref('categories')
  const categoryName = useCategoryName()
  const [weekStart = 1] = usePref('weekStart')
  const [defaultCurrency = 'INR'] = usePref('defaultCurrency')
  const today = useToday()
  const mark = decimalMark(useNumberLocale())

  /** Everyone and everything a question can name; empty while the store loads. */
  const vocab: Vocab = {
    people: (people ?? []).filter(p => p.id !== me).map(p => ({id: p.id, name: p.data.name})),
    groups: (groups ?? []).map(g => ({id: g.id, name: g.data.name})),
    categories: categoryPref.map(c => ({id: c.id, name: c.name})),
  }

  const ask = useNonReactiveCallback(async (question: string): Promise<Answer> => {
    /* Answers name categories in the UI language (a built-in one the person has not renamed); what they type to ask still matches the stored names (`vocab`). */
    const categories = categoryPref.map(c => ({id: c.id, name: categoryName(c), color: c.color}))
    return answerIntent(parseQuestion(question, vocab), {
      source: storeAskSource(store, me, {today, mark, categories: vocab.categories}),
      me,
      today,
      weekStart: weekStart as 0 | 1 | 6,
      defaultCurrency,
      mark,
      people: vocab.people,
      groups: vocab.groups,
      categories,
    })
  })

  return {ask, vocab, isReady: !!people && !!groups}
}
