import * as TextField from '#/components/forms/TextField'
import {ClockIcon} from './icons'

/*
 * A time of day as `HH:MM` (24-hour). Native types it behind the same icon and API as the date field
 * (the platform time picker comes with the DateField's, once @expo/ui is in the native build); the quick
 * picks in the sheet cover the usual times. The web file uses the browser's own time input.
 * ponytail: typed time on native, swap in @expo/ui's DateTimePicker with the next native build.
 */
export function TimeField({value, onChange, label, isInvalid, testID}: {value: string; onChange: (time: string) => void; label: string; isInvalid?: boolean; testID?: string}) {
  return (
    <TextField.Root isInvalid={isInvalid}>
      <TextField.Icon icon={ClockIcon} />
      <TextField.Input label={label} value={value} onChangeText={onChange} placeholder="HH:MM" keyboardType="numbers-and-punctuation" testID={testID} />
    </TextField.Root>
  )
}
