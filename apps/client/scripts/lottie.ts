/*
 * Builds Splito's original Lottie animations as plain Lottie JSON (no
 * After Effects), and renders frame strips with lottie-web in Playwright's
 * Chrome for review.
 *
 *   node scripts/lottie.ts [previewDir]
 *
 * Colours follow the logo rule - blue and white, or black and white, never
 * blue on dark - so every animation is written twice:
 *   assets/lottie/<name>.json       brand blue + white, for light themes
 *   assets/lottie/<name>-dark.json  white + black, for dark and dim themes
 * Every file carries meta.g = "splito/scripts/lottie.ts" so its origin is
 * traceable.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'assets/lottie')
/*
 * The loading animation's cat (Lucide "cat", ISC, lucide-static v1.61.0, see
 * LICENSES/lucide.txt): its four paths, kept here since the brand mark moved
 * to the owner-provided SVG (owner rule 21).
 */
const MARK = `
<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z" fill="#006AFF" stroke="#006AFF" stroke-width="2"/>
<path d="M8 14v.5" stroke="#FFFFFF" stroke-width="2"/>
<path d="M16 14v.5" stroke="#FFFFFF" stroke-width="2"/>
<path d="M11.25 16.25h1.5L12 17l-.75-.75Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2"/>
`

const W = 240
const C = W / 2
const FPS = 60

/**
 * Two colours per variant. `t(a)` mixes `a` of the ink into the paper, so
 * light tints are the brand blue lightened with white (t(0.74), t(0.54) and
 * t(0.34) match Bluesky's primary_400/300/200) and dark tints are greys.
 */
type Palette = {ink: string; paper: string; t: (a: number) => string}
function palette(ink: string, paper: string): Palette {
  const [i, p] = [rgb(ink), rgb(paper)]
  const hex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return {
    ink,
    paper,
    t: a => '#' + i.map((v, k) => hex(p[k]! + (v - p[k]!) * a)).join(''),
  }
}
const VARIANTS = {
  light: palette('#006AFF', '#FFFFFF'),
  dark: palette('#FFFFFF', '#000000'),
}

/** cubic-bezier(x1, y1, x2, y2) */
type Curve = readonly [number, number, number, number]
const EASE = {
  inOut: [0.65, 0, 0.35, 1], // easeInOutCubic: hops, beats
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
const trim = (e: unknown) => ({ty: 'tm', s: st(0), e, o: st(0), m: 1})

type Bezier = {v: number[][]; i: number[][]; o: number[][]; c: boolean}
/** A closed circle of radius r round the comp centre, as four cubic arcs. */
function circlePath(r: number): Bezier {
  const k = r * 0.5523
  return {
    v: [
      [C, C - r],
      [C + r, C],
      [C, C + r],
      [C - r, C],
    ],
    i: [
      [-k, 0],
      [0, -k],
      [k, 0],
      [0, k],
    ],
    o: [
      [k, 0],
      [0, k],
      [-k, 0],
      [0, -k],
    ],
    c: true,
  }
}
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
  /** Clip the layer to a circle of this radius round the centre (the backdrop disc). */
  clip?: number
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
      ...(l.clip && {
        hasMask: true,
        masksProperties: [
          {
            inv: false,
            mode: 'a',
            pt: st(circlePath(l.clip)),
            o: st(100),
            x: st(0),
            nm: 'disc',
          },
        ],
      }),
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

type Pt = [number, number]
/** One cubic segment from the current point: control 1, control 2, end. */
type Seg = [c1: Pt, c2: Pt, p: Pt]
type SubPath = {start: Pt; segs: Seg[]; isClosed: boolean}

/** SVG elliptical arc (endpoint form, SVG 1.1 F.6.5) as cubics of at most 90 degrees each. */
function arcToCubics(
  p0: Pt,
  rxIn: number,
  ryIn: number,
  angle: number,
  isLarge: boolean,
  isSweep: boolean,
  p: Pt,
): Seg[] {
  let [rx, ry] = [Math.abs(rxIn), Math.abs(ryIn)]
  if (!rx || !ry) return [[p0, p, p]]
  const [cos, sin] = [
    Math.cos((angle * Math.PI) / 180),
    Math.sin((angle * Math.PI) / 180),
  ]
  const [dx, dy] = [(p0[0] - p[0]) / 2, (p0[1] - p[1]) / 2]
  const [x1, y1] = [cos * dx + sin * dy, -sin * dx + cos * dy]
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lambda > 1) [rx, ry] = [rx * Math.sqrt(lambda), ry * Math.sqrt(lambda)]
  const sq =
    (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) /
    (rx * rx * y1 * y1 + ry * ry * x1 * x1)
  const f = (isLarge === isSweep ? -1 : 1) * Math.sqrt(Math.max(0, sq))
  const [cxp, cyp] = [(f * rx * y1) / ry, (-f * ry * x1) / rx]
  const cx = cos * cxp - sin * cyp + (p0[0] + p[0]) / 2
  const cy = sin * cxp + cos * cyp + (p0[1] + p[1]) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const t0 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
  let dt = ang(
    (x1 - cxp) / rx,
    (y1 - cyp) / ry,
    (-x1 - cxp) / rx,
    (-y1 - cyp) / ry,
  )
  if (!isSweep && dt > 0) dt -= 2 * Math.PI
  if (isSweep && dt < 0) dt += 2 * Math.PI
  const at = (t: number): Pt => [
    cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
  ]
  const tangent = (t: number): Pt => [
    -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
  ]
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)))
  return Array.from({length: n}, (_, k): Seg => {
    const [a, b] = [t0 + (dt * k) / n, t0 + (dt * (k + 1)) / n]
    const h = (4 / 3) * Math.tan((b - a) / 4)
    const [pa, pb, ta, tb] = [at(a), at(b), tangent(a), tangent(b)]
    return [
      [pa[0] + h * ta[0], pa[1] + h * ta[1]],
      [pb[0] - h * tb[0], pb[1] - h * tb[1]],
      k === n - 1 ? p : pb,
    ]
  })
}

