import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'
import {
  type Group,
  type NudgeVia,
  type Person,
  recordNudge,
  updatePerson,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {type RemindRequest} from '#/lib/remind/bus'
import {buildRemindMessage, sortedAmounts, whatsappUrl} from '#/lib/remind/message'
import {copyReminder, openWhatsapp, shareText} from '#/lib/remind/share'
import {remindWords} from '#/lib/remind/words'
import {logger} from '#/logger'
import {useEntities, useMe, useMutationCtx, useStore} from '#/data/hooks'
import {useLastNudge} from '#/data/remind'
import {useNumberLocale} from '#/locale/numberLocale'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as TextField from '#/components/forms/TextField'
import {upiPayUrl} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {CopyIcon, WhatsappIcon} from './icons'

type Remind = Extract<RemindRequest, {kind: 'remind'}>

// ponytail: shape check only, like the friend's UPI field; the payer's UPI app is the real validator.
const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/

/**
 * "Remind Riya" (F-1118): the friendly message with what they owe per currency (never summed) and, for
 * rupees, my UPI link; handed to the share sheet, WhatsApp when their number is known, or copied. Splito
 * cannot see whether it was sent, so it never says so; it logs "You reminded Riya" in Activity.
 */
export function RemindSheet({control, request}: {control: Dialog.DialogControlProps; request: Remind}) {
  return (
    <FormSheet.Outer control={control} testID="remind-sheet">
      <Form request={request} />
    </FormSheet.Outer>
  )
}

function Form({request}: {request: Remind}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const getTimeAgo = useGetTimeAgo()
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const lastNudge = useLastNudge(request.personId)
  const person = people?.find(p => p.id === request.personId)
  const group = request.groupId ? groups?.find(g => g.id === request.groupId) : undefined
  const name = person?.data.name ?? l`Someone`
  const [upiId, setUpiId] = useState(me?.data.upiId ?? '')
  const [isBusy, setIsBusy] = useState(false)

  const owesRupees = request.owed.INR !== undefined
  const upi =
    owesRupees && me && UPI_RE.test(upiId.trim())
      ? {id: upiId.trim(), link: upiPayUrl({upiId: upiId.trim(), name: me.data.name, amount: request.owed.INR!})}
      : null
  const message = buildRemindMessage({
    name: name.split(/\s+/)[0] ?? name,
    amounts: request.owed,
    groupName: group?.data.name ?? null,
    locale,
    upi,
    words: remindWords(),
  })
  const phone = person?.data.contact?.kind === 'phone' ? person.data.contact.value : null
  const whatsapp = whatsappUrl(phone, message)
  const lastAgo = lastNudge ? getTimeAgo(lastNudge, Date.now()) : null

  /** Logs the reminder once it has been handed over, and closes. Never claims it was sent. */
  const handedOver = async (via: NudgeVia) => {
    try {
      // Remembered on me, so the next reminder carries the link without asking.
      if (me && upi && upi.id !== (me.data.upiId ?? '')) await updatePerson(store, ctx, me.id, {name: me.data.name, upiId: upi.id})
      await recordNudge(store, ctx, {personId: request.personId, groupId: request.groupId, amounts: request.owed, via})
    } catch (e) {
      logger.warn('could not log the reminder', {safeMessage: String(e)})
      Toast.show(l`Couldn’t log this reminder. Please try again.`, {type: 'error'})
      return
    }
    haptics.success()
    control.close(() =>
      Toast.show(
        via === 'copy'
          ? l`Reminder copied. Paste it in a chat with ${name}.`
          : l`Reminder opened for ${name}. Splito can’t see whether it was sent.`,
        {type: 'success'},
      ),
    )
  }

  const run = async (act: () => Promise<NudgeVia | null>) => {
    setIsBusy(true)
    try {
      const via = await act()
      if (via) await handedOver(via)
    } catch (e) {
      logger.warn('sharing the reminder failed', {safeMessage: String(e)})
      Toast.show(l`Couldn’t open the share sheet. Try Copy instead.`, {type: 'error'})
    } finally {
      setIsBusy(false)
    }
  }

  const share = () =>
    run(async () => {
      const result = await shareText(message)
      return result === 'cancelled' ? null : result === 'copied' ? 'copy' : 'share'
    })
  const copy = () =>
    run(async () => {
      await copyReminder(message)
      return 'copy'
    })
  const openChat = () =>
    run(async () => {
      await openWhatsapp(whatsapp!)
      return 'whatsapp'
    })

  return (
    <FormSheet.Inner
      title={l`Remind ${name}`}
      isDirty={false}
      footer={{
        saveLabel: l`Share`,
        canSave: !!person && !isBusy,
        onSave: () => void share(),
      }}>
      <View style={[a.gap_lg]} testID="remind-body">
        <View style={[a.flex_row, a.align_center, a.gap_md, a.p_md, a.rounded_md, t.atoms.bg_contrast_25]}>
          <UserAvatar size={44} name={name} type="user" />
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
              <Trans>{name} owes you</Trans>
            </Text>
            {sortedAmounts(request.owed).map(([currency, amount]) => (
              <Text
                key={currency}
                testID={`remind-owed-${currency}`}
                style={[a.text_lg, a.font_bold, {fontVariant: ['tabular-nums']}]}>
                {formatAmount(amount, currency, locale)}
              </Text>
            ))}
            {group && (
              <Text emoji numberOfLines={1} style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {group.data.name}
              </Text>
            )}
          </View>
        </View>

        <View style={[a.gap_xs]}>
          <TextField.LabelText>
            <Trans>Message</Trans>
          </TextField.LabelText>
          <View style={[a.p_md, a.rounded_md, a.border, t.atoms.border_contrast_low]}>
            <Text testID="remind-message" selectable style={[a.text_md, a.leading_snug]}>
              {message}
            </Text>
          </View>
        </View>

        {owesRupees && (
          <View>
            <TextField.LabelText>
              <Trans>Your UPI ID (optional)</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <Dialog.Input
                testID="remind-upi"
                label={l`Your UPI ID`}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="name@bank"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </TextField.Root>
            <Text style={[a.pt_xs, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>Adds a link {name} can tap to pay you in a UPI app. Saved on this device.</Trans>
            </Text>
          </View>
        )}

        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          {whatsapp && (
            <Button testID="remind-whatsapp" label={l`Send on WhatsApp`} size="small" color="secondary" disabled={isBusy} onPress={() => void openChat()}>
              <ButtonIcon icon={WhatsappIcon} />
              <ButtonText>
                <Trans>WhatsApp</Trans>
              </ButtonText>
            </Button>
          )}
          <Button testID="remind-copy" label={l`Copy the message`} size="small" color="secondary" disabled={isBusy} onPress={() => void copy()}>
            <ButtonIcon icon={CopyIcon} />
            <ButtonText>
              <Trans>Copy</Trans>
            </ButtonText>
          </Button>
        </View>

        <Text testID="remind-note" style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {lastAgo ? <Trans>You last reminded {name} {lastAgo} ago.</Trans> : null}
          {lastAgo ? ' ' : null}
          <Trans>Splito hands this to the app you pick. It can’t see whether the message is sent.</Trans>
        </Text>
      </View>
    </FormSheet.Inner>
  )
}

