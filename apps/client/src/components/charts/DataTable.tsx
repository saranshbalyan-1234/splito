import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * The table view of a chart: the same numbers as rows a screen reader can
 * walk (ARIA table roles on web). The first column is the label; the rest
 * are right-aligned figures.
 */
export function DataTable({
  columns,
  rows,
  testID,
}: {
  columns: string[]
  rows: Array<{key: string; cells: string[]}>
  testID: string
}) {
  const t = useTheme()
  const cell = (i: number) => [
    i === 0
      ? [a.flex_1, {flexBasis: 120}]
      : [a.text_right, {minWidth: 104, flexShrink: 0}],
  ]
  return (
    <View testID={testID} role="table" style={a.w_full}>
      <View
        role="row"
        style={[
          a.flex_row,
          a.gap_md,
          a.pb_sm,
          a.border_b,
          t.atoms.border_contrast_low,
        ]}>
        {columns.map((c, i) => (
          <Text
            key={c}
            role="columnheader"
            numberOfLines={1}
            style={[
              cell(i),
              a.text_xs,
              a.font_semi_bold,
              t.atoms.text_contrast_medium,
            ]}>
            {c}
          </Text>
        ))}
      </View>
      {rows.map(r => (
        <View
          key={r.key}
          role="row"
          testID={`${testID}-${r.key}`}
          style={[
            a.flex_row,
            a.gap_md,
            a.py_sm,
            a.border_b,
            t.atoms.border_contrast_low,
          ]}>
          {r.cells.map((c, i) => (
            <Text
              key={i}
              role={i === 0 ? 'rowheader' : 'cell'}
              numberOfLines={1}
              style={[cell(i), a.text_sm, i === 0 ? a.font_medium : tabular]}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}
