import {useState} from 'react'
import {View} from 'react-native'
import {Line} from 'react-native-svg'
import {formatAmountCompact, ZERO} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {Pressable} from '#/components/Pressable'
import {fractionBetween} from '#/components/charts/scale'
import {Text} from '#/components/Typography'

/** Room under the plot for the time labels. */
export const X_AXIS = 28
/** Room above the highest tick, so its label is not clipped. */
export const PAD_TOP = 10

const tabular = {fontVariant: ['tabular-nums' as const]}
const LABEL_HEIGHT = 16

export type Point = {
  key: string
  value: bigint
  /** Short label under the axis ("Mar", "26"). */
  axisLabel: string
  /** Full label for tooltips and screen readers ("March 2026"). */
  label: string
  /** Splito: the bucket that holds today, drawn strongest. */
  isCurrent?: boolean
  /** Splito: a bucket still in the future, labelled faintly. */
  isFuture?: boolean
}

/** Approximate width of one `text_xs` character, for sizing the value gutter before layout. */
const CHAR_W = 6.6

/**
 * Pixel geometry shared by the bar and line charts. Ticks are bigint minor
 * units, lowest first. The left gutter grows to fit the longest tick label
 * ("₹30K", "₹30 हज़ार"), so labels are never clipped.
 */
export function frame(
  width: number,
  height: number,
  ticks: bigint[],
  n: number,
  currency: string,
  locale: string,
) {
  const lo = ticks[0]!
  const hi = ticks.at(-1)!
  const labels = ticks.map(tick => formatAmountCompact(tick, currency, locale))
  const longest = labels.reduce((m, l) => Math.max(m, l.length), 0)
  const gutter = Math.min(96, Math.max(40, Math.ceil(longest * CHAR_W) + 14))
  const plotW = Math.max(0, width - gutter)
  const bottom = height - X_AXIS
  const plotH = bottom - PAD_TOP
  const slot = n > 0 ? plotW / n : 0
  return {
    gutter,
    labels,
    plotW,
    plotH,
    bottom,
    slot,
    y: (v: bigint) => PAD_TOP + (1 - fractionBetween(v, lo, hi)) * plotH,
    cx: (i: number) => gutter + slot * (i + 0.5),
  }
}

/** Hairline grid (solid, one step off the surface) plus a stronger zero line. */
export function Grid({
  ticks,
  width,
  gutter,
  y,
}: {
  ticks: bigint[]
  width: number
  gutter: number
  y: (v: bigint) => number
}) {
  const t = useTheme()
  return (
    <>
      {ticks.map(tick => (
        <Line
          key={tick.toString()}
          x1={gutter}
          x2={width}
          y1={Math.round(y(tick)) + 0.5}
          y2={Math.round(y(tick)) + 0.5}
          stroke={
            tick === ZERO ? t.palette.contrast_200 : t.palette.contrast_50
          }
          strokeWidth={1}
        />
      ))}
    </>
  )
}

/** Compact value labels in the left gutter, right-aligned to the plot. */
export function YLabels({
  ticks,
  labels,
  gutter,
  y,
}: {
  ticks: bigint[]
  labels: string[]
  gutter: number
  y: (v: bigint) => number
}) {
  const t = useTheme()
  return (
    <>
      {ticks.map((tick, i) => (
        <Text
          key={tick.toString()}
          numberOfLines={1}
          aria-hidden
          style={[
            a.absolute,
            a.text_xs,
            a.text_right,
            t.atoms.text_contrast_low,
            tabular,
            {
              left: 0,
              width: gutter - 10,
              top: y(tick) - LABEL_HEIGHT / 2,
              lineHeight: LABEL_HEIGHT,
            },
          ]}>
          {labels[i]}
        </Text>
      ))}
    </>
  )
}

