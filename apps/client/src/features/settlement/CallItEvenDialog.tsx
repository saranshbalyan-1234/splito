import {useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  amountInputText,
  type BalancePart,
  decimalMark,
  formatAmount,
  magnitude,
  remainingMinor,
  sumMinor,
  writeOffParts,
  ZERO,
} from '@splito/domain'
import {createWriteOffs, deleteWriteOffs} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMe, useMutationCtx, useStore} from '#/data/hooks'
import {todayIn} from '#/locale/dates'
import {useNumberLocale} from '#/locale/numberLocale'
import {useTimeZone} from '#/locale/useDates'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {Handshake_Stroke2_Corner0_Rounded as HandshakeIcon} from '#/components/icons/Money'
import {
  currencyName,
  parseTypedAmount,
} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * Two people and what one owes the other, part by part, per currency.
 * Parts are signed: > 0 means `b` owes `a`, < 0 means `a` owes `b`.
 */
export type EvenDraft = {
  a: string
  b: string
  balance: Record<string, BalancePart[]>
  /** The currency selected first. */
  currency: string
}

/**
 * "Call it even" (F-1113): lets a debt go with an explicit write-off record,
 * never a fake payment or a deletion. The open balance is prefilled; the
 * whole of it clears every part (direct and each group) in that currency,
 * less forgives part of it, direct first (`writeOffParts`). Other currencies
 * are untouched. Saving twice records once (ids are fixed while open), and
 * the toast offers Undo. Built on the Record payment sheet's layout.
 */
export function CallItEvenDialog({
  control,
  draft,
  names,
  groupNames,
  onWrittenOff,
}: {
  control: Dialog.DialogControlProps
  draft: EvenDraft | null
  names: Map<string, string>
  groupNames?: Map<string, string>
  onWrittenOff?: () => void
}) {
  return (
    <FormSheet.Outer control={control} testID="call-even-sheet">
      {draft && (
        <Form
          draft={draft}
          names={names}
          groupNames={groupNames}
          onWrittenOff={onWrittenOff}
        />
      )}
    </FormSheet.Outer>
  )
}

