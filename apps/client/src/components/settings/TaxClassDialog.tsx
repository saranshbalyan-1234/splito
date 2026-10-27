import {useState} from 'react'
import {type TaxClass} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as TextField from '#/components/forms/TextField'
import {useTaxClassName} from '#/components/split/charges/hooks'

const NAME_MAX = 32

/** Add or rename a tax class. Classes are never deleted, because past bills point at them; they can be hidden. */
export function TaxClassDialog({
  control,
  taxClass,
  onNameSaved,
}: {
  control: Dialog.DialogControlProps
  /** Undefined adds a new class. */
  taxClass?: TaxClass
  onNameSaved: (name: string) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="taxclass-sheet">
      {/* Keyed so the form starts from the class being edited; the dialog itself must not remount. */}
      <Inner
        key={taxClass?.id ?? 'new'}
        taxClass={taxClass}
        onNameSaved={onNameSaved}
      />
    </FormSheet.Outer>
  )
}

function Inner({
  taxClass,
  onNameSaved,
}: {
  taxClass?: TaxClass
  onNameSaved: (name: string) => void
}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const haptics = useHaptics()
  const className = useTaxClassName()
  const shownName = taxClass ? className(taxClass) : ''
  const [name, setName] = useState(shownName)
  const trimmed = name.trim()
  const isValid = trimmed.length > 0 && trimmed.length <= NAME_MAX

  const save = () => {
    if (!isValid) return
    haptics.success()
    // An untouched built-in name keeps following the UI language.
    const saved = taxClass && trimmed === shownName ? taxClass.name : trimmed
    control.close(() => onNameSaved(saved))
  }

  return (
    <FormSheet.Inner
      title={taxClass ? l`Rename tax class` : l`New tax class`}
      isDirty={name !== shownName}
      footer={{saveLabel: l`Save`, canSave: isValid, onSave: save}}>
      <TextField.LabelText>
        <Trans>Name</Trans>
      </TextField.LabelText>
      <TextField.Root isInvalid={name.length > 0 && !isValid}>
        <TextField.Input
          testID="taxclass-name"
          label={l`Name`}
          placeholder={l`For example, Desserts`}
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX}
          autoFocus={!taxClass}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </TextField.Root>
    </FormSheet.Inner>
  )
}
