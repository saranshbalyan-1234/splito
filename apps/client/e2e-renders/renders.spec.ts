import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'

import {expect, type Page, test} from '@playwright/test'

import {openDemo} from '../e2e/openDemo'

/*
 * The wasted-render gate (ARCHITECTURE 17, owner 108, decision 107). One
 * scenario on the DEV web build (why-did-you-render loaded, `pnpm renders`):
 * launch -> Home, a tab round, open Add expense, type 10 characters, close it,
 * scroll 1,000 activity rows of the large demo, open Search & Ask and ask one
 * question. Per phase it counts every component render (DevTools-hook style,
 * as perf/save.spec.ts) and collects every why-did-you-render report.
 *
 * It fails on a report that `baseline.json` does not hold (or one that fires
 * more often), and on a component's render count above the baseline. Lower
 * numbers pass and are kept with RENDERS_BASELINE=write, which rewrites the
 * baseline from this run (do that only to record an improvement, or a reviewed
 * and documented increase).
 */

type Counts = Record<string, number>
type Report = {
  name: string
  owner: string
  kind: string
  keys: string[]
  detail?: string
  chain?: string
}
type Win = {
  __renders: {phase: string; last: number; counts: Record<string, Counts>}
  __wdyr: Report[]
}
type Baseline = {
  /** Phase -> renders of components being shown (`mounts`) and of mounted ones (`updates`), and per "mount:Name" / "update:Name" (3 or more only). */
  phases: Record<string, {mounts: number; updates: number; components: Counts}>
  /** "Component < Owner [kind: keys]" -> times reported in the whole scenario. */
  reports: Counts
}

const BASELINE = join(__dirname, 'baseline.json')
/* Counts move a little with timing (a store read landing one frame later); a regression is more than this. */
const SLACK = 0.1
const MIN_COMPONENT = 3

function instrument() {
  const state = {
    phase: 'launch',
    last: 0,
    counts: {} as Record<string, Record<string, number>>,
  }
  ;(window as unknown as Win).__renders = state
  type FiberType = {
    displayName?: string
    name?: string
    type?: FiberType
    render?: FiberType
  }
  type Fiber = {
    tag: number
    flags: number
    type: FiberType | null
    child: Fiber | null
    sibling: Fiber | null
    alternate: Fiber | null
  }
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15])
  const nameOf = (f: Fiber) => {
    const t = f.type
    const fn = f.tag === 14 ? t?.type : f.tag === 11 ? t?.render : t
    return t?.displayName || fn?.displayName || fn?.name || 'Anonymous'
  }
  const walk = (first: Fiber | null) => {
    for (let fiber = first; fiber; fiber = fiber.sibling) {
      // PerformedWork (1): this fiber rendered in this commit; a new mount always did.
      if (
        COMPONENT_TAGS.has(fiber.tag) &&
        (!fiber.alternate || (fiber.flags & 1) === 1)
      ) {
        // Mounts and re-renders are kept apart: a mount is the cost of showing a row, a re-render of a mounted one is where waste hides.
        const c = (state.counts[state.phase] ??= {})
        const n = (fiber.alternate ? 'update:' : 'mount:') + nameOf(fiber)
        c[n] = (c[n] ?? 0) + 1
      }
      // Children shared with the previous tree were skipped entirely.
      if (!fiber.alternate || fiber.child !== fiber.alternate.child)
        walk(fiber.child)
    }
  }
  ;(
    window as unknown as {__REACT_DEVTOOLS_GLOBAL_HOOK__: unknown}
  ).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject: () => 1,
    checkDCE: () => {},
    onScheduleFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
    onCommitFiberRoot: (_id: number, root: {current: Fiber}) => {
      state.last = performance.now()
      walk(root.current.child)
    },
  }
}

/** Starts counting into `name`, after the previous step has gone quiet (no commit for 500 ms). */
async function phase(page: Page, name: string) {
  await quiet(page)
  await page.evaluate(
    n => ((window as unknown as Win).__renders.phase = n),
    name,
  )
}

async function quiet(page: Page) {
  await page.waitForFunction(
    () => performance.now() - (window as unknown as Win).__renders.last > 500,
    undefined,
    {timeout: 60_000, polling: 100},
  )
}

