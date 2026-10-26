import {useState} from 'react'
import {View} from 'react-native'
import Svg, {Circle, Path} from 'react-native-svg'
import {formatAmount} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {Pressable} from '#/components/Pressable'
import {fraction, percentOf} from '#/components/charts/scale'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'

export type Slice = {
  key: string
  value: bigint
  /** The entity's own colour (a category's), so a filter never repaints survivors. */
  color: string
  label: string
}

const RING = 18
/** Surface gap between neighbouring slices, in px along the ring. */
const GAP = 2
const tabular = {fontVariant: ['tabular-nums' as const]}

function arc(c: number, r: number, from: number, to: number) {
  const p = (ang: number) => `${c + r * Math.cos(ang)},${c + r * Math.sin(ang)}`
  const large = to - from > Math.PI ? 1 : 0
  return `M${p(from)} A${r},${r} 0 ${large} 1 ${p(to)}`
}

/**
 * Parts of a whole: a thin ring with a 2px surface gap between slices, the
 * total (or the selected slice) in the middle, and a legend that names every
 * slice with its share and amount, so identity never rests on colour alone.
 * Slices and legend rows select; selecting dims the rest.
 */
export function DonutChart({
  slices,
  total,
  caption,
  currency,
  locale,
  selectedKey,
  onSelect,
  size = 184,
  isWide = false,
  testID,
}: {
  slices: Slice[]
  total: bigint
  caption: string
  currency: string
  locale: string
  selectedKey?: string
  onSelect?: (key: string | null) => void
  size?: number
  /** Legend beside the ring instead of under it. */
  isWide?: boolean
  testID: string
}) {
  const t = useTheme()
  const [hoverKey, setHoverKey] = useState<string>()
  const c = size / 2
  const r = c - RING / 2
  const gap = slices.length > 1 ? GAP / r : 0
  const pct = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })

  let angle = -Math.PI / 2
  const arcs = slices.map(s => {
    const sweep = fraction(s.value, total) * Math.PI * 2
    const from = angle + gap / 2
    const to = angle + sweep - gap / 2
    angle += sweep
    return {s, from, to}
  })
  const focus = slices.find(s => s.key === (hoverKey ?? selectedKey))
  const isDimmed = (key: string) =>
    (selectedKey !== undefined && key !== selectedKey) ||
    (selectedKey === undefined && hoverKey !== undefined && key !== hoverKey)
  const select = (key: string) => onSelect?.(key === selectedKey ? null : key)

  return (
    <View
      testID={testID}
      style={[
        isWide ? [a.flex_row, a.align_center, a.gap_2xl] : a.gap_lg,
        a.w_full,
      ]}>
      <View style={[a.self_center, {width: size, height: size}]}>
        <Svg width={size} height={size}>
          {slices.length === 1 ? (
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke={slices[0]!.color}
              strokeWidth={RING}
              fill="none"
              onPress={() => select(slices[0]!.key)}
            />
          ) : (
            arcs.map(({s, from, to}) =>
              to > from ? (
                <Path
                  key={s.key}
                  d={arc(c, r, from, to)}
                  stroke={s.color}
                  strokeWidth={RING}
                  fill="none"
                  opacity={isDimmed(s.key) ? 0.25 : 1}
                  onPress={() => select(s.key)}
                />
              ) : null,
            )
          )}
        </Svg>
        <View
          pointerEvents="none"
          style={[
            a.absolute,
            a.inset_0,
            a.align_center,
            a.justify_center,
            a.px_2xl,
          ]}>
          <AnimatedAmount
            testID={`${testID}-center`}
            minor={focus ? focus.value : total}
            currency={currency}
            locale={locale}
            style={[a.text_lg, a.font_bold, a.text_center]}
          />
          <Text
            numberOfLines={1}
            style={[
              a.text_xs,
              a.text_center,
              a.pt_2xs,
              t.atoms.text_contrast_medium,
            ]}>
            {focus ? focus.label : caption}
          </Text>
        </View>
      </View>
      <View style={[a.flex_1, a.w_full]} role="list">
        {slices.map(s => {
          const isSelected = s.key === selectedKey
          return (
            <Pressable
              key={s.key}
              testID={`${testID}-${s.key}`}
              role="listitem"
              accessibilityRole="button"
              accessibilityLabel={`${s.label}: ${formatAmount(s.value, currency, locale)}, ${pct.format(percentOf(s.value, total) / 100)}`}
              accessibilityHint=""
              accessibilityState={{selected: isSelected}}
              onPress={() => select(s.key)}
              onHoverIn={() => setHoverKey(s.key)}
              onHoverOut={() => setHoverKey(undefined)}
              style={({hovered, focused}) => [
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.px_sm,
                a.rounded_sm,
                {minHeight: 36},
                (hovered || focused || isSelected) && t.atoms.bg_contrast_25,
                {opacity: isDimmed(s.key) ? 0.55 : 1},
              ]}>
              <View
                style={[
                  {width: 10, height: 10, borderRadius: 3},
                  {backgroundColor: s.color},
                ]}
              />
              <Text
                numberOfLines={1}
                style={[a.flex_1, a.text_sm, a.font_medium, t.atoms.text]}>
                {s.label}
              </Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium, tabular]}>
                {pct.format(percentOf(s.value, total) / 100)}
              </Text>
              <Text
                testID={`${testID}-${s.key}-amount`}
                style={[
                  a.text_sm,
                  a.font_semi_bold,
                  a.text_right,
                  tabular,
                  {minWidth: 96},
                ]}>
                {formatAmount(s.value, currency, locale)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
