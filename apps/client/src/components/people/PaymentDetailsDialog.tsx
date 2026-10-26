import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'
import {
  deleteRepayment,
  type Entity,
  type Repayment,
  restoreRepayment,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {utcDate} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * A recorded payment: who paid whom, how much, when and where. Deleting
 * leaves a tombstone, and the toast offers Undo.
 */
export function PaymentDetailsDialog({
  control,
  repayment,
  me,
  names,
  groupName,
}: {
  control: Dialog.DialogControlProps
  repayment: Entity<Repayment> | null
  me: string
  names: Map<string, string>
  groupName: string | null
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Payment details`}
        style={web({maxWidth: 400})}>
        {repayment && (
          <Details
            repayment={repayment}
            me={me}
            names={names}
            groupName={groupName}
          />
        )}
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Details({
  repayment,
  me,
  names,
  groupName,
}: {
  repayment: Entity<Repayment>
  me: string
  names: Map<string, string>
  groupName: string | null
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const {from, to, amount, currency, date, note} = repayment.data
  const name = (id: string) => names.get(id) ?? l`Someone`
  const title =
    from === me
      ? l`You paid ${name(to)}`
      : to === me
        ? l`${name(from)} paid you`
        : l`${name(from)} paid ${name(to)}`
  const when = i18n.date(utcDate(date), {dateStyle: 'long', timeZone: 'UTC'})

  const remove = async () => {
    try {
      await deleteRepayment(store, ctx, repayment.id)
      haptics.confirm()
      control.close(() =>
        Toast.show(
          <Toast.Outer>
            <Toast.Icon />
            <Toast.Text>{l`Payment deleted`}</Toast.Text>
            <Toast.Action
              label={l`Undo`}
              onPress={() =>
                void restoreRepayment(store, ctx, repayment.id).catch(e => {
                  logger.error(e, {where: 'PaymentDetailsDialog.undo'})
                  Toast.show(l`Couldn’t restore this payment`, {type: 'error'})
                })
              }>
              <Trans>Undo</Trans>
            </Toast.Action>
          </Toast.Outer>,
        ),
      )
    } catch (e) {
      logger.error(e, {where: 'PaymentDetailsDialog.remove'})
      Toast.show(l`The payment couldn’t be deleted. Please try again.`, {
        type: 'error',
      })
    }
  }

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs, a.pr_2xl]}>
        <Text
          style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          <Trans>Payment</Trans>
        </Text>
        <Text emoji style={[a.text_2xl, a.font_bold, a.leading_tight]}>
          {title}
        </Text>
        <Text
          testID="payment-details-amount"
          style={[
            a.pt_xs,
            a.text_4xl,
            a.font_bold,
            a.leading_tight,
            {fontVariant: ['tabular-nums']},
          ]}>
          {formatAmount(amount, currency, locale)}
        </Text>
      </View>
      <View style={[a.rounded_md, a.border, t.atoms.border_contrast_low]}>
        <DetailRow label={l`Date`} value={when} />
        <DetailRow label={l`Where`} value={groupName ?? l`Direct, no group`} />
        {note ? <DetailRow label={l`Note`} value={note} /> : null}
      </View>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          A record of money that changed hands outside Splito. Deleting it puts
          the balance back as it was.
        </Trans>
      </Text>
      <Button
        testID="payment-delete"
        label={l`Delete payment`}
        size="large"
        color="negative_subtle"
        onPress={() => void remove()}>
        <ButtonIcon icon={TrashIcon} />
        <ButtonText>
          <Trans>Delete payment</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function DetailRow({label, value}: {label: string; value: string}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.flex_row,
        a.justify_between,
        a.gap_md,
        a.px_md,
        a.py_sm,
        a.border_t,
        t.atoms.border_contrast_low,
        {marginTop: -1},
      ]}>
      <Text style={[a.text_md, t.atoms.text_contrast_medium]}>{label}</Text>
      <Text emoji style={[a.flex_1, a.text_md, a.text_right]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}