/** Parses an SVG path (M L H V C S A Z, absolute or relative - all Lucide's cat uses) into cubic subpaths. */
function parsePath(d: string): SubPath[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const subs: SubPath[] = []
  let [i, cmd] = [0, '']
  let [cur, start]: Pt[] = [
    [0, 0],
    [0, 0],
  ]
  let prevC2: Pt | null = null
  const num = () => {
    const v = Number(tokens[i++])
    if (Number.isNaN(v)) throw new Error(`path: expected a number in "${d}"`)
    return v
  }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!
    const isRel = cmd === cmd.toLowerCase()
    const pt = (): Pt => {
      const [x, y] = [num(), num()]
      return isRel ? [cur[0] + x, cur[1] + y] : [x, y]
    }
    const segs: Seg[] = []
    switch (cmd.toUpperCase()) {
      case 'M':
        cur = start = pt()
        subs.push({start, segs: [], isClosed: false})
        cmd = isRel ? 'l' : 'L' // extra pairs after M are lines
        prevC2 = null
        continue
      case 'L': {
        const p = pt()
        segs.push([cur, p, p])
        break
      }
      case 'H': {
        const x = num()
        const p: Pt = [isRel ? cur[0] + x : x, cur[1]]
        segs.push([cur, p, p])
        break
      }
      case 'V': {
        const y = num()
        const p: Pt = [cur[0], isRel ? cur[1] + y : y]
        segs.push([cur, p, p])
        break
      }
      case 'C':
        segs.push([pt(), pt(), pt()])
        break
      case 'S': {
        const c1: Pt = prevC2
          ? [2 * cur[0] - prevC2[0], 2 * cur[1] - prevC2[1]]
          : cur
        segs.push([c1, pt(), pt()])
        break
      }
      case 'A': {
        const [rx, ry, angle, large, sweep] = [
          num(),
          num(),
          num(),
          num(),
          num(),
        ]
        segs.push(...arcToCubics(cur, rx, ry, angle, !!large, !!sweep, pt()))
        break
      }
      case 'Z':
        if (cur[0] !== start[0] || cur[1] !== start[1])
          segs.push([cur, start, start])
        subs.at(-1)!.isClosed = true
        break
      default:
        throw new Error(`path: unsupported command "${cmd}"`)
    }
    const sub = subs.at(-1)
    if (!sub) throw new Error(`path: "${d}" does not start with M`)
    sub.segs.push(...segs)
    if (segs.length) cur = segs.at(-1)![2]
    prevC2 = /[CS]/i.test(cmd) ? segs.at(-1)![1] : null
    if (cmd.toUpperCase() === 'Z') {
      cur = start
      if (i < tokens.length && !/[a-zA-Z]/.test(tokens[i]!))
        throw new Error(`path: numbers after Z in "${d}"`)
    }
  }
  return subs
}

/** A parsed subpath as a Lottie bezier (vertices with relative in/out tangents), mapped into layer space. */
function toBezier(sub: SubPath, map: (p: Pt) => Pt): Bezier {
  const v: number[][] = [map(sub.start)]
  const inn: number[][] = [[0, 0]]
  const o: number[][] = []
  for (const [c1, c2, p] of sub.segs) {
    const [prev, a, b, end] = [v.at(-1)!, map(c1), map(c2), map(p)]
    o.push([a[0] - prev[0]!, a[1] - prev[1]!])
    v.push(end)
    inn.push([b[0] - end[0], b[1] - end[1]])
  }
  o.push([0, 0])
  if (sub.isClosed) {
    /* Z ends on the start point: fold that duplicate vertex back into the first. */
    v.pop()
    o.pop()
    inn[0] = inn.pop()!
  }
  return {v, i: inn, o, c: sub.isClosed}
}

function bounds(b: Bezier) {
  const xs: number[] = []
  const ys: number[] = []
  const n = b.c ? b.v.length : b.v.length - 1
  for (let k = 0; k < n; k++) {
    const p = b.v[k]!
    const next = b.v[(k + 1) % b.v.length]!
    const c1 = [p[0]! + b.o[k]![0]!, p[1]! + b.o[k]![1]!]
    const c2 = [
      next[0]! + b.i[(k + 1) % b.v.length]![0]!,
      next[1]! + b.i[(k + 1) % b.v.length]![1]!,
    ]
    for (let t = 0; t <= 1; t += 0.01) {
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
  }
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  }
}

/* The mark's four paths in file order: head outline, left eye, right eye, nose. */
const MARK_PATHS = [...MARK.matchAll(/<path d="([^"]+)"/g)].map(
  m => parsePath(m[1]!)[0]!,
)
if (MARK_PATHS.length !== 4)
  throw new Error(`mark.svg: expected 4 paths, found ${MARK_PATHS.length}`)
{
  /* Self-check of the parser against the head's known extent (Lucide cat: x 3..21, y 3..21, ear tops at y 2.82). */
  const b = bounds(toBezier(MARK_PATHS[0]!, p => p))
  const want = {x0: 3, x1: 21, y0: 2.82, y1: 21}
  for (const [k, v] of Object.entries(want))
    if (Math.abs(b[k as keyof typeof b] - v) > 0.03)
      throw new Error(
        `mark.svg head parsed wrong: ${k} = ${b[k as keyof typeof b]}, want ${v}`,
      )
}

/**
 * The Splito cat at `k` px per mark unit, centred on the layer origin, drawn
 * exactly like mark.svg: filled head with a 2-unit round stroke, eyes as
 * round-capped strokes, nose filled and stroked. Returns the eye group
 * separately so callers can animate a blink, plus the cat's bottom edge.
 */
function cat(c: Palette, k: number, eyeScale?: unknown) {
  const [head, eyeL, eyeR, nose] = MARK_PATHS as [
    SubPath,
    SubPath,
    SubPath,
    SubPath,
  ]
  /* Centre of the visible mark (outline plus the stroke's 1 unit) in mark units. */
  const [cx, cy] = [12, (2.82 - 1 + 21 + 1) / 2]
  const map = (p: Pt): Pt => [(p[0] - cx) * k, (p[1] - cy) * k]
  const eyeCentre = map([12, 14.25])
  return {
    shapes: [
      group(
        'eyes',
        [
          pathShape(toBezier(eyeL, map)),
          pathShape(toBezier(eyeR, map)),
          stroke(c.paper, 2 * k),
        ],
        {
          a: st(eyeCentre),
          p: st(eyeCentre),
          s: eyeScale ?? st([100, 100]),
        },
      ),
      group('nose', [
        pathShape(toBezier(nose, map)),
        fill(c.paper),
        stroke(c.paper, 2 * k),
      ]),
      group('head', [
        pathShape(toBezier(head, map)),
        fill(c.ink),
        stroke(c.ink, 2 * k),
      ]),
    ],
    bottom: map([12, 22])[1],
  }
}

/* ---------- shared figures ---------- */

