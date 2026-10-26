import {useState} from 'react'
import {View} from 'react-native'
import Svg, {Circle, Line, Path} from 'react-native-svg'
import {axisTicks, ZERO} from '@splito/domain'

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

/**
 * One signed series over time: a 2px line, a 10% wash down to zero, and an
 * end dot with a surface ring. Hover or focus moves a crosshair to the
 * nearest point and shows its value. `format` words the value (the balance
 * line says who owes whom rather than showing a sign).
 */
export function LineChart({
  points,
  currency,
  locale,
  format,
  height = 200,
  testID,
}: {
  points: Point[]
  currency: string
  locale: string
  format: (v: bigint) => string
  height?: number
  testID: string
}) {
  const t = useTheme()
  const [width, onLayout] = useWidth()
  const [hoverKey, setHoverKey] = useState<string>()
  const values = points.map(p => p.value)
  const lo = values.reduce((m, v) => (v < m ? v : m), ZERO)
  const hi = values.reduce((m, v) => (v > m ? v : m), ZERO)
  const ticks = axisTicks(lo, hi)
  const {gutter, labels, slot, bottom, y, cx} = frame(
    width,
    height,
    ticks,
    points.length,
    currency,
    locale,
  )
  const color = t.palette.primary_500

  const xy = points.map((p, i) => [cx(i), y(p.value)] as const)
  const line = xy.map(([x, yy], i) => `${i ? 'L' : 'M'}${x},${yy}`).join(' ')
  const zero = y(ZERO)
  const area =
    xy.length > 1
      ? `${line} L${xy.at(-1)![0]},${zero} L${xy[0]![0]},${zero} Z`
      : ''
  const activeIndex = points.findIndex(p => p.key === hoverKey)
  const active = points[activeIndex]
  const last = xy.at(-1)

  return (
    <View testID={testID} style={[a.w_full, {height}]} onLayout={onLayout}>
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={a.absolute}>
            <Grid ticks={ticks} width={width} gutter={gutter} y={y} />
            {area ? <Path d={area} fill={color} opacity={0.1} /> : null}
            <Path
              d={line}
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
            {active && (
              <Line
                x1={cx(activeIndex)}
                x2={cx(activeIndex)}
                y1={0}
                y2={bottom}
                stroke={t.palette.contrast_300}
                strokeWidth={1}
              />
            )}
            {(active ? [xy[activeIndex]!] : last ? [last] : []).map(
              ([x, yy]) => (
                <Circle
                  key="dot"
                  cx={x}
                  cy={yy}
                  r={5}
                  fill={color}
                  stroke={t.atoms.bg.backgroundColor}
                  strokeWidth={2}
                />
              ),
            )}
          </Svg>
          <YLabels ticks={ticks} labels={labels} gutter={gutter} y={y} />
          <XLabels points={points} slot={slot} cx={cx} bottom={bottom} />
          <HitColumns
            testID={`${testID}-point`}
            points={points}
            gutter={gutter}
            slot={slot}
            bottom={bottom}
            selectedKey={undefined}
            describe={p => `${p.label}: ${format(p.value)}`}
            onActive={setHoverKey}
          />
          {active && (
            <Tooltip
              testID={`${testID}-tooltip`}
              x={cx(activeIndex)}
              y={y(active.value)}
              width={width}
              value={format(active.value)}
              label={active.label}
            />
          )}
        </>
      )}
    </View>
  )
}
