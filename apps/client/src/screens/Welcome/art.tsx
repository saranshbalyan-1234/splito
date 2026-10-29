import Svg, {Circle, G, Line, Path, Rect} from 'react-native-svg'

import {useTheme} from '#/alf'

/*
 * The intro slides' original static art (F-249): flat shapes in the theme's own colours, so it follows the accent and
 * the light and dark themes with no per-theme files. Drawn on a 240 x 160 board; decorative, hidden from screen
 * readers (the title and sentence carry the meaning). ponytail: static; swap for Lottie (`pnpm lottie`) when motion is wanted.
 */
const W = 240
const H = 160

function useInk() {
  const t = useTheme()
  const p = t.palette
  return {
    base: p.contrast_50,
    line: p.contrast_200,
    mute: p.contrast_400,
    strong: p.contrast_700,
    main: p.primary_500,
    soft: p.primary_300,
    tint: p.primary_100,
    paper: t.atoms.bg.backgroundColor as string,
  }
}

function Board({children}: {children: React.ReactNode}) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} aria-hidden>
      {children}
    </Svg>
  )
}

function Person({x, color, paper}: {x: number; color: string; paper: string}) {
  return (
    <G>
      <Circle cx={x} cy={44} r={14} fill={color} />
      <Path d={`M${x - 22} 84 a22 22 0 0 1 44 0 z`} fill={color} />
      <Circle cx={x} cy={44} r={14} stroke={paper} strokeWidth={3} fill={color} />
    </G>
  )
}

/** Split anything with anyone: three people and one bill cut into equal shares. */
export function SplitArt() {
  const c = useInk()
  return (
    <Board>
      <Rect x={20} y={14} width={200} height={132} rx={18} fill={c.base} />
      <Person x={60} color={c.main} paper={c.base} />
      <Person x={120} color={c.soft} paper={c.base} />
      <Person x={180} color={c.mute} paper={c.base} />
      <Rect x={40} y={104} width={160} height={14} rx={7} fill={c.line} />
      <Path d="M47 104h46v14H47a7 7 0 0 1 0-14z" fill={c.main} />
      <Rect x={94} y={104} width={52} height={14} fill={c.soft} />
      <Path d="M147 104h46a7 7 0 0 1 0 14h-46z" fill={c.mute} />
      <Line x1={94} y1={100} x2={94} y2={122} stroke={c.base} strokeWidth={3} />
      <Line x1={146} y1={100} x2={146} y2={122} stroke={c.base} strokeWidth={3} />
    </Board>
  )
}

/** Bills done right: a receipt with line items, a tax chip per line and a total. */
export function BillArt() {
  const c = useInk()
  return (
    <Board>
      <Rect x={20} y={14} width={200} height={132} rx={18} fill={c.base} />
      <Path d="M70 22h100v110l-10-7-10 7-10-7-10 7-10-7-10 7-10-7-10 7-10-7-10 7z" fill={c.paper} stroke={c.line} strokeWidth={2} />
      {[40, 58, 76].map((y, i) => (
        <G key={y}>
          <Rect x={82} y={y} width={[40, 52, 34][i]} height={7} rx={3.5} fill={c.line} />
          <Rect x={132} y={y - 2} width={26} height={11} rx={5.5} fill={i === 1 ? c.main : c.tint} />
        </G>
      ))}
      <Line x1={82} y1={96} x2={158} y2={96} stroke={c.line} strokeWidth={2} strokeDasharray="4 4" />
      <Rect x={82} y={104} width={30} height={9} rx={4.5} fill={c.strong} />
      <Rect x={124} y={102} width={34} height={13} rx={6.5} fill={c.main} />
    </Board>
  )
}

function Node({x, y, color}: {x: number; y: number; color: string}) {
  return (
    <G>
      <Circle cx={x} cy={y} r={16} fill={color} />
    </G>
  )
}

/** Settle up in the fewest payments: from a tangle to one clean line. */
export function SettleArt() {
  const c = useInk()
  return (
    <Board>
      <Rect x={20} y={14} width={200} height={132} rx={18} fill={c.base} />
      <Node x={64} y={52} color={c.mute} />
      <Node x={176} y={52} color={c.soft} />
      <Node x={120} y={112} color={c.main} />
      <Path d="M82 52h76" stroke={c.main} strokeWidth={4} strokeLinecap="round" />
      <Path d="M150 44l10 8-10 8" stroke={c.main} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M70 69l36 30" stroke={c.line} strokeWidth={3} strokeLinecap="round" strokeDasharray="2 7" />
      <Path d="M170 69l-36 30" stroke={c.line} strokeWidth={3} strokeLinecap="round" strokeDasharray="2 7" />
      <Circle cx={120} cy={112} r={7} fill={c.paper} />
      <Path d="M116 112l3 3 5-6" stroke={c.main} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Board>
  )
}

/** Search or ask anything: a search bar and an answer with a small chart. */
export function AskArt() {
  const c = useInk()
  return (
    <Board>
      <Rect x={20} y={14} width={200} height={132} rx={18} fill={c.base} />
      <Rect x={38} y={28} width={164} height={28} rx={14} fill={c.paper} stroke={c.line} strokeWidth={2} />
      <Circle cx={56} cy={42} r={6} stroke={c.strong} strokeWidth={2.5} fill="none" />
      <Line x1={60.5} y1={46.5} x2={65} y2={51} stroke={c.strong} strokeWidth={2.5} strokeLinecap="round" />
      <Rect x={76} y={39} width={74} height={6} rx={3} fill={c.line} />
      <Path d="M38 76a12 12 0 0 1 12-12h116a12 12 0 0 1 12 12v44a12 12 0 0 1-12 12H62l-12 10v-10a12 12 0 0 1-12-12z" fill={c.paper} stroke={c.line} strokeWidth={2} />
      <Rect x={56} y={106} width={14} height={14} rx={3} fill={c.tint} />
      <Rect x={76} y={94} width={14} height={26} rx={3} fill={c.soft} />
      <Rect x={96} y={80} width={14} height={40} rx={3} fill={c.main} />
      <Rect x={122} y={84} width={32} height={6} rx={3} fill={c.line} />
      <Rect x={122} y={98} width={24} height={6} rx={3} fill={c.line} />
    </Board>
  )
}

/** Yours, offline: a phone that holds everything, with the connection struck out. */
export function OfflineArt() {
  const c = useInk()
  return (
    <Board>
      <Rect x={20} y={14} width={200} height={132} rx={18} fill={c.base} />
      <Rect x={92} y={26} width={56} height={108} rx={12} fill={c.paper} stroke={c.strong} strokeWidth={3} />
      <Rect x={110} y={32} width={20} height={4} rx={2} fill={c.line} />
      <Circle cx={120} cy={80} r={17} fill={c.main} />
      <Path d="M112 80l6 6 11-12" stroke={c.paper} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x={102} y={108} width={36} height={6} rx={3} fill={c.line} />
      <Path d="M170 62a28 28 0 0 1 28 0M177 72a17 17 0 0 1 14 0" stroke={c.mute} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Circle cx={184} cy={82} r={3} fill={c.mute} />
      <Line x1={166} y1={52} x2={202} y2={90} stroke={c.main} strokeWidth={4} strokeLinecap="round" />
    </Board>
  )
}

export const SLIDE_ART = [SplitArt, BillArt, SettleArt, AskArt, OfflineArt] as const
