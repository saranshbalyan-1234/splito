import {expect, type Page, test} from '@playwright/test'

import {SETTINGS_SECTION_SHEETS, SHEETS} from '#/lib/links/table'
import {openDemo} from './openDemo'

/*
 * F-241 / F-254: every page, tab, sheet, picker and drawer has a URL. Each sample opens cold (the address pasted
 * into a fresh load) and warm (a link opened inside the running app, as a push tap or a shared link would), at a
 * phone and a desktop width; then Back and close are checked. Demo data only: nothing is handed to a real app
 * (owner 118) and no URL performs an action. The data is the real (e2e) database, seeded through the app's own
 * mutations: in demo mode a link to an id asks to switch back first (that prompt has its own test below).
 */

type Ids = {person: string; group: string; expense: string}
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
      await expect(page.getByTestId('group-filter-sheet')).toBeVisible()
    },
    parent: ({group}) => `/groups/${group}/members`,
    close: sheetClose,
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

/**
 * Opens the app and seeds, through the app's own mutations: a friend I owe 100 in rupees (so Record payment, Call it
 * even and Pay with UPI all have something to open), a group with that friend, and an expense in it.
 */
async function openApp(page: Page): Promise<Ids> {
  await page.goto('/')
  await page.waitForFunction(() => 'splito' in window && !!(window as unknown as {__splitoTest?: {openLink?: unknown}}).__splitoTest?.openLink, undefined, {timeout: 30_000})
  return await page.evaluate(async () => {
    type Splito = {me: string; createPerson(name: string): Promise<string>; createGroup(input: unknown): Promise<string>; createExpense(draft: unknown): Promise<string>}
    const s = (window as unknown as {splito: Splito}).splito
    const person = await s.createPerson('Arjun Mehta')
    const group = await s.createGroup({name: 'Goa trip', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [person]})
    const base = {currency: 'INR', tz: 'Asia/Kolkata', category: 'food', notes: ''}
    await s.createExpense({...base, title: 'Concert', groupId: null, total: '20000', payers: {[person]: '20000'}, split: {mode: 'equal', participants: [s.me, person]}, date: '2026-10-20'})
    const expense = await s.createExpense({...base, title: 'Snacks', groupId: group, total: '10000', payers: {[s.me]: '10000'}, split: {mode: 'equal', participants: [s.me, person]}, date: '2026-10-21'})
    return {person, group, expense}
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

    test('Group X > Settle > Edit rules opens exactly one rules sheet (the copy of Group under Settle stays shut)', async ({page}) => {
      const known = await openApp(page)
      // Cold, the stack is People > Groups > Group > Settle; the link then opens the Group page's rules over Settle.
      await page.goto(`/groups/${known.group}/settle`)
      await expect(page.getByTestId('screen-settle')).toBeVisible()
      await openLink(page, `https://splito.app/groups/${known.group}/rules`)
      await expect(page.getByTestId('rules-sheet')).toBeVisible()
      await expect.poll(() => here(page)).toBe(`/groups/${known.group}/rules`)
      await expect(page.getByTestId('rules-sheet')).toHaveCount(1)
      await page.getByTestId('sheet-close').last().click()
      await expect(page.getByTestId('rules-sheet')).toHaveCount(0)
    })

    test('closing by X, Cancel, Save and the scrim each takes the address off and adds no history entry', async ({page}) => {
      const known = await openApp(page)
      await page.goto(`/people/${known.person}`)
      await expect(page.getByTestId('screen-person')).toBeVisible()
      const length = () => page.evaluate(() => history.length)
      const closers: Array<[string, (p: Page) => Promise<void>]> = [
        ['the X', p => p.getByTestId('sheet-close').last().click()],
        ['Cancel', p => p.getByTestId('sheet-cancel').click()],
        ['Save', p => p.getByTestId('sheet-save').click()],
        ['the scrim', p => p.keyboard.press('Escape')],
      ]
      for (const [name, close] of closers) {
        const before = await length()
        await page.getByTestId('person-record-payment').click()
        await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
        await expect.poll(() => here(page), {message: `open (${name})`}).toBe(`/people/${known.person}/record-payment`)
        // The first open adds one entry; later ones replace the entry the last close left ahead of us.
        if (name === 'the X') expect(await length()).toBe(before + 1)
        else expect(await length()).toBeLessThanOrEqual(before + 1)
        await close(page)
        await expect(page.getByTestId('record-payment-sheet')).toBeHidden()
        await expect.poll(() => here(page), {message: `closed by ${name}`}).toBe(`/people/${known.person}`)
        // Closing steps back; it never pushes another entry.
        expect(await length()).toBeLessThanOrEqual(before + 1)
        await expect(page.getByTestId('screen-person')).toBeVisible()
      }
    })

    test('a picker inside a sheet: picking closes it, one level back, no stray entry', async ({page}) => {
      const known = await openApp(page)
      await page.goto(`/people/${known.person}`)
      const length = () => page.evaluate(() => history.length)
      const base = await length()
      await page.getByTestId('person-record-payment').click()
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
      await page.getByTestId('payment-other-currency').click()
      await expect.poll(() => here(page)).toBe(`/people/${known.person}/record-payment/currency`)
      expect(await length()).toBe(base + 2)
      await page.getByTestId('currency-EUR').click()
      await expect(page.getByTestId('currency-dialog')).toBeHidden()
      await expect.poll(() => here(page)).toBe(`/people/${known.person}/record-payment`)
      await expect(page.getByTestId('record-payment-sheet')).toBeVisible()
      expect(await length()).toBeLessThanOrEqual(base + 2)
    })

    test('?action is gone: an old settle link opens the page and nothing else', async ({page}) => {
      const known = await openApp(page)
      await page.goto(`/people/${known.person}?action=settle`)
      await expect(page.getByTestId('screen-person')).toBeVisible()
      await page.waitForTimeout(500)
      await expect(page.getByTestId('record-payment-sheet')).toHaveCount(0)
      expect(here(page)).toBe(`/people/${known.person}`)
    })

    test('an offset far past the calendar loads Analytics instead of crashing', async ({page}) => {
      await openApp(page)
      for (const offset of ['10000000', '-99999', '1e9', '9999']) {
        await page.goto(`/analytics?period=year&offset=${offset}`)
        await expect(page.getByTestId('screen-analytics')).toBeVisible()
      }
      await page.goto('/analytics?period=month&offset=-3&currency=INR')
      await expect(page.getByTestId('screen-analytics')).toBeVisible()
    })

    test('a sheet whose target is not on this device is dropped, leaving the page', async ({page}) => {
      await openApp(page)
      const gone = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'
      await page.goto(`/people/${gone}/record-payment`)
      await expect(page.getByTestId('person-not-found')).toBeVisible()
      await expect.poll(() => here(page)).toBe(`/people/${gone}`)
      await expect(page.getByTestId('record-payment-sheet')).toHaveCount(0)
    })

    test('a prefilled composer drops its prefill from the address on the first edit, so a refresh restores the draft', async ({page}) => {
      await openApp(page)
      await page.goto('/expense/new?title=Taxi+home&amount=250&currency=INR')
      await expect(page.getByTestId('expense-title')).toHaveValue('Taxi home')
      // Mounting writes nothing to the address.
      expect(here(page)).toBe('/expense/new?amount=250&currency=INR&title=Taxi+home')
      await page.getByTestId('expense-title').fill('Taxi home late')
      await expect.poll(() => here(page)).toBe('/expense/new')
      await page.waitForTimeout(600)
      await page.reload()
      await expect(page.getByTestId('expense-title')).toHaveValue('Taxi home late')
    })

    test('a pasted real-data address in demo mode asks to switch back first', async ({page}) => {
      await openDemo(page)
      await page.goto('/groups/3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77/balances')
      await expect(page.getByRole('button', {name: 'Stay in demo'})).toBeVisible()
      await page.getByRole('button', {name: 'Stay in demo'}).click()
      await expect.poll(() => here(page)).toBe('/')
      await expect(page.getByTestId('screen-people')).toBeVisible()
    })

    test('demo mode: a link to real data asks to switch back first; Stay keeps the demo, Switch back opens it', async ({page}) => {
      await openDemo(page)
      await page.waitForFunction(() => !!(window as unknown as {__splitoTest?: {openLink?: unknown}}).__splitoTest?.openLink)
      await openLink(page, 'https://splito.app/groups/3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77/balances')
      await expect(page.getByRole('button', {name: 'Stay in demo'})).toBeVisible()
      await page.getByRole('button', {name: 'Stay in demo'}).click()
      await expect(page.getByRole('button', {name: 'Stay in demo'})).toBeHidden()
      expect(here(page)).toBe('/')
      await openLink(page, 'https://splito.app/groups/3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77/balances')
      await page.getByRole('button', {name: 'Switch back'}).click()
      await expect.poll(() => here(page)).toBe('/groups/3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a77/balances')
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

/*
 * Every route of the table (F-241 acceptance 6), pasted cold: the page shows with its sheet or picker on top and the
 * address stays as typed (a sheet the page cannot open would be dropped and the address would lose it). Phone width
 * for all of them, desktop for a sample.
 */
const PAGE_PATHS: Record<string, (ids: Ids, section?: string) => string> = {
  People: () => '/',
  Groups: () => '/groups',
  Analytics: () => '/analytics',
  Person: ({person}) => `/people/${person}`,
  Group: ({group}) => `/groups/${group}`,
  Profile: () => '/profile',
  Settings: () => '/settings',
  SettingsSection: (_ids, section) => `/settings/${section}`,
  CreateGroup: () => '/groups/new',
  AddExpense: () => '/expense/new',
  EditExpense: ({expense}) => `/expense/${expense}/edit`,
}
/** Item-level sheets that only exist while a form is itemised; a link to them without that draft is dropped. */
const NEEDS_ITEMS = ['charge', 'tax-class']

const TABLE_ROUTES = Object.entries(SHEETS).flatMap(([page, chains]) =>
  (chains as readonly string[])
    .filter(chain => !NEEDS_ITEMS.includes(chain))
    .map(chain => {
      const section = page === 'SettingsSection' ? Object.entries(SETTINGS_SECTION_SHEETS).find(([, list]) => list.includes(chain))?.[0] : undefined
      return {page, chain, section}
    }),
)

for (const [label, viewport, only] of [
  ['phone 390', {width: 390, height: 844}, undefined],
  ['desktop 1440', {width: 1440, height: 900}, ['record-payment/currency', 'rules', 'export/period', 'timezone', 'currency']],
] as const) {
  test.describe(`every table route, cold, ${label}`, () => {
    test.use({viewport})
    for (const {page: name, chain, section} of TABLE_ROUTES) {
      if (only && !(only as readonly string[]).includes(chain)) continue
      test(`${name} /${chain}`, async ({page}) => {
        const known = await openApp(page)
        const path = `${PAGE_PATHS[name]!(known, section).replace(/\/$/, '')}/${chain}`
        await page.goto(path)
        const dialogs = page.getByRole('dialog')
        await expect(dialogs.last()).toBeVisible()
        expect(here(page)).toBe(path)
        if (chain.includes('/')) expect(await dialogs.count()).toBeGreaterThanOrEqual(2)
      })
    }
  })
}
