/*
 * Renders every Splito brand raster (app icons, splash, favicons, PWA icons)
 * from the approved mark, assets/brand/mark.svg, with Playwright's Chrome.
 * The mark is never redrawn here: variants only recolour its four wing paths.
 *
 *   node scripts/brand.ts [previewDir]
 *
 * Writes assets/brand/*.png, public/*.png, public/icons/*.png and
 * public/manifest.json. With previewDir, also writes brand-preview.png there.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium, type Page} from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRAND = join(ROOT, 'assets/brand')
const PUBLIC = join(ROOT, 'public')
const MARK = readFileSync(join(BRAND, 'mark.svg'), 'utf8')

/** Splash and PWA backgrounds; dark is Splito's blackish dark theme. */
const LIGHT_BG = '#FFFFFF'
const DARK_BG = '#000000'
/** Bluesky palette primary_500 - status bar / notification accent. */
const ACCENT = '#006AFF'

const WINGS = [
  ...MARK.matchAll(/<path d="([^"]+)" fill="url\(#(l|r)\)"\/>/g),
].map(m => ({d: m[1]!, side: m[2] as 'l' | 'r'}))
if (WINGS.length !== 4)
  throw new Error(`mark.svg: expected 4 wing paths, found ${WINGS.length}`)

type Paint = {defs: string; l: string; r: string; rOpacity?: number}

function gradient(id: string, top: string, bottom: string) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`
}

/** The mark exactly as approved (gradient stops read from mark.svg). */
const COLOR: Paint = {
  defs: MARK.match(/<defs>([\s\S]*)<\/defs>/)![1]!,
  l: 'url(#l)',
  r: 'url(#r)',
}
/* One Bluesky palette step lighter per stop (400/700 -> 300/500, 200/400 -> 100/300) so the dark wings keep contrast on black. */
const ON_DARK: Paint = {
  defs:
    gradient('l', '#75AFFF', '#006AFF') + gradient('r', '#CCE1FF', '#75AFFF'),
  l: 'url(#l)',
  r: 'url(#r)',
}
/** One-colour mark; the split side stays readable through opacity (alpha-only targets: monochrome, notification, tinted). */
function mono(color: string, rOpacity = 0.6): Paint {
  return {defs: '', l: color, r: color, rOpacity}
}

type Background =
  | {kind: 'none'}
  | {kind: 'solid'; color: string}
  | {kind: 'gradient'; top: string; bottom: string}
const NONE: Background = {kind: 'none'}
/** Icon tile: white with a faint cool fade so it does not read as a blank square on white home screens. */
const TILE: Background = {kind: 'gradient', top: '#FFFFFF', bottom: '#E5F0FF'}
/** Alternative tile shown in the preview only (Bluesky-style blue gradient with a white mark). */
const BLUE_TILE: Background = {
  kind: 'gradient',
  top: '#4291FF',
  bottom: '#0048AD',
}

type Asset = {
  out: string
  size: number
  paint: Paint
  /** Mark width as a fraction of the canvas, measured on the mark's real bounding box. */
  scale: number
  bg?: Background
  /** Corner radius as a fraction of size (transparent corners). */
  radius?: number
}

/*
 * Scales follow each platform's safe zone for a mark about 1.28x as long
 * diagonally as it is wide:
 * - Android adaptive: 66 dp safe circle of 108 dp -> width <= 0.47
 * - PWA maskable: 80% safe circle -> width <= 0.62
 * - Android 12 splash: icon circle is 2/3 of the drawable -> width <= 0.52
 */
const ASSETS: Asset[] = [
  {
    out: 'assets/brand/icon.png',
    size: 1024,
    paint: COLOR,
    scale: 0.7,
    bg: TILE,
  },
  {out: 'assets/brand/icon-dark.png', size: 1024, paint: ON_DARK, scale: 0.7},
  {
    out: 'assets/brand/icon-tinted.png',
    size: 1024,
    paint: mono('#FFFFFF'),
    scale: 0.7,
  },
  {
    out: 'assets/brand/adaptive-foreground.png',
    size: 1024,
    paint: COLOR,
    scale: 0.46,
  },
  {
    out: 'assets/brand/adaptive-background.png',
    size: 1024,
    paint: COLOR,
    scale: 0,
    bg: TILE,
  },
  {
    out: 'assets/brand/adaptive-monochrome.png',
    size: 1024,
    paint: mono('#FFFFFF'),
    scale: 0.46,
  },
  {
    out: 'assets/brand/notification-icon.png',
    size: 96,
    paint: mono('#FFFFFF'),
    scale: 0.92,
  },
  {out: 'assets/brand/splash-mark.png', size: 600, paint: COLOR, scale: 0.5},
  {
    out: 'assets/brand/splash-mark-dark.png',
    size: 600,
    paint: ON_DARK,
    scale: 0.5,
  },
  {out: 'assets/brand/favicon.png', size: 64, paint: COLOR, scale: 1},
  {out: 'public/favicon-16.png', size: 16, paint: COLOR, scale: 1},
  {out: 'public/favicon-32.png', size: 32, paint: COLOR, scale: 1},
  {out: 'public/favicon-48.png', size: 48, paint: COLOR, scale: 1},
  {
    out: 'public/apple-touch-icon.png',
    size: 180,
    paint: COLOR,
    scale: 0.7,
    bg: TILE,
  },
  {
    out: 'public/icons/icon-192.png',
    size: 192,
    paint: COLOR,
    scale: 0.66,
    bg: TILE,
    radius: 0.225,
  },
  {
    out: 'public/icons/icon-512.png',
    size: 512,
    paint: COLOR,
    scale: 0.66,
    bg: TILE,
    radius: 0.225,
  },
  {
    out: 'public/icons/maskable-512.png',
    size: 512,
    paint: COLOR,
    scale: 0.56,
    bg: TILE,
  },
]

const MANIFEST = {
  name: 'Splito',
  short_name: 'Splito',
  description: 'Split expenses with anyone, even offline.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: LIGHT_BG,
  theme_color: LIGHT_BG,
  icons: [
    {
      src: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

type Box = {x: number; y: number; width: number; height: number}

function svg({size, paint, scale, bg = NONE, radius = 0}: Asset, box: Box) {
  const k = (scale * size) / Math.max(box.width, box.height)
  const tx = size / 2 - (box.x + box.width / 2) * k
  const ty = size / 2 - (box.y + box.height / 2) * k
  const bgDefs = bg.kind === 'gradient' ? gradient('bg', bg.top, bg.bottom) : ''
  const bgFill =
    bg.kind === 'gradient'
      ? 'url(#bg)'
      : bg.kind === 'solid'
        ? bg.color
        : 'none'
  const wings = WINGS.map(
    w =>
      `<path d="${w.d}" fill="${w.side === 'l' ? paint.l : paint.r}"${w.side === 'r' && paint.rOpacity ? ` fill-opacity="${paint.rOpacity}"` : ''}/>`,
  ).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs>${bgDefs}${paint.defs}</defs>` +
    `<rect width="${size}" height="${size}" rx="${radius * size}" fill="${bgFill}"/>` +
    (scale > 0
      ? `<g transform="translate(${tx} ${ty}) scale(${k})">${wings}</g>`
      : '') +
    `</svg>`
  )
}

