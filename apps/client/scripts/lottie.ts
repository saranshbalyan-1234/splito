/*
 * Builds Splito's original Lottie animations as plain Lottie JSON (no
 * After Effects), in Bluesky palette blues, and renders frame strips with
 * lottie-web in Playwright's Chrome for review.
 *
 *   node scripts/lottie.ts [previewDir]
 *
 * Writes assets/lottie/<name>.json. Every file carries
 * meta.g = "splito/scripts/lottie.ts" so its origin is traceable.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets/lottie')
const MARK = readFileSync(join(ROOT, 'assets/brand/mark.svg'), 'utf8')

const W = 240
const C = W / 2
const FPS = 60

/** Bluesky ALF default palette (MIT, @bsky.app/alf). */
const P = {
  p50: '#E5F0FF',
  p100: '#CCE1FF',
  p200: '#A8CCFF',
  p300: '#75AFFF',
  p400: '#4291FF',
  p500: '#006AFF',
  p700: '#0048AD',
  white: '#FFFFFF',
}

/** cubic-bezier(x1, y1, x2, y2) */
type Curve = readonly [number, number, number, number]
const EASE = {
  inOut: [0.65, 0, 0.35, 1], // easeInOutCubic: wing beats, hops
  out: [0.22, 1, 0.36, 1], // easeOutQuint: things arriving
  in: [0.55, 0, 1, 0.45], // easeInCirc-ish: things leaving
  back: [0.34, 1.56, 0.64, 1], // easeOutBack: pops with a small overshoot
  linear: [0, 0, 1, 1],
} satisfies Record<string, Curve>

type Value = number | number[]
type Key = [t: number, v: Value, curve?: Curve]

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(
    x => Math.round(x * 1000) / 1000,
  )
}

const st = (k: unknown) => ({a: 0, k})

/** Keyframed property. Tangents follow bodymovin: scalars for spatial position, one per dimension otherwise. */
function kf(keys: Key[], isSpatial = false) {
  return {
    a: 1,
    k: keys.map(([t, v, c = EASE.inOut], i) => {
      const s = Array.isArray(v) ? v : [v]
      if (i === keys.length - 1) return {t, s}
      const dim = (n: number) => (isSpatial ? n : s.map(() => n))
      return {
        t,
        s,
        o: {x: dim(c[0]), y: dim(c[1])},
        i: {x: dim(c[2]), y: dim(c[3])},
      }
    }),
  }
}

type Transform = {
  p?: unknown
  a?: unknown
  s?: unknown
  r?: unknown
  o?: unknown
}

function tr({
  p = st([0, 0]),
  a = st([0, 0]),
  s = st([100, 100]),
  r = st(0),
  o = st(100),
}: Transform = {}) {
  return {ty: 'tr', p, a, s, r, o, sk: st(0), sa: st(0), nm: 'Transform'}
}
function group(nm: string, items: unknown[], transform?: Transform) {
  return {ty: 'gr', nm, np: items.length, it: [...items, tr(transform)]}
}
const ellipse = (w: number, h = w, p = [0, 0], s?: unknown) => ({
  ty: 'el',
  d: 1,
  p: st(p),
  s: s ?? st([w, h]),
})
const rect = (w: number, h: number, r: number, p = [0, 0], s?: unknown) => ({
  ty: 'rc',
  d: 1,
  p: st(p),
  s: s ?? st([w, h]),
  r: st(r),
})
const fill = (hex: string, opacity: unknown = st(100)) => ({
  ty: 'fl',
  c: st([...rgb(hex), 1]),
  o: opacity,
  r: 1,
})
const stroke = (
  hex: string,
  w: number,
  opacity: unknown = st(100),
  dash?: number[],
) => ({
  ty: 'st',
  c: st([...rgb(hex), 1]),
  o: opacity,
  w: st(w),
  lc: 2,
  lj: 2,
  ml: 4,
  ...(dash && {
    d: [
      {n: 'd', nm: 'dash', v: st(dash[0])},
      {n: 'g', nm: 'gap', v: st(dash[1])},
      {n: 'o', nm: 'offset', v: st(0)},
    ],
  }),
})
const gradientFill = (
  top: string,
  bottom: string,
  s: number[],
  e: number[],
) => ({
  ty: 'gf',
  o: st(100),
  r: 1,
  t: 1,
  s: st(s),
  e: st(e),
  g: {p: 2, k: st([0, ...rgb(top), 1, ...rgb(bottom)])},
})
const trim = (e: unknown) => ({ty: 'tm', s: st(0), e, o: st(0), m: 1})

