import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  itemBreakdown,
  type SplitInput,
  sumMinor,
  ZERO,
} from '@splito/domain'

import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme} from '#/alf'
import {SectionLabel} from '#/components/split/shared'
import {ChargedBreakdown} from './ChargedBreakdown'
import {ItemRow} from './ItemRow'
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
  const locale = useNumberLocale()
  /* Scoped, stacked charges (F-403) have their own breakdown. */
  if (split.charges)
    return (
      <ChargedBreakdown
        split={split}
        fmt={fmt}
        name={name}
        avatarName={avatarName}
      />
    )
  const {items, subtotals} = itemBreakdown(split)
  /* "Tax 18%": the rate a charge was entered as, when it was a percentage. */
  const rate = (key: keyof NonNullable<typeof split.rates>) => {
    const bp = split.rates?.[key]
    return bp === undefined
      ? ''
      : ` ${new Intl.NumberFormat(locale, {style: 'percent', maximumFractionDigits: 2}).format(bp / 10000)}`
  }
  const extras = [
    {
      key: 'discount',
      label: l`Discount` + rate('discount'),
      value: split.discount,
      sign: '−',
    },
    {
      key: 'service',
      label: l`Service charge` + rate('service'),
      value: split.service ?? ZERO,
      sign: '',
    },
    {key: 'tax', label: l`Tax` + rate('tax'), value: split.tax, sign: ''},
    {key: 'tip', label: l`Tip` + rate('tip'), value: split.tip, sign: ''},
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
          <ItemRow
            key={item.id}
            item={item}
            index={i}
            parts={items[item.id]!}
            fmt={fmt}
            name={name}
            avatarName={avatarName}
          />
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
            <View
              testID="expense-extra-subtotal"
              style={[a.flex_row, a.justify_between, a.py_2xs]}>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Items subtotal</Trans>
              </Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium, tabular]}>
                {fmt(sumMinor(Object.values(subtotals)))}
              </Text>
            </View>
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