async function render(
  page: Page,
  markup: string,
  width: number,
  height: number,
  isTransparent: boolean,
) {
  /* Chrome tiles screenshots of viewports smaller than its minimum window, so keep the viewport large and clip. */
  await page.setViewportSize({
    width: Math.max(width, 1024) + 256,
    height: Math.max(height, 1024) + 256,
  })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;overflow:hidden;background:transparent"><div style="display:flex">${markup}</div></body></html>`,
  )
  return page.screenshot({
    omitBackground: isTransparent,
    clip: {x: 0, y: 0, width, height},
  })
}

/** Tight bounding box of the four wings in mark.svg units, measured by the browser. */
async function measureMark(page: Page): Promise<Box> {
  await page.setContent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g id="m">${WINGS.map(w => `<path d="${w.d}"/>`).join('')}</g></svg>`,
  )
  return page.evaluate(() => {
    const b = (
      document.getElementById('m') as unknown as SVGGraphicsElement
    ).getBBox()
    return {x: b.x, y: b.y, width: b.width, height: b.height}
  })
}

function dataUri(png: Buffer) {
  return `data:image/png;base64,${png.toString('base64')}`
}

/** Mock-ups of every asset in context, for review. Not shipped. */
function previewHtml(png: Record<string, Buffer>, blueTile: Buffer) {
  const img = (k: string, style = '') =>
    `<img src="${dataUri(png[k]!)}" style="${style}">`
  const cell = (label: string, body: string, bg = '#f4f6f8', fg = '#222') =>
    `<figure style="margin:0;padding:16px;background:${bg};color:${fg};border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:10px;min-width:150px"><div style="display:flex;gap:12px;align-items:center;min-height:120px">${body}</div><figcaption style="font:12px system-ui">${label}</figcaption></figure>`
  const ios = 'width:112px;height:112px;border-radius:25px'
  const adaptive = (mask: string) =>
    `<div style="width:96px;height:96px;overflow:hidden;border-radius:${mask};position:relative">${img('assets/brand/adaptive-background.png', 'position:absolute;width:144px;left:-24px;top:-24px')}${img('assets/brand/adaptive-foreground.png', 'position:absolute;width:144px;left:-24px;top:-24px')}</div>`
  const mask = (k: string, size: number, color: string, extra = '') =>
    `<div style="width:${size}px;height:${size}px;background:${color};-webkit-mask:url(${dataUri(png[k]!)}) center/contain no-repeat;${extra}"></div>`
  const phone = (bg: string, k: string) =>
    `<div style="width:120px;height:240px;border-radius:20px;background:${bg};display:flex;align-items:center;justify-content:center;border:1px solid #8884">${img(k, 'width:100px')}</div>`
  const tab = (bg: string, fg: string) =>
    `<div style="display:flex;gap:8px;align-items:center;background:${bg};color:${fg};padding:8px 14px;border-radius:8px 8px 0 0;font:13px system-ui">${img('public/favicon-16.png', 'width:16px;height:16px')}Splito</div>`
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fff;font:14px system-ui;width:1180px">
<h2 style="margin:0 0 12px">Splito brand kit (rendered from assets/brand/mark.svg)</h2>
<div style="display:flex;flex-wrap:wrap;gap:12px">
${cell('iOS light (chosen: white tile)', img('assets/brand/icon.png', ios), 'linear-gradient(#c9d6ff,#e2e2e2)')}
${cell('iOS dark (transparent, system bg)', `<div style="${ios};background:linear-gradient(#3a3a3c,#1c1c1e);display:flex">${img('assets/brand/icon-dark.png', ios)}</div>`, '#0b0b0d', '#ddd')}
${cell('iOS tinted (simulated)', `<div style="${ios};background:linear-gradient(#1d2a3d,#0d1420);display:flex">${img('assets/brand/icon-tinted.png', `${ios};filter:sepia(1) hue-rotate(170deg) saturate(3)`)}</div>`, '#0b0b0d', '#ddd')}
${cell('Alternative: blue tile (not chosen)', `<img src="${dataUri(blueTile)}" style="${ios}">`, 'linear-gradient(#c9d6ff,#e2e2e2)')}
${cell('Android adaptive: circle / squircle', adaptive('50%') + adaptive('32%'), '#e8eaed')}
${cell('Android 13 themed (monochrome)', `<div style="width:96px;height:96px;border-radius:50%;background:#d3e3fd;display:flex;align-items:center;justify-content:center;overflow:hidden">${mask('assets/brand/adaptive-monochrome.png', 144, '#0b57d0', 'flex:none')}</div>`, '#e8eaed')}
${cell('Notification icon 24 / 48 dp', mask('assets/brand/notification-icon.png', 24, '#fff') + mask('assets/brand/notification-icon.png', 48, ACCENT), '#202124', '#ddd')}
${cell('Splash light / dark', phone(LIGHT_BG, 'assets/brand/splash-mark.png') + phone(DARK_BG, 'assets/brand/splash-mark-dark.png'), '#d0d4da')}
${cell('Favicon tab light / dark', `<div style="display:flex;flex-direction:column;gap:8px">${tab('#fff', '#222')}${tab('#35363a', '#eee')}</div>`, '#dee1e6')}
${cell('Favicons 16 / 32 / 48 (1x)', img('public/favicon-16.png') + img('public/favicon-32.png') + img('public/favicon-48.png'))}
${cell('Apple touch 180', img('public/apple-touch-icon.png', 'width:90px;border-radius:20px'), 'linear-gradient(#c9d6ff,#e2e2e2)')}
${cell('PWA any 192 / 512', img('public/icons/icon-192.png', 'width:96px') + img('public/icons/icon-512.png', 'width:96px'), '#2b2b2b', '#ddd')}
${cell('PWA maskable 512 (circle mask)', img('public/icons/maskable-512.png', 'width:96px;border-radius:50%') + img('public/icons/maskable-512.png', 'width:96px;border-radius:24px'), '#e8eaed')}
</div></body></html>`
}