/*
 * Reports that start in code we do not own and cannot change: react-native-web builds a fresh style / children
 * for the View, LocaleProvider or Text it renders (so a real Pressable or Text render reports its inner View),
 * lucide icons pass new props to react-native-svg, VirtualizedList re-creates its cell context, radix and
 * react-navigation keep state objects. They are still counted in the render totals, never in the reports.
 * Anything else, including a View built by one of our components, fails the gate.
 */
const LIBRARY_OWNERS = new Set([
  'Pressable',
  'ScrollView',
  'TextInput',
  'CellRenderer',
  'VirtualizedList',
  'FlatList',
])
const LIBRARY_NAMES = new Set([
  'LocaleProvider',
  'Svg',
  'Path',
  'Circle',
  'ScrollView',
  'FlatList',
  'VirtualizedList',
  'VirtualizedListCellContextProvider',
  'VirtualizedListContextProvider',
  'CellRenderer',
  'DismissableLayer',
  'FocusScope',
  'PreventRemoveProvider',
])
/*
 * lucide's icons render an anonymous inner component ("Unknown") from a forwardRef named for the icon. Those
 * names come from the package's own type declarations, so an anonymous component of ours is never excused.
 */
const LUCIDE_ICONS = new Set(
  [
    ...readFileSync(
      join(
        dirname(require.resolve('lucide-react-native')),
        '..',
        'types',
        'lucide-react-native.d.ts',
      ),
      'utf8',
    ).matchAll(/declare const (\w+): LucideIcon/g),
  ].map(m => m[1]),
)

/** react-native-web's LocaleContext value: View and Text read it with useContext. */
const isLocaleContext = (r: Report) =>
  r.kind === 'hook' && !!r.detail?.startsWith('{"direction"')

function isLibrary(r: Report) {
  if (LIBRARY_NAMES.has(r.name) || isLocaleContext(r)) return true
  if (r.name === 'Unknown' && LUCIDE_ICONS.has(r.owner)) return true
  // An anonymous owner counts only when the component right above it is a library one (react-native-web's ScrollView renders one).
  if (r.owner === 'Unknown' && LIBRARY_OWNERS.has(r.chain?.split('<')[1] ?? ''))
    return true
  return r.kind === 'props' && LIBRARY_OWNERS.has(r.owner)
}

function reportKey(r: Report) {
  return `${r.name} < ${r.owner || '?'} [${r.kind}: ${r.keys.slice(0, 4).join(', ')}]`
}