const backdrop = (c: Palette, r = 100): Layer => ({
  nm: 'backdrop',
  shapes: [group('disc', [ellipse(r * 2), fill(c.t(0.74), st(12))])],
})

/** The rounded card the empty states sit on. */
const cardLayer = (c: Palette): Layer => ({
  nm: 'card',
  shapes: [
    group('card', [
      rect(148, 148, 22),
      fill(c.ink, st(10)),
      stroke(c.t(0.74), 3, st(70)),
    ]),
  ],
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

/**
 * The Splito cat hops twice a loop: it rises and slows, falls and speeds
 * up, stretches a little into the landing and settles with a small squash.
 * It blinks at the top of the second hop; its shadow tightens while it is
 * in the air. 2 s loop.
 */
function loading(c: Palette) {
  const LIFT = 14
  const ground = C - 8
  /* Keys for one hop starting at t: take-off, apex, touchdown, squash (the next hop or the loop end recovers). */
  const hop = (
    t: number,
    rest: Value,
    apex: Value,
    touch: Value,
    squash: Value,
  ): Key[] => [
    [t, rest, EASE.out],
    [t + 26, apex, EASE.in],
    [t + 48, touch, EASE.out],
    [t + 53, squash, EASE.inOut],
  ]
  const twice = (
    rest: Value,
    apex: Value,
    touch: Value,
    squash: Value,
    isSpatial = false,
  ) =>
    kf(
      [
        ...hop(0, rest, apex, touch, squash),
        ...hop(60, rest, apex, touch, squash),
        [120, rest],
      ],
      isSpatial,
    )
  const {shapes, bottom} = cat(
    c,
    5.6,
    kf([
      [0, [100, 100]],
      [80, [100, 100], EASE.inOut],
      [85, [100, 12], EASE.inOut],
      [92, [100, 100]],
      [120, [100, 100]],
    ]),
  )
  const feet = [C, ground + bottom]
  return animation('loading', 120, [
    {
      nm: 'shadow',
      shapes: [group('shadow', [ellipse(84, 10), fill(c.t(0.74), st(20))])],
      p: st([C, ground + bottom + 10, 0]),
      s: twice(
        [100, 100, 100],
        [70, 70, 100],
        [100, 100, 100],
        [104, 100, 100],
      ),
    },
    {
      nm: 'cat',
      shapes,
      /* Anchored at its feet so the squash stays on the ground. */
      a: st([0, bottom, 0]),
      p: twice(feet, [feet[0]!, feet[1]! - LIFT], feet, feet, true),
      s: twice(
        [100, 100, 100],
        [100, 100, 100],
        [97, 103, 100],
        [105, 95, 100],
      ),
    },
  ])
}

/** Disc pops, ring pulses, check draws, sparkles burst. 1.6 s, holds the last frame. */
function success(c: Palette) {
  const sparkles: Layer[] = Array.from({length: 8}, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    const at = (r: number) => [C + Math.cos(a) * r, C + Math.sin(a) * r]
    return {
      nm: `sparkle-${i}`,
      shapes: [
        group('dot', [
          ellipse(i % 2 ? 10 : 14),
          fill(i % 2 ? c.t(0.34) : c.t(0.54)),
        ]),
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
            c.t(0.54),
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
      shapes: [group('disc', [ellipse(144), fill(c.ink)])],
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
          stroke(c.paper, 14),
        ]),
      ],
    },
  ])
}

/**
 * A coin hops between two friends and back, flipping as it goes. The
 * friends are whole head-and-shoulders busts inside the backdrop disc, and
 * the coin arcs above their heads. 3 s loop.
 */
function emptyPeople(c: Palette) {
  const L = [C - 38, 186]
  const R = [C + 38, 186]
  /* The coin passes above the two heads, from one friend's side to the other's. */
  const coinL = C - 30
  const coinR = C + 30
  const coinY = 72
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
    backdrop(c),
    {
      nm: 'friend-left',
      shapes: [
        group('person', person(c.ink, 0.85), {
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
        group('person', person(c.t(0.54), 0.85), {
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
          [
            ellipse(18),
            stroke(c.ink, 3),
            ellipse(36),
            fill(c.t(0.34)),
            stroke(c.ink, 3),
          ],
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
          [0, coinL],
          ...hop(20, coinL, coinR),
          ...hop(90, coinR, coinL),
          [180, coinL],
        ]),
        y: kf([
          [0, coinY],
          [20, coinY, EASE.out],
          [45, coinY - 26, EASE.inOut],
          [70, coinY],
          [90, coinY, EASE.out],
          [115, coinY - 26, EASE.inOut],
          [140, coinY],
          [180, coinY],
        ]),
      },
    },
  ])
}

