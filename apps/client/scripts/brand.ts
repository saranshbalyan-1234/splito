/*
 * Renders every Splito brand raster (app icons, splash, favicons, PWA icons)
 * from the four approved mark files in assets/brand, with Playwright's
 * Chrome. The marks are placed as-is, never redrawn or recoloured here:
 *
 *   mark.svg        blue cat, white features   light backgrounds
 *   mark-white.svg  white cat, blue features   blue tiles
 *   mark-dark.svg   white cat, black features  dark backgrounds
 *   mark-black.svg  black cat, white features  monochrome / print
 *
 * One-colour targets (Android monochrome, notification, iOS tinted) use
 * mark-dark.svg as a luminance mask, so the eyes and nose stay knocked out.
 * Owner rule: blue and white, or black and white - never blue on dark.
 *
 *   node scripts/brand.ts [previewDir]
 *
 * Writes assets/brand/*.png, public/*.png, public/icons/*.png,
 * public/splash-mark*.svg and public/manifest.json. With previewDir, also
 * writes brand-preview.png there.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium, type Page} from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRAND = join(ROOT, 'assets/brand')
const PUBLIC = join(ROOT, 'public')

/** Bluesky ALF palette primary_500, the brand blue. */
const BLUE = '#006AFF'
const WHITE = '#FFFFFF'
const BLACK = '#000000'

const MARKS = {
  blue: readFileSync(join(BRAND, 'mark.svg'), 'utf8'),
  white: readFileSync(join(BRAND, 'mark-white.svg'), 'utf8'),
  dark: readFileSync(join(BRAND, 'mark-dark.svg'), 'utf8'),
  black: readFileSync(join(BRAND, 'mark-black.svg'), 'utf8'),
}
type Mark = keyof typeof MARKS | {mono: string}

type Asset = {
  out: string
  size: number
  mark: Mark | null
  /** Longest side of the mark's visible bounding box, as a fraction of the canvas. */
  scale: number
  bg?: string
  /** Corner radius as a fraction of size (transparent corners). */
  radius?: number
  /** Platform safe circle (diameter as a fraction of the canvas); the script fails if the mark leaves it. */
  safe?: number
}

/*
 * The glyph sits at 0.6 of the visible icon on every launcher so the cat
 * reads the same size on each:
 * - iOS / apple-touch / PWA "any": the whole tile is visible -> 0.6
 * - Android adaptive: 72 of 108 dp visible -> 0.6 * 2/3 = 0.4; 66 dp safe circle
 * - PWA maskable: 80% safe circle -> 0.6 * 0.8 = 0.48
 * - Android 12 splash: the icon is masked to a circle 2/3 of the drawable
 */