test('no wasted renders, no render above the baseline', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await page.addInitScript(instrument)

  // Switch the large demo on (a year of use: ~50 activity pages), then count a cold launch into it: the mode survives a reload.
  await openDemo(page)
  await page.reload()
  await expect(page.getByTestId('screen-people')).toBeVisible({timeout: 60_000})

  await phase(page, 'tabs')
  for (const tab of ['groups', 'activity', 'analytics', 'people']) {
    await page.getByTestId(`tab-${tab}`).click()
    await quiet(page)
  }

  await phase(page, 'addExpense')
  await page.getByTestId('sidebar-add').click()
  await expect(page.getByTestId('expense-title')).toBeVisible()
  await phase(page, 'type')
  await page
    .getByTestId('expense-title')
    .pressSequentially('abcdefghij', {delay: 60})
  await phase(page, 'closeAdd')
  await page.getByTestId('sheet-close').click()
  await page.getByTestId('draft-discard').click()
  await expect(page.getByTestId('expense-title')).toBeHidden()

  await phase(page, 'scroll')
  await page.getByTestId('tab-activity').click()
  await expect(page.getByTestId('screen-activity')).toBeVisible()
  await page.mouse.move(720, 500)
  const rows = page.locator(
    '[data-testid^="activity-"]:not([data-testid^="activity-menu"]):not([data-testid^="activity-action"])',
  )
  let seen = 0
  for (let i = 0; i < 80 && seen < 1000; i++) {
    await page.mouse.wheel(0, 1500)
    await page.waitForTimeout(120)
    seen = Math.max(seen, await rows.count())
  }
  console.log(`SCROLLED rows mounted: ${seen}`)
  // Positive control: a scroll that never reached 1,000 rows measured nothing.
  expect(seen, 'rows mounted by the scroll').toBeGreaterThanOrEqual(1000)

  await phase(page, 'ask')
  await page
    .getByTestId('screen-activity')
    .getByTestId('header-search-ask')
    .click()
  await page.getByTestId('search-input').fill('Who owes me the most?')
  await page.getByTestId('search-input').press('Enter')
  await expect(page.getByTestId('ask-ranking-owed-INR')).toBeVisible()
  await quiet(page)

  const {counts, wdyr} = await page.evaluate(() => ({
    counts: (window as unknown as Win).__renders.counts,
    wdyr: (window as unknown as Win).__wdyr ?? [],
  }))
  const phases: Baseline['phases'] = {}
  for (const [name, c] of Object.entries(counts)) {
    const sum = (prefix: string) =>
      Object.entries(c).reduce(
        (a, [k, n]) => a + (k.startsWith(prefix) ? n : 0),
        0,
      )
    phases[name] = {
      mounts: sum('mount:'),
      updates: sum('update:'),
      components: Object.fromEntries(
        Object.entries(c)
          .filter(([, n]) => n >= MIN_COMPONENT)
          .sort((a, b) => b[1] - a[1]),
      ),
    }
  }
  const reports: Counts = {}
  const own = wdyr.filter(r => !isLibrary(r))
  for (const r of own) reports[reportKey(r)] = (reports[reportKey(r)] ?? 0) + 1
  const now: Baseline = {
    phases,
    reports: Object.fromEntries(
      Object.entries(reports).sort((a, b) => b[1] - a[1]),
    ),
  }
  writeFileSync(
    test.info().outputPath('renders-last.json'),
    JSON.stringify(now, null, 1),
  )
  writeFileSync(
    test.info().outputPath('renders-reports.json'),
    JSON.stringify(wdyr),
  )
  console.log(
    `RENDERS ${Object.entries(phases)
      .map(([k, v]) => `${k}=${v.mounts}+${v.updates}`)
      .join(' ')} reports=${own.length} (library ${wdyr.length - own.length})`,
  )

  // Positive controls: with the library not loaded (or the dev JSX runtime off) there are no reports, and a gate
  // that sees nothing passes vacuously. The app always has some, from the libraries counted above.
  expect(wdyr.length, 'why-did-you-render reports collected').toBeGreaterThan(0)

  const isWrite = process.env.RENDERS_BASELINE === 'write'
  const problems: string[] = []
  if (!isWrite)
    expect(
      existsSync(BASELINE),
      'e2e-renders/baseline.json missing: RENDERS_BASELINE=write records it',
    ).toBe(true)
  if (existsSync(BASELINE)) {
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline
    for (const [key, n] of Object.entries(now.reports)) {
      const allowed = base.reports[key] ?? 0
      // A key the baseline lacks is a new wasted render: no slack. A known one may fire once more on a slow run.
      if (n > (allowed === 0 ? 0 : Math.ceil(allowed * (1 + SLACK)) + 1))
        problems.push(`wasted render: ${key} x${n} (baseline ${allowed})`)
    }
    for (const [name, b] of Object.entries(base.phases)) {
      const p = now.phases[name]
      // A phase that counted under half of its baseline did not run the same scenario.
      if (!p || p.mounts + p.updates < (b.mounts + b.updates) / 2)
        problems.push(
          `${name}: ${p ? p.mounts + p.updates : 'missing'} renders, baseline ${b.mounts + b.updates}: under half, the scenario did not run`,
        )
    }
    for (const [name, p] of Object.entries(now.phases)) {
      const b = base.phases[name]
      if (!b) problems.push(`phase ${name} has no baseline`)
      else {
        for (const kind of ['mounts', 'updates'] as const)
          if (p[kind] > Math.ceil(b[kind] * (1 + SLACK)) + 1)
            problems.push(`${name}: ${p[kind]} ${kind}, baseline ${b[kind]}`)
        for (const [c, n] of Object.entries(p.components)) {
          const allowed = b.components[c] ?? MIN_COMPONENT - 1
          if (n > Math.ceil(allowed * (1 + SLACK)) + 1)
            problems.push(`${name}: ${c} rendered ${n}x, baseline ${allowed}`)
        }
      }
    }
  }
  // Written only after the comparison, which is printed either way: a record of a regression is a decision.
  if (problems.length) console.log(`PROBLEMS\n${problems.join('\n')}`)
  if (isWrite) {
    writeFileSync(BASELINE, JSON.stringify(now, null, 1) + '\n')
    return
  }
  expect(problems, problems.join('\n')).toEqual([])
})
