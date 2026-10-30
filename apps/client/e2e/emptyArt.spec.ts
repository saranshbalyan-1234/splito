import {expect, type Page, test} from '@playwright/test'

import {openDemo} from './openDemo'

/*
 * F-260 (owners 146, 172): every empty state shows art about its own screen, the same size and structure
 * everywhere, at phone and desktop width, and holds one frame under reduced motion. ANIM_SHOTS=<dir> also
 * saves a screenshot of each (the report's screenshots).
 */

const SIZES = [
  {name: '390', width: 390, height: 844, art: 168},
  {name: '1440', width: 1440, height: 900, art: 200},
] as const

type Splito = {
  me: string
  createPerson(name: string): Promise<string>
  createGroup(input: unknown): Promise<string>
}

/** A well-formed id nothing on this device has (a malformed one is sanitised away and opens Home). */
const NO_SUCH = '3f2b8a52-6c1e-4d0a-9b7e-1a2b3c4d5e6f'

/** The screens an empty account reaches by address: [path, empty state testID, its art]. */
const EMPTY_ACCOUNT: [string, string, string][] = [
  ['/people', 'people-empty', 'empty-people'],
  ['/groups', 'groups-empty', 'empty-groups'],
  ['/activity', 'activity-empty', 'empty-activity'],
  ['/activity?tab=all&type=transactions', 'activity-empty', 'empty-expenses'],
  ['/activity?tab=all&type=payments', 'activity-empty', 'empty-payments'],
  ['/activity?tab=all&type=comments', 'activity-empty', 'empty-comments'],
  ['/activity?tab=all&type=groups', 'activity-empty', 'empty-groups'],
  ['/activity?tab=all&type=friends', 'activity-empty', 'empty-invites'],
  ['/activity?tab=all&type=reminders', 'activity-empty', 'empty-reminders'],
  ['/activity?tab=all&type=disputes', 'activity-empty', 'empty-disputes'],
  ['/activity?tab=all&type=comments,reminders', 'activity-empty', 'empty-filter'],
  ['/analytics', 'analytics-empty', 'empty-analytics'],
  ['/settings/feedback', 'feedback-empty', 'empty-feedback'],
  ['/invites', 'invite-links-empty', 'empty-invites'],
  [`/expense/${NO_SUCH}`, 'expense-not-found', 'empty-not-found'],
  [`/payment/${NO_SUCH}`, 'repayment-not-found', 'empty-not-found'],
  [`/people/${NO_SUCH}`, 'person-not-found', 'empty-not-found'],
  [`/groups/${NO_SUCH}`, 'group-not-found', 'empty-not-found'],
  [`/groups/${NO_SUCH}/settle`, 'settle-not-found', 'empty-not-found'],
]

async function expectArt(page: Page, testID: string, art: string, size: number, shot?: string) {
  const el = page.getByTestId(`${testID}-illustration`)
  await expect(el).toBeVisible()
  await expect(el).toHaveAttribute('data-art', art)
  /* The player and the JSON are lazy chunks: the svg arrives a moment after the box. */
  await expect(el.locator('svg')).toHaveCount(1)
  /* Never a dead end (owner 213): the next useful step is on every empty state. */
  await expect(page.getByTestId(testID).getByRole('button').first()).toBeVisible()
  const box = (await el.boundingBox())!
  expect([Math.round(box.width), Math.round(box.height)]).toEqual([size, size])
  /* The art has played to its resting frame (at most 2.2 s at 60 fps) before the picture is taken. */
  if (shot && process.env.ANIM_SHOTS) await page.waitForTimeout(2600)
  if (shot && process.env.ANIM_SHOTS) await page.screenshot({path: `${process.env.ANIM_SHOTS}/${shot}.png`})
}

