import {useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type BalancePart,
  formatAmount,
  getCurrency,
  splitPayment,
  toDecimalString,
  ZERO,
} from '@splito/domain'
import {createRepayments} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMe, useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {ArrowRight_Stroke2_Corner0_Rounded as ArrowRightIcon} from '#/components/icons/Arrow'
import {ArrowRightLeft_Stroke2_Corner0_Rounded as SwapIcon} from '#/components/icons/Route'
import {
  currencyName,
  parseTypedAmount,
  partsOwedBy,
  todayLocal,
} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import * as FormSheet from '#/components/FormSheet'
import {SuccessCheck} from '#/motion/SuccessCheck'

export type PaymentDraft = {
  /** Who paid. */
  from: string
  /** Who received. */
  to: string
  currency: string
  /** Suggested amount in minor units (the open balance or the plan's transfer). */
  amount: bigint | null
  groupId: string | null
}

/**
 * Records money that changed hands outside Splito (partial or full). The
 * suggestion is prefilled and editable; Splito never moves money and never
 * says it did. Saving twice records one payment: ids are fixed while the
 * dialog is open. With `balance` (a friend's page), one payment is split
 * across the direct and group parts it settles (`splitPayment`), so each
 * group's own balance moves too; otherwise it goes to `draft.groupId`.
 */
export function RecordPaymentDialog({
  control,
  draft,
  currencies,
  suggestions = {},
  me,
  names,
  canSwap = false,
  balance,
  groupNames,
  onPaymentRecorded,
}: {
  control: Dialog.DialogControlProps
  draft: PaymentDraft
  /** Currencies the user may pick; the draft's currency is selected first. */
  currencies?: string[]
  /** Suggested amount per currency, for the currency switcher. */
  suggestions?: Record<string, bigint>
  me: string
  names: Map<string, string>
  canSwap?: boolean
  /** My balance with the friend per currency, part by part (> 0: they owe me). */
  balance?: Record<string, BalancePart[]>
  groupNames?: Map<string, string>
  onPaymentRecorded?: () => void
}) {
  return (
    <FormSheet.Outer control={control} testID="record-payment-sheet">
      <Form
        draft={draft}
        currencies={currencies ?? [draft.currency]}
        suggestions={suggestions}
        me={me}
        names={names}
        canSwap={canSwap}
        balance={balance}
        groupNames={groupNames}
        onPaymentRecorded={onPaymentRecorded}
      />
    </FormSheet.Outer>
  )
}