const ICON = 0.6
const ASSETS: Asset[] = [
  {
    out: 'assets/brand/icon.png',
    size: 1024,
    mark: 'white',
    scale: ICON,
    bg: BLUE,
  },
  {
    out: 'assets/brand/icon-dark.png',
    size: 1024,
    mark: 'dark',
    scale: ICON,
    bg: BLACK,
  },
  {
    out: 'assets/brand/icon-tinted.png',
    size: 1024,
    mark: {mono: WHITE},
    scale: ICON,
  },
  {
    out: 'assets/brand/adaptive-foreground.png',
    size: 1024,
    mark: 'white',
    scale: (ICON * 2) / 3,
    safe: 66 / 108,
  },
  {
    out: 'assets/brand/adaptive-background.png',
    size: 1024,
    mark: null,
    scale: 0,
    bg: BLUE,
  },
  {
    out: 'assets/brand/adaptive-monochrome.png',
    size: 1024,
    mark: {mono: WHITE},
    scale: (ICON * 2) / 3,
    safe: 66 / 108,
  },
  /* Status bar icon: 24 dp with a 22 dp live area; Android draws only its alpha. */
  {
    out: 'assets/brand/notification-icon.png',
    size: 96,
    mark: {mono: WHITE},
    scale: 20 / 24,
  },
  {
    out: 'assets/brand/splash-mark.png',
    size: 600,
    mark: 'blue',
    scale: 0.46,
    safe: 2 / 3,
  },
  {
    out: 'assets/brand/splash-mark-dark.png',
    size: 600,
    mark: 'dark',
    scale: 0.46,
    safe: 2 / 3,
  },
  {out: 'assets/brand/favicon.png', size: 64, mark: 'blue', scale: 1},
  {out: 'public/favicon-16.png', size: 16, mark: 'blue', scale: 1},
  {out: 'public/favicon-32.png', size: 32, mark: 'blue', scale: 1},
  {out: 'public/favicon-48.png', size: 48, mark: 'blue', scale: 1},
  /* iOS rounds the corners itself, so the tile is full-bleed. */
  {
    out: 'public/apple-touch-icon.png',
    size: 180,
    mark: 'white',
    scale: ICON,
    bg: BLUE,
  },
  {
    out: 'public/icons/icon-192.png',
    size: 192,
    mark: 'white',
    scale: ICON,
    bg: BLUE,
    radius: 0.225,
  },
  {
    out: 'public/icons/icon-512.png',
    size: 512,
    mark: 'white',
    scale: ICON,
    bg: BLUE,
    radius: 0.225,
  },
  {
    out: 'public/icons/maskable-512.png',
    size: 512,
    mark: 'white',
    scale: ICON * 0.8,
    bg: BLUE,
    safe: 0.8,
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
  background_color: WHITE,
  theme_color: WHITE,
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

/** Visible extent of the mark in its 24-unit viewBox: tight box plus the farthest point from the box centre. */
type Geometry = {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

/** The mark file positioned on a canvas: its viewBox becomes the visible box, centred at (cx, cy). */
function place(file: string, g: Geometry, k: number, cx: number, cy: number) {
  const n = (v: number) => +v.toFixed(3)
  const w = g.width * k
  const h = g.height * k
  return file
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace(
      /viewBox="[^"]*"/,
      `x="${n(cx - w / 2)}" y="${n(cy - h / 2)}" width="${n(w)}" height="${n(h)}" viewBox="${n(g.x)} ${n(g.y)} ${n(g.width)} ${n(g.height)}" overflow="visible"`,
    )
    .trim()
}

function svg(
  {out, size, mark, scale, bg, radius = 0, safe}: Asset,
  g: Geometry,
) {
  const k = (scale * size) / Math.max(g.width, g.height)
  if (safe && g.radius * k > (safe * size) / 2 + 1e-9)
    throw new Error(`${out}: mark leaves the ${safe.toFixed(3)} safe circle`)
  const c = size / 2
  let body = ''
  if (mark && typeof mark === 'string') body = place(MARKS[mark], g, k, c, c)
  else if (mark)
    body =
      `<mask id="knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">${place(MARKS.dark, g, k, c, c)}</mask>` +
      `<rect width="${size}" height="${size}" fill="${mark.mono}" mask="url(#knockout)"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    (bg
      ? `<rect width="${size}" height="${size}" rx="${radius * size}" fill="${bg}"/>`
      : '') +
    body +
    `</svg>`
  )
}

async function render(
  page: Page,
  markup: string,
  size: number,
  isTransparent: boolean,
) {
  /* Chrome tiles screenshots of viewports smaller than its minimum window, so keep the viewport large and clip. */
  await page.setViewportSize({
    width: Math.max(size, 1024) + 256,
    height: Math.max(size, 1024) + 256,
  })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;overflow:hidden;background:transparent"><div style="display:flex">${markup}</div></body></html>`,
  )
  return page.screenshot({
    omitBackground: isTransparent,
    clip: {x: 0, y: 0, width: size, height: size},
  })
}

/** Measures the head outline of mark.svg in the browser; the round 2-unit stroke adds 1 unit all round. */
async function measureMark(page: Page): Promise<Geometry> {
  const head = MARKS.blue.match(/<path d="([^"]+)"/)![1]!
  await page.setContent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path id="h" d="${head}"/></svg>`,
  )
  return page.evaluate(() => {
    const path = document.getElementById('h') as unknown as SVGPathElement
    const b = path.getBBox()
    const [cx, cy] = [b.x + b.width / 2, b.y + b.height / 2]
    const length = path.getTotalLength()
    let radius = 0
    for (let i = 0; i <= 2000; i++) {
      const p = path.getPointAtLength((i / 2000) * length)
      radius = Math.max(radius, Math.hypot(p.x - cx, p.y - cy))
    }
    return {
      x: b.x - 1,
      y: b.y - 1,
      width: b.width + 2,
      height: b.height + 2,
      radius: radius + 1,
    }
  })
}

function dataUri(png: Buffer) {
  return `data:image/png;base64,${png.toString('base64')}`
}

/** Mock-ups of every asset in context, for review. Not shipped. */
function previewHtml(png: Record<string, Buffer>) {
  const img = (k: string, style = '') =>
    `<img src="${dataUri(png[k]!)}" style="${style}">`
  const file = (m: keyof typeof MARKS, bg: string) =>
    `<div style="width:96px;height:96px;background:${bg};border-radius:16px;display:flex;align-items:center;justify-content:center;border:1px solid #8883"><img src="data:image/svg+xml;base64,${Buffer.from(MARKS[m]).toString('base64')}" style="width:64px;height:64px"></div>`
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
    `<div style="display:flex;gap:8px;align-items:center;background:${bg};color:${fg};padding:8px 14px;border-radius:8px 8px 0 0;font:13px system-ui">${img('public/favicon-32.png', 'width:16px;height:16px')}Splito</div>`
  const home = (bg: string) =>
    `<div style="display:flex;gap:14px;padding:14px;border-radius:16px;background:${bg}">${img('assets/brand/icon.png', 'width:60px;border-radius:13px')}<div style="width:60px;height:60px;border-radius:13px;background:#fff3"></div><div style="width:60px;height:60px;border-radius:13px;background:#0003"></div></div>`
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fff;font:14px system-ui;width:1180px">
<h2 style="margin:0 0 4px">Splito brand kit</h2>
<p style="margin:0 0 14px;color:#555">Rendered by scripts/brand.ts from assets/brand/mark*.svg. Rule: blue and white, or black and white - never blue on dark.</p>
<div style="display:flex;flex-wrap:wrap;gap:12px">
${cell('Source marks: mark / mark-white / mark-dark / mark-black', file('blue', WHITE) + file('white', BLUE) + file('dark', BLACK) + file('black', WHITE))}
${cell('iOS light', img('assets/brand/icon.png', ios), 'linear-gradient(#c9d6ff,#e2e2e2)')}
${cell('iOS dark', img('assets/brand/icon-dark.png', ios), '#0b0b0d', '#ddd')}
${cell('iOS tinted (simulated)', `<div style="${ios};background:linear-gradient(#1d2a3d,#0d1420);display:flex">${img('assets/brand/icon-tinted.png', `${ios};filter:sepia(1) hue-rotate(170deg) saturate(3)`)}</div>`, '#0b0b0d', '#ddd')}
${cell('Home screen, light / dark wallpaper', home('linear-gradient(135deg,#f7d9c4,#c9d6ff)') + home('linear-gradient(135deg,#1b2735,#090a0f)'), '#e8eaed')}
${cell('Android adaptive: circle / squircle', adaptive('50%') + adaptive('32%'), '#e8eaed')}
${cell('Android 13 themed (monochrome)', `<div style="width:96px;height:96px;border-radius:50%;background:#d3e3fd;display:flex;align-items:center;justify-content:center;overflow:hidden">${mask('assets/brand/adaptive-monochrome.png', 144, '#0b57d0', 'flex:none')}</div>`, '#e8eaed')}
${cell('Notification icon 24 / 48 dp', mask('assets/brand/notification-icon.png', 24, '#fff') + mask('assets/brand/notification-icon.png', 48, '#fff'), '#202124', '#ddd')}
${cell('Splash light / dark', phone(WHITE, 'assets/brand/splash-mark.png') + phone(BLACK, 'assets/brand/splash-mark-dark.png'), '#d0d4da')}
${cell('Favicon tab light / dark', `<div style="display:flex;flex-direction:column;gap:8px">${tab('#fff', '#222')}${tab('#35363a', '#eee')}</div>`, '#dee1e6')}
${cell('Favicons 16 / 32 / 48 (1x)', img('public/favicon-16.png') + img('public/favicon-32.png') + img('public/favicon-48.png'))}
${cell('Apple touch 180', img('public/apple-touch-icon.png', 'width:90px;border-radius:20px'), 'linear-gradient(#c9d6ff,#e2e2e2)')}
${cell('PWA any 192 / 512', img('public/icons/icon-192.png', 'width:96px') + img('public/icons/icon-512.png', 'width:96px'), '#2b2b2b', '#ddd')}
${cell('PWA maskable 512: circle / rounded', img('public/icons/maskable-512.png', 'width:96px;border-radius:50%') + img('public/icons/maskable-512.png', 'width:96px;border-radius:24px'), '#e8eaed')}
</div></body></html>`
}

async function main() {
  const previewDir = process.argv[2]
  const browser = await chromium.launch({channel: 'chrome'})
  const page = await browser.newPage({deviceScaleFactor: 1})
  const geometry = await measureMark(page)
  const png: Record<string, Buffer> = {}
  for (const asset of ASSETS) {
    const file = join(ROOT, asset.out)
    mkdirSync(dirname(file), {recursive: true})
    png[asset.out] = await render(
      page,
      svg(asset, geometry),
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
  for (const [name, mark] of [
    ['splash-mark.svg', 'blue'],
    ['splash-mark-dark.svg', 'dark'],
  ] as const) {
    writeFileSync(
      join(PUBLIC, name),
      svg({out: name, size: 64, mark, scale: 1}, geometry) + '\n',
    )
    console.log(`public/${name}`)
  }

  if (previewDir) {
    const preview = await browser.newPage({deviceScaleFactor: 2})
    await preview.setViewportSize({width: 1228, height: 800})
    await preview.setContent(previewHtml(png))
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
