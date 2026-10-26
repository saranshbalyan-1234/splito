import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  itemBreakdown,
  participantId,
  participantWeight,
  type SplitInput,
  ZERO,
} from '@splito/domain'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {PortionBadge} from '#/components/split/PortionBadge'
import {SectionLabel} from '#/components/split/shared'
import {Text} from '#/components/Typography'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * An itemised bill on the expense page: every item with its price and who
 * had it, each person's part of that item ("Riya x2 - INR 600"), then tax,
 * tip, service charge and discount. Every figure comes from the domain's
 * `itemBreakdown`, so the parts add up to the shares above exactly.
 */
export function ItemsBreakdown({
  split,
  fmt,
  name,
  avatarName,
}: {
  split: Extract<SplitInput, {mode: 'items'}>
  fmt: (v: bigint) => string
  name: (id: string) => string
  avatarName: (id: string) => string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {items} = itemBreakdown(split)
  const extras = [
    {key: 'tax', label: l`Tax`, value: split.tax, sign: ''},
    {key: 'tip', label: l`Tip`, value: split.tip, sign: ''},
    {
      key: 'service',
      label: l`Service charge`,
      value: split.service ?? ZERO,
      sign: '',
    },
    {key: 'discount', label: l`Discount`, value: split.discount, sign: '−'},
  ].filter(x => x.value !== ZERO)

  return (
    <View testID="expense-items">
      <SectionLabel>
        <Trans>Items</Trans>
      </SectionLabel>
      <View
        style={[
          a.mx_lg,
          a.rounded_md,
          a.border,
          a.overflow_hidden,
          t.atoms.border_contrast_low,
        ]}>
        {split.items.map((item, i) => (
          <View
            key={item.id}
            testID={`expense-item-${i}`}
            style={[
              a.px_md,
              a.py_md,
              a.gap_sm,
              i > 0 && [a.border_t, t.atoms.border_contrast_low],
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
                    {weight > 1 ? (
                      <PortionBadge portions={weight} />
                    ) : null}
                    <Text
                      style={[a.text_sm, t.atoms.text_contrast_medium, tabular]}>
                      {fmt(items[item.id]![id]!)}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        ))}
        {extras.length > 0 ? (
          <View
            style={[
              a.px_md,
              a.py_sm,
              a.gap_xs,
              a.border_t,
              t.atoms.border_contrast_low,
              t.atoms.bg_contrast_25,
            ]}>
            {extras.map(x => (
              <View
                key={x.key}
                testID={`expense-extra-${x.key}`}
                style={[a.flex_row, a.justify_between, a.py_2xs]}>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {x.label}
                </Text>
                <Text
                  style={[a.text_sm, t.atoms.text_contrast_medium, tabular]}>
                  {x.sign}
                  {fmt(x.value)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}
