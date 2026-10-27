import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  amountInputText,
  decimalMark,
  formatAmount,
  magnitude,
  ZERO,
} from '@splito/domain'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {usePrefControl} from '#/components/settings/PrefSection'
import {Text} from '#/components/Typography'
import {FieldError} from '../fields'
import {type ExpenseForm, type FormEvaluation} from '../form'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * Ties a charged bill to the printed total (F-403): items, each charge and
 * round-off add up to the total, line by line. When the printed total
 * disagrees, the gap is shown in red and never absorbed silently: within the
 * currency's round-off limit it can be added as a round-off line, beyond it
 * the items are to be checked.
 */
export function Reconciliation({
  form,
  update,
  evaluation,
  locale,
}: {
  form: ExpenseForm
  update: (fn: (f: ExpenseForm) => ExpenseForm) => void
  evaluation: FormEvaluation
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const spread = usePrefControl('bill.roundOffSpread').value ?? 'shares'
  const [isChecking, setIsChecking] = useState(false)
  const {bill, gap, total, roundOff} = evaluation
  if (!bill) return null
  const fmt = (v: bigint) => formatAmount(v, form.currency, locale)
  const lines = bill.lines.filter(x => x.amount !== ZERO)
  const final =
    total !== undefined && (roundOff || gap === ZERO)
      ? total
      : bill.computedTotal
  const hasGap = gap !== undefined && gap !== ZERO && !roundOff
  const spoken = [
    l`Items ${fmt(bill.itemsTotal)}`,
    ...lines
      .filter(x => !x.isInclusive)
      .map(x => `${x.charge.name} ${fmt(x.amount)}`),
    ...(roundOff ? [l`Round-off ${fmt(roundOff.minor)}`] : []),
    l`Total ${fmt(final)}`,
  ].join(', ')

  const row = (
    key: string,
    label: string,
    value: string,
    {bold = false, muted = false}: {bold?: boolean; muted?: boolean} = {},
  ) => (
    <View
      key={key}
      testID={`bill-line-${key}`}
      style={[a.flex_row, a.justify_between, a.gap_md, a.py_2xs]}>
      <Text
        numberOfLines={1}
        style={[
          a.flex_1,
          a.text_sm,
          bold && a.font_semi_bold,
          muted ? t.atoms.text_contrast_low : t.atoms.text_contrast_medium,
        ]}>
        {label}
      </Text>
      <Text
        style={[
          a.text_sm,
          bold && a.font_semi_bold,
          muted ? t.atoms.text_contrast_low : t.atoms.text_contrast_medium,
          tabular,
        ]}>
        {value}
      </Text>
    </View>
  )

  return (
    <View
      testID="bill-reconciliation"
      accessible
      accessibilityLabel={spoken}
      style={[a.p_md, a.gap_xs, a.rounded_md, t.atoms.bg_contrast_25]}>
      {row('items', l`Items`, fmt(bill.itemsTotal))}
      {lines.map(x =>
        row(
          x.charge.id,
          x.isInclusive ? l`${x.charge.name} (included)` : x.charge.name,
          fmt(x.amount),
          {muted: x.isInclusive},
        ),
      )}
      {roundOff ? (
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <View style={[a.flex_1]}>
            {row('round-off', l`Round-off`, fmt(roundOff.minor))}
          </View>
          <Button
            testID="bill-round-off-remove"
            label={l`Remove round-off`}
            size="tiny"
            variant="ghost"
            color="secondary"
            onPress={() => update(f => ({...f, roundOff: undefined}))}>
            <ButtonText>
              <Trans>Remove</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : null}
      <View style={[a.border_t, t.atoms.border_contrast_low, a.pt_xs]}>
        {row('total', l`Total`, fmt(final), {bold: true})}
      </View>

      {total === undefined ? (
        <View style={[a.flex_row, a.align_center, a.gap_md, a.pt_xs]}>
          <Text style={[a.flex_1, a.text_sm, t.atoms.text_contrast_high]}>
            <Trans>Enter the printed total to check it against this.</Trans>
          </Text>
          <Button
            testID="bill-use-total"
            label={l`Use as the total`}
            size="small"
            color="primary_subtle"
            onPress={() =>
              update(f => ({
                ...f,
                // Written by the app, so it is never asked about (F-111 C2).
                amount: amountInputText(
                  bill.computedTotal,
                  f.currency,
                  decimalMark(locale),
                ),
                amountReading: 'decimal',
              }))
            }>
            <ButtonText>
              <Trans>Use as total</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : null}

      {hasGap ? (
        <View testID="bill-gap" style={[a.gap_sm, a.pt_xs]}>
          <FieldError>
            {gap! > ZERO
              ? l`The printed total ${fmt(total!)} is ${fmt(gap!)} more than the items and charges.`
              : l`The printed total ${fmt(total!)} is ${fmt(magnitude(gap!))} less than the items and charges.`}
          </FieldError>
          <View style={[a.flex_row, a.gap_sm]}>
            {evaluation.canRoundOff ? (
              <Button
                testID="bill-round-off-add"
                label={l`Add ${fmt(gap!)} as round-off`}
                size="small"
                color="primary"
                onPress={() => update(f => ({...f, roundOff: spread}))}>
                <ButtonText>
                  <Trans>Add as round-off</Trans>
                </ButtonText>
              </Button>
            ) : null}
            <Button
              testID="bill-check-items"
              label={l`Check items`}
              size="small"
              color="secondary"
              onPress={() => setIsChecking(c => !c)}>
              <ButtonText>
                <Trans>Check items</Trans>
              </ButtonText>
            </Button>
          </View>
          {isChecking ? (
            <View testID="bill-check-list" style={[a.gap_2xs]}>
              <Text
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>Compare each line with the bill:</Trans>
              </Text>
              {form.items.map((item, n) => (
                <View
                  key={item.key}
                  style={[a.flex_row, a.justify_between, a.gap_md]}>
                  <Text numberOfLines={1} style={[a.flex_1, a.text_sm]}>
                    {item.name || l`Item ${n + 1}`}
                  </Text>
                  <Text style={[a.text_sm, tabular]}>{item.amount || '–'}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
