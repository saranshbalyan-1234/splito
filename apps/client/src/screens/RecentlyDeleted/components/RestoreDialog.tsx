import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type BinItem} from '@splito/sync'

import {useTheme, atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {EntryIcon} from '#/components/people/EntryIcon'
import {utcDate} from '#/components/people/ledger'
import {Text} from '#/components/Typography'
import {daysLeft} from '../days'
import {type BinRowModel} from '../describe'

/**
 * One deleted item before it comes back: what it was, where, who deleted it
 * and when, and what restoring does. Restore is the footer's primary action;
 * "Delete forever" hands over to its confirmation prompt after this sheet
 * closes (one modal at a time).
 */
export function RestoreDialog({
  control,
  item,
  model,
  deletedByName,
  groupName,
  days,
  readAt,
  onRestorePressed,
  onDeleteForeverPressed,
}: {
  control: Dialog.DialogControlProps
  item: BinItem | null
  model: BinRowModel | null
  deletedByName: string
  groupName: string | null
  days: number
  readAt: number
  onRestorePressed: (item: BinItem) => Promise<void>
  onDeleteForeverPressed: (item: BinItem) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="restore-sheet">
      {item && model && (
        <Body
          item={item}
          model={model}
          deletedByName={deletedByName}
          groupName={groupName}
          days={days}
          readAt={readAt}
          onRestorePressed={onRestorePressed}
          onDeleteForeverPressed={onDeleteForeverPressed}
        />
      )}
    </FormSheet.Outer>
  )
}

function Body({
  item,
  model,
  deletedByName,
  groupName,
  days,
  readAt,
  onRestorePressed,
  onDeleteForeverPressed,
}: {
  item: BinItem
  model: BinRowModel
  deletedByName: string
  groupName: string | null
  days: number
  readAt: number
  onRestorePressed: (item: BinItem) => Promise<void>
  onDeleteForeverPressed: (item: BinItem) => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const [isSaving, setIsSaving] = useState(false)
  const left = daysLeft(item.deletedAt, days, readAt)
  const title =
    item.type === 'expense'
      ? l`Restore expense`
      : item.type === 'repayment'
        ? l`Restore payment`
        : l`Restore write-off`
  const kindLabel =
    item.type === 'expense'
      ? l`Expense`
      : item.type === 'repayment'
        ? l`Payment`
        : l`Write-off`

  return (
    <FormSheet.Inner
      title={title}
      footer={{
        saveLabel: l`Restore`,
        isSaving,
        onSave: () => {
          setIsSaving(true)
          void onRestorePressed(item).finally(() => setIsSaving(false))
        },
      }}>
      <View style={[a.gap_lg]}>
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <EntryIcon
            category={
              item.type === 'expense' ? item.entity.data.category : undefined
            }
            isPayment={item.type === 'repayment'}
            isWriteOff={item.type === 'writeoff'}
          />
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text
              testID="restore-title"
              emoji
              numberOfLines={2}
              style={[a.text_xl, a.font_semi_bold, a.leading_tight]}>
              {model.title}
            </Text>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {kindLabel}
            </Text>
          </View>
        </View>
        <Text
          testID="restore-amount"
          style={[
            a.text_4xl,
            a.font_bold,
            a.leading_tight,
            {fontVariant: ['tabular-nums']},
          ]}>
          {model.amount}
        </Text>
        <View style={[a.rounded_md, a.border, t.atoms.border_contrast_low]}>
          {model.effect ? (
            <DetailRow
              label={l`For you`}
              value={model.effect}
              color={
                model.effectSign > 0
                  ? t.palette.positive_600
                  : t.palette.negative_500
              }
            />
          ) : null}
          <DetailRow
            label={l`Date`}
            value={i18n.date(utcDate(model.date), {
              dateStyle: 'long',
              timeZone: 'UTC',
            })}
          />
          <DetailRow
            label={l`Where`}
            value={groupName ?? l`Direct, no group`}
          />
          <DetailRow
            label={l`Deleted`}
            value={l`${i18n.date(new Date(item.deletedAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })} by ${deletedByName}`}
          />
        </View>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {left === 1 ? (
            <Trans>
              Restoring puts it back in balances, history and Activity. It stays
              here for 1 more day.
            </Trans>
          ) : (
            <Trans>
              Restoring puts it back in balances, history and Activity. It stays
              here for {left} more days.
            </Trans>
          )}
        </Text>
        <Button
          testID="restore-delete-forever"
          label={l`Delete forever`}
          size="large"
          color="negative_subtle"
          onPress={() => control.close(() => onDeleteForeverPressed(item))}>
          <ButtonIcon icon={TrashIcon} />
          <ButtonText>
            <Trans>Delete forever</Trans>
          </ButtonText>
        </Button>
      </View>
    </FormSheet.Inner>
  )
}

/* The details table, as the payment details sheet draws it. */
function DetailRow({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
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
      <Text
        emoji
        style={[
          a.flex_1,
          a.text_md,
          a.text_right,
          color ? [a.font_semi_bold, {color}] : null,
        ]}
        numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}
