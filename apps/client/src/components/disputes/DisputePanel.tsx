import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type Dispute, type DisputeTarget, type Entity, type Expense, fixApplies} from '@splito/sync'

import {HITSLOP_10} from '#/lib/constants'
import {useHaptics} from '#/lib/haptics'
import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {requestDispute} from '#/lib/disputes/bus'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useDisputeAccess, useDisputeActions, useRecordDisputes} from '#/state/disputes'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {DisputeBadge} from './DisputeBadge'
import {ReleaseIcon} from './icons'
import {useDisputeWords} from './words'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {useDisplayName, useErrorText} from '#/components/split/shared'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * The disputes and holds of one record, on its detail page (F-1210, 26.20): who raised each, why, what they propose,
 * how it was answered, and the actions this person may take (Accept, Reject, Withdraw, Release, Reopen). The same
 * rules as the mutations decide the buttons. Open ones first, then the closed ones, quieter. Nothing when there are none.
 */
export function DisputePanel({targetType, targetId, currency, inset = true}: {targetType: DisputeTarget; targetId: string; currency: string; /** Side padding; off where the page already pads. */ inset?: boolean}) {
  const disputes = useRecordDisputes(targetType, targetId)
  if (!disputes?.length) return null
  const open = disputes.filter(d => d.data.status === 'open').sort((x, y) => y.createdAt - x.createdAt)
  const closed = disputes.filter(d => d.data.status !== 'open').sort((x, y) => y.updatedAt - x.updatedAt)
  return (
    <View testID="dispute-panel" style={[inset && a.px_lg, a.pt_md, a.gap_sm]}>
      {open.map(d => (
        <DisputeCard key={d.id} dispute={d} targetType={targetType} targetId={targetId} currency={currency} />
      ))}
      {closed.map(d => (
        <DisputeCard key={d.id} dispute={d} targetType={targetType} targetId={targetId} currency={currency} />
      ))}
    </View>
  )
}

