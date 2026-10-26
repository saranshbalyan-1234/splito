import {useState} from 'react'
import {Linking, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {DomainError, formatAmount, toDecimalString} from '@splito/domain'
import {type Entity, type Person, updatePerson} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {IndianRupee_Stroke2_Corner0_Rounded as RupeeIcon} from '#/components/icons/Money'
import {parseTypedAmount, upiPayUrl} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

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
  const {t: l} = useLingui()
  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={l`Pay with UPI`}
        style={web({maxWidth: 440})}>
        <Form
          person={person}
          amount={amount}
          onPaidConfirmed={onPaidConfirmed}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
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
  const [amountText, setAmountText] = useState(toDecimalString(amount, 2))
  const [error, setError] = useState<'upi' | 'amount' | null>(null)
  const [opened, setOpened] = useState<bigint | null>(null)
  const name = person.data.name

  const open = async () => {
    let minor: bigint
    try {
      minor = parseTypedAmount(amountText, 'INR', locale)
      if (minor <= 0n) throw new DomainError('INVALID_AMOUNT')
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
      if (IS_WEB) {
        /*
         * An anchor click is how mobile browsers hand a custom scheme to the
         * installed app; the page stays where it is.
         */
        const link = document.createElement('a')
        link.href = url
        link.rel = 'noopener'
        document.body.appendChild(link)
        link.click()
        link.remove()
      } else {
        await Linking.openURL(url)
      }
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
      <View style={[a.gap_lg]} testID="upi-confirm">
        <View style={[a.gap_xs, a.pr_2xl]}>
          <Text style={[a.text_2xl, a.font_bold, a.leading_tight]}>
            <Trans>Did the payment go through?</Trans>
          </Text>
          <Text
            style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>
              Splito can’t see your UPI app. Record the payment only once your
              app shows it as successful.
            </Trans>
          </Text>
        </View>
        <View style={[a.gap_sm]}>
          <Button
            testID="upi-mark-paid"
            label={l`Yes, record the payment`}
            size="large"
            color="primary"
            onPress={() => control.close(() => onPaidConfirmed(opened))}>
            <ButtonText>
              <Trans>Yes, record {formatAmount(opened, 'INR', locale)}</Trans>
            </ButtonText>
          </Button>
          <Button
            label={l`Not yet`}
            size="large"
            color="secondary"
            onPress={() => control.close()}>
            <ButtonText>
              <Trans>Not yet</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_xs, a.pr_2xl]}>
        <Text style={[a.text_2xl, a.font_bold, a.leading_tight]}>
          <Trans>Pay with UPI</Trans>
        </Text>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Opens your UPI app with {name} and the amount filled in. You confirm
            the payment there.
          </Trans>
        </Text>
      </View>

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
            value={amountText}
            onChangeText={v => {
              setAmountText(v)
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
            UPI links open on a phone with a UPI app. On a computer, nothing may
            happen.
          </Trans>
        </Admonition>
      )}

      <Button
        testID="upi-open"
        label={l`Open UPI app`}
        size="large"
        color="primary"
        onPress={() => void open()}>
        <ButtonIcon icon={RupeeIcon} />
        <ButtonText>
          <Trans>Open UPI app</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