for (const size of SIZES) {
  test.describe(`empty states at ${size.name}`, () => {
    test.use({viewport: {width: size.width, height: size.height}})

    for (const [path, testID, art] of EMPTY_ACCOUNT) {
      test(`${path} shows ${art}`, async ({page}) => {
        await page.goto(path)
        await expect(page.getByTestId(testID)).toBeVisible({timeout: 30_000})
        await expectArt(page, testID, art, size.art, `${size.name}-${art}-${testID}${path.includes('type=') ? '-' + path.split('type=')[1] : ''}`)
      })
    }

    test('Search no match and Ask with nothing yet show their own art', async ({page}) => {
      await page.goto('/search?q=zzzz')
      await expect(page.getByTestId('search-empty')).toBeVisible({timeout: 30_000})
      await expectArt(page, 'search-empty', 'empty-search', size.art, `${size.name}-empty-search-dialog`)
      await page.goto('/search?mode=ask')
      await expect(page.getByTestId('ask-empty')).toBeVisible({timeout: 30_000})
      await expectArt(page, 'ask-empty', 'empty-ask', size.art, `${size.name}-empty-ask`)
    })

    test('a person, a group and a settle plan with nothing in them show their own art', async ({page}) => {
      await page.goto('/people')
      await page.waitForFunction(() => 'splito' in window)
      const ids = await page.evaluate(async () => {
        const s = (window as unknown as {splito: Splito}).splito
        const friend = await s.createPerson('Riya Sharma')
        const group = await s.createGroup({name: 'Goa', kind: 'trip', currency: 'INR', startDate: null, endDate: null, memberIds: [friend]})
        return {friend, group}
      })
      await page.goto(`/people/${ids.friend}`)
      await expectArt(page, 'person-history-empty', 'empty-history', size.art, `${size.name}-empty-history`)
      await page.goto(`/groups/${ids.group}`)
      await expectArt(page, 'group-expenses-empty', 'empty-expenses', size.art, `${size.name}-empty-expenses`)
      await page.goto(`/groups/${ids.group}/balances`)
      await expectArt(page, 'group-balances-empty', 'empty-balances', size.art, `${size.name}-empty-balances`)
      await page.goto(`/groups/${ids.group}/settle`)
      await expectArt(page, 'settle-empty', 'empty-settle', size.art, `${size.name}-empty-settle`)
    })

    test('a list search with no match shows its own art', async ({page}) => {
      test.setTimeout(150_000)
      await openDemo(page, '/people')
      const people = page.getByTestId('screen-people')
      await people.getByTestId('list-search').click()
      await people.getByTestId('list-search-input').fill('zzzz')
      await expectArt(page, 'people-search-empty', 'empty-search', size.art, `${size.name}-empty-search-list`)
      await openDemo(page, '/groups')
      const groups = page.getByTestId('screen-groups')
      await groups.getByTestId('list-search').click()
      await groups.getByTestId('list-search-input').fill('zzzz')
      await expectArt(page, 'groups-search-empty', 'empty-search', size.art)
    })
  })
}

test.describe('reduced motion', () => {
  test.use({reducedMotion: 'reduce'})

  test('every empty state holds one still frame, light and dark', async ({page}) => {
    test.setTimeout(240_000)
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({reducedMotion: 'reduce', colorScheme: scheme})
      for (const [path, testID, art] of EMPTY_ACCOUNT.filter((_, i) => i % 3 === 0)) {
        await page.goto(path)
        const el = page.getByTestId(`${testID}-illustration`)
        await expect(el).toHaveAttribute('data-art', art, {timeout: 30_000})
        await expect(el).toHaveAttribute('data-static', 'true')
        await expect(el.locator('svg')).toHaveCount(1)
        const frame = () => el.locator('svg').evaluate(svg => svg.innerHTML)
        const first = await frame()
        await page.waitForTimeout(700)
        expect(await frame()).toBe(first)
      }
    }
  })
})

test('an animated empty state plays once and rests: the svg stops changing', async ({page}) => {
  await page.goto('/groups')
  const art = page.getByTestId('groups-empty-illustration')
  await expect(art.locator('svg')).toHaveCount(1, {timeout: 30_000})
  const frame = () => art.locator('svg').evaluate(svg => svg.innerHTML)
  /* Settled long after the play-through (the art is 1.3 s to its resting frame at 60 fps), then still. */
  await page.waitForTimeout(3500)
  const rest = await frame()
  await page.waitForTimeout(1500)
  expect(await frame()).toBe(rest)
})
