import {expect, test} from '@playwright/test'

type Manifest = {
  name: string
  start_url: string
  display: string
  icons: {src: string; sizes: string; type: string; purpose?: string}[]
}

/** Reads the pixel size of a PNG from its IHDR chunk. */
function pngSize(buf: Buffer) {
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG')
  return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)}
}

test('manifest is served and every icon it lists loads at its declared size', async ({
  request,
}) => {
  const res = await request.get('/manifest.json')
  expect(res.status()).toBe(200)
  const manifest = (await res.json()) as Manifest
  expect(manifest).toMatchObject({
    name: 'Splito',
    start_url: '/',
    display: 'standalone',
  })
  expect(manifest.icons.map(i => i.purpose)).toEqual(
    expect.arrayContaining(['any', 'maskable']),
  )
  for (const icon of manifest.icons) {
    const img = await request.get(icon.src)
    expect(img.status(), icon.src).toBe(200)
    expect(img.headers()['content-type']).toContain('image/png')
    const {width, height} = pngSize(await img.body())
    expect(`${width}x${height}`, icon.src).toBe(icon.sizes)
  }
})

test('web launch mark is served and the app replaces it on first render', async ({
  page,
  request,
}) => {
  for (const src of ['/splash-mark.svg', '/splash-mark-dark.svg']) {
    const res = await request.get(src)
    expect(res.status(), src).toBe(200)
    expect(res.headers()['content-type'], src).toContain('image/svg+xml')
  }
  await page.goto('/')
  await expect(page.getByTestId('screen-people')).toBeVisible()
  await expect(page.locator('#launch-mark')).toHaveCount(0)
})

test('index.html links the manifest, favicons and apple touch icon, and they load', async ({
  page,
  request,
}) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.json',
  )
  const links = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll(els =>
      els.map(l => ({
        href: l.getAttribute('href')!,
        sizes: l.getAttribute('sizes'),
      })),
    )
  // Expo adds /favicon.ico from app.config web.favicon; the sized PNGs come from public/index.html.
  expect(links.map(l => l.href)).toEqual([
    '/favicon-16.png',
    '/favicon-32.png',
    '/favicon-48.png',
    '/apple-touch-icon.png',
    '/favicon.ico',
  ])
  for (const {href, sizes} of links) {
    const img = await request.get(href)
    expect(img.status(), href).toBe(200)
    const body = await img.body()
    expect(body.length, href).toBeGreaterThan(0)
    if (sizes) {
      const {width, height} = pngSize(body)
      expect(`${width}x${height}`, href).toBe(sizes)
    }
  }
})
