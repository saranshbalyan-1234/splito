import {type ExpenseForm, keepItemPeople} from './form'

type PickedGroup = {
  id: string
  currency: string
  members: {personId: string; leftAt: number | null}[]
}

/**
 * The form in `currency`. Cash rounding, when on, moves to that currency's
 * own unit so a unit meant for rupees never rounds euros (audit M15).
 */
export function formWithCurrency(
  f: ExpenseForm,
  currency: string,
  roundToFor: (currency: string) => number,
): ExpenseForm {
  return {...f, currency, ...(f.roundTo ? {roundTo: roundToFor(currency)} : {})}
}

/**
 * The form after picking `group`. The group's home currency only pre-fills a
 * new expense that has no amount yet and no currency the user chose; typed
 * numbers keep their currency and edits never change it (audit M5, § 26.13).
 * Unticked people stay unticked while they are still in the split.
 */
export function formWithGroup(
  f: ExpenseForm,
  group: PickedGroup,
  me: string,
  roundToFor: (currency: string) => number,
  {
    isEdit = false,
    isCurrencyPicked = false,
  }: {isEdit?: boolean; isCurrencyPicked?: boolean},
): ExpenseForm {
  const ids = group.members.filter(m => m.leftAt === null).map(m => m.personId)
  const people = [
    ...ids.filter(id => id === me),
    ...ids.filter(id => id !== me),
  ]
  const isPrefill = !isEdit && !isCurrencyPicked && !f.amount.trim()
  return {
    ...(isPrefill ? formWithCurrency(f, group.currency, roundToFor) : f),
    groupId: group.id,
    people,
    payer: people.includes(f.payer) ? f.payer : (people[0] ?? me),
    excluded: f.excluded.filter(p => people.includes(p)),
    items: keepItemPeople(f.items, new Set(people)),
  }
}
