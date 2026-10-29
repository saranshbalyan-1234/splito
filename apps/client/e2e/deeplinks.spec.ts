import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-241 / F-254: every page, tab, sheet, picker and drawer has a URL. Each sample opens cold (the address pasted
 * into a fresh load) and warm (a link opened inside the running app, as a push tap or a shared link would), at a
 * phone and a desktop width; then Back and close are checked. Demo data only: nothing is handed to a real app
 * (owner 118) and no URL performs an action. The data is the real (e2e) database, seeded through the app's own
 * mutations: in demo mode a link to an id asks to switch back first (that prompt has its own test below).
 */

type Ids = {person: string; group: string}
type Sample = {
  name: string
  /** The path as the address bar prints it. */
  path: (ids: Ids) => string
  /** What shows when it is open. */
  isOpen: (page: Page) => Promise<void>
  /** The address after closing it by its own close control (the parent page, or the sheet under a picker). */
  parent: (ids: Ids) => string
  /** Closes it the way a person does; default is the sheet's X. */
  close?: (page: Page) => Promise<void>
}

const sheetClose = (page: Page) => page.getByTestId('sheet-close').last().click()

const SAMPLES: Sample[] = [
  {
    name: 'a page',
    path: ({person}) => `/people/${person}`,
    isOpen: async page => await expect(page.getByTestId('screen-person')).toBeVisible(),
    parent: () => '/',
  },
  {
    name: 'a sheet over a page (record payment)',
    path: ({person}) => `/people/${person}/record-payment`,
    isOpen: async page => {
      await expect(page.getByTestId('screen-person')).toBeVisible()
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
    },
    parent: ({person}) => `/people/${person}`,
    close: sheetClose,
  },
  {
    name: 'a picker inside a sheet (record payment > currency)',
    path: ({person}) => `/people/${person}/record-payment/currency`,
    isOpen: async page => {
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
      await expect(page.getByTestId('currency-dialog')).toBeVisible()
    },
    parent: ({person}) => `/people/${person}/record-payment`,
    close: sheetClose,
  },
  {
    name: 'a picker inside the expense composer (/expense/new/currency)',
    path: () => '/expense/new/currency',
    isOpen: async page => {
      await expect(page.getByTestId('currency-dialog')).toBeVisible()
    },
    parent: () => '/expense/new',
    close: sheetClose,
  },
  {
    name: 'a group tab',
    path: ({group}) => `/groups/${group}/balances`,
    isOpen: async page => {
      await expect(page.getByTestId('group-tab-balances')).toHaveAttribute('aria-selected', 'true')
    },
    parent: () => '/',
  },
  {
    name: 'a group sheet (filters) on a tab',
    path: ({group}) => `/groups/${group}/members/filters`,
    isOpen: async page => {
      await expect(page.getByTestId('group-tab-members')).toHaveAttribute('aria-selected', 'true')
    },
    parent: ({group}) => `/groups/${group}/members`,
  },
  {
    name: 'the side drawer',
    path: () => '/groups?drawer=menu',
    isOpen: async page => {
      await expect(page.getByTestId('screen-groups')).toBeVisible()
      await expect(page.getByTestId('drawer')).toBeVisible()
    },
    parent: () => '/groups',
    close: async page => await page.keyboard.press('Escape'),
  },
  {
    name: 'Search & Ask in Ask mode with its question',
    path: () => '/search?mode=ask&q=who+owes+me',
    isOpen: async page => {
      await expect(page.getByTestId('ask-chat')).toBeVisible()
    },
    parent: () => '/',
    close: async page => await page.keyboard.press('Escape'),
  },
  {
    name: 'a Settings editor (language and region > timezone)',
    path: () => '/settings/regional/timezone',
    isOpen: async page => {
      await expect(page.getByTestId('screen-settings-section')).toBeVisible()
      await expect(page.getByTestId('timezone-dialog')).toBeVisible()
    },
    parent: () => '/settings/regional',
    close: sheetClose,
  },
  {
    name: 'an Activity tab',
    path: () => '/activity/others',
    isOpen: async page => {
      await expect(page.getByTestId('activity-tabs').getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true')
    },
    parent: () => '/',
  },
  {
    name: 'list state (Groups sort and filter)',
    path: () => '/groups?show=owe&sort=name',
    isOpen: async page => {
      await expect(page.getByTestId('screen-groups')).toBeVisible()
      await expect(page.getByTestId('list-filters-dot')).toBeVisible()
    },
    parent: () => '/',
  },
]

/** Opens the app and seeds one friend and one group through the app's own mutations; returns their ids. */
async function openApp(page: Page): Promise<Ids> {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window && !!(window as unknown as {__splitoTest?: {openLink?: unknown}}).__splitoTest?.openLink, undefined, {timeout: 30_000})
  return await page.evaluate(async () => {
    type Splito = {createPerson(name: string): Promise<string>; createGroup(input: unknown): Promise<string>}
    const s = (window as unknown as {splito: Splito}).splito
    const person = await s.createPerson('Arjun Mehta')
    const group = await s.createGroup({name: 'Goa trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [person]})
    return {person, group}
  })
}

const openLink = (page: Page, url: string) =>
  page.evaluate(u => (window as unknown as {__splitoTest: {openLink(u: string): void}}).__splitoTest.openLink(u), url)

/** A short tail of the address (path and query), for comparing with what the sample prints. */
const here = (page: Page) => {
  const u = new URL(page.url())
  return u.pathname + u.search
}

for (const [label, viewport] of [
  ['phone 390', {width: 390, height: 844}],
  ['desktop 1440', {width: 1440, height: 900}],
] as const) {
  test.describe(label, () => {
    test.use({viewport})

    for (const sample of SAMPLES) {
      test(`${sample.name}: cold (pasted address) opens it, refresh keeps it, close returns to the parent`, async ({page}) => {
        const known = await openApp(page)
        const path = sample.path(known)
        await page.goto(path)
        await sample.isOpen(page)
        expect(here(page)).toBe(path)
        await page.reload()
        await sample.isOpen(page)
        expect(here(page)).toBe(path)
        if (sample.close) {
          await sample.close(page)
          await expect.poll(() => here(page)).toBe(sample.parent(known))
        }
      })

      test(`${sample.name}: warm (opened inside the app) pushes the address and Back undoes it`, async ({page}) => {
        const known = await openApp(page)
        const path = sample.path(known)
        const before = here(page)
        await openLink(page, `https://splito.app${path}`)
        await sample.isOpen(page)
        await expect.poll(() => here(page)).toBe(path)
        await page.goBack()
        await expect.poll(() => here(page)).toBe(before)
      })
    }

    test('splito:// opens the same screen as https, warm', async ({page}) => {
      const known = await openApp(page)
      await openLink(page, `splito://groups/${known.group}/balances`)
      await expect(page.getByTestId('group-tab-balances')).toHaveAttribute('aria-selected', 'true')
    })

    test('an unknown address opens Home and the bar says /', async ({page}) => {
      await openApp(page)
      await page.goto('/no/such/place')
      await expect(page.getByTestId('screen-people')).toBeVisible()
      expect(here(page)).toBe('/')
    })

    test('browser Back closes the top sheet, Forward reopens it', async ({page}) => {
      const known = await openApp(page)
      await openLink(page, `/people/${known.person}`)
      await openLink(page, `/people/${known.person}/record-payment`)
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
      // The picker opens from a button in the sheet, a separate step: its own history entry.
      await page.getByTestId('payment-other-currency').click()
      await expect.poll(() => here(page)).toBe(`/people/${known.person}/record-payment/currency`)
      await expect(page.getByTestId('currency-dialog')).toBeVisible()
      await page.goBack()
      await expect(page.getByTestId('currency-dialog')).toBeHidden()
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
      await page.goBack()
      await expect(page.getByTestId('record-payment-sheet')).toBeHidden()
      expect(here(page)).toBe(`/people/${known.person}`)
      await page.goForward()
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
    })

    test('a sheet URL never writes: opening record payment leaves the ledger as it was', async ({page}) => {
      const known = await openApp(page)
      const count = () => page.evaluate(() => (window as unknown as {splito: {countExpenses(): Promise<number>; list(t: string): Promise<unknown[]>}}).splito.list('repayment').then(r => r.length))
      const before = await count()
      await page.goto(`/people/${known.person}/record-payment`)
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
      await page.reload()
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
      expect(await count()).toBe(before)
    })

    test('demo mode: a link to real data asks to switch back first; Stay keeps the demo, Switch back opens it', async ({page}) => {
      await openDemo(page)
      await page.waitForFunction(() => !!(window as unknown as {__splitoTest?: {openLink?: unknown}}).__splitoTest?.openLink)
      await openLink(page, 'https://splito.app/groups/abc123/balances')
      await expect(page.getByRole('button', {name: 'Stay in demo'})).toBeVisible()
      await page.getByRole('button', {name: 'Stay in demo'}).click()
      await expect(page.getByRole('button', {name: 'Stay in demo'})).toBeHidden()
      expect(here(page)).toBe('/')
      await openLink(page, 'https://splito.app/groups/abc123/balances')
      await page.getByRole('button', {name: 'Switch back'}).click()
      await expect.poll(() => here(page)).toBe('/groups/abc123/balances')
      // A link to a generic page does not ask.
      await openLink(page, 'https://splito.app/analytics')
      await expect(page.getByTestId('screen-analytics')).toBeVisible()
    })

    test('a refresh on a picker URL restores the draft under it (the composer keeps one per place)', async ({page}) => {
      await openApp(page)
      await page.goto('/expense/new')
      await page.getByTestId('expense-title').fill('Dinner at Thalassa')
      await page.getByTestId('amount-currency').click()
      await expect(page.getByTestId('currency-dialog')).toBeVisible()
      await expect.poll(() => here(page)).toBe('/expense/new/currency')
      await page.reload()
      await expect(page.getByTestId('currency-dialog')).toBeVisible()
      await page.getByTestId('sheet-close').last().click()
      await expect.poll(() => here(page)).toBe('/expense/new')
      await expect(page.getByTestId('expense-title')).toHaveValue('Dinner at Thalassa')
    })
  })
}
