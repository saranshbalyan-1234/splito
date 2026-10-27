import {useLingui} from '@lingui/react/macro'

import {type Suggestion} from '#/lib/ask/types'

/**
 * The questions Ask Splito offers as chips and as "try this", in the user's
 * language. Each is sent as the next question, so each must be one the parser
 * reads in that language (askQuestions.test.ts checks every one against the
 * Hindi catalogue too).
 */
export function useAskQuestions() {
  const {t: l} = useLingui()
  const owedMost = () => l`Who owes me the most?`
  const iOweMost = () => l`Whom do I owe the most?`
  const balanceWith = (name: string) => l`What does ${name} owe me?`
  const spendMonth = () => l`How much did I spend this month?`
  const spendCategory = (name: string) => l`How much did I spend on ${name} this month?`
  const spendFood = () => l`How much did I spend on food this month?`
  const groupByDay = (name: string) => l`Show my ${name} spending by day`
  const groupOwes = (name: string) => l`Who owes whom in ${name}?`
  const byCategory = () => l`Show my spending by category this year`
  const split = () => l`Split last night's dinner 3 ways`
  const of = (s: Suggestion): string => {
    switch (s.key) {
      case 'owedMost':
        return owedMost()
      case 'iOweMost':
        return iOweMost()
      case 'balanceWith':
        return balanceWith(s.name)
      case 'spendMonth':
        return spendMonth()
      case 'spendCategory':
        return spendCategory(s.name)
      case 'groupByDay':
        return groupByDay(s.name)
      case 'groupOwes':
        return groupOwes(s.name)
      case 'byCategory':
        return byCategory()
      case 'split':
        return split()
    }
  }
  return {owedMost, iOweMost, balanceWith, spendMonth, spendCategory, spendFood, groupByDay, groupOwes, byCategory, split, of}
}
