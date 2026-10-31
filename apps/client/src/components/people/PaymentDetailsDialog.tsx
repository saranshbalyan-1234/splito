import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
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
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {DeletedMeta, useStruck} from '#/components/DeletedMeta'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {CommentCount} from '#/components/comments/CommentCount'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as UndoIcon} from '#/components/icons/ArrowRotate'
import {Bubble_Stroke2_Corner2_Rounded as BubbleIcon} from '#/components/icons/Message'
import {TrashLid_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {EyeIcon, EyeOffIcon} from '#/components/settings/icons'
import {DisputeBadge} from '#/components/disputes/DisputeBadge'
import {DisputePanel} from '#/components/disputes/DisputePanel'
import {RaiseIcon} from '#/components/disputes/icons'
import {requestDispute} from '#/lib/disputes/bus'
import {markOf, useOpenDisputes} from '#/state/disputes'
import {useErrorText} from '#/components/split/shared'
import {SyncStatusLine} from '#/components/SyncStatus'
import {SyncToned} from '#/components/SyncTone'
import {useFormatDay} from '#/locale/useDates'
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
  hide,
}: {
  control: Dialog.DialogControlProps
  repayment: Entity<Repayment | WriteOff> | null
  kind?: 'repayment' | 'writeoff'
  me: string
  names: Map<string, string>
  groupName: string | null
  /** A deleted record can be hidden from my lists (decisions 104 to 106); the caller owns the preference. */
  hide?: {isHidden: boolean; onToggle: () => void}
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
            hide={hide}
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
  hide,
}: {
  repayment: Entity<Repayment | WriteOff>
  isWriteOff: boolean
  me: string
  names: Map<string, string>
  groupName: string | null
  hide?: {isHidden: boolean; onToggle: () => void}
}) {
  const t = useTheme()
  const struck = useStruck()
  const errorText = useErrorText()
  const {t: l} = useLingui()
  const formatDay = useFormatDay()
  const control = Dialog.useDialogContext()
  const navigation = useNavigation<NavigationProp>()
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
  const when = formatDay(date, {intl: {dateStyle: 'long'}})

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

  /* A deleted record opens read-only: struck, when it went, and Restore (same guards as the mutation's). */
  const restore = async () => {
    try {
      await (isWriteOff ? restoreWriteOff : restoreRepayment)(store, ctx, repayment.id)
      haptics.confirm()
      control.close()
    } catch (e) {
      logger.error(e, {where: 'PaymentDetailsDialog.restore'})
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
    }
  }
  const isDeleted = repayment.deleted
  const targetType = isWriteOff ? 'writeoff' : 'repayment'
  const mark = markOf(useOpenDisputes(), targetType, repayment.id)

  return (
    <View style={[a.gap_lg]}>
      <SyncToned status={repayment.syncStatus} style={[a.gap_lg]}>
      <View style={[a.gap_xs]}>
        <Text emoji style={[a.text_xl, a.font_semi_bold, a.leading_tight, isDeleted && struck]}>
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
            isDeleted && struck,
          ]}>
          {formatAmount(amount, currency, locale)}
        </Text>
        {isDeleted ? <DeletedMeta testID="payment-deleted-at" at={repayment.updatedAt} /> : null}
        {mark && !isDeleted ? <DisputeBadge kind={mark === 'hold' ? 'hold' : 'dispute'} testID="payment-disputed" /> : null}
      </View>
      <DisputePanel targetType={targetType} targetId={repayment.id} currency={currency} inset={false} />
      <View style={[a.rounded_md, a.border, t.atoms.border_contrast_low]}>
        <DetailRow label={l`Date`} value={when} />
        <DetailRow label={l`Where`} value={groupName ?? l`Direct, no group`} />
        {note ? <DetailRow label={l`Note`} value={note} /> : null}
      </View>
      </SyncToned>
      <SyncStatusLine row={repayment} testID="payment-sync-status" />
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {isDeleted ? (
          isWriteOff ? (
            <Trans>This write-off was undone. It no longer counts towards any balance.</Trans>
          ) : (
            <Trans>This payment was deleted. It no longer counts towards any balance.</Trans>
          )
        ) : isWriteOff ? (
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
      {isWriteOff ? null : (
        <Button
          testID="payment-discussion"
          label={l`Open the discussion`}
          size="large"
          color="secondary"
          onPress={() =>
            control.close(() =>
              navigation.navigate('Repayment', {repaymentId: repayment.id}),
            )
          }>
          <ButtonIcon icon={BubbleIcon} />
          <ButtonText>
            <Trans>Comments</Trans>
          </ButtonText>
          <CommentCount targetType="repayment" targetId={repayment.id} />
        </Button>
      )}
      {isDeleted ? null : (
        <Button
          testID="payment-report"
          label={isWriteOff ? l`Report a problem with this write-off` : l`Report a problem with this payment`}
          size="small"
          color="secondary"
          style={[a.self_start]}
          onPress={() => control.close(() => requestDispute({kind: 'report', targetType, targetId: repayment.id}))}>
          <ButtonIcon icon={RaiseIcon} />
          <ButtonText>
            <Trans>Report a problem</Trans>
          </ButtonText>
        </Button>
      )}
      {isDeleted ? (
        <View style={[a.gap_sm]}>
          <Button
            testID={isWriteOff ? 'writeoff-restore' : 'payment-restore'}
            label={isWriteOff ? l`Restore write-off` : l`Restore payment`}
            size="large"
            color="primary"
            onPress={() => void restore()}>
            <ButtonIcon icon={UndoIcon} />
            <ButtonText>
              <Trans>Restore</Trans>
            </ButtonText>
          </Button>
          {hide ? (
            <Button
              testID="payment-hide"
              label={hide.isHidden ? l`Unhide` : l`Hide`}
              size="large"
              color="secondary"
              onPress={() => {
                hide.onToggle()
                control.close()
              }}>
              <ButtonIcon icon={hide.isHidden ? EyeIcon : EyeOffIcon} />
              <ButtonText>{hide.isHidden ? <Trans>Unhide</Trans> : <Trans>Hide</Trans>}</ButtonText>
            </Button>
          ) : null}
        </View>
      ) : isWriteOff ? (
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
