import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, ZERO} from '@splito/domain'
import {
  type DisputeReason,
  type Entity,
  type Expense,
  type HistoryEntry,
  type ProposedFix,
  type Repayment,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type DisputeRequest} from '#/lib/disputes/bus'
import {logger} from '#/logger'
import {useDisputeAccess, useDisputeActions} from '#/state/disputes'
import {useEntity, useGroupHistory, useRecentTransactions} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as TextField from '#/components/forms/TextField'
import {ChoiceChips} from '#/components/forms/ChoiceChips'
import {reasonsFor, useDisputeWords} from '#/components/disputes/words'
import {parseTypedAmount} from '#/components/people/ledger'
import {useAvatarName, useDisplayName, useErrorText} from '#/components/split/shared'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

type Raise = Extract<DisputeRequest, {kind: 'raise' | 'hold'}>

/** Quick reasons for a hold; the field is free text (required). */
const HOLD_SUGGESTIONS = ['Waiting for the refund', 'Need the receipt', 'Checking the amount'] as const

/**
 * "Dispute" or "Put on hold" on an expense, one item of a bill, a payment or a write-off (F-1210, 26.20). A reason
 * chip, an optional note (required for Other and for a hold), a proposed fix for amount, share, payer and
 * duplicate so the answer can be one tap, and (before the backend) who it is raised as. The record keeps counting.
 */
export function RaiseSheet({control, request, onClosed}: {control: Dialog.DialogControlProps; request: Raise; /** After it has closed (the host lets it go). */ onClosed?: () => void}) {
  return (
    <FormSheet.Outer control={control} testID="dispute-sheet" onClose={onClosed}>
      <Form request={request} />
    </FormSheet.Outer>
  )
}

