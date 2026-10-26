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
const MARK = readFileSync(join(ROOT, 'assets/brand/mark.svg'), 'utf8')

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

/** A coin hops between two friends and back, flipping as it goes. 3 s loop. */
function emptyPeople(c: Palette) {
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
    backdrop(c),
    {
      nm: 'friend-left',
      shapes: [
        group('person', person(c.ink), {
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
        group('person', person(c.t(0.54)), {
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
          [ellipse(30), fill(c.t(0.34)), ellipse(16), stroke(c.ink, 3.5)],
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
    {
      nm: 'card',
      shapes: [
        group('card', [
          rect(148, 148, 22),
          fill(c.ink, st(10)),
          stroke(c.t(0.74), 3, st(70)),
        ]),
      ],
    },
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
    {
      nm: 'card',
      shapes: [
        group('card', [
          rect(148, 148, 22),
          fill(c.ink, st(10)),
          stroke(c.t(0.74), 3, st(70)),
        ]),
      ],
    },
    {
      nm: 'baseline',
      shapes: [
        group('line', [rect(112, 3, 1.5, [0, BASE - C + 2]), fill(c.t(0.34))]),
      ],
    },
    ...bars,
  ])
}

const BUILDERS = {
  loading,
  success,
  'empty-people': emptyPeople,
  'empty-groups': emptyGroups,
  'empty-activity': emptyActivity,
  'empty-analytics': emptyAnalytics,
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
