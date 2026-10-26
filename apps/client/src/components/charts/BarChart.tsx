import {useEffect, useState} from 'react'
import {View} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, {Path} from 'react-native-svg'
import {axisTicks, formatAmount, ZERO} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {
  frame,
  Grid,
  HitColumns,
  type Point,
  Tooltip,
  XLabels,
  YLabels,
} from '#/components/charts/Cartesian'
import {useWidth} from '#/components/charts/scale'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/** Thin marks: never wider than this, whatever the slot. */
const MAX_BAR = 24
const RADIUS = 4

/** A bar with a rounded data end and a square foot on the baseline. */
function barPath(x: number, w: number, top: number, base: number) {
  const h = base - top
  if (h <= 0) return ''
  const r = Math.min(RADIUS, w / 2, h)
  return [
    `M${x},${base}`,
    `L${x},${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `L${x + w - r},${top}`,
    `Q${x + w},${top} ${x + w},${top + r}`,
    `L${x + w},${base}`,
    'Z',
  ].join(' ')
}

/**
 * Columns over time, one series, from a single baseline. Hover or focus shows
 * a tooltip; pressing a bar selects it (the caller filters by it) and the
 * other bars step back. Bars rise from the baseline when the data changes.
 */
export function BarChart({
  points,
  currency,
  locale,
  selectedKey,
  onSelect,
  height = 220,
  testID,
}: {
  points: Point[]
  currency: string
  locale: string
  selectedKey?: string
  onSelect?: (key: string | null) => void
  height?: number
  testID: string
}) {
  const t = useTheme()
  const [width, onLayout] = useWidth()
  const [hoverKey, setHoverKey] = useState<string>()
  const shouldReduceMotion = useShouldReduceMotion()
  const max = points.reduce((m, p) => (p.value > m ? p.value : m), ZERO)
  const ticks = axisTicks(ZERO, max)
  const {gutter, labels, slot, bottom, y, cx} = frame(
    width,
    height,
    ticks,
    points.length,
    currency,
    locale,
  )
  const barW = Math.max(2, Math.min(MAX_BAR, slot * 0.62))

  /* Bars grow from the baseline: scale about the centre, then shift down by the lost half. */
  const signature = points.map(p => `${p.key}:${p.value}`).join(',')
  const progress = useSharedValue(1)
  useEffect(() => {
    if (shouldReduceMotion) {
      progress.set(1)
      return
    }
    progress.set(0)
    progress.set(
      withTiming(1, {duration: 450, easing: Easing.out(Easing.cubic)}),
    )
  }, [signature, shouldReduceMotion, progress])
  const growStyle = useAnimatedStyle(() => ({
    transform: [
      {translateY: ((1 - progress.get()) * bottom) / 2},
      {scaleY: Math.max(progress.get(), 0.001)},
    ],
  }))

  const activeKey = hoverKey ?? selectedKey
  const activeIndex = points.findIndex(p => p.key === activeKey)
  const active = points[activeIndex]
  const hasSelection = selectedKey !== undefined

  return (
    <View testID={testID} style={[a.w_full, {height}]} onLayout={onLayout}>
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={a.absolute}>
            <Grid ticks={ticks} width={width} gutter={gutter} y={y} />
          </Svg>
          <Animated.View
            style={[
              a.absolute,
              {left: 0, top: 0, width, height: bottom},
              growStyle,
            ]}
            pointerEvents="none">
            <Svg width={width} height={bottom}>
              {points.map((p, i) => (
                <Path
                  key={p.key}
                  d={barPath(cx(i) - barW / 2, barW, y(p.value), y(ZERO))}
                  fill={t.palette.primary_500}
                  opacity={
                    hasSelection && p.key !== selectedKey
                      ? 0.3
                      : p.key === hoverKey && !hasSelection
                        ? 0.85
                        : 1
                  }
                />
              ))}
            </Svg>
          </Animated.View>
          <YLabels ticks={ticks} labels={labels} gutter={gutter} y={y} />
          <XLabels points={points} slot={slot} cx={cx} bottom={bottom} />
          <HitColumns
            testID={`${testID}-bar`}
            points={points}
            gutter={gutter}
            slot={slot}
            bottom={bottom}
            selectedKey={selectedKey}
            describe={p =>
              `${p.label}: ${formatAmount(p.value, currency, locale)}`
            }
            onActive={setHoverKey}
            onSelect={onSelect}
          />
          {active && (
            <Tooltip
              testID={`${testID}-tooltip`}
              x={cx(activeIndex)}
              y={y(active.value)}
              width={width}
              value={formatAmount(active.value, currency, locale)}
              label={active.label}
            />
          )}
        </>
      )}
    </View>
  )
}
