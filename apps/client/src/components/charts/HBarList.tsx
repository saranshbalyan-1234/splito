import {View} from 'react-native'
import {formatAmount, ZERO} from '@splito/domain'

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
  shareOf,
  testID,
}: {
  bars: HBar[]
  /** Splito: shows each bar's share of this whole ("28%") beside its amount. */
  shareOf?: bigint
  currency: string
  locale: string
  selectedKey?: string
  onSelect?: (key: string | null) => void
  testID: string
}) {
  const t = useTheme()
  const max = bars.reduce((m, b) => (b.value > m ? b.value : m), ZERO)
  return (
    <View testID={testID} role="list" style={a.gap_2xs}>
      {bars.map(b => {
        const isSelected = b.key === selectedKey
        const isDimmed = selectedKey !== undefined && !isSelected
        const amount = formatAmount(b.value, currency, locale)
        const content = (
          <>
            <View style={[a.flex_row, a.align_center, a.gap_sm]}>
              {b.leading}
              <Text
                numberOfLines={1}
                style={[a.flex_1, a.text_sm, a.font_medium, t.atoms.text]}>
                {b.label}
              </Text>
              {shareOf !== undefined && shareOf > ZERO ? (
                <Text
                  testID={`${testID}-${b.label}-share`}
                  style={[a.text_xs, t.atoms.text_contrast_medium, tabular]}>
                  {`${Math.round(fraction(b.value, shareOf) * 100)}%`}
                </Text>
              ) : null}
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
          </>
        )
        const rowStyle = [
          a.px_sm,
          a.py_sm,
          a.gap_xs,
          a.rounded_sm,
          {opacity: isDimmed ? 0.55 : 1},
        ]
        /* A row nobody selects is a plain View, not a disabled Pressable: a disabled one would also disable a link inside it (a person's avatar, F-261). */
        return onSelect ? (
          <Pressable
            key={b.key}
            testID={`${testID}-${b.label}`}
            role="listitem"
            accessibilityRole="button"
            accessibilityLabel={`${b.label}: ${amount}`}
            accessibilityHint=""
            accessibilityState={{selected: isSelected}}
            onPress={() => onSelect(isSelected ? null : b.key)}
            style={({hovered, focused}) => [
              ...rowStyle,
              (hovered || focused || isSelected) && t.atoms.bg_contrast_25,
            ]}>
            {content}
          </Pressable>
        ) : (
          <View
            key={b.key}
            testID={`${testID}-${b.label}`}
            role="listitem"
            style={rowStyle}>
            {content}
          </View>
        )
      })}
    </View>
  )
}
