import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {participantId, participantWeight, type SplitInput} from '@splito/domain'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {PortionBadge} from '#/components/split/PortionBadge'
import {Text} from '#/components/Typography'

const tabular = {fontVariant: ['tabular-nums' as const]}

/** One item of a bill: its price and who had it, each person's part ("Riya x2 - INR 600"). */
export function ItemRow({
  item,
  index: i,
  parts,
  fmt,
  name,
  avatarName,
  isFirst = i === 0,
}: {
  item: Extract<SplitInput, {mode: 'items'}>['items'][number]
  index: number
  parts: Record<string, bigint>
  fmt: (v: bigint) => string
  name: (id: string) => string
  avatarName: (id: string) => string
  isFirst?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View
      testID={`expense-item-${i}`}
      style={[
        a.px_md,
        a.py_md,
        a.gap_sm,
        !isFirst && [a.border_t, t.atoms.border_contrast_low],
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <Text
          style={[a.flex_1, a.text_md, a.font_semi_bold]}
          numberOfLines={2}>
          {item.name || l`Item ${i + 1}`}
        </Text>
        <Text style={[a.text_md, a.font_semi_bold, tabular]}>
          {fmt(item.amount)}
        </Text>
      </View>
      <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
        {item.participants.map(p => {
          const id = participantId(p)
          const weight = participantWeight(p)
          return (
            <View
              key={id}
              testID={`expense-item-${i}-${name(id)}`}
              style={[
                a.flex_row,
                a.align_center,
                a.gap_xs,
                a.rounded_full,
                a.pl_2xs,
                a.pr_sm,
                a.py_2xs,
                t.atoms.bg_contrast_25,
              ]}>
              <UserAvatar size={18} name={avatarName(id)} type="user" />
              <Text style={[a.text_sm, a.font_medium]} numberOfLines={1}>
                {name(id)}
              </Text>
              {weight > 1 ? <PortionBadge portions={weight} /> : null}
              <Text
                style={[
                  a.text_sm,
                  t.atoms.text_contrast_medium,
                  tabular,
                ]}>
                {fmt(parts[id]!)}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