function Form({
  draft,
  currencies,
  suggestions,
  me,
  names,
  canSwap,
  balance,
  groupNames,
  onPaymentRecorded,
}: {
  draft: PaymentDraft
  currencies: string[]
  suggestions: Record<string, bigint>
  me: string
  names: Map<string, string>
  canSwap: boolean
  balance?: Record<string, BalancePart[]>
  groupNames?: Map<string, string>
  onPaymentRecorded?: () => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const ids = useRef<string[]>([])
  const [from, setFrom] = useState(draft.from)
  const [to, setTo] = useState(draft.to)
  const [currency, setCurrency] = useState(draft.currency)
  const suggestionFor = (c: string) =>
    c === draft.currency && draft.amount !== null
      ? draft.amount
      : suggestions[c]
  const prefill = (c: string) => {
    const s = suggestionFor(c)
    return s ? toDecimalString(s, getCurrency(c).scale) : ''
  }
  const [amountText, setAmountText] = useState(() => prefill(draft.currency))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const name = (pid: string) => names.get(pid) ?? l`Someone`
  /* My avatar shows my own initial, as everywhere else; the sentence still says "you". */
  const myName = useMe()?.data.name
  const avatarName = (pid: string) => (pid === me ? myName : name(pid))
  const sentence =
    from === me
      ? l`You paid ${name(to)}`
      : to === me
        ? l`${name(from)} paid you`
        : l`${name(from)} paid ${name(to)}`
  const suggestion = suggestionFor(currency)
  /* The parts one payment of `amount` settles, in order. */
  const piecesFor = (amount: bigint): BalancePart[] => {
    const parts = balance?.[currency]
    return parts
      ? splitPayment(amount, partsOwedBy(parts, from === me))
      : [{groupId: draft.groupId, amount}]
  }
  const typed = typedAmountOrNull(amountText, currency, locale)
  const pieces = typed ? piecesFor(typed) : []
  const settles =
    balance && pieces.some(p => p.groupId !== null)
      ? pieces
          .map(p =>
            p.groupId === null
              ? l`Direct ${formatAmount(p.amount, currency, locale)}`
              : `${groupNames?.get(p.groupId) ?? l`Group`} ${formatAmount(p.amount, currency, locale)}`,
          )
          .join(' · ')
      : null

  /* One id per part, kept while the dialog is open, so saving twice records once. */
  const idFor = (i: number) => {
    if (!ids.current[i]) ids.current[i] = ctx.newId()
    return ids.current[i]
  }

  const save = async () => {
    if (typed === null || typed <= ZERO) {
      haptics.error()
      setError(l`Enter an amount greater than zero.`)
      return
    }
    setIsSaving(true)
    try {
      const {date, tz} = todayLocal()
      await createRepayments(
        store,
        ctx,
        piecesFor(typed).map((p, i) => ({
          id: idFor(i),
          groupId: p.groupId,
          currency,
          from,
          to,
          amount: p.amount,
          date,
          tz,
          note,
        })),
      )
      setIsDone(true)
    } catch (e) {
      logger.error(e, {where: 'RecordPaymentDialog.save'})
      setIsSaving(false)
      setError(l`The payment couldn’t be saved. Please try again.`)
    }
  }

  const title = l`Record a payment`
  if (isDone) {
    return (
      <FormSheet.Inner title={title}>
        <View
          testID="payment-recorded"
          style={[a.align_center, a.gap_md, a.py_xl]}>
          <SuccessCheck
            size={72}
            onCheckShown={() =>
              setTimeout(
                () =>
                  control.close(() => {
                    Toast.show(l`Payment recorded`, {type: 'success'})
                    onPaymentRecorded?.()
                  }),
                400,
              )
            }
          />
          <Text style={[a.text_xl, a.font_bold, a.text_center]}>
            <Trans>Payment recorded</Trans>
          </Text>
          <Text
            style={[
              a.text_md,
              a.leading_snug,
              a.text_center,
              t.atoms.text_contrast_medium,
            ]}>
            {sentence}{' '}
            {formatAmount(
              parseTypedAmount(amountText, currency, locale),
              currency,
              locale,
            )}
          </Text>
        </View>
      </FormSheet.Inner>
    )
  }

  return (
    <FormSheet.Inner
      title={title}
      isDirty={
        from !== draft.from ||
        currency !== draft.currency ||
        amountText !== prefill(draft.currency) ||
        note !== ''
      }
      footer={{
        saveLabel: l`Record payment`,
        canSave: typed !== null && typed > ZERO,
        isSaving,
        onSave: () => void save(),
      }}>
      <FormSheet.Description>
        <Trans>
          For money that changed hands outside Splito – cash, UPI or a bank
          transfer. Splito keeps the record; it never moves money.
        </Trans>
      </FormSheet.Description>
      <View style={[a.gap_lg]}>
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.p_md,
            a.rounded_md,
            t.atoms.bg_contrast_25,
          ]}>
          <View style={[a.flex_row, a.align_center, a.gap_xs]}>
            <UserAvatar size={32} name={avatarName(from)} type="user" />
            <ArrowRightIcon
              size="sm"
              fill={t.atoms.text_contrast_medium.color}
            />
            <UserAvatar size={32} name={avatarName(to)} type="user" />
          </View>
          <Text
            testID="payment-sentence"
            emoji
            numberOfLines={2}
            style={[a.flex_1, a.text_md, a.font_semi_bold, a.leading_snug]}>
            {sentence}
          </Text>
          {canSwap && (
            <Button
              testID="payment-swap"
              label={l`Swap who paid`}
              size="small"
              color="secondary"
              shape="round"
              onPress={() => {
                haptics.tap()
                setFrom(to)
                setTo(from)
              }}>
              <ButtonIcon icon={SwapIcon} />
            </Button>
          )}
        </View>

        {currencies.length > 1 && (
          <SegmentedControl.Root
            label={l`Currency`}
            type="radio"
            size="small"
            value={currency}
            onChange={c => {
              // The control reports its current value once on layout.
              if (c === currency) return
              setCurrency(c)
              setAmountText(prefill(c))
              setError(null)
            }}>
            {currencies.map(c => (
              <SegmentedControl.Item key={c} value={c} label={c}>
                <SegmentedControl.ItemText>{c}</SegmentedControl.ItemText>
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        )}

        <View>
          <TextField.LabelText>
            <Trans>Amount</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={!!error}>
            <Dialog.Input
              testID="payment-amount"
              label={l`Amount`}
              value={amountText}
              onChangeText={text => {
                setAmountText(text)
                setError(null)
              }}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0"
              onSubmitEditing={() => void save()}
            />
            <TextField.SuffixText label={currencyName(currency, i18n.locale)}>
              {currency}
            </TextField.SuffixText>
          </TextField.Root>
          <Text
            style={[
              a.pt_sm,
              a.text_sm,
              a.leading_snug,
              error
                ? {color: t.palette.negative_500}
                : t.atoms.text_contrast_medium,
            ]}>
            {error ??
              (suggestion
                ? l`Open balance ${formatAmount(suggestion, currency, locale)}. Part payments are fine.`
                : l`Part payments are fine.`)}
          </Text>
          {!error && settles && (
            <Text
              testID="payment-settles"
              style={[
                a.pt_xs,
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Counts towards: {settles}</Trans>
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Note (optional)</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <Dialog.Input
              testID="payment-note"
              label={l`Note`}
              value={note}
              onChangeText={setNote}
              placeholder={l`e.g. Paid by UPI`}
              maxLength={140}
            />
          </TextField.Root>
        </View>
      </View>
    </FormSheet.Inner>
  )
}

/** The typed amount, or null while it isn't one yet. */
function typedAmountOrNull(text: string, currency: string, locale: string) {
  try {
    return parseTypedAmount(text, currency, locale)
  } catch {
    return null
  }
}
