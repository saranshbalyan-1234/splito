import {type Page} from '@playwright/test'

import {type SplitoDevTools} from '../src/data/devTools'

/** The draft fields every seeded expense shares (INR, Kolkata, food): pass it into `page.evaluate` as an argument. */
export const BASE = {currency: 'INR', tz: 'Asia/Kolkata', category: 'food', notes: ''}

/** One seeded expense. People are numbered: 0 is me, 1 and up are the group's `people` in order. Amounts are minor units. */
export type SeedExpense = {title: string; total: string; paidBy: number; among: number[]; date: string; category?: string}

/**
 * Seeds a group through the app's own mutations (`window.splito`, dev and E2E builds only; load the app first with
 * `openApp`): `people` are created as friends and added to the group with their expenses. Returns the group id, my
 * person id, the friends' ids in order and the expense ids in order.
 */
export async function seedGroup(
  page: Page,
  spec: {name?: string; people: string[]; startDate?: string | null; endDate?: string | null; expenses?: SeedExpense[]},
) {
  return page.evaluate(
    async ({name, people, startDate, endDate, expenses, base}) => {
      const s = (window as unknown as {splito: SplitoDevTools}).splito
      const ids: string[] = []
      for (const person of people) ids.push(await s.createPerson(person))
      const group = await s.createGroup({name, kind: 'trip', currency: 'INR', startDate, endDate, memberIds: ids})
      const who = [s.me, ...ids]
      const made: string[] = []
      for (const e of expenses) {
        made.push(
          await s.createExpense({
            ...base,
            title: e.title,
            groupId: group,
            category: e.category ?? base.category,
            total: e.total,
            payers: {[who[e.paidBy]!]: e.total},
            split: {mode: 'equal', participants: e.among.map(i => who[i]!)},
            date: e.date,
          }),
        )
      }
      return {group, me: s.me, people: ids, expenses: made}
    },
    {name: spec.name ?? 'Rishikesh', people: spec.people, startDate: spec.startDate ?? null, endDate: spec.endDate ?? null, expenses: spec.expenses ?? [], base: BASE},
  )
}

/** A04: Kavya owes me 100 directly and 50 in a shared group (Pune trip). Returns Kavya's and the group's ids. */
export async function seedA04(page: Page) {
  return page.evaluate(async base => {
    const s = (window as unknown as {splito: SplitoDevTools}).splito
    const kavya = await s.createPerson('Kavya Rao')
    const group = await s.createGroup({name: 'Pune trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [kavya]})
    const draft = (title: string, groupId: string | null, total: string, date: string) => ({
      ...base,
      title,
      groupId,
      total,
      payers: {[s.me]: total},
      split: {mode: 'equal', participants: [s.me, kavya]},
      date,
    })
    await s.createExpense(draft('Concert', null, '20000', '2026-10-20'))
    await s.createExpense(draft('Snacks', group, '10000', '2026-10-21'))
    return {kavya, group}
  }, BASE)
}