type Bezier = {v: number[][]; i: number[][]; o: number[][]; c: boolean}
const pathShape = (b: Bezier) => ({ty: 'sh', d: 1, ks: st(b)})
/** Open polyline as a Lottie path. */
function polyline(points: number[][]): Bezier {
  return {
    v: points,
    i: points.map(() => [0, 0]),
    o: points.map(() => [0, 0]),
    c: false,
  }
}

type Layer = {
  nm: string
  shapes: unknown[]
  p?: unknown
  a?: unknown
  s?: unknown
  r?: unknown
  o?: unknown
}

function animation(nm: string, frames: number, layers: Layer[]) {
  /* Lottie draws the first layer on top; callers list layers back to front. */
  return {
    v: '5.7.0',
    fr: FPS,
    ip: 0,
    op: frames,
    w: W,
    h: W,
    nm,
    ddd: 0,
    assets: [],
    layers: [...layers].reverse().map((l, i) => ({
      ddd: 0,
      ind: i + 1,
      ty: 4,
      nm: l.nm,
      sr: 1,
      ks: {
        o: l.o ?? st(100),
        r: l.r ?? st(0),
        p: l.p ?? st([C, C, 0]),
        a: l.a ?? st([0, 0, 0]),
        s: l.s ?? st([100, 100, 100]),
      },
      ao: 0,
      shapes: l.shapes,
      ip: 0,
      op: frames,
      st: 0,
      bm: 0,
    })),
    meta: {g: 'splito/scripts/lottie.ts'},
  }
}

/* ---------- the Splito mark as Lottie paths ---------- */

/** Parses the absolute M/C/Z wing paths of mark.svg into Lottie beziers. */
function svgPath(d: string, map: (x: number, y: number) => number[]): Bezier {
  const nums = d.match(/-?\d*\.?\d+/g)!.map(Number)
  const pts: number[][] = []
  for (let i = 0; i < nums.length; i += 2) pts.push(map(nums[i]!, nums[i + 1]!))
  /* M p0, then cubic triples (c1, c2, p) - mark.svg uses only these, closed by Z with a straight line. */
  const v = [pts[0]!]
  const o: number[][] = []
  const inn: number[][] = [[0, 0]]
  for (let k = 1; k + 2 < pts.length + 1; k += 3) {
    const prev = v.at(-1)!
    const [c1, c2, p] = [pts[k]!, pts[k + 1]!, pts[k + 2]!]
    o.push([c1[0]! - prev[0]!, c1[1]! - prev[1]!])
    v.push(p)
    inn.push([c2[0]! - p[0]!, c2[1]! - p[1]!])
  }
  o.push([0, 0])
  return {v, i: inn, o, c: true}
}

function bounds(b: Bezier) {
  const xs: number[] = []
  const ys: number[] = []
  b.v.forEach((p, k) => {
    const next = b.v[(k + 1) % b.v.length]!
    const c1 = [p[0]! + b.o[k]![0]!, p[1]! + b.o[k]![1]!]
    const c2 = [
      next[0]! + b.i[(k + 1) % b.v.length]![0]!,
      next[1]! + b.i[(k + 1) % b.v.length]![1]!,
    ]
    for (let t = 0; t <= 1; t += 0.05) {
      const u = 1 - t
      xs.push(
        u ** 3 * p[0]! +
          3 * u * u * t * c1[0]! +
          3 * u * t * t * c2[0]! +
          t ** 3 * next[0]!,
      )
      ys.push(
        u ** 3 * p[1]! +
          3 * u * u * t * c1[1]! +
          3 * u * t * t * c2[1]! +
          t ** 3 * next[1]!,
      )
    }
  })
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  }
}

