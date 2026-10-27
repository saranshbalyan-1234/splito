import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type BinItem} from '@splito/sync'

import {useTheme, atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {DeletedMeta, useStruck} from '#/components/DeletedMeta'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {EntryIcon} from '#/components/people/EntryIcon'
import {useFormatDay, useTimeZone} from '#/locale/useDates'
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
  readAt,
  onRestorePressed,
  onDeleteForeverPressed,
}: {
  control: Dialog.DialogControlProps
  item: BinItem | null
  model: BinRowModel | null
  deletedByName: string
  groupName: string | null
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
  readAt,
  onRestorePressed,
  onDeleteForeverPressed,
}: {
  item: BinItem
  model: BinRowModel
  deletedByName: string
  groupName: string | null
  readAt: number
  onRestorePressed: (item: BinItem) => Promise<void>
  onDeleteForeverPressed: (item: BinItem) => void
}) {
  const t = useTheme()
  const struck = useStruck()
  const {t: l, i18n} = useLingui()
  const formatDay = useFormatDay()
  const tz = useTimeZone()
  const control = Dialog.useDialogContext()
  const [isSaving, setIsSaving] = useState(false)
  const left = daysLeft(item.purgeAfter, readAt)
  const title = {
    expense: l`Restore expense`,
    repayment: l`Restore payment`,
    writeoff: l`Restore write-off`,
    group: l`Restore group`,
  }[item.type]
  const kindLabel = {
    expense: l`Expense`,
    repayment: l`Payment`,
    writeoff: l`Write-off`,
    group: l`Group`,
  }[item.type]
  const removed = item.type === 'group' ? item.entity.data.removed : undefined

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
          {item.type === 'group' ? (
            <GroupAvatar
              kind={item.entity.data.kind}
              name={item.entity.data.name}
              size={42}
            />
          ) : (
            <EntryIcon
              category={
                item.type === 'expense' ? item.entity.data.category : undefined
              }
              isPayment={item.type === 'repayment'}
              isWriteOff={item.type === 'writeoff'}
            />
          )}
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text
              testID="restore-title"
              emoji
              numberOfLines={2}
              style={[a.text_xl, a.font_semi_bold, a.leading_tight, struck]}>
              {model.title}
            </Text>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {kindLabel}
            </Text>
            <DeletedMeta testID="restore-deleted" at={item.deletedAt} />
          </View>
        </View>
        {item.type === 'group' ? null : (
          <Text
            testID="restore-amount"
            style={[
              a.text_4xl,
              a.font_bold,
              a.leading_tight,
              struck,
              {fontVariant: ['tabular-nums']},
            ]}>
            {model.amount}
          </Text>
        )}
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
          {item.type === 'group' ? (
            <>
              <DetailRow
                label={l`Expenses`}
                value={String(removed?.expenses ?? 0)}
              />
              <DetailRow
                label={l`Payments`}
                value={String(removed?.repayments ?? 0)}
              />
              <DetailRow
                label={l`Write-offs`}
                value={String(removed?.writeoffs ?? 0)}
              />
              <DetailRow
                label={l`Members`}
                value={String(
                  item.entity.data.members.filter(m => m.leftAt === null)
                    .length,
                )}
              />
            </>
          ) : (
            <>
              <DetailRow
                label={l`Date`}
                value={formatDay(model.date, {intl: {dateStyle: 'long'}})}
              />
              <DetailRow
                label={l`Where`}
                value={groupName ?? l`Direct, no group`}
              />
            </>
          )}
          <DetailRow
            label={l`Deleted`}
            value={l`${i18n.date(new Date(item.deletedAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: tz,
            })} by ${deletedByName}`}
          />
        </View>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {item.type === 'group' ? (
            <Trans>
              Restoring brings the group back with every expense, payment and
              write-off that went with it.
            </Trans>
          ) : left === 1 ? (
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
