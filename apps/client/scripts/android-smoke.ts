/*
 * Android smoke flow on an emulator: add an expense, then settle up.
 *
 *   node scripts/android-smoke.ts [outDir]
 *
 * Needs the debug app installed (`npx expo run:android`) and Metro serving a
 * dev bundle without the tour (no EXPO_PUBLIC_TOUR) on METRO_PORT (default
 * 8081). The script switches Demo mode on from Settings > Data, as a person
 * would. ANDROID_SERIAL picks the device. See docs/ANDROID.md.
 *
 * Bluesky drives native flows with Maestro (__e2e__/flows/*.yml); this runs the
 * same steps over adb + uiautomator, which ship with the Android SDK, so no
 * extra tool is needed. React Native exposes testID as the node's resource-id.
 */
import {execFileSync} from 'node:child_process'
import {mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

const ADB = join(
  process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`,
  'platform-tools/adb',
)
const APP = 'app.splito'
const PORT = process.env.METRO_PORT ?? '8081'
const OUT = process.argv[2] ?? 'android-smoke'
mkdirSync(OUT, {recursive: true})

type Node = {
  id: string
  text: string
  desc: string
  x: number
  y: number
  box: number[]
  inner: string
}

/* stderr is piped: uiautomator logs 'null root node' while the app is still launching. */
const adb = (...args: string[]) =>
  execFileSync(ADB, args, {
    encoding: 'utf8',
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))
const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

let lastXml = ''
function dump(): Node[] {
  adb('shell', 'uiautomator', 'dump', '/sdcard/splito-ui.xml')
  lastXml = adb('exec-out', 'cat', '/sdcard/splito-ui.xml')
  const nodes = [...lastXml.matchAll(/<node [^>]*>/g)].map(([tag]) => {
    const attr = (k: string) =>
      decode(tag.match(new RegExp(` ${k}="([^"]*)"`))?.[1] ?? '')
    const box = attr('bounds').match(/\d+/g)!.map(Number)
    return {
      id: attr('resource-id'),
      text: attr('text'),
      desc: attr('content-desc'),
      x: (box[0] + box[2]) >> 1,
      y: (box[1] + box[3]) >> 1,
      box,
      inner: '',
    }
  })
  /* A row's text lives in child TextViews: gather every text drawn inside its bounds. */
  for (const n of nodes) {
    const [l, t, r, b] = n.box
    n.inner = nodes
      .filter(
        c =>
          c.text &&
          c.box[0] >= l &&
          c.box[1] >= t &&
          c.box[2] <= r &&
          c.box[3] <= b,
      )
      .map(c => c.text)
      .join(' ')
  }
  return nodes
}

let shot = 0
function screenshot(name: string) {
  writeFileSync(
    join(OUT, `${String(++shot).padStart(2, '0')}-${name}.png`),
    execFileSync(ADB, ['exec-out', 'screencap', '-p'], {maxBuffer: 64 << 20}),
  )
}

/** The last matching node wins: a sheet opened on top of another is later in the tree. */
async function waitFor(
  match: (n: Node) => boolean,
  what: string,
  timeout = 20_000,
) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const found = dump().filter(match).pop()
    if (found) return found
    await pause(500)
  }
  screenshot('FAILED')
  writeFileSync(join(OUT, 'FAILED.xml'), lastXml)
  throw new Error(`Timed out waiting for ${what}`)
}
const byId = (id: string) => waitFor(n => n.id === id, `#${id}`)
const withText = (id: string, text: string) =>
  waitFor(
    n => n.id === id && n.inner.includes(text),
    `#${id} containing "${text}"`,
  )

async function tap(id: string) {
  const n = await byId(id)
  adb('shell', 'input', 'tap', String(n.x), String(n.y))
  await pause(400)
}
async function type(id: string, text: string) {
  await tap(id)
  adb('shell', 'input', 'text', text.replace(/ /g, '%s'))
  await pause(300)
}

async function main() {
  console.log('launch: fresh state, demo data')
  adb('shell', 'pm', 'clear', APP)
  adb('reverse', `tcp:${PORT}`, `tcp:${PORT}`)
  /* The URL `expo run:android` opens; the flags keep the dev menu from covering the app on first launch. */
  const url = `exp+splito://?__expo_url=${encodeURIComponent(`http://localhost:${PORT}`)}&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1`
  adb(
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `'${url}'`,
  )
  await byId('screen-people')
  /* Demo mode is a switch (ARCHITECTURE 26.1): Settings > Data > Demo mode seeds the separate demo database. */
  await tap('header-avatar')
  await tap('settings-demo-mode')
  await tap('tab-people')
  await waitFor(
    n => n.id === 'person-Riya Sharma',
    'the seeded People list',
    180_000,
  )
  /* Riya owes me ₹5,578.00 in the demo data. */
  await withText('person-Riya Sharma', '5,578.00')
  screenshot('people')

  console.log('add expense: ₹1,500 split equally with Riya')
  await tap('fab-add')
  await type('expense-title', 'Smoke test dinner')
  await type('amount-input', '1500')
  await tap('expense-people')
  await tap('person-option-Riya Sharma')
  screenshot('people-picker')
  await tap('sheet-close')
  await withText('split-readout', '750.00 each')
  screenshot('add-expense')
  await tap('sheet-save')
  /* The saved check shows for well under a uiautomator dump, so the balance is the proof. Her half moves her balance from ₹5,578.00 to ₹6,328.00. */
  await withText('person-Riya Sharma', '6,328.00')
  screenshot('people-after-expense')

  console.log('settle up: record Riya paying the whole balance')
  await tap('person-Riya Sharma')
  await byId('screen-person')
  await tap('person-record-payment')
  await withText('payment-sentence', 'Riya Sharma paid you')
  screenshot('record-payment')
  await tap('sheet-save')
  await byId('person-settled')
  screenshot('settled')
  console.log(`PASS - screenshots in ${OUT}`)
}

main().catch(e => {
  console.error(`FAIL - ${e.message} (see ${OUT})`)
  process.exit(1)
})
