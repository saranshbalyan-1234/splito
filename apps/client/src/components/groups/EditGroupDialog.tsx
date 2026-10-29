import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {DomainError} from '@splito/domain'
import {type Entity, type Group, updateGroup} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {atoms as a} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {
  GroupFields,
  type GroupFieldValues,
} from '#/components/groups/GroupFields'
import {CurrencyDialog} from '#/components/split/pickers'
import * as Toast from '#/components/Toast'

/**
 * Edit group (the group page's overflow menu): name, type, currency and
 * trip dates, in the same fields as New group. A new currency applies to
 * expenses added from now on; existing ones keep theirs.
 */
export function EditGroupDialog({
  control,
  group,
}: {
  control: Dialog.DialogControlProps
  group: Entity<Group>
}) {
  return (
    <FormSheet.Outer control={control} testID="edit-group-sheet">
      <Form group={group} />
    </FormSheet.Outer>
  )
}

function Form({group}: {group: Entity<Group>}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const currencyControl = Dialog.useDialogControl({url: 'edit/currency'})
  const [initial] = useState<GroupFieldValues>(() => ({
    name: group.data.name,
    kind: group.data.kind,
    currency: group.data.currency,
    startDate: group.data.startDate ?? '',
    endDate: group.data.endDate ?? '',
  }))
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<'name' | 'dates' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isTrip = value.kind === 'trip'

  const save = async () => {
    setIsSaving(true)
    try {
      await updateGroup(store, ctx, group.id, {
        name: value.name,
        kind: value.kind,
        currency: value.currency,
        startDate: isTrip && value.startDate ? value.startDate : null,
        endDate: isTrip && value.endDate ? value.endDate : null,
      })
      haptics.success()
      control.close(() => Toast.show(l`Group updated`, {type: 'success'}))
    } catch (e) {
      setIsSaving(false)
      haptics.error()
      if (e instanceof DomainError && e.code === 'INVALID_NAME')
        setError('name')
      else if (e instanceof DomainError && e.code === 'INVALID_DATE')
        setError('dates')
      else {
        logger.error(e, {where: 'EditGroupDialog.save'})
        Toast.show(l`Couldn’t save the group. Please try again.`, {
          type: 'error',
        })
      }
    }
  }

  return (
    <>
      <FormSheet.Inner
        title={l`Edit group`}
        isDirty={JSON.stringify(value) !== JSON.stringify(initial)}
        footer={{
          saveLabel: l`Save`,
          canSave:
            value.name.trim() !== '' &&
            JSON.stringify(value) !== JSON.stringify(initial),
          isSaving,
          onSave: () => void save(),
        }}>
        <View style={[a.gap_xl]}>
          <GroupFields
            testIDPrefix="edit-group"
            value={value}
            error={error}
            onChange={patch => {
              setValue(v => ({...v, ...patch}))
              setError(null)
            }}
            onPressCurrency={() => currencyControl.open()}
          />
        </View>
      </FormSheet.Inner>
      <CurrencyDialog
        control={currencyControl}
        value={value.currency}
        onSelect={currency => setValue(v => ({...v, currency}))}
      />
    </>
  )
}
