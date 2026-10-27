import {type Group, type Person} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'
import {type StatementRow, ZERO} from '@splito/domain'

import {type StatementPage, type StatementText} from '#/lib/export/statementFormat'
import {useEntities, useMutationCtx} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'

/**
 * The words a statement uses, in the person's language: who paid, what each
 * kind of record is called, the column headings. Names come from the local
 * people and groups; "You" is the local user.
 */
export function useStatementText() {
  const {t: l, i18n} = useLingui()
  const {actor} = useMutationCtx()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const locale = useNumberLocale()
  const person = (id: string) => (id === actor ? l`You` : (people?.find(p => p.id === id)?.data.name ?? l`Someone`))
  const group = (id: string | null) => (id === null ? l`Not in a group` : (groups?.find(g => g.id === id)?.data.name ?? ''))

  const text: StatementText = {
    describe: (row: StatementRow) => {
      if (row.kind === 'expense') return row.title
      const r = row.record as Extract<StatementRow['record'], {kind: 'repayment' | 'writeoff'}>
      return row.kind === 'repayment' ? l`${person(r.from)} paid ${person(r.to)}` : l`${person(r.to)} let ${person(r.from)}’s debt go`
    },
    groupName: group,
    paidBy: row => {
      const r = row.record
      return r.kind === 'expense' ? Object.keys(r.payers).map(person).join(', ') : person(r.from)
    },
    kind: kind => ({expense: l`Expense`, repayment: l`Payment`, writeoff: l`Call it even`})[kind],
    columns: {
      date: l`Date`,
      type: l`Type`,
      description: l`Description`,
      group: l`Group`,
      currency: l`Currency`,
      amount: l`Amount`,
      paidBy: l`Paid by`,
      youPaid: l`You paid`,
      yourShare: l`Your share`,
      effect: l`Effect on your balance`,
      balance: l`Balance`,
    },
    opening: l`Opening balance`,
    closing: l`Closing balance`,
    adjustment: l`Group settle-up routing`,
  }

  const day = (d: string) => i18n.date(new Date(`${d}T00:00:00Z`), {dateStyle: 'medium', timeZone: 'UTC'})
  const page = (opts: {subject: string; from?: string | null; to?: string | null; owner: string}): StatementPage => ({
    title: l`Splito statement`,
    subject: opts.subject,
    range: opts.from || opts.to ? l`${opts.from ? day(opts.from) : '…'} to ${opts.to ? day(opts.to) : '…'}` : l`All dates`,
    generated: l`Made on this device on ${i18n.date(new Date(), {dateStyle: 'medium'})}`,
    owner: opts.owner,
    footnote: l`Positive means you are owed, negative means you owe. Every currency is its own balance; Splito never adds different currencies together. Splito records what you tell it; it does not move money.`,
    empty: l`Nothing recorded in this range.`,
    currencyHeading: code => code,
    direction: v => (v > ZERO ? l`You are owed` : v < ZERO ? l`You owe` : l`All settled`),
    columns: {date: l`Date`, description: l`Description`, group: l`Group`, amount: l`Amount`, effect: l`Effect`, balance: l`Balance`},
  })

  return {text, page, person, group, locale, people, groups}
}
