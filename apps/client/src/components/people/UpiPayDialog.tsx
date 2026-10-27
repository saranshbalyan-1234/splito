import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  amountInputText,
  decimalMark,
  DomainError,
  formatAmount,
  ZERO,
} from '@splito/domain'
import {type Entity, type Person, updatePerson} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as TextField from '#/components/forms/TextField'
import {parseTypedAmount, upiPayUrl} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {openExternalUrl} from '#/lib/externalUrl'

/**
 * Pay a friend what you owe in rupees from your UPI app. Splito only opens
 * the app with the payee and amount filled in; it can't see whether the
 * payment went through, so it then asks before recording anything.
 */
export function UpiPayDialog({
  control,
  person,
  amount,
  onPaidConfirmed,
}: {
  control: Dialog.DialogControlProps
  person: Entity<Person>
  /** What I owe this person in INR, minor units (> 0). */
  amount: bigint
  /** The user says the UPI payment went through; record it. */
  onPaidConfirmed: (amount: bigint) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="upi-sheet">
      <Form person={person} amount={amount} onPaidConfirmed={onPaidConfirmed} />
    </FormSheet.Outer>
  )
}

function Form({
  person,
  amount,
  onPaidConfirmed,
}: {
  person: Entity<Person>
  amount: bigint
  onPaidConfirmed: (amount: bigint) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const [upiId, setUpiId] = useState(person.data.upiId ?? '')
  const prefill = amountInputText(amount, 'INR', decimalMark(locale))
  const [typed, setTyped] = useState(prefill)
  const [error, setError] = useState<'upi' | 'amount' | null>(null)
  const [opened, setOpened] = useState<bigint | null>(null)
  const name = person.data.name

  const open = async () => {
    let minor: bigint
    try {
      minor = parseTypedAmount(typed, 'INR', locale)
      if (minor <= ZERO) throw new DomainError('INVALID_AMOUNT')
    } catch {
      haptics.error()
      setError('amount')
      return
    }
    if (!upiId.trim()) {
      setError('upi')
      return
    }
    try {
      // Remembered on the friend, so next time it is filled in.
      if (upiId.trim() !== (person.data.upiId ?? '')) {
        await updatePerson(store, ctx, person.id, {name, upiId})
      }
    } catch {
      haptics.error()
      setError('upi')
      return
    }
    const url = upiPayUrl({upiId: upiId.trim(), name, amount: minor})
    try {
      /* On the web an anchor click hands the scheme to the installed app; the page stays. */
      await openExternalUrl(url)
      haptics.tap()
      setOpened(minor)
    } catch (e) {
      logger.warn('UPI link not handled', {safeMessage: String(e)})
      Toast.show(l`No UPI app on this device can open the payment.`, {
        type: 'error',
      })
    }
  }

  if (opened !== null) {
    return (
      <FormSheet.Inner
        title={l`Did the payment go through?`}
        footer={{
          saveLabel: l`Yes, record ${formatAmount(opened, 'INR', locale)}`,
          onSave: () => control.close(() => onPaidConfirmed(opened)),
          cancelLabel: l`Not yet`,
          onCancel: () => control.close(),
        }}>
        <View testID="upi-confirm">
          <FormSheet.Description>
            <Trans>
              Splito can’t see your UPI app. Record the payment only once your
              app shows it as successful.
            </Trans>
          </FormSheet.Description>
        </View>
      </FormSheet.Inner>
    )
  }

  return (
    <FormSheet.Inner
      title={l`Pay with UPI`}
      isDirty={upiId !== (person.data.upiId ?? '') || typed !== prefill}
      footer={{
        saveLabel: l`Open UPI app`,
        canSave: upiId.trim() !== '' && typed.trim() !== '',
        onSave: () => void open(),
      }}>
      <FormSheet.Description>
        <Trans>
          Opens your UPI app with {name} and the amount filled in. You confirm
          the payment there.
        </Trans>
      </FormSheet.Description>
      <View style={[a.gap_lg]}>
        <View>
          <TextField.LabelText>
            <Trans>{name}’s UPI ID</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={error === 'upi'}>
            <Dialog.Input
              testID="upi-id"
              label={l`UPI ID`}
              value={upiId}
              onChangeText={v => {
                setUpiId(v)
                setError(null)
              }}
              placeholder="name@bank"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </TextField.Root>
          {error === 'upi' && (
            <Text style={[a.pt_sm, a.text_sm, {color: t.palette.negative_500}]}>
              <Trans>Enter a UPI ID like name@bank.</Trans>
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Amount</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={error === 'amount'}>
            <Dialog.Input
              testID="upi-amount"
              label={l`Amount`}
              value={typed}
              onChangeText={v => {
                setTyped(v)
                setError(null)
              }}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
            <TextField.SuffixText label={l`Indian Rupee`}>
              INR
            </TextField.SuffixText>
          </TextField.Root>
          {error === 'amount' && (
            <Text style={[a.pt_sm, a.text_sm, {color: t.palette.negative_500}]}>
              <Trans>Enter an amount greater than zero.</Trans>
            </Text>
          )}
        </View>

        {IS_WEB && (
          <Admonition type="info">
            <Trans>
              UPI links open on a phone with a UPI app. On a computer, nothing
              may happen.
            </Trans>
          </Admonition>
        )}
      </View>
    </FormSheet.Inner>
  )
}