const MARK_GRADIENT = {
  l: [
    ...MARK.matchAll(/<linearGradient id="l"[\s\S]*?<\/linearGradient>/g),
  ][0]![0].match(/#[0-9A-Fa-f]{6}/g)!,
  r: [
    ...MARK.matchAll(/<linearGradient id="r"[\s\S]*?<\/linearGradient>/g),
  ][0]![0].match(/#[0-9A-Fa-f]{6}/g)!,
}

/** The four wings, centred on the canvas at `k` px per mark unit, grouped by side. */
function markWings(k: number) {
  const map = (x: number, y: number) => [(x - 32) * k + C, (y - 33.5) * k + C]
  const wings = [
    ...MARK.matchAll(/<path d="([^"]+)" fill="url\(#(l|r)\)"\/>/g),
  ].map(m => ({b: svgPath(m[1]!, map), side: m[2] as 'l' | 'r'}))
  const side = (s: 'l' | 'r') =>
    wings
      .filter(w => w.side === s)
      .map((w, i) => {
        const bb = bounds(w.b)
        const [top, bottom] = MARK_GRADIENT[s] as [string, string]
        const mid = (bb.x0 + bb.x1) / 2
        return group(`wing-${s}${i}`, [
          pathShape(w.b),
          gradientFill(top, bottom, [mid, bb.y0], [mid, bb.y1]),
        ])
      })
  /* Each side folds toward its own inner edge (x = 30.5 and 33.5 in mark.svg). */
  return {
    left: side('l'),
    right: side('r'),
    leftHinge: map(30.5, 33.5),
    rightHinge: map(33.5, 33.5),
  }
}

/* ---------- shared figures ---------- */

const backdrop = (r = 100): Layer => ({
  nm: 'backdrop',
  shapes: [group('disc', [ellipse(r * 2), fill(P.p400, st(12))])],
})

/** Head and shoulders, centred on its own origin (head above, shoulders below). */
function person(color: string, scale = 1) {
  const s = (n: number) => n * scale
  const shoulders: Bezier = {
    v: [
      [s(-36), s(40)],
      [s(0), s(4)],
      [s(36), s(40)],
    ],
    i: [
      [0, 0],
      [s(-26), 0],
      [0, s(-24)],
    ],
    o: [
      [0, s(-24)],
      [s(26), 0],
      [0, 0],
    ],
    c: true,
  }
  return [
    group('head', [ellipse(s(40)), fill(color)], {p: st([0, s(-22)])}),
    group('shoulders', [pathShape(shoulders), fill(color)]),
  ]
}

/* ---------- animations ---------- */

/** Splito mark beating its wings: the split side trails by a beat. 2 s loop. */
function loading() {
  const {left, right, leftHinge, rightHinge} = markWings(2.6)
  const beat = (delay: number): Key[] => [
    [delay, [100, 100]],
    [delay + 30, [28, 100]],
    [delay + 60, [100, 100]],
    [delay + 90, [28, 100]],
    [delay + 120, [100, 100]],
  ]
  const lift: Key[] = [
    [0, [C, C]],
    [30, [C, C - 8]],
    [60, [C, C]],
    [90, [C, C - 8]],
    [120, [C, C]],
  ]
  const wingLayer = (
    nm: string,
    shapes: unknown[],
    hinge: number[],
    delay: number,
  ): Layer => ({
    nm,
    shapes: [
      group(nm, shapes, {
        a: st(hinge),
        p: st(hinge),
        s: delay
          ? kf([[0, [76, 100]], ...beat(delay).slice(1, -1), [120, [76, 100]]])
          : kf(beat(0)),
      }),
    ],
    p: kf(lift, true),
    a: st([C, C, 0]),
  })
  return animation('loading', 120, [
    {
      nm: 'shadow',
      shapes: [
        group('shadow', [ellipse(120, 14, [0, 86]), fill(P.p400, st(18))], {
          s: kf([
            [0, [100, 100]],
            [30, [80, 100]],
            [60, [100, 100]],
            [90, [80, 100]],
            [120, [100, 100]],
          ]),
        }),
      ],
    },
    wingLayer('wings-left', left, leftHinge, 0),
    /* The right wings start 8 frames behind; their first/last keys sit mid-beat so the loop stays seamless. */
    wingLayer('wings-right', right, rightHinge, 8),
  ])
}

/** Disc pops, ring pulses, check draws, sparkles burst. 1.6 s, holds the last frame. */
function success() {
  const sparkles: Layer[] = Array.from({length: 8}, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    const at = (r: number) => [C + Math.cos(a) * r, C + Math.sin(a) * r]
    return {
      nm: `sparkle-${i}`,
      shapes: [
        group('dot', [ellipse(i % 2 ? 10 : 14), fill(i % 2 ? P.p200 : P.p300)]),
      ],
      p: kf(
        [
          [22, at(74), EASE.out],
          [58, at(112)],
        ],
        true,
      ),
      s: kf([
        [22, [0, 0], EASE.back],
        [32, [100, 100], EASE.in],
        [58, [0, 0]],
      ]),
    }
  })
  return animation('success', 96, [
    {
      nm: 'ring',
      shapes: [
        group('ring', [
          ellipse(
            0,
            0,
            [0, 0],
            kf([
              [10, [140, 140], EASE.out],
              [50, [214, 214]],
            ]),
          ),
          stroke(
            P.p300,
            6,
            kf([
              [0, 0],
              [9, 0],
              [10, 70, EASE.out],
              [50, 0],
            ]),
          ),
        ]),
      ],
    },
    ...sparkles,
    {
      nm: 'disc',
      shapes: [group('disc', [ellipse(144), fill(P.p500)])],
      s: kf([
        [0, [0, 0, 100], EASE.back],
        [26, [100, 100, 100]],
      ]),
    },
    {
      nm: 'check',
      shapes: [
        group('check', [
          pathShape(
            polyline([
              [-32, 2],
              [-10, 24],
              [34, -22],
            ]),
          ),
          trim(
            kf([
              [18, 0, EASE.out],
              [46, 100],
            ]),
          ),
          stroke(P.white, 14),
        ]),
      ],
    },
  ])
}

/** A coin hops between two friends and back, flipping as it goes. 3 s loop. */
function emptyPeople() {
  const L = [C - 46, 176]
  const R = [C + 46, 176]
  const coinY = 70
  const hop = (t: number, from: number, to: number): Key[] => [
    [t, from],
    [t + 50, to],
  ]
  const bounce = (t: number): Key[] => [
    [0, [100, 100]],
    [t, [100, 100], EASE.out],
    [t + 8, [104, 95], EASE.out],
    [t + 24, [100, 100]],
    [180, [100, 100]],
  ]
  return animation('empty-people', 180, [
    backdrop(),
    {
      nm: 'friend-left',
      shapes: [
        group('person', person(P.p500), {
          p: st(L),
          a: st([0, 40]),
          s: kf(bounce(140)),
        }),
      ],
      p: st([0, 0, 0]),
    },
    {
      nm: 'friend-right',
      shapes: [
        group('person', person(P.p300), {
          p: st(R),
          a: st([0, 40]),
          s: kf(bounce(70)),
        }),
      ],
      p: st([0, 0, 0]),
    },
    {
      nm: 'coin',
      shapes: [
        group(
          'coin',
          [ellipse(30), fill(P.p200), ellipse(16), stroke(P.p500, 3.5)],
          {
            s: kf([
              [20, [100, 100]],
              [32, [12, 100]],
              [45, [100, 100]],
              [57, [12, 100]],
              [70, [100, 100]],
              [90, [100, 100]],
              [102, [12, 100]],
              [115, [100, 100]],
              [127, [12, 100]],
              [140, [100, 100]],
            ]),
          },
        ),
      ],
      p: {
        s: true,
        x: kf([
          [0, L[0]!],
          ...hop(20, L[0]!, R[0]!),
          ...hop(90, R[0]!, L[0]!),
          [180, L[0]!],
        ]),
        y: kf([
          [0, coinY],
          [20, coinY, EASE.out],
          [45, coinY - 28, EASE.inOut],
          [70, coinY],
          [90, coinY, EASE.out],
          [115, coinY - 28, EASE.inOut],
          [140, coinY],
          [180, coinY],
        ]),
      },
    },
  ])
}

/** Three members around a slowly turning dashed ring, greeting in turn. 3 s loop. */
function emptyGroups() {
  /* 24 dashes round the ring, so the 90 degree turn per loop lands on an identical pattern. */
  const DASH = (Math.PI * 176) / 24
  const seats = [
    {p: [C, 82], color: P.p500, t: 0},
    {p: [C - 50, 158], color: P.p400, t: 20},
    {p: [C + 50, 158], color: P.p300, t: 40},
  ]
  return animation('empty-groups', 180, [
    backdrop(),
    {
      nm: 'ring',
      shapes: [
        group('ring', [
          ellipse(176),
          stroke(P.p300, 4, st(80), [DASH * 0.42, DASH * 0.58]),
        ]),
      ],
      r: kf([
        [0, 0, EASE.linear],
        [180, 90],
      ]),
    },
    ...seats.map(({p, color, t}, i): Layer => ({
      nm: `member-${i}`,
      shapes: [
        group('person', person(color, 0.62), {p: st(p), a: st([0, 14])}),
      ],
      s: kf([
        [0, [100, 100, 100]],
        [t, [100, 100, 100], EASE.out],
        [t + 12, [114, 114, 100], EASE.inOut],
        [t + 34, [100, 100, 100]],
        [180, [100, 100, 100]],
      ]),
      a: st([p[0]!, p[1]!, 0]),
      p: st([p[0]!, p[1]!, 0]),
    })),
  ])
}

/** A feed card fills with rows one by one, pings, then clears. 3 s loop. */
function emptyActivity() {
  const rows = [-38, 0, 38].map((y, i): Layer => {
    const t = 12 + i * 16
    return {
      nm: `row-${i}`,
      shapes: [
        group('dot', [ellipse(20), fill(i === 0 ? P.p500 : P.p400)], {
          p: st([-46, 0]),
        }),
        group(
          'bar',
          [
            rect(i === 1 ? 52 : 72, 12, 6, [i === 1 ? 26 : 36, 0]),
            fill(P.p300),
          ],
          {
            p: st([-28, 0]),
            s: kf([
              [t, [0, 100], EASE.out],
              [t + 26, [100, 100]],
            ]),
          },
        ),
      ],
      p: kf(
        [
          [t, [C, C + y + 14], EASE.out],
          [t + 26, [C, C + y]],
        ],
        true,
      ),
      o: kf([
        [0, 0],
        [t, 0, EASE.out],
        [t + 18, 100],
        [140, 100, EASE.in],
        [158, 0],
        [180, 0],
      ]),
    }
  })
  return animation('empty-activity', 180, [
    backdrop(),
    {
      nm: 'card',
      shapes: [
        group('card', [
          rect(148, 148, 22),
          fill(P.p500, st(10)),
          stroke(P.p400, 3, st(70)),
        ]),
      ],
    },
    ...rows,
    {
      nm: 'ping',
      shapes: [group('ping', [ellipse(22), fill(P.p500)])],
      p: st([C + 66, C - 66, 0]),
      s: kf([
        [0, [0, 0, 100]],
        [60, [0, 0, 100], EASE.back],
        [74, [100, 100, 100]],
        [140, [100, 100, 100], EASE.in],
        [154, [0, 0, 100]],
        [180, [0, 0, 100]],
      ]),
    },
    {
      nm: 'ping-ring',
      shapes: [
        group('ring', [
          ellipse(
            0,
            0,
            [0, 0],
            kf([
              [66, [22, 22], EASE.out],
              [100, [54, 54]],
            ]),
          ),
          stroke(
            P.p400,
            3,
            kf([
              [0, 0],
              [65, 0],
              [66, 80, EASE.out],
              [100, 0],
            ]),
          ),
        ]),
      ],
      p: st([C + 66, C - 66, 0]),
    },
  ])
}

/** name -> [builder, frames to sample in the preview] */
const ANIMATIONS = {
  loading: loading(),
  success: success(),
  'empty-people': emptyPeople(),
  'empty-groups': emptyGroups(),
  'empty-activity': emptyActivity(),
}

async function preview(dir: string) {
  const lottiePath = createRequire(import.meta.url).resolve(
    'lottie-web/build/player/lottie_light.min.js',
  )
  const browser = await chromium.launch({channel: 'chrome'})
  const page = await browser.newPage({deviceScaleFactor: 1})
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  const COLS = 8
  await page.setViewportSize({width: COLS * 130 + 20, height: 1400})
  await page.setContent(
    '<!doctype html><html><body style="margin:0;font:12px system-ui"></body></html>',
  )
  await page.addScriptTag({path: lottiePath})
  for (const [name, data] of Object.entries(ANIMATIONS)) {
    const frames = Array.from({length: COLS}, (_, i) =>
      Math.round((i * (data.op - 1)) / (COLS - 1)),
    )
    await page.evaluate(
      ({data, frames}) => {
        document.body.innerHTML = ''
        for (const bg of ['#ffffff', '#000000']) {
          const row = document.createElement('div')
          row.style.cssText = `display:flex;gap:10px;padding:10px;background:${bg};color:${bg === '#000000' ? '#aaa' : '#555'}`
          for (const f of frames) {
            const cell = document.createElement('div')
            const box = document.createElement('div')
            box.style.cssText = 'width:120px;height:120px'
            cell.append(
              box,
              Object.assign(document.createElement('div'), {
                textContent: `f${f}`,
              }),
            )
            row.append(cell)
            // @ts-expect-error lottie is a page global from the injected script
            const anim = window.lottie.loadAnimation({
              container: box,
              renderer: 'svg',
              loop: false,
              autoplay: false,
              animationData: structuredClone(data),
            })
            anim.goToAndStop(f, true)
          }
          document.body.append(row)
        }
      },
      {data, frames},
    )
    const file = join(dir, `lottie-${name}.png`)
    await page.screenshot({path: file, fullPage: true})
    console.log(file)
  }
  await browser.close()
  if (errors.length)
    throw new Error(`lottie-web reported errors:\n${errors.join('\n')}`)
}

mkdirSync(OUT, {recursive: true})
for (const [name, data] of Object.entries(ANIMATIONS)) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data))
  console.log(`assets/lottie/${name}.json ${(data.op / FPS).toFixed(1)}s`)
}
if (process.argv[2]) await preview(process.argv[2])
