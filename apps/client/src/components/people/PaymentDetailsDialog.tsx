import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'
import {
  deleteRepayment,
  deleteWriteOff,
  type Entity,
  type Repayment,
  restoreRepayment,
  restoreWriteOff,
  type WriteOff,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as UndoIcon} from '#/components/icons/ArrowRotate'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {utcDate} from '#/components/people/ledger'
import {SyncStatusLine} from '#/components/SyncStatus'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * A recorded payment (or, with `kind="writeoff"`, a debt let go with "Call
 * it even"): who, how much, when and where. Deleting leaves a tombstone, and
 * the toast offers Undo.
 */
export function PaymentDetailsDialog({
  control,
  repayment,
  kind = 'repayment',
  me,
  names,
  groupName,
}: {
  control: Dialog.DialogControlProps
  repayment: Entity<Repayment | WriteOff> | null
  kind?: 'repayment' | 'writeoff'
  me: string
  names: Map<string, string>
  groupName: string | null
}) {
  const {t: l} = useLingui()
  return (
    <FormSheet.Outer control={control} testID="payment-details-sheet">
      <FormSheet.Inner
        title={kind === 'writeoff' ? l`Called it even` : l`Payment details`}>
        {repayment && (
          <Details
            repayment={repayment}
            isWriteOff={kind === 'writeoff'}
            me={me}
            names={names}
            groupName={groupName}
          />
        )}
      </FormSheet.Inner>
    </FormSheet.Outer>
  )
}

function Details({
  repayment,
  isWriteOff,
  me,
  names,
  groupName,
}: {
  repayment: Entity<Repayment | WriteOff>
  isWriteOff: boolean
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
  const title = isWriteOff
    ? to === me
      ? l`You forgave ${name(from)}`
      : from === me
        ? l`${name(to)} forgave you`
        : l`${name(to)} forgave ${name(from)}`
    : from === me
      ? l`You paid ${name(to)}`
      : to === me
        ? l`${name(from)} paid you`
        : l`${name(from)} paid ${name(to)}`
  const when = i18n.date(utcDate(date), {dateStyle: 'long', timeZone: 'UTC'})

  const remove = async () => {
    try {
      await (isWriteOff ? deleteWriteOff : deleteRepayment)(
        store,
        ctx,
        repayment.id,
      )
      haptics.confirm()
      control.close(() =>
        Toast.show(
          <Toast.Outer>
            <Toast.Icon />
            <Toast.Text>
              {isWriteOff ? l`Write-off undone` : l`Payment deleted`}
            </Toast.Text>
            <Toast.Action
              label={l`Undo`}
              onPress={() =>
                void (isWriteOff ? restoreWriteOff : restoreRepayment)(
                  store,
                  ctx,
                  repayment.id,
                ).catch(e => {
                  logger.error(e, {where: 'PaymentDetailsDialog.undo'})
                  Toast.show(
                    isWriteOff
                      ? l`Couldn’t put this write-off back`
                      : l`Couldn’t restore this payment`,
                    {type: 'error'},
                  )
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
      <View style={[a.gap_xs]}>
        <Text emoji style={[a.text_xl, a.font_semi_bold, a.leading_tight]}>
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
      <SyncStatusLine row={repayment} testID="payment-sync-status" />
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {isWriteOff ? (
          <Trans>
            A debt let go – no money changed hands, and it never counts as
            spending. Undoing it puts the balance back as it was.
          </Trans>
        ) : (
          <Trans>
            A record of money that changed hands outside Splito. Deleting it
            puts the balance back as it was.
          </Trans>
        )}
      </Text>
      {isWriteOff ? (
        <Button
          testID="writeoff-undo"
          label={l`Undo write-off`}
          size="large"
          color="secondary"
          onPress={() => void remove()}>
          <ButtonIcon icon={UndoIcon} />
          <ButtonText>
            <Trans>Undo write-off</Trans>
          </ButtonText>
        </Button>
      ) : (
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
      )}
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