/** Labels under the plot; every few are skipped when they would collide. */
export function XLabels({
  points,
  slot,
  cx,
  bottom,
}: {
  points: Point[]
  slot: number
  cx: (i: number) => number
  bottom: number
}) {
  const t = useTheme()
  const plotW = slot * points.length
  const fit = Math.max(1, Math.floor(plotW / 36))
  const every = Math.ceil(points.length / fit)
  const w = slot * every
  /* Labels step from the first bucket, so the axis always starts labelled; "now" also has its dot. */
  const anchor = 0
  return (
    <>
      {points.map((p, i) =>
        (i - anchor) % every === 0 ? (
          <Text
            key={p.key}
            numberOfLines={1}
            aria-hidden
            style={[
              a.absolute,
              a.text_xs,
              a.text_center,
              p.isCurrent
                ? [a.font_semi_bold, {color: t.palette.primary_500}]
                : p.isFuture
                  ? t.atoms.text_contrast_low
                  : t.atoms.text_contrast_medium,
              {
                left: cx(i) - w / 2,
                width: w,
                top: bottom + 8,
                lineHeight: LABEL_HEIGHT,
              },
            ]}>
            {p.axisLabel}
          </Text>
        ) : null,
      )}
    </>
  )
}

/**
 * One pressable column per point, the full slot wide and the plot tall: the
 * hit target is bigger than the mark. Hover and focus show the tooltip; a
 * press selects (and a second press clears).
 */
export function HitColumns({
  points,
  gutter,
  slot,
  bottom,
  selectedKey,
  describe,
  onActive,
  onSelect,
  testID,
}: {
  points: Point[]
  gutter: number
  slot: number
  bottom: number
  selectedKey: string | undefined
  describe: (p: Point) => string
  /** The hovered or focused point; a state setter, so leaving one column never clears its neighbour. */
  onActive: React.Dispatch<React.SetStateAction<string | undefined>>
  onSelect?: (key: string | null) => void
  testID: string
}) {
  return (
    <>
      {points.map((p, i) => {
        const isSelected = p.key === selectedKey
        return (
          <Pressable
            key={p.key}
            testID={`${testID}-${p.key}`}
            accessibilityRole={onSelect ? 'button' : 'text'}
            accessibilityLabel={describe(p)}
            accessibilityHint=""
            accessibilityState={onSelect ? {selected: isSelected} : undefined}
            disabled={!onSelect}
            onPress={() => onSelect?.(isSelected ? null : p.key)}
            onHoverIn={() => onActive(p.key)}
            onHoverOut={() => onActive(k => (k === p.key ? undefined : k))}
            onFocus={() => onActive(p.key)}
            onBlur={() => onActive(k => (k === p.key ? undefined : k))}
            style={[
              a.absolute,
              {left: gutter + slot * i, width: slot, top: 0, height: bottom},
            ]}
          />
        )
      })}
    </>
  )
}

/** The value of the mark under the pointer: value first, label second. Clamped inside the chart. */
export function Tooltip({
  x,
  y,
  width,
  value,
  label,
  testID,
}: {
  x: number
  y: number
  width: number
  value: string
  label: string
  testID?: string
}) {
  const t = useTheme()
  const [size, setSize] = useState({w: 0, h: 0})
  const left = Math.max(0, Math.min(width - size.w, x - size.w / 2))
  const top = Math.max(0, y - size.h - 10)
  return (
    <View
      testID={testID}
      pointerEvents="none"
      onLayout={e =>
        setSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
      style={[
        a.absolute,
        a.px_sm,
        a.py_xs,
        a.rounded_sm,
        a.border,
        t.atoms.bg,
        t.atoms.border_contrast_low,
        t.atoms.shadow_md,
        {left, top, opacity: size.w === 0 ? 0 : 1},
      ]}>
      <Text style={[a.text_sm, a.font_semi_bold, a.leading_snug, tabular]}>
        {value}
      </Text>
      <Text style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
        {label}
      </Text>
    </View>
  )
}
