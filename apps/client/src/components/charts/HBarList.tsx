import {View} from 'react-native'
import {formatAmount} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {Pressable} from '#/components/Pressable'
import {fraction} from '#/components/charts/scale'
import {Text} from '#/components/Typography'

export type HBar = {
  key: string
  value: bigint
  label: string
  /** Shown before the label, e.g. an avatar. */
  leading?: React.ReactNode
  /** Bar colour; defaults to the primary blue. */
  color?: string
}

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * Ranked horizontal bars: label and value on one line, a thin bar under it
 * scaled to the largest row. Rows are buttons when `onSelect` is given;
 * selecting dims the others.
 */
export function HBarList({
  bars,
  currency,
  locale,
  selectedKey,
  onSelect,
  testID,
}: {
  bars: HBar[]
  currency: string
  locale: string
  selectedKey?: string
  onSelect?: (key: string | null) => void
  testID: string
}) {
  const t = useTheme()
  const max = bars.reduce((m, b) => (b.value > m ? b.value : m), 0n)
  return (
    <View testID={testID} role="list" style={a.gap_2xs}>
      {bars.map(b => {
        const isSelected = b.key === selectedKey
        const isDimmed = selectedKey !== undefined && !isSelected
        const amount = formatAmount(b.value, currency, locale)
        return (
          <Pressable
            key={b.key}
            testID={`${testID}-${b.label}`}
            role="listitem"
            accessibilityRole={onSelect ? 'button' : 'text'}
            accessibilityLabel={`${b.label}: ${amount}`}
            accessibilityHint=""
            accessibilityState={onSelect ? {selected: isSelected} : undefined}
            disabled={!onSelect}
            onPress={() => onSelect?.(isSelected ? null : b.key)}
            style={({hovered, focused}) => [
              a.px_sm,
              a.py_sm,
              a.gap_xs,
              a.rounded_sm,
              onSelect &&
                (hovered || focused || isSelected) &&
                t.atoms.bg_contrast_25,
              {opacity: isDimmed ? 0.55 : 1},
            ]}>
            <View style={[a.flex_row, a.align_center, a.gap_sm]}>
              {b.leading}
              <Text
                numberOfLines={1}
                style={[a.flex_1, a.text_sm, a.font_medium, t.atoms.text]}>
                {b.label}
              </Text>
              <Text
                testID={`${testID}-${b.label}-amount`}
                style={[a.text_sm, a.font_semi_bold, tabular]}>
                {amount}
              </Text>
            </View>
            <View
              style={[
                a.w_full,
                a.rounded_full,
                a.overflow_hidden,
                t.atoms.bg_contrast_50,
                {height: 6},
              ]}>
              <View
                style={[
                  a.h_full,
                  a.rounded_full,
                  {
                    width: `${fraction(b.value, max) * 100}%`,
                    backgroundColor: b.color ?? t.palette.primary_500,
                  },
                ]}
              />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
