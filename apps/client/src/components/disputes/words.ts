import {useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'
import {type DisputeReason, type DisputeStatus, type ProposedFix, type StoredReason} from '@splito/sync'

import {useNumberLocale} from '#/locale/numberLocale'
import {useDisplayName} from '#/components/split/shared'

/** The words of a dispute (F-1210): reasons, states and what a proposed fix would do. */
export function useDisputeWords() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const name = useDisplayName()

  const reason = (r: StoredReason): string =>
    ({
      not_part: l`Not part of this`,
      left_out: l`I was left out`,
      wrong_amount: l`Wrong amount`,
      wrong_share: l`Wrong split or my share`,
      wrong_payer: l`Wrong payer`,
      duplicate: l`Duplicate`,
      wrong_currency_date: l`Wrong currency or date`,
      not_received: l`Payment not received`,
      other: l`Other`,
      hold: l`On hold`,
    })[r]

  /** The state of one dispute: open disputes read "Disputed", open holds "On hold". */
  const status = (s: DisputeStatus, kind: 'dispute' | 'hold'): string =>
    ({
      open: kind === 'hold' ? l`On hold` : l`Disputed`,
      accepted: l`Accepted`,
      rejected: l`Rejected`,
      withdrawn: l`Withdrawn`,
      released: l`Released`,
      gone: l`Gone`,
    })[s]

  const fix = (f: ProposedFix, currency: string): string => {
    switch (f.kind) {
      case 'amount':
        return l`Change the amount to ${formatAmount(f.amount, currency, locale)}`
      case 'share': {
        const who = name(f.personId)
        return l`Set ${who}’s share to ${formatAmount(f.amount, currency, locale)}`
      }
      case 'payer': {
        const who = name(f.personId)
        return l`Make ${who} the payer`
      }
      case 'duplicate':
        return l`Delete this as a duplicate of another expense`
    }
  }

  return {reason, status, fix}
}

/** The reasons offered for each kind of record, in the order the chips show. */
export function reasonsFor(targetType: 'expense' | 'repayment' | 'writeoff', isItem: boolean): DisputeReason[] {
  if (isItem) return ['not_part', 'wrong_amount', 'wrong_share', 'other']
  if (targetType === 'expense') return ['not_part', 'left_out', 'wrong_amount', 'wrong_share', 'wrong_payer', 'duplicate', 'wrong_currency_date', 'other']
  if (targetType === 'repayment') return ['not_received', 'wrong_amount', 'wrong_currency_date', 'other']
  return ['not_part', 'wrong_amount', 'other']
}
