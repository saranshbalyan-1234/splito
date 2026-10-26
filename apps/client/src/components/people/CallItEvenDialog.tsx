import {useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type BalancePart,
  formatAmount,
  getCurrency,
  magnitude,
  remainingMinor,
  sumMinor,
  toDecimalString,
  writeOffParts,
  ZERO,
} from '@splito/domain'
import {createWriteOffs, deleteWriteOff} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMe, useMutationCtx, useStore} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
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
  todayLocal,
} from '#/components/people/ledger'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {SuccessCheck} from '#/motion/SuccessCheck'

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
  const prefill = (c: string) => {
    const n = magnitude(sumMinor((draft.balance[c] ?? []).map(p => p.amount)))
    return n === ZERO ? '' : toDecimalString(n, getCurrency(c).scale)
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
  const sentence =
    creditor === ctx.actor
      ? l`You let ${name(debtor)} off`
      : debtor === ctx.actor
        ? l`${name(creditor)} lets you off`
        : l`${name(creditor)} lets ${name(debtor)} off`

  const typed = typedAmountOrNull(amountText, currency, locale)
  const isOver = typed !== null && typed > full
  const isValid = typed !== null && typed > ZERO && !isOver
  const isFull = isValid && typed === full
  const pieces = isValid ? writeOffParts(parts, typed) : []
  const money = (v: bigint) => formatAmount(v, currency, locale)
  const clears =
    pieces.length > 1 || pieces.some(p => p.groupId !== null)
      ? pieces
          .map(p =>
            p.groupId === null
              ? l`Direct ${money(magnitude(p.amount))}`
              : `${groupNames?.get(p.groupId) ?? l`Group`} ${money(magnitude(p.amount))}`,
          )
          .join(' · ')
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
      const {date, tz} = todayLocal()
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
      setDone({written: written.map(w => w.id), isFull})
    } catch (e) {
      logger.error(e, {where: 'CallItEvenDialog.save'})
      setIsSaving(false)
      Toast.show(l`Couldn’t call it even. Please try again.`, {type: 'error'})
    }
  }

  const undo = (written: string[]) =>
    void Promise.all(written.map(id => deleteWriteOff(store, ctx, id))).catch(
      e => {
        logger.error(e, {where: 'CallItEvenDialog.undo'})
        Toast.show(l`Couldn’t undo the write-off`, {type: 'error'})
      },
    )

  const title = l`Call it even`
  if (done) {
    return (
      <FormSheet.Inner title={title}>
        <View
          testID="call-even-done"
          style={[a.align_center, a.gap_md, a.py_xl]}>
          <SuccessCheck
            size={72}
            fill={t.palette.positive_500}
            onCheckShown={() =>
              setTimeout(
                () =>
                  control.close(() => {
                    Toast.show(
                      <Toast.Outer>
                        <Toast.Icon />
                        <Toast.Text>
                          {done.isFull ? l`All even` : l`Written off`}
                        </Toast.Text>
                        <Toast.Action
                          label={l`Undo`}
                          onPress={() => undo(done.written)}>
                          <Trans context="action">Undo</Trans>
                        </Toast.Action>
                      </Toast.Outer>,
                      {type: 'success'},
                    )
                    onWrittenOff?.()
                  }),
                400,
              )
            }
          />
          <Text style={[a.text_xl, a.font_bold, a.text_center]}>
            {done.isFull ? <Trans>All even</Trans> : <Trans>Written off</Trans>}
          </Text>
          <Text
            style={[
              a.text_md,
              a.leading_snug,
              a.text_center,
              t.atoms.text_contrast_medium,
            ]}>
            {sentence} {money(typed ?? ZERO)}
          </Text>
        </View>
      </FormSheet.Inner>
    )
  }

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
        canSave: isValid,
        isSaving,
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
              <Trans>Open balance {money(full)}</Trans>
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
            <TextField.SuffixText label={currencyName(currency, i18n.locale)}>
              {currency}
            </TextField.SuffixText>
          </TextField.Root>
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
            {isOver
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