/** Three members around a slowly turning dashed ring, greeting in turn. 3 s loop. */
function emptyGroups(c: Palette) {
  /* 24 dashes round the ring, so the 90 degree turn per loop lands on an identical pattern. */
  const DASH = (Math.PI * 176) / 24
  const seats = [
    {p: [C, 82], color: c.ink, t: 0},
    {p: [C - 50, 158], color: c.t(0.74), t: 20},
    {p: [C + 50, 158], color: c.t(0.54), t: 40},
  ]
  return animation('empty-groups', 180, [
    backdrop(c),
    {
      nm: 'ring',
      shapes: [
        group('ring', [
          ellipse(176),
          stroke(c.t(0.54), 4, st(80), [DASH * 0.42, DASH * 0.58]),
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
function emptyActivity(c: Palette) {
  const rows = [-38, 0, 38].map((y, i): Layer => {
    const t = 12 + i * 16
    return {
      nm: `row-${i}`,
      shapes: [
        group('dot', [ellipse(20), fill(i === 0 ? c.ink : c.t(0.74))], {
          p: st([-46, 0]),
        }),
        group(
          'bar',
          [
            rect(i === 1 ? 52 : 72, 12, 6, [i === 1 ? 26 : 36, 0]),
            fill(c.t(0.54)),
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
    backdrop(c),
    cardLayer(c),
    ...rows,
    {
      nm: 'ping',
      shapes: [group('ping', [ellipse(22), fill(c.ink)])],
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
            c.t(0.74),
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

/** Columns rise from a baseline one by one, the tallest in full ink, then sink. 3 s loop. */
function emptyAnalytics(c: Palette) {
  const BASE = C + 44
  const bars = [
    {x: C - 42, h: 40, color: c.t(0.54)},
    {x: C - 14, h: 66, color: c.t(0.74)},
    {x: C + 14, h: 52, color: c.t(0.54)},
    {x: C + 42, h: 88, color: c.ink},
  ].map(({x, h, color}, i): Layer => {
    const t = 10 + i * 14
    return {
      nm: `bar-${i}`,
      shapes: [
        /* The rect hangs above the group's origin, so scaling the group grows it from the baseline. */
        group('bar', [rect(18, h, 5, [0, -h / 2]), fill(color)], {
          p: st([x, BASE]),
          s: kf([
            [0, [100, 0]],
            [t, [100, 0], EASE.back],
            [t + 30, [100, 100]],
            [138 + i * 4, [100, 100], EASE.in],
            [156 + i * 4, [100, 0]],
            [180, [100, 0]],
          ]),
        }),
      ],
      p: st([0, 0, 0]),
    }
  })
  return animation('empty-analytics', 180, [
    backdrop(c),
    cardLayer(c),
    {
      nm: 'baseline',
      shapes: [
        group('line', [rect(112, 3, 1.5, [0, BASE - C + 2]), fill(c.t(0.34))]),
      ],
    },
    ...bars,
  ])
}

/* Shapes inside one layer draw first-on-top: a background (paper, bubble, body) is listed last. */
/* ---------- the intro slides (F-249): one loop each, 3 s, state at the last frame equals the first ---------- */

const LOOP = 180
/** Scale key list: absent until `t`, a pop in, held, then back out before the loop ends. */
const popKeys = (t: number): Key[] => [
  [0, [0, 0]],
  [t, [0, 0], EASE.back],
  [t + 16, [100, 100]],
  [LOOP - 26, [100, 100], EASE.in],
  [LOOP - 8, [0, 0]],
  [LOOP, [0, 0]],
]
/** Scale x from the left edge (the rect's anchor), the same shape. */
const drawKeys = (t: number, to = 100): Key[] => [
  [0, [0, 100]],
  [t, [0, 100], EASE.out],
  [t + 24, [to, 100]],
  [LOOP - 26, [to, 100], EASE.in],
  [LOOP - 8, [0, 100]],
  [LOOP, [0, 100]],
]
/** Scale y from the bottom edge. */
const growKeys = (t: number): Key[] => [
  [0, [100, 0]],
  [t, [100, 0], EASE.out],
  [t + 26, [100, 100]],
  [LOOP - 26, [100, 100], EASE.in],
  [LOOP - 8, [100, 0]],
  [LOOP, [100, 0]],
]

/** Three friends and one bill: a coin drops, the bar splits into three shares, each friend nods in turn. */
function welcomeSplit(c: Palette) {
  const xs = [C - 62, C, C + 62]
  const cols = [c.ink, c.t(0.54), c.t(0.34)]
  const BAR_Y = C + 54
  const nod = (t: number): Key[] => [
    [0, [100, 100]],
    [t, [100, 100], EASE.out],
    [t + 8, [104, 94], EASE.out],
    [t + 24, [100, 100]],
    [LOOP, [100, 100]],
  ]
  return animation('welcome-split', LOOP, [
    backdrop(c),
    ...xs.map((x, i) => ({
      nm: `friend-${i}`,
      shapes: [group('person', person(cols[i]!, 0.8), {p: st([x, C + 14]), a: st([0, 32]), s: kf(nod(40 + i * 22))})],
      p: st([0, 0, 0]),
    })),
    {
      nm: 'shares',
      shapes: xs.map((x, i) => group('share', [rect(52, 12, 6), fill(cols[i]!)], {p: st([x, BAR_Y]), a: st([0, 6]), s: kf(popKeys(52 + i * 12))})),
      p: st([0, 0, 0]),
    },
    {
      nm: 'coin',
      shapes: [group('coin', [ellipse(22), fill(c.t(0.34)), stroke(c.ink, 3)], {p: kf([[0, [C, C - 92]], [28, [C, C - 92], EASE.in], [52, [C, BAR_Y - 14]], [LOOP, [C, BAR_Y - 14]]])})],
      p: st([0, 0, 0]),
      o: kf([[0, 100], [50, 100], [54, 0], [LOOP, 0]], false),
    },
  ])
}

/** A receipt: line items write themselves in, each gets its tax chip, then the total. */
function welcomeBills(c: Palette) {
  const widths = [46, 58, 38]
  return animation('welcome-bills', LOOP, [
    backdrop(c),
    {
      nm: 'receipt',
      shapes: [
        ...widths.map((w, i) => group('line', [rect(w, 7, 3.5), fill(c.t(0.34))], {p: st([C - 40, C - 34 + i * 24]), a: st([-w / 2, 0]), s: kf(drawKeys(14 + i * 14))})),
        ...widths.map((_, i) => group('chip', [rect(26, 12, 6), fill(i === 1 ? c.ink : c.t(0.54))], {p: st([C + 30, C - 34 + i * 24]), s: kf(popKeys(34 + i * 14))})),
        group('rule', [rect(84, 2.5, 1.25), fill(c.t(0.34))], {p: st([C - 42, C + 32]), a: st([-42, 0]), s: kf(drawKeys(70))}),
        group('total', [rect(74, 13, 6.5), fill(c.ink)], {p: st([C - 37, C + 48]), a: st([-37, 0]), s: kf(drawKeys(84))}),
        group('paper', [rect(108, 136, 12), fill(c.paper), stroke(c.ink, 4)], {p: st([C, C])}),
      ],
      p: st([0, 0, 0]),
    },
  ])
}

/** Settling up in fewest payments: one arrow draws from one friend to another, the third is settled with a check. */
function welcomeSettle(c: Palette) {
  const A = [C - 58, C - 30]
  const B = [C + 58, C - 30]
  const K = [C, C + 54]
  const dashed = (p: number[][]) => group('old', [pathShape(polyline(p)), stroke(c.ink, 3, st(30), [2, 8])])
  return animation('welcome-settle', LOOP, [
    backdrop(c),
    {
      nm: 'tangle',
      shapes: [dashed([[A[0]! + 10, A[1]! + 14], [K[0]! - 12, K[1]! - 12]]), dashed([[B[0]! - 10, B[1]! + 14], [K[0]! + 12, K[1]! - 12]])],
      p: st([0, 0, 0]),
      o: kf([[0, 100], [60, 100], [90, 0], [LOOP - 26, 0], [LOOP - 8, 100], [LOOP, 100]], false),
    },
    {
      nm: 'people',
      shapes: [
        group('a', [ellipse(38), fill(c.t(0.54))], {p: st(A)}),
        group('b', [ellipse(38), fill(c.t(0.34))], {p: st(B)}),
        group('k', [ellipse(38), fill(c.ink)], {p: st(K)}),
      ],
      p: st([0, 0, 0]),
    },
    {
      nm: 'payment',
      shapes: [
        group('line', [pathShape(polyline([[A[0]! + 24, A[1]!], [B[0]! - 26, B[1]!]])), stroke(c.ink, 5), trim(kf([[0, 0], [40, 0, EASE.out], [78, 100], [LOOP - 26, 100, EASE.in], [LOOP - 8, 0], [LOOP, 0]]))]),
        group('head', [pathShape(polyline([[B[0]! - 38, B[1]! - 10], [B[0]! - 26, B[1]!], [B[0]! - 38, B[1]! + 10]])), stroke(c.ink, 5)]),
      ],
      p: st([0, 0, 0]),
      o: kf([[0, 0], [70, 0], [78, 100], [LOOP - 26, 100], [LOOP - 8, 0], [LOOP, 0]], false),
    },
    {
      nm: 'done',
      shapes: [group('check', [pathShape(polyline([[-9, 1], [-2, 8], [10, -8]])), stroke(c.paper, 5)], {p: st(K), s: kf(popKeys(84))})],
      p: st([0, 0, 0]),
    },
  ])
}

/** Search and ask: a question types itself into the bar, the answer's chart grows. */
function welcomeAsk(c: Palette) {
  const heights = [28, 46, 64]
  return animation('welcome-ask', LOOP, [
    backdrop(c),
    {
      nm: 'bar',
      shapes: [
        group('lens', [ellipse(13), stroke(c.ink, 3)], {p: st([C - 62, C - 63])}),
        group('handle', [pathShape(polyline([[C - 55, C - 56], [C - 50, C - 51]])), stroke(c.ink, 3)]),
        group('typing', [rect(76, 6, 3), fill(c.t(0.34))], {p: st([C - 40, C - 62]), a: st([-38, 0]), s: kf(drawKeys(8))}),
        group('field', [rect(164, 34, 17), fill(c.paper), stroke(c.t(0.34), 3)], {p: st([C, C - 62])}),
      ],
      p: st([0, 0, 0]),
    },
    {
      nm: 'answer',
      shapes: [
        ...heights.map((h, i) => group('column', [rect(18, h, 4), fill(i === 2 ? c.ink : i === 1 ? c.t(0.54) : c.t(0.34))], {p: st([C - 28 + i * 28, C + 62]), a: st([0, h / 2]), s: kf(growKeys(60 + i * 14))})),
        group('bubble', [rect(164, 92, 14), fill(c.paper), stroke(c.t(0.34), 3)], {p: st([C, C + 30]), s: kf(popKeys(34))}),
      ],
      p: st([0, 0, 0]),
    },
  ])
}

/** Yours, offline: a phone that holds it all; the connection is struck out. */
function welcomeOffline(c: Palette) {
  const WX = C + 50
  const WY = C - 38
  /* A quarter of a circle round the dot, turned to point up: the circle's own centre is the anchor. */
  const arc = (r: number, t: number) =>
    group('arc', [pathShape(circlePath(r)), stroke(c.t(0.54), 4, kf([[0, 25], [t, 25], [t + 12, 100], [t + 40, 25], [LOOP, 25]], false)), trim(st(25))], {p: st([WX, WY + 10]), a: st([C, C]), r: st(-45)})
  return animation('welcome-offline', LOOP, [
    backdrop(c),
    {
      nm: 'wifi',
      shapes: [arc(12, 8), arc(24, 18), arc(36, 28), group('dot', [ellipse(7), fill(c.t(0.54))], {p: st([WX, WY + 10])})],
      p: st([0, 0, 0]),
    },
    {
      nm: 'strike',
      shapes: [group('slash', [pathShape(polyline([[WX - 26, WY - 20], [WX + 26, WY + 32]])), stroke(c.ink, 5), trim(kf([[0, 0], [64, 0, EASE.out], [84, 100], [LOOP - 26, 100, EASE.in], [LOOP - 8, 0], [LOOP, 0]]))])],
      p: st([0, 0, 0]),
    },
    {
      nm: 'phone',
      shapes: [
        group('notch', [rect(20, 4, 2), fill(c.t(0.34))], {p: st([C - 24, C - 46])}),
        group('tick', [pathShape(polyline([[-9, 0], [-2, 7], [10, -8]])), stroke(c.paper, 5)], {p: st([C - 24, C + 4]), s: kf(popKeys(26))}),
        group('badge', [ellipse(40), fill(c.ink)], {p: st([C - 24, C + 4]), s: kf(popKeys(18))}),
        group('bars', [rect(40, 6, 3), fill(c.t(0.34))], {p: st([C - 24, C + 44]), s: kf(drawKeys(36))}),
        group('body', [rect(72, 118, 14), fill(c.paper), stroke(c.ink, 4)], {p: st([C - 24, C + 6])}),
      ],
      p: st([0, 0, 0]),
    },
  ])
}


/* ---------- screen-specific empty states (F-260) ---------- */

/**
 * A Lucide glyph (ISC) as Lottie strokes: its `path` nodes, read from the installed
 * lucide-react-native icon file, scaled by `k` and centred on the layer origin.
 */
function lucide(name: string, c: Palette, k: number, w: number, color = c.ink, tint?: string) {
  const file = createRequire(import.meta.url).resolve(
    `lucide-react-native/icons/${name}`,
  )
  const src = readFileSync(file, 'utf8')
  const ds = [...src.matchAll(/\[\s*"path",\s*\{\s*d:\s*"([^"]+)"/g)].map(m => m[1]!)
  if (!ds.length) throw new Error(`lucide ${name}: no paths found`)
  const map = (p: Pt): Pt => [(p[0] - 12) * k, (p[1] - 12) * k]
  return ds.flatMap(d =>
    parsePath(d).map(sub =>
      group('glyph', [pathShape(toBezier(sub, map)), stroke(color, w * k), ...(tint ? [fill(tint, st(30))] : [])]),
    ),
  )
}

/** A speech bubble with a tail at the bottom left, centred on the origin. */
function bubble(w: number, h: number, bg: string, line: string, lineW = 5) {
  const [x, y] = [w / 2, h / 2]
  const tail = polyline([[-x + 22, y - 1], [-x + 16, y + 16], [-x + 40, y - 1]])
  return [
    group('tail', [pathShape(tail), stroke(line, lineW)]),
    group('body', [rect(w, h, 22), fill(bg), stroke(line, lineW)]),
  ]
}

/** Scale keys for something that pops in at `t`, holds, and leaves before the loop ends. */
const bob = (t: number, amp: number): Key[] => [
  [0, 0],
  [t, 0, EASE.out],
  [t + 14, -amp, EASE.inOut],
  [t + 30, 0],
  [LOOP, 0],
]

/** A lens sweeps over a card of rows and finds nothing. */
function emptySearch(c: Palette) {
  const rows = [-34, 0, 34].map(y =>
    group('row', [
      group('dot', [ellipse(14), fill(c.t(0.54))], {p: st([-50, 0])}),
      group('bar', [rect(y === 0 ? 70 : 92, 10, 5), fill(c.t(0.34))], {p: st([8, 0])}),
    ], {p: st([0, y])}),
  )
  return animation('empty-search', LOOP, [
    backdrop(c),
    cardLayer(c),
    {nm: 'rows', shapes: rows, p: st([C, C, 0])},
    {
      nm: 'lens',
      shapes: [
        group('handle', [pathShape(polyline([[17, 17], [36, 36]])), stroke(c.ink, 7)]),
        group('ring', [ellipse(50), stroke(c.ink, 7), fill(c.paper, st(55))]),
      ],
      p: kf(
        [
          [0, [C - 30, C - 24]],
          [60, [C + 22, C - 16]],
          [120, [C - 8, C + 18]],
          [LOOP, [C - 30, C - 24]],
        ],
        true,
      ),
    },
  ])
}

/** A funnel takes dots in at the top; nothing comes out. */
function emptyFilter(c: Palette) {
  const funnel = polyline([[-48, -36], [48, -36], [10, 6], [10, 44], [-10, 34], [-10, 6]])
  funnel.c = true
  const dots = [-22, 0, 22].map((x, i): Layer => {
    const t = 8 + i * 22
    return {
      nm: `dot-${i}`,
      shapes: [group('dot', [ellipse(12), fill(i === 1 ? c.ink : c.t(0.54))])],
      p: kf([[0, [C + x, C - 84]], [t, [C + x, C - 84], EASE.in], [t + 38, [C + x * 0.3, C - 20]], [LOOP, [C + x * 0.3, C - 20]]], true),
      o: kf([[0, 0], [t, 0], [t + 6, 100], [t + 30, 100], [t + 40, 0], [LOOP, 0]], false),
    }
  })
  return animation('empty-filter', LOOP, [
    backdrop(c),
    {
      nm: 'funnel',
      shapes: [
        group('outline', [pathShape(funnel), stroke(c.ink, 7), fill(c.t(0.34), st(30))]),
      ],
      p: st([C, C + 8, 0]),
    },
    ...dots,
    {
      nm: 'tray',
      shapes: [group('tray', [rect(56, 6, 3), fill(c.t(0.54), st(70))])],
      p: st([C, C + 66, 0]),
    },
  ])
}

/** A disc pops, its check draws, a ring pulses: everything is even. */
function emptySettled(c: Palette) {
  return animation('empty-settled', LOOP, [
    backdrop(c),
    {
      nm: 'ring',
      shapes: [
        group('ring', [
          ellipse(0, 0, [0, 0], kf([[34, [120, 120], EASE.out], [90, [200, 200]]])),
          stroke(c.t(0.54), 5, kf([[0, 0], [33, 0], [34, 80, EASE.out], [90, 0], [LOOP, 0]])),
        ]),
      ],
    },
    {
      nm: 'disc',
      shapes: [group('disc', [ellipse(116), fill(c.ink)], {s: kf(popKeys(0))})],
    },
    {
      nm: 'check',
      shapes: [
        group('check', [
          pathShape(polyline([[-24, 2], [-8, 18], [26, -16]])),
          trim(kf([[0, 0], [16, 0, EASE.out], [44, 100], [LOOP - 26, 100, EASE.in], [LOOP - 8, 0], [LOOP, 0]])),
          stroke(c.paper, 12),
        ]),
      ],
    },
  ])
}

/** A clock hand sweeps round and the past fills in as dots. */
function emptyHistory(c: Palette) {
  const dots = Array.from({length: 4}, (_, i) => {
    const a = (i / 4) * Math.PI * 2
    return group('mark', [ellipse(i === 0 ? 12 : 9), fill(i === 0 ? c.ink : c.t(0.54))], {
      p: st([Math.sin(a) * 50, -Math.cos(a) * 50]),
      s: kf(popKeys(10 + i * 14)),
    })
  })
  return animation('empty-history', LOOP, [
    backdrop(c),
    {
      nm: 'clock',
      shapes: [
        group('minute', [pathShape(polyline([[0, 0], [0, -38]])), stroke(c.ink, 7)], {
          r: kf([[0, 0, EASE.linear], [LOOP, 360]]),
        }),
        group('hour', [pathShape(polyline([[0, 0], [0, -24]])), stroke(c.t(0.54), 7)], {
          r: kf([[0, 0, EASE.linear], [LOOP, 30]]),
        }),
        group('hub', [ellipse(12), fill(c.ink)]),
        ...dots,
        group('face', [ellipse(116), fill(c.paper), stroke(c.t(0.34), 5)]),
      ],
      p: st([C, C, 0]),
    },
  ])
}

/** A receipt writes its lines; a plus badge pops: add the first expense. */
function emptyExpenses(c: Palette) {
  const widths = [60, 72, 48]
  return animation('empty-expenses', LOOP, [
    backdrop(c),
    {
      nm: 'receipt',
      shapes: [
        ...widths.map((w, i) =>
          group('line', [rect(w, 8, 4), fill(i === 2 ? c.t(0.54) : c.t(0.34))], {
            p: st([C - 46, C - 30 + i * 24]),
            a: st([-w / 2, 0]),
            s: kf(drawKeys(14 + i * 14)),
          }),
        ),
        group('paper', [rect(100, 130, 12), fill(c.paper), stroke(c.ink, 4)], {p: st([C - 6, C])}),
      ],
      p: st([0, 0, 0]),
    },
    {
      nm: 'badge',
      shapes: [
        group('plus', [pathShape(polyline([[-9, 0], [9, 0]])), stroke(c.paper, 5)]),
        group('plus-v', [pathShape(polyline([[0, -9], [0, 9]])), stroke(c.paper, 5)]),
        group('disc', [ellipse(38), fill(c.ink)]),
      ],
      p: st([C + 46, C + 40, 0]),
      s: kf(popKeys(66)),
    },
  ])
}

/** A pair of scales swings, then settles level: no balances yet. */
function emptyBalances(c: Palette) {
  const pan = (x: number) => [
    group('string', [pathShape(polyline([[x, -28], [x - 20, 8], [x + 20, 8], [x, -28]])), stroke(c.t(0.54), 3)]),
    group('pan', [rect(46, 8, 4), fill(c.ink)], {p: st([x, 10])}),
  ]
  return animation('empty-balances', LOOP, [
    backdrop(c),
    {
      nm: 'stand',
      shapes: [
        group('foot', [rect(70, 8, 4), fill(c.t(0.54))], {p: st([0, 52])}),
        group('post', [rect(8, 80, 4), fill(c.t(0.54))], {p: st([0, 12])}),
      ],
      p: st([C, C, 0]),
    },
    {
      nm: 'beam',
      shapes: [
        ...pan(-52),
        ...pan(52),
        group('bar', [rect(120, 7, 3.5), fill(c.ink)], {p: st([0, -28])}),
        group('pivot', [ellipse(14), fill(c.ink)], {p: st([0, -28])}),
      ],
      a: st([0, -28, 0]),
      p: st([C, C - 28, 0]),
      r: kf([[0, 0], [20, 0, EASE.out], [50, -10], [84, 8], [116, -4], [146, 0], [LOOP, 0]]),
    },
  ])
}

/** Two friends meet in the middle and the account closes: nothing to settle. */
function emptySettle(c: Palette) {
  const x = (from: number, to: number): Key[] => [
    [0, from], [40, from, EASE.out], [86, to], [130, to, EASE.in], [168, from], [LOOP, from],
  ]
  const side = (nm: string, color: string, from: number, to: number): Layer => ({
    nm,
    shapes: [group('person', person(color, 0.9), {a: st([0, 14])})],
    p: {s: true, x: kf(x(C + from, C + to)), y: st(C + 6)} as never,
  })
  return animation('empty-settle', LOOP, [
    backdrop(c),
    side('left', c.ink, -58, -24),
    side('right', c.t(0.54), 58, 24),
    {
      nm: 'seal',
      shapes: [
        group('check', [pathShape(polyline([[-9, 1], [-2, 8], [10, -8]])), stroke(c.paper, 5)]),
        group('disc', [ellipse(34), fill(c.ink)]),
      ],
      p: st([C, C - 46, 0]),
      s: kf(popKeys(84)),
    },
  ])
}

/** A bubble with three dots that take turns to bounce: nobody has said anything yet. */
function emptyFeedback(c: Palette) {
  const dots = [-24, 0, 24].map((x, i) =>
    group('dot', [ellipse(13), fill(i === 1 ? c.ink : c.t(0.54))], {
      p: kf([[0, [x, 0]], ...bob(14 + i * 10, 12).slice(1).map(([t, v]) => [t, [x, v as number]] as Key)]),
    }),
  )
  return animation('empty-feedback', LOOP, [
    backdrop(c),
    {
      nm: 'bubble',
      shapes: [...dots, ...bubble(132, 86, c.paper, c.ink)],
      p: st([C, C - 4, 0]),
    },
    {
      nm: 'heart',
      shapes: lucide('heart', c, 2.2, 2, c.ink),
      p: st([C + 54, C - 54, 0]),
      s: kf(popKeys(70)),
    },
  ])
}

/** Two links slide together: a link to invite someone. */
function emptyInvites(c: Palette) {
  const u = [Math.cos((-40 * Math.PI) / 180), Math.sin((-40 * Math.PI) / 180)]
  const at = (k: number, sign: number) => [C + sign * k * u[0]!, C + sign * k * u[1]!]
  const link = (nm: string, sign: number, color: string): Layer => ({
    nm,
    shapes: [group('link', [rect(76, 38, 19), stroke(color, 9)])],
    r: st(-40),
    p: kf(
      [
        [0, at(44, sign)],
        [50, at(44, sign), EASE.out],
        [90, at(18, sign)],
        [140, at(18, sign), EASE.in],
        [172, at(44, sign)],
        [LOOP, at(44, sign)],
      ],
      true,
    ),
  })
  return animation('empty-invites', LOOP, [
    backdrop(c),
    link('left', -1, c.ink),
    link('right', 1, c.t(0.54)),
  ])
}

/** A page with a question mark that drifts: not found. */
function emptyNotFound(c: Palette) {
  return animation('empty-not-found', LOOP, [
    backdrop(c),
    {
      nm: 'page',
      shapes: [
        ...lucide('circle-question-mark', c, 4.2, 2, c.ink),
        group('paper', [rect(104, 132, 14), fill(c.paper), stroke(c.t(0.34), 5)], {p: st([0, 0])}),
      ],
      p: kf([[0, [C, C]], [45, [C, C - 5]], [90, [C, C]], [135, [C, C - 5]], [LOOP, [C, C]]], true),
      r: kf([[0, 0], [45, 2.5], [90, 0], [135, -2.5], [LOOP, 0]]),
    },
  ])
}

/** A bubble with a sparkle: ask anything. */
function emptyAsk(c: Palette) {
  return animation('empty-ask', LOOP, [
    backdrop(c),
    {
      nm: 'bubble',
      shapes: bubble(136, 92, c.paper, c.ink),
      p: st([C, C + 4, 0]),
    },
    {
      nm: 'sparkle',
      shapes: lucide('sparkles', c, 3.4, 2, c.ink),
      p: st([C, C - 2, 0]),
      s: kf([[0, [100, 100]], [30, [100, 100], EASE.back], [48, [124, 124]], [78, [100, 100]], [110, [100, 100], EASE.back], [128, [124, 124]], [158, [100, 100]], [LOOP, [100, 100]]]),
      r: kf([[0, 0], [48, 8], [78, 0], [128, -8], [158, 0], [LOOP, 0]]),
    },
  ])
}

/** A shield draws itself and its check: no disputes. */
function emptyDisputes(c: Palette) {
  return animation('empty-disputes', LOOP, [
    backdrop(c),
    {
      nm: 'shield',
      shapes: [
        group('check', [pathShape(polyline([[-18, 0], [-6, 12], [20, -14]])), trim(kf(drawKeys(50).map(([t, v]) => [t, (v as number[])[0]!] as Key))), stroke(c.ink, 12)]),
        ...lucide('shield', c, 6, 2, c.ink, c.t(0.54)),
      ],
      p: st([C, C + 2, 0]),
    },
  ])
}

/** A note slides from one friend to the other: no payments yet. */
function emptyPayments(c: Palette) {
  const note = [
    group('coin', [ellipse(16), stroke(c.ink, 4)]),
    group('note', [rect(78, 46, 9), fill(c.t(0.34)), stroke(c.ink, 4)]),
  ]
  return animation('empty-payments', LOOP, [
    backdrop(c),
    {nm: 'left', shapes: [group('p', person(c.ink, 0.62), {a: st([0, 14])})], p: st([C - 74, C + 24, 0])},
    {nm: 'right', shapes: [group('p', person(c.t(0.54), 0.62), {a: st([0, 14])})], p: st([C + 74, C + 24, 0])},
    {
      nm: 'trail',
      shapes: [0, 1, 2].map(i => group('speed', [rect(24 - i * 6, 4, 2), fill(c.t(0.54))], {p: st([-52, -10 + i * 10])})),
      p: kf([[0, [C - 20, C - 20]], [30, [C - 20, C - 20], EASE.out], [90, [C + 50, C - 20]], [LOOP, [C + 50, C - 20]]], true),
      o: kf([[0, 0], [34, 0], [44, 80], [80, 80], [92, 0], [LOOP, 0]], false),
    },
    {
      nm: 'note',
      shapes: note,
      p: kf([[0, [C - 50, C - 20]], [30, [C - 50, C - 20], EASE.inOut], [90, [C + 18, C - 20]], [LOOP, [C + 18, C - 20]]], true),
      o: kf([[0, 0], [20, 0], [32, 100], [80, 100], [94, 0], [LOOP, 0]], false),
    },
  ])
}

/** Two bubbles answer each other: no comments. */
function emptyComments(c: Palette) {
  const dots = (x0: number, t: number, color: string) =>
    [-16, 0, 16].map((dx, i) => group('dot', [ellipse(9), fill(color)], {p: st([x0 + dx, 0]), s: kf(popKeys(t + i * 6))}))
  return animation('empty-comments', LOOP, [
    backdrop(c),
    {
      nm: 'one',
      shapes: [...dots(0, 28, c.paper), ...bubble(100, 60, c.ink, c.ink)],
      p: st([C - 22, C - 30, 0]),
      s: kf(popKeys(14)),
    },
    {
      nm: 'two',
      shapes: [...dots(0, 62, c.ink), ...bubble(100, 60, c.paper, c.ink)],
      p: st([C + 22, C + 34, 0]),
      s: kf(popKeys(48)),
    },
  ])
}

/** A bell swings and rings: no reminders. */
function emptyReminders(c: Palette) {
  const swing = (t: number): Key[] => [
    [t, 0, EASE.out], [t + 10, 16], [t + 22, -13], [t + 34, 9], [t + 46, -5], [t + 58, 0],
  ]
  return animation('empty-reminders', LOOP, [
    backdrop(c),
    {
      nm: 'bell',
      shapes: lucide('bell', c, 6, 2, c.ink),
      a: st([0, -34, 0]),
      p: st([C, C - 26, 0]),
      r: kf([[0, 0], ...swing(10), ...swing(100), [LOOP, 0]]),
    },
    {
      nm: 'ring',
      shapes: [
        group('ring', [
          ellipse(0, 0, [0, 0], kf([[12, [90, 90], EASE.out], [60, [150, 150]]])),
          stroke(c.t(0.54), 4, kf([[0, 0], [11, 0], [12, 70, EASE.out], [60, 0], [LOOP, 0]])),
        ]),
      ],
      p: st([C, C - 4, 0]),
    },
  ])
}

const BUILDERS = {
  loading,
  success,
  'empty-people': emptyPeople,
  'empty-groups': emptyGroups,
  'empty-activity': emptyActivity,
  'empty-analytics': emptyAnalytics,
  'empty-search': emptySearch,
  'empty-filter': emptyFilter,
  'empty-settled': emptySettled,
  'empty-history': emptyHistory,
  'empty-expenses': emptyExpenses,
  'empty-balances': emptyBalances,
  'empty-settle': emptySettle,
  'empty-feedback': emptyFeedback,
  'empty-invites': emptyInvites,
  'empty-not-found': emptyNotFound,
  'empty-ask': emptyAsk,
  'empty-disputes': emptyDisputes,
  'empty-payments': emptyPayments,
  'empty-comments': emptyComments,
  'empty-reminders': emptyReminders,
  'welcome-split': welcomeSplit,
  'welcome-bills': welcomeBills,
  'welcome-settle': welcomeSettle,
  'welcome-ask': welcomeAsk,
  'welcome-offline': welcomeOffline,
}
/** name -> {light, dark} Lottie JSON */
const ANIMATIONS = Object.fromEntries(
  Object.entries(BUILDERS).map(([name, build]) => [
    name,
    {light: build(VARIANTS.light), dark: build(VARIANTS.dark)},
  ]),
)

async function preview(dir: string) {
  const lottiePath = createRequire(import.meta.url).resolve(
    'lottie-web/build/player/lottie_light.min.js',
  )
  const browser = await chromium.launch({channel: 'chrome'})
  const page = await browser.newPage({deviceScaleFactor: 2})
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  const COLS = 8
  await page.setViewportSize({width: COLS * 130 + 20, height: 100})
  await page.setContent(
    '<!doctype html><html><body style="margin:0;font:12px system-ui"></body></html>',
  )
  await page.addScriptTag({path: lottiePath})
  for (const [name, variants] of Object.entries(ANIMATIONS)) {
    const frames = Array.from({length: COLS}, (_, i) =>
      Math.round((i * (variants.light.op - 1)) / (COLS - 1)),
    )
    await page.evaluate(
      ({variants, frames}) => {
        document.body.innerHTML = ''
        for (const [bg, data] of [
          ['#ffffff', variants.light],
          ['#000000', variants.dark],
        ] as const) {
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
      {variants, frames},
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
for (const [name, {light, dark}] of Object.entries(ANIMATIONS)) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(light))
  writeFileSync(join(OUT, `${name}-dark.json`), JSON.stringify(dark))
  console.log(
    `assets/lottie/${name}{,-dark}.json ${(light.op / FPS).toFixed(1)}s`,
  )
}
if (process.argv[2]) await preview(process.argv[2])
