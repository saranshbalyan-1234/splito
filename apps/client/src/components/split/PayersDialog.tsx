import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {MoneyInput} from './fields'
import {type ExpenseForm, type FormEvaluation} from './form'
import {useAvatarName, useDisplayName} from './shared'

type Update = (fn: (f: ExpenseForm) => ExpenseForm) => void

/**
 * Who paid: one person by default (a tap picks them and closes), or several
 * people with the exact amount each paid and a live "left to pay" line.
 */
export function PayersDialog({
  control,
  form,
  update,
  evaluation,
  locale,
}: {
  control: Dialog.DialogControlProps
  form: ExpenseForm
  update: Update
  evaluation: FormEvaluation
  locale: string
}) {
  return (
    <FormSheet.Outer control={control} testID="payers-dialog">
      <PayersInner
        form={form}
        update={update}
        evaluation={evaluation}
        locale={locale}
      />
    </FormSheet.Outer>
  )
}

function PayersInner({
  form,
  update,
  evaluation,
  locale,
}: {
  form: ExpenseForm
  update: Update
  evaluation: FormEvaluation
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const left = evaluation.payersRemaining

  return (
    <FormSheet.Inner title={l`Who paid?`}>
      <SegmentedControl.Root
        label={l`Number of payers`}
        type="radio"
        size="small"
        value={form.payerMode}
        onChange={payerMode =>
          update(f => (f.payerMode === payerMode ? f : {...f, payerMode}))
        }
        style={[a.mb_md]}>
        <SegmentedControl.Item
          value="single"
          label={l`One person`}
          testID="payers-single">
          <SegmentedControl.ItemText style={[a.text_sm]}>
            <Trans>One person</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
        <SegmentedControl.Item
          value="multiple"
          label={l`Multiple payers`}
          testID="payers-multiple">
          <SegmentedControl.ItemText style={[a.text_sm]}>
            <Trans>Multiple payers</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>

      {form.payerMode === 'single' ? (
        <Toggle.Group
          type="radio"
          label={l`Who paid?`}
          values={[form.payer]}
          onChange={([payer]) => {
            if (!payer) return
            update(f => ({...f, payer}))
            control.close()
          }}>
          {form.people.map((id, i) => (
            <Toggle.Item
              key={id}
              name={id}
              label={name(id)}
              testID={`payer-${name(id)}`}
              style={[
                t.atoms.border_contrast_low,
                i < form.people.length - 1 && a.border_b,
                a.rounded_0,
                a.px_0,
                a.py_sm,
                a.gap_md,
              ]}>
              <UserAvatar size={36} name={avatarName(id)} type="user" />
              <Text
                style={[a.flex_1, a.text_md, a.font_medium]}
                numberOfLines={1}>
                {name(id)}
              </Text>
              <Toggle.Radio />
            </Toggle.Item>
          ))}
        </Toggle.Group>
      ) : (
        <View>
          {form.people.map((id, i) => (
            <View
              key={id}
              style={[
                a.flex_row,
                a.align_center,
                a.gap_md,
                a.py_sm,
                t.atoms.border_contrast_low,
                i < form.people.length - 1 && a.border_b,
              ]}>
              <UserAvatar size={36} name={avatarName(id)} type="user" />
              <Text
                style={[a.flex_1, a.text_md, a.font_medium]}
                numberOfLines={1}>
                {name(id)}
              </Text>
              <MoneyInput
                testID={`paid-${name(id)}`}
                label={l`Amount ${name(id)} paid`}
                currency={form.currency}
                value={form.paid[id] ?? ''}
                isInvalid={!!evaluation.rowErrors[`paid:${id}`]}
                onChangeText={v =>
                  update(f => ({...f, paid: {...f.paid, [id]: v}}))
                }
              />
            </View>
          ))}
          {left !== undefined ? (
            <Text
              testID="payers-readout"
              style={[
                a.text_md,
                a.font_medium,
                a.pt_md,
                {fontVariant: ['tabular-nums']},
                left === ZERO
                  ? t.atoms.text_contrast_medium
                  : {color: t.palette.negative_500},
              ]}>
              {left === ZERO ? (
                <Trans>Adds up to the total</Trans>
              ) : left > ZERO ? (
                <Trans>
                  {formatAmount(left, form.currency, locale)} left to pay
                </Trans>
              ) : (
                <Trans>
                  {formatAmount(magnitude(left), form.currency, locale)} more
                  than the total
                </Trans>
              )}
            </Text>
          ) : (
            <Text style={[a.text_sm, a.pt_md, t.atoms.text_contrast_medium]}>
              <Trans>Enter the total first, then what each person paid.</Trans>
            </Text>
          )}
        </View>
      )}
    </FormSheet.Inner>
  )
}