function Form({request}: {request: Raise}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const words = useDisputeWords()
  const errorText = useErrorText()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const actions = useDisputeActions()
  const {targetType, targetId} = request
  const isHold = request.kind === 'hold'
  const itemId = request.kind === 'raise' ? request.itemId : undefined
  const record = useEntity<Expense & Repayment>(targetType, targetId)
  const access = useDisputeAccess(targetType, targetId)
  const d = record?.data
  const currency = d?.currency ?? 'INR'
  const item = targetType === 'expense' && itemId !== undefined && d?.split.mode === 'items' ? d.split.items.find(i => i.id === itemId) : undefined
  const participants = access.record?.participants ?? []

  const [reason, setReason] = useState<DisputeReason | null>(null)
  const [note, setNote] = useState('')
  const [amountText, setAmountText] = useState('')
  const [payerId, setPayerId] = useState<string | null>(null)
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null)
  const [raisedBy, setRaisedBy] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  /* The live group's members, as the mutation reads them (a deleted group has none). */
  const members = access.record?.groupMembers ?? []
  /* Who it can be raised as: the people on the record; a group member who is not on it may only say they were left out. */
  const candidates = reason === 'left_out' ? [...new Set([...members.filter(m => !participants.includes(m))])] : participants
  const defaultWho = candidates.includes(access.me) ? access.me : (candidates[0] ?? access.me)
  const who = raisedBy && candidates.includes(raisedBy) ? raisedBy : defaultWho

  const shown = isHold ? [] : reasonsFor(targetType, item !== undefined)
  const typed = (() => {
    try {
      return amountText.trim() ? parseTypedAmount(amountText, currency, locale) : null
    } catch {
      return null
    }
  })()
  const amountLabel = reason === 'wrong_amount' ? l`The right amount (optional)` : l`The right share (optional)`
  const needsAmount = reason === 'wrong_amount' || reason === 'wrong_share' || reason === 'left_out'
  const isAmountBad = needsAmount && amountText.trim() !== '' && (typed === null || typed < ZERO)
  const fix = (): ProposedFix | null => {
    if (isHold || item) return null
    if (reason === 'wrong_amount' && typed !== null && typed > ZERO) return {kind: 'amount', amount: typed}
    if ((reason === 'wrong_share' || reason === 'left_out') && typed !== null && typed >= ZERO) return {kind: 'share', personId: who, amount: typed}
    if (reason === 'wrong_payer' && payerId) return {kind: 'payer', personId: payerId}
    if (reason === 'duplicate' && duplicateOf) return {kind: 'duplicate', of: duplicateOf}
    return null
  }

  const canSave = !!record && !record.deleted && !isAmountBad && (isHold ? note.trim() !== '' : reason !== null && (reason !== 'other' || note.trim() !== ''))
  const save = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      if (isHold) await actions.hold({targetType, targetId, raisedBy: who, note})
      else await actions.raise({targetType, targetId, itemId: item ? itemId : null, raisedBy: who, reason: reason!, note, proposedFix: fix()})
      haptics.success()
      control.close(() => Toast.show(isHold ? l`Put on hold. It still counts in balances.` : l`Dispute raised. It still counts in balances.`, {type: 'success'}))
    } catch (e) {
      logger.warn('could not raise the dispute', {safeMessage: String(e)})
      haptics.error()
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
      setIsSaving(false)
    }
  }

  const itemName = item?.name || l`this item`
  const title = isHold ? l`Put on hold` : item ? l`Dispute ${itemName}` : l`Dispute`
  const money = d ? formatAmount(targetType === 'expense' ? d.total : d.amount, currency, locale) : ''
  const subject = item ? `${item.name || l`Item`} · ${formatAmount(item.amount, currency, locale)}` : targetType === 'expense' ? (d?.title ?? '') : money
  const totalText = money

  return (
    <FormSheet.Inner
      title={title}
      isDirty={reason !== null || note !== ''}
      footer={{
        saveLabel: isHold ? l`Put on hold` : l`Raise dispute`,
        canSave,
        isSaving,
        onSave: () => void save(),
      }}>
      <FormSheet.Description>
        {isHold ? (
          <Trans>
            Pauses this while something is sorted out. It still counts in balances, but Settle up leaves it out. Anyone on it can release it with one tap.
          </Trans>
        ) : (
          <Trans>
            Say what looks wrong without editing it. It still counts in balances until someone changes it; Settle up leaves it out by default.
          </Trans>
        )}
      </FormSheet.Description>
      <View style={[a.gap_lg]}>
        <View style={[a.p_md, a.rounded_md, a.gap_2xs, t.atoms.bg_contrast_25]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]} testID="dispute-subject">
            {subject}
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium, {fontVariant: ['tabular-nums']}]}>{item ? l`Your portion of the bill` : totalText}</Text>
        </View>

        {candidates.length > 1 && (
          <View style={[a.gap_xs]}>
            <TextField.LabelText>
              <Trans>Raised by</Trans>
            </TextField.LabelText>
            <ChoiceChips
              gap="sm"
              label={l`Raised by`}
              value={who}
              onChange={setRaisedBy}
              options={candidates.map(id => ({value: id, label: name(id), testID: `dispute-by-${avatarName(id)}`}))}
            />
            {who !== access.me && (
              <Text testID="dispute-recorded-by" style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                <Trans>Recorded by you. It becomes two-sided once people share this.</Trans>
              </Text>
            )}
          </View>
        )}

        {isHold ? (
          <View style={[a.gap_xs]}>
            <ChoiceChips
              gap="sm"
              label={l`Note`}
              value={note}
              onChange={setNote}
              options={HOLD_SUGGESTIONS.map(s => {
                const text = s === 'Waiting for the refund' ? l`Waiting for the refund` : s === 'Need the receipt' ? l`Need the receipt` : l`Checking the amount`
                return {value: text, label: text, testID: `hold-suggestion-${s}`}
              })}
            />
          </View>
        ) : (
          <View style={[a.gap_xs]}>
            <TextField.LabelText>
              <Trans>What looks wrong?</Trans>
            </TextField.LabelText>
            <ChoiceChips
              gap="sm"
              label={l`What looks wrong?`}
              value={reason}
              onChange={setReason}
              options={shown.map(r => ({value: r, label: words.reason(r), testID: `dispute-reason-${r}`}))}
            />
          </View>
        )}

        {!isHold && !item && needsAmount && (
          <View style={[a.gap_xs]}>
            <TextField.LabelText>{amountLabel}</TextField.LabelText>
            <TextField.Root isInvalid={isAmountBad}>
              <Dialog.Input
                testID="dispute-amount"
                label={amountLabel}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="0"
              />
              <TextField.SuffixText label={currency}>{currency}</TextField.SuffixText>
            </TextField.Root>
            <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>If you add it, whoever answers can accept and apply it in one tap.</Trans>
            </Text>
          </View>
        )}

        {!isHold && reason === 'wrong_payer' && (
          <View style={[a.gap_xs]}>
            <TextField.LabelText>
              <Trans>Who really paid? (optional)</Trans>
            </TextField.LabelText>
            <ChoiceChips
              gap="sm"
              label={l`Who really paid? (optional)`}
              value={payerId}
              onChange={id => setPayerId(payerId === id ? null : id)}
              options={(members.length ? members : participants).map(id => ({value: id, label: name(id), testID: `dispute-payer-${avatarName(id)}`}))}
            />
          </View>
        )}

        {!isHold && reason === 'duplicate' && targetType === 'expense' && (
          <DuplicatePicker groupId={d?.groupId ?? null} currency={currency} selfId={targetId} value={duplicateOf} onChange={setDuplicateOf} />
        )}

        <View style={[a.gap_xs]}>
          <TextField.LabelText>
            {isHold || reason === 'other' ? <Trans>Reason</Trans> : <Trans>Note (optional)</Trans>}
          </TextField.LabelText>
          <TextField.Root>
            <Dialog.Input
              testID="dispute-note"
              label={isHold ? l`Why is it on hold?` : l`Note`}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={1000}
              placeholder={isHold ? l`Why is it on hold?` : l`Tell them what you saw`}
            />
          </TextField.Root>
        </View>
      </View>
    </FormSheet.Inner>
  )
}

