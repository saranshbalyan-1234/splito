import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  billOf,
  isInScope,
  roundOffByPerson,
  type SplitInput,
  splitItem,
  ZERO,
} from '@splito/domain'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme} from '#/alf'
import {useTaxClasses} from '#/components/split/charges/hooks'
import {SectionLabel} from '#/components/split/shared'
import {Text} from '#/components/Typography'
import {ItemRow} from './ItemRow'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * An itemised bill with scoped, stacked charges (F-403): the items grouped by
 * tax class, each charge with what it applies to ("on Alcohol + Service"),
 * and for every person their items, their share of each charge and the
 * round-off. All figures come from the domain's `billOf`, so each person's
 * parts add up to the share above exactly.
 */
export function ChargedBreakdown({
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
  const {all, nameOf} = useTaxClasses()
  const bill = billOf(split)
  const roundOff = split.roundOff
  const roundOffShares = roundOff ? roundOffByPerson(bill, roundOff) : {}
  const pct = new Intl.NumberFormat(locale, {maximumFractionDigits: 2})

  /* Items by class, in the person's class order; classes no longer listed come last. */
  const classIds = [...new Set(split.items.map(i => i.taxClass ?? 'standard'))]
  const order = (id: string) => {
    const n = all.findIndex(c => c.id === id)
    return n < 0 ? all.length : n
  }
  classIds.sort((x, y) => order(x) - order(y))
  const parts = Object.fromEntries(split.items.map(i => [i.id, splitItem(i.amount, i.participants)]))

  const lines = bill.lines.filter(x => x.amount !== ZERO)
  const covers = (c: (typeof bill.lines)[number]['charge']) =>
    split.items.filter(i => isInScope(c.appliesTo, i))
  const scopeOf = (n: number) => {
    const { charge } = bill.lines[n]!
    const on =
      charge.appliesTo.type === 'all'
        ? l`all items`
        : charge.appliesTo.type === 'classes'
          ? charge.appliesTo.classes.map(nameOf).join(' + ')
          : covers(charge)
              .map((i, k) => i.name || l`Item ${k + 1}`)
              .join(' + ')
    // Stacking: the earlier charges that fall on the same items.
    const mine = new Set(covers(charge).map(i => i.id))
    const under = charge.stacksOn === 'earlier'
      ? bill.lines
          .slice(0, n)
          .filter(x => !x.isInclusive && x.amount !== ZERO && covers(x.charge).some(i => mine.has(i.id)))
          .map(x => x.charge.name)
      : []
    return [l`on ${on}`, ...under.map(u => `+ ${u}`)].join(' ')
  }
  const rate = (n: number) => {
    const v = bill.lines[n]!.charge.value
    return v.mode === 'percent' ? ` ${pct.format(v.basisPoints / 100)}%` : ''
  }

  const people = Object.keys(
    split.items.reduce<Record<string, true>>((acc, i) => {
      for (const id of Object.keys(parts[i.id]!)) acc[id] = true
      return acc
    }, {}),
  )

  return (
    <View testID="expense-items">
      <SectionLabel>
        <Trans>Items</Trans>
      </SectionLabel>
      <View
        style={[a.mx_lg, a.rounded_md, a.border, a.overflow_hidden, t.atoms.border_contrast_low]}>
        {classIds.map((classId, g) => {
          const group = split.items
            .map((item, index) => ({item, index}))
            .filter(x => (x.item.taxClass ?? 'standard') === classId)
          const subtotal = group.reduce((s, x) => s + x.item.amount, ZERO)
          return (
            <View key={classId} testID={`expense-class-${classId}`}>
              <View
                style={[
                  a.flex_row,
                  a.justify_between,
                  a.px_md,
                  a.py_xs,
                  g > 0 && [a.border_t, t.atoms.border_contrast_low],
                  t.atoms.bg_contrast_25,
                ]}>
                <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
                  {nameOf(classId)}
                </Text>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium, tabular]}>
                  {fmt(subtotal)}
                </Text>
              </View>
              {group.map(({item, index}) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  parts={parts[item.id]!}
                  fmt={fmt}
                  name={name}
                  avatarName={avatarName}
                  isFirst={false}
                />
              ))}
            </View>
          )
        })}
      </View>

      <SectionLabel>
        <Trans>Charges</Trans>
      </SectionLabel>
      <View
        testID="expense-charges"
        style={[a.mx_lg, a.rounded_md, a.border, a.overflow_hidden, t.atoms.border_contrast_low]}>
        <ChargeRow
          testID="expense-charge-items"
          label={l`Items`}
          value={fmt(bill.itemsTotal)}
          isFirst
        />
        {bill.lines.map((line, n) =>
          line.amount === ZERO ? null : (
            <ChargeRow
              key={line.charge.id}
              testID={`expense-charge-${n}`}
              label={`${line.charge.name}${rate(n)}`}
              detail={
                line.isInclusive
                  ? l`${scopeOf(n)} · included in the prices`
                  : scopeOf(n)
              }
              value={(line.amount < ZERO ? '−' : '') + fmt(line.amount < ZERO ? -line.amount : line.amount)}
              isMuted={line.isInclusive}
            />
          ),
        )}
        {roundOff ? (
          <ChargeRow
            testID="expense-charge-round-off"
            label={l`Round-off`}
            detail={
              roundOff.to === undefined
                ? l`shared by everyone’s share`
                : l`paid by ${name(roundOff.to)}`
            }
            value={fmt(roundOff.minor)}
          />
        ) : null}
        <ChargeRow
          testID="expense-charge-total"
          label={l`Total`}
          value={fmt(bill.computedTotal + (roundOff?.minor ?? ZERO))}
          isBold
        />
      </View>

      <SectionLabel>
        <Trans>What each person pays</Trans>
      </SectionLabel>
      <View
        style={[a.mx_lg, a.rounded_md, a.border, a.overflow_hidden, t.atoms.border_contrast_low]}>
        {people.map((id, k) => {
          const rows = [
            {key: 'items', label: l`Items`, value: bill.subtotals[id] ?? ZERO},
            ...lines
              .filter(x => !x.isInclusive && x.byPerson[id] !== undefined && x.byPerson[id] !== ZERO)
              .map(x => ({key: x.charge.id, label: x.charge.name, value: x.byPerson[id]!})),
            ...(roundOffShares[id] ? [{key: 'round-off', label: l`Round-off`, value: roundOffShares[id]!}] : []),
          ]
          const total = rows.reduce((s, r) => s + r.value, ZERO)
          return (
            <View
              key={id}
              testID={`expense-person-${name(id)}`}
              style={[a.px_md, a.py_md, a.gap_xs, k > 0 && [a.border_t, t.atoms.border_contrast_low]]}>
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <UserAvatar size={22} name={avatarName(id)} type="user" />
                <Text style={[a.flex_1, a.text_md, a.font_semi_bold]} numberOfLines={1}>
                  {name(id)}
                </Text>
                <Text style={[a.text_md, a.font_semi_bold, tabular]}>{fmt(total)}</Text>
              </View>
              {rows.map(r => (
                <View key={r.key} style={[a.flex_row, a.justify_between, a.gap_md]}>
                  <Text numberOfLines={1} style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
                    {r.label}
                  </Text>
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium, tabular]}>
                    {(r.value < ZERO ? '−' : '') + fmt(r.value < ZERO ? -r.value : r.value)}
                  </Text>
                </View>
              ))}
            </View>
          )
        })}
      </View>
    </View>
  )
}

function ChargeRow({
  label,
  detail,
  value,
  testID,
  isFirst = false,
  isBold = false,
  isMuted = false,
}: {
  label: string
  detail?: string
  value: string
  testID: string
  isFirst?: boolean
  isBold?: boolean
  isMuted?: boolean
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      style={[
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.gap_md,
        a.px_md,
        a.py_sm,
        !isFirst && [a.border_t, t.atoms.border_contrast_low],
        isBold && t.atoms.bg_contrast_25,
      ]}>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          style={[a.text_sm, (isBold || !isMuted) && a.font_semi_bold, isMuted && t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>{detail}</Text>
        ) : null}
      </View>
      <Text
        style={[a.text_sm, isBold && a.font_bold, isMuted && t.atoms.text_contrast_medium, tabular]}>
        {value}
      </Text>
    </View>
  )
}
