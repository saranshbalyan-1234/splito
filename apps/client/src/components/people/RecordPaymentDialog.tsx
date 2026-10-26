import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  DomainError,
  formatAmount,
  getCurrency,
  toDecimalString,
} from '@splito/domain'
import {createRepayment} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {ArrowRight_Stroke2_Corner0_Rounded as ArrowRightIcon} from '#/components/icons/Arrow'
import {ArrowRightLeft_Stroke2_Corner0_Rounded as SwapIcon} from '#/components/icons/Route'
import {
  currencyName,
  parseTypedAmount,
  todayLocal,
} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
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
 * says it did. Saving twice records one payment: the id is fixed when the
 * dialog opens.
 */
export function RecordPaymentDialog({
  control,
  draft,
  currencies,
  suggestions = {},
  me,
  names,
  canSwap = false,
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
  onPaymentRecorded?: () => void
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Record a payment`}
        style={web({maxWidth: 440})}>
        <Form
          draft={draft}
          currencies={currencies ?? [draft.currency]}
          suggestions={suggestions}
          me={me}
          names={names}
          canSwap={canSwap}
          onPaymentRecorded={onPaymentRecorded}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Form({
  draft,
  currencies,
  suggestions,
  me,
  names,
  canSwap,
  onPaymentRecorded,
}: {
  draft: PaymentDraft
  currencies: string[]
  suggestions: Record<string, bigint>
  me: string
  names: Map<string, string>
  canSwap: boolean
  onPaymentRecorded?: () => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const [id] = useState(() => ctx.newId())
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
  const sentence =
    from === me
      ? l`You paid ${name(to)}`
      : to === me
        ? l`${name(from)} paid you`
        : l`${name(from)} paid ${name(to)}`
  const suggestion = suggestionFor(currency)

  const save = async () => {
    let amount: bigint
    try {
      amount = parseTypedAmount(amountText, currency, locale)
      if (amount <= 0n) throw new DomainError('INVALID_AMOUNT')
    } catch {
      haptics.error()
      setError(l`Enter an amount greater than zero.`)
      return
    }
    setIsSaving(true)
    try {
      const {date, tz} = todayLocal()
      await createRepayment(store, ctx, {
        id,
        groupId: draft.groupId,
        currency,
        from,
        to,
        amount,
        date,
        tz,
        note,
      })
      setIsDone(true)
    } catch (e) {
      logger.error(e, {where: 'RecordPaymentDialog.save'})
      setIsSaving(false)
      setError(l`The payment couldn’t be saved. Please try again.`)
    }
  }

  if (isDone) {
    return (
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
    )
  }

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs, a.pr_2xl]}>
        <Text style={[a.text_2xl, a.font_bold, a.leading_tight]}>
          <Trans>Record a payment</Trans>
        </Text>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            For money that changed hands outside Splito – cash, UPI or a bank
            transfer. Splito keeps the record; it never moves money.
          </Trans>
        </Text>
      </View>

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
          <UserAvatar size={32} name={name(from)} type="user" />
          <ArrowRightIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
          <UserAvatar size={32} name={name(to)} type="user" />
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

      <Button
        testID="payment-save"
        label={l`Record payment`}
        size="large"
        color="primary"
        disabled={isSaving}
        onPress={() => void save()}>
        <ButtonText>
          <Trans>Record payment</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