/** The same-currency expenses near this one (its group's, or my newest), to say which one this repeats. */
function DuplicatePicker({groupId, currency, selfId, value, onChange}: {groupId: string | null; currency: string; selfId: string; value: string | null; onChange: (id: string | null) => void}) {
  return groupId ? (
    <GroupCandidates groupId={groupId} currency={currency} selfId={selfId} value={value} onChange={onChange} />
  ) : (
    <RecentCandidates currency={currency} selfId={selfId} value={value} onChange={onChange} />
  )
}

type PickerProps = {currency: string; selfId: string; value: string | null; onChange: (id: string | null) => void}

function GroupCandidates({groupId, ...rest}: PickerProps & {groupId: string}) {
  const pager = useGroupHistory(groupId)
  return <Candidates entries={pager?.entries} {...rest} />
}

function RecentCandidates(props: PickerProps) {
  const pager = useRecentTransactions(40)
  return <Candidates entries={pager?.entries} {...props} />
}

function Candidates({entries, currency, selfId, value, onChange}: PickerProps & {entries: HistoryEntry[] | undefined}) {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const options = (entries ?? [])
    .flatMap(e => (e.kind === 'expense' && !e.entity.deleted && e.entity.id !== selfId && e.entity.data.currency === currency ? [e.entity as Entity<Expense>] : []))
    .slice(0, 8)
  if (options.length === 0) return null
  return (
    <View style={[a.gap_xs]}>
      <TextField.LabelText>
        <Trans>Which expense is this the same as? (optional)</Trans>
      </TextField.LabelText>
      <ChoiceChips
        gap="sm"
        label={l`Which expense is this the same as? (optional)`}
        value={value}
        onChange={id => onChange(value === id ? null : id)}
        options={options.map(o => ({value: o.id, label: `${o.data.title} · ${formatAmount(o.data.total, currency, locale)}`, testID: `dispute-duplicate-${o.data.title}`}))}
      />
    </View>
  )
}