async function main() {
  const previewDir = process.argv[2]
  const browser = await chromium.launch({channel: 'chrome'})
  const page = await browser.newPage({deviceScaleFactor: 1})
  const box = await measureMark(page)
  const png: Record<string, Buffer> = {}
  for (const asset of ASSETS) {
    const file = join(ROOT, asset.out)
    mkdirSync(dirname(file), {recursive: true})
    png[asset.out] = await render(
      page,
      svg(asset, box),
      asset.size,
      asset.size,
      !asset.bg || !!asset.radius,
    )
    writeFileSync(file, png[asset.out]!)
    console.log(`${asset.out} ${asset.size}px`)
  }
  writeFileSync(
    join(PUBLIC, 'manifest.json'),
    JSON.stringify(MANIFEST, null, 2) + '\n',
  )
  console.log('public/manifest.json')
  /* Web launch mark, shown by public/index.html until React's first commit replaces #root. */
  for (const [name, paint] of [
    ['splash-mark.svg', COLOR],
    ['splash-mark-dark.svg', ON_DARK],
  ] as const) {
    writeFileSync(
      join(PUBLIC, name),
      svg({out: name, size: 64, paint, scale: 1}, box) + '\n',
    )
    console.log(`public/${name}`)
  }

  if (previewDir) {
    const blueTile = await render(
      page,
      svg(
        {
          out: '',
          size: 512,
          paint: mono('#FFFFFF', 0.72),
          scale: 0.7,
          bg: BLUE_TILE,
        },
        box,
      ),
      512,
      512,
      false,
    )
    const preview = await browser.newPage({deviceScaleFactor: 2})
    await preview.setViewportSize({width: 1228, height: 800})
    await preview.setContent(previewHtml(png, blueTile))
    mkdirSync(previewDir, {recursive: true})
    await preview.screenshot({
      path: join(previewDir, 'brand-preview.png'),
      fullPage: true,
    })
    console.log(join(previewDir, 'brand-preview.png'))
  }
  await browser.close()
}

await main()