function Form({
  draft,
  names,
  groupNames,
  onWrittenOff,
}: {
  draft: EvenDraft
  names: Map<string, string>
  groupNames?: Map<string, string>
  onWrittenOff?: () => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const tz = useTimeZone()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const locale = useNumberLocale()
  const myName = useMe()?.data.name
  const ids = useRef<string[]>([])
  const currencies = Object.keys(draft.balance).sort()
  const [currency, setCurrency] = useState(draft.currency)
  const parts = draft.balance[currency] ?? []
  const net = sumMinor(parts.map(p => p.amount))
  const full = magnitude(net)
  /*
   * Owed one way directly and the other way in a group, netting to zero
   * (audit m7): calling it even clears every part, so there is no amount
   * to type, only what each side lets go.
   */
  const isZeroNet = full === ZERO && parts.length > 0
  const eachWay = sumMinor(
    parts.filter(p => p.amount > ZERO).map(p => p.amount),
  )
  const prefill = (c: string) => {
    const n = magnitude(sumMinor((draft.balance[c] ?? []).map(p => p.amount)))
    // In the number format's own mark: parseTypedAmount reads it back exactly (F-111 C1).
    return n === ZERO ? '' : amountInputText(n, c, decimalMark(locale))
  }
  const [amountText, setAmountText] = useState(() => prefill(draft.currency))
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [done, setDone] = useState<{written: string[]; isFull: boolean} | null>(
    null,
  )

  const name = (pid: string) => names.get(pid) ?? l`Someone`
  const avatarName = (pid: string) => (pid === ctx.actor ? myName : name(pid))
  /* Who forgives whom, in the balance's direction. */
  const creditor = net >= ZERO ? draft.a : draft.b
  const debtor = net >= ZERO ? draft.b : draft.a
  const sentence = isZeroNet
    ? draft.a === ctx.actor || draft.b === ctx.actor
      ? l`You and ${name(draft.a === ctx.actor ? draft.b : draft.a)} let each other off`
      : l`${name(draft.a)} and ${name(draft.b)} let each other off`
    : creditor === ctx.actor
      ? l`You let ${name(debtor)} off`
      : debtor === ctx.actor
        ? l`${name(creditor)} lets you off`
        : l`${name(creditor)} lets ${name(debtor)} off`

  const typed = typedAmountOrNull(amountText, currency, locale)
  const isOver = typed !== null && typed > full
  const isValid = isZeroNet || (typed !== null && typed > ZERO && !isOver)
  const isFull = isZeroNet || (isValid && typed === full)
  const pieces = isValid ? writeOffParts(parts, isZeroNet ? ZERO : typed!) : []
  const money = (v: bigint) => formatAmount(v, currency, locale)
  /*
   * Each part it clears, with its direction when parts go both ways (owed to
   * me in a group, owed by me directly), so no part reads as the other way.
   */
  const isMixed = new Set(pieces.map(p => p.amount > ZERO)).size > 1
  const piece = (p: BalancePart) => {
    const where =
      p.groupId === null ? l`Direct` : (groupNames?.get(p.groupId) ?? l`Group`)
    const amount = money(magnitude(p.amount))
    if (!isMixed) return `${where} ${amount}`
    const debtorName =
      p.amount > ZERO
        ? draft.b === ctx.actor
          ? l`you`
          : name(draft.b)
        : draft.a === ctx.actor
          ? l`you`
          : name(draft.a)
    return l`${where} ${amount} owed by ${debtorName}`
  }
  const clears =
    pieces.length > 1 || pieces.some(p => p.groupId !== null)
      ? pieces.map(piece).join(' · ')
      : null

  const idFor = (i: number) => {
    if (!ids.current[i]) ids.current[i] = ctx.newId()
    return ids.current[i]
  }

  const save = async () => {
    if (!isValid) {
      haptics.error()
      return
    }
    setIsSaving(true)
    try {
      const date = todayIn(tz)
      const written = await createWriteOffs(
        store,
        ctx,
        pieces.map((p, i) => ({
          id: idFor(i),
          groupId: p.groupId,
          currency,
          from: p.amount > ZERO ? draft.b : draft.a,
          to: p.amount > ZERO ? draft.a : draft.b,
          amount: magnitude(p.amount),
          date,
          tz,
          note,
        })),
      )
      const ids = written.map(w => w.id)
      setDone({written: ids, isFull})
      /* The button draws its check, then the sheet closes with the one toast (F-275: no full-sheet success screen). */
      haptics.success()
      setTimeout(
        () =>
          control.close(() => {
            Toast.show(
              <Toast.Outer>
                <Toast.Icon />
                <Toast.Text>{isFull ? l`All even` : l`Written off`}</Toast.Text>
                <Toast.Action label={l`Undo`} onPress={() => undo(ids)}>
                  <Trans context="action">Undo</Trans>
                </Toast.Action>
              </Toast.Outer>,
              {type: 'success'},
            )
            onWrittenOff?.()
          }),
        300,
      )
    } catch (e) {
      logger.error(e, {where: 'CallItEvenDialog.save'})
      setIsSaving(false)
      Toast.show(l`Couldn’t call it even. Please try again.`, {type: 'error'})
    }
  }

  /* One transaction: an undo that fails leaves every part as it was (audit m16). */
  const undo = (written: string[]) =>
    void deleteWriteOffs(store, ctx, written).catch(e => {
      logger.error(e, {where: 'CallItEvenDialog.undo'})
      Toast.show(l`Couldn’t undo the write-off`, {type: 'error'})
    })

  const title = l`Call it even`

  return (
    <FormSheet.Inner
      title={title}
      isDirty={
        currency !== draft.currency ||
        amountText !== prefill(draft.currency) ||
        note !== ''
      }
      footer={{
        saveLabel: isFull || !isValid ? l`Call it even` : l`Write off`,
        canSave: isValid && !done,
        isSaving,
        isSaved: !!done,
        savedTestID: 'call-even-done',
        onSave: () => void save(),
      }}>
      <FormSheet.Description>
        <Trans>
          Let a debt go without any money changing hands. It shows in history
          and Activity, never counts as spending, and you can undo it.
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
            <UserAvatar size={32} name={avatarName(creditor)} type="user" />
            <HandshakeIcon size="sm" fill={t.palette.positive_600} />
            <UserAvatar size={32} name={avatarName(debtor)} type="user" />
          </View>
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text
              testID="call-even-sentence"
              emoji
              numberOfLines={2}
              style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
              {sentence}
            </Text>
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {isZeroNet ? (
                <Trans>{money(eachWay)} owed each way</Trans>
              ) : (
                <Trans>Open balance {money(full)}</Trans>
              )}
            </Text>
          </View>
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
              ids.current = []
            }}>
            {currencies.map(c => (
              <SegmentedControl.Item key={c} value={c} label={c}>
                <SegmentedControl.ItemText>{c}</SegmentedControl.ItemText>
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        )}

        <View>
          {!isZeroNet && (
            <>
              <TextField.LabelText>
                <Trans>Amount to let go</Trans>
              </TextField.LabelText>
              <TextField.Root isInvalid={isOver}>
                <Dialog.Input
                  testID="call-even-amount"
                  label={l`Amount to let go`}
                  value={amountText}
                  onChangeText={text => {
                    setAmountText(text)
                    ids.current = []
                  }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder={currency}
                  onSubmitEditing={() => void save()}
                />
                <TextField.SuffixText
                  label={currencyName(currency, i18n.locale)}>
                  {currency}
                </TextField.SuffixText>
              </TextField.Root>
            </>
          )}
          <Text
            testID="call-even-hint"
            style={[
              a.pt_sm,
              a.text_sm,
              a.leading_snug,
              isOver
                ? {color: t.palette.negative_500}
                : t.atoms.text_contrast_medium,
            ]}>
            {isZeroNet
              ? l`Both ways: each of you lets the other off, and you’ll be even in ${currency}. Other currencies stay as they are.`
              : isOver
                ? l`That’s more than the open balance of ${money(full)}.`
                : isFull || !isValid
                  ? l`The whole balance: you’ll be even in ${currency}. Other currencies stay as they are.`
                  : l`Part of it: ${money(remainingMinor(full, [typed ?? ZERO]))} stays open.`}
          </Text>
          {clears && (
            <Text
              testID="call-even-clears"
              style={[
                a.pt_xs,
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Clears: {clears}</Trans>
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Note (optional)</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <Dialog.Input
              testID="call-even-note"
              label={l`Note`}
              value={note}
              onChangeText={setNote}
              placeholder={l`e.g. Birthday treat`}
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