function DisputeCard({dispute, targetType, targetId, currency}: {dispute: Entity<Dispute>; targetType: DisputeTarget; targetId: string; currency: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const haptics = useHaptics()
  const words = useDisputeWords()
  const name = useDisplayName()
  const errorText = useErrorText()
  const getTimeAgo = useGetTimeAgo()
  const now = useTickEveryMinute()
  const actions = useDisputeActions()
  const access = useDisputeAccess(targetType, targetId)
  const d = dispute.data
  const isOpen = d.status === 'open'
  const raiser = name(d.raisedBy)
  const resolver = d.resolvedBy ? name(d.resolvedBy) : ''
  const hasFix = !!d.proposedFix
  /* One tap only when the fix keeps the split as it is (ruling after the F-1210 review); otherwise only "Edit it". */
  const expense = targetType === 'expense' ? (access.entity?.data as Expense | undefined) : undefined
  const isBlocked = hasFix && !!d.proposedFix && d.proposedFix.kind !== 'duplicate' && !!expense && !fixApplies(expense, d.proposedFix)
  const canApply = (hasFix && !isBlocked) || d.reason === 'not_received'
  const willDo = !isOpen || !canApply ? '' : d.proposedFix?.kind === 'duplicate' ? l`Accepting deletes this expense.` : d.reason === 'not_received' ? l`Accepting deletes this payment.` : d.proposedFix?.kind === 'share' ? l`Accepting sets that share and scales the others to match.` : l`Accepting applies this change as an edit.`
  const itemName = d.itemId !== null ? l`one item` : null
  const ago = getTimeAgo(dispute.createdAt, now)
  const fixText = d.proposedFix ? words.fix(d.proposedFix, currency) : ''

  const run = async (act: () => Promise<unknown>, done: string) => {
    try {
      await act()
      haptics.success()
      Toast.show(done, {type: 'success'})
    } catch (e) {
      logger.warn('dispute action failed', {safeMessage: String(e)})
      haptics.error()
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
    }
  }

  return (
    <View
      testID={`dispute-card-${raiser}`}
      style={[a.p_md, a.rounded_md, a.gap_sm, a.border, isOpen ? {borderColor: t.palette.yellow} : t.atoms.border_contrast_low]}>
      <View style={[a.flex_row, a.align_center, a.gap_sm, a.flex_wrap]}>
        <DisputeBadge kind={d.kind} status={d.status} testID={`dispute-badge-${d.status}`} />
        <Text style={[a.flex_1, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium, {minWidth: 120}]}>
          {d.recordedBy !== d.raisedBy && d.recordedBy === access.me ? (
            <Trans>
              {raiser} · recorded by you · {ago}
            </Trans>
          ) : (
            <Trans>
              {raiser} · {ago}
            </Trans>
          )}
        </Text>
      </View>

      <Text testID="dispute-reason" style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
        {d.kind === 'hold' ? l`On hold` : words.reason(d.reason)}
        {itemName ? <Text style={[a.text_md, t.atoms.text_contrast_medium]}>{` · ${itemName}`}</Text> : null}
        {d.reopenCount > 0 ? <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{` · ${l`reopened`}`}</Text> : null}
      </Text>
      {d.note ? (
        <Text testID="dispute-note-text" emoji style={[a.text_md, a.leading_snug]}>
          {d.note}
        </Text>
      ) : null}
      {d.proposedFix ? (
        <Text testID="dispute-fix" style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Proposed: {fixText}</Trans>
        </Text>
      ) : null}
      {willDo ? (
        <Text testID="dispute-will-do" style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {willDo}
        </Text>
      ) : null}
      {isOpen && isBlocked ? (
        <Text testID="dispute-blocked" style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>This can’t be applied in one tap, because it would change how the expense is split. Use Edit it to make the change yourself.</Trans>
        </Text>
      ) : null}
      {!isOpen && resolver ? (
        <View style={[a.gap_2xs]}>
          <Text testID="dispute-resolution" style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {d.status === 'rejected' ? (
              <Trans>{resolver} rejected it</Trans>
            ) : d.status === 'accepted' ? (
              <Trans>{resolver} accepted it</Trans>
            ) : d.status === 'released' ? (
              <Trans>{resolver} released it</Trans>
            ) : d.status === 'gone' ? (
              <Trans>The record was deleted</Trans>
            ) : (
              <Trans>{resolver} closed it</Trans>
            )}
          </Text>
          {d.resolution ? (
            <Text testID="dispute-resolution-note" emoji style={[a.text_md, a.leading_snug]}>
              {d.resolution}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
        {access.canDo(d, 'accept') && !isBlocked && (
          <Button
            testID="dispute-accept"
            hitSlop={HITSLOP_10}
            label={canApply ? l`Accept and apply` : l`Accept`}
            size="small"
            color="primary"
            onPress={() =>
              void run(() => actions.accept(dispute.id, canApply), canApply && hasFix ? l`Accepted. The change was applied.` : l`Accepted`)
            }>
            <ButtonText>{canApply ? <Trans>Accept and apply</Trans> : <Trans>Accept</Trans>}</ButtonText>
          </Button>
        )}
        {access.canDo(d, 'accept') && targetType === 'expense' && (
          <Button testID="dispute-edit" hitSlop={HITSLOP_10} label={l`Edit it`} size="small" color="secondary" onPress={() => navigation.navigate('EditExpense', {expenseId: targetId})}>
            <ButtonIcon icon={PencilIcon} />
            <ButtonText>
              <Trans>Edit it</Trans>
            </ButtonText>
          </Button>
        )}
        {access.canDo(d, 'reject') && (
          <Button testID="dispute-reject" hitSlop={HITSLOP_10} label={l`Reject`} size="small" color="secondary" onPress={() => requestDispute({kind: 'reject', disputeId: dispute.id})}>
            <ButtonText>
              <Trans>Reject</Trans>
            </ButtonText>
          </Button>
        )}
        {access.canDo(d, 'withdraw') && (
          <Button testID="dispute-withdraw" hitSlop={HITSLOP_10} label={l`Withdraw`} size="small" color="secondary" onPress={() => void run(() => actions.withdraw(dispute.id), l`Withdrawn`)}>
            <ButtonText>
              <Trans>Withdraw</Trans>
            </ButtonText>
          </Button>
        )}
        {access.canDo(d, 'release') && (
          <Button testID="dispute-release" hitSlop={HITSLOP_10} label={l`Release`} size="small" color="primary" onPress={() => void run(() => actions.release(dispute.id), l`Released`)}>
            <ButtonIcon icon={ReleaseIcon} />
            <ButtonText>
              <Trans>Release</Trans>
            </ButtonText>
          </Button>
        )}
        {access.canDo(d, 'reopen') && (
          <Button testID="dispute-reopen" hitSlop={HITSLOP_10} label={l`Reopen`} size="small" color="secondary" onPress={() => requestDispute({kind: 'reopen', disputeId: dispute.id})}>
            <ButtonText>
              <Trans>Reopen</Trans>
            </ButtonText>
          </Button>
        )}
      </View>
    </View>
  )
}
