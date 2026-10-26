// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/forms/DateField/index.tsx (API only)
import {type DateFieldProps} from '#/components/forms/DateField/types'
import {toSimpleDateString} from '#/components/forms/DateField/utils'
import * as TextField from '#/components/forms/TextField'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarDays} from '#/components/icons/CalendarDays'

export * as utils from '#/components/forms/DateField/utils'
export const LabelText = TextField.LabelText

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/*
 * Bluesky's native DateField opens the platform picker from @expo/ui, which
 * Splito's native build doesn't include yet. Until it does, native types the
 * date (YYYY-MM-DD) behind the same API and icon; callers validate it.
 * ponytail: typed date on native, swap in @expo/ui's DateTimePicker with the next native build.
 */
export function DateField({
  value,
  inputRef: _inputRef,
  onChangeDate,
  onConfirm,
  label,
  placeholder,
  isInvalid,
  testID,
  accessibilityHint,
}: DateFieldProps) {
  return (
    <TextField.Root isInvalid={isInvalid}>
      <TextField.Icon icon={CalendarDays} />
      <TextField.Input
        label={label}
        value={
          value === ''
            ? ''
            : typeof value === 'string'
              ? value
              : toSimpleDateString(value)
        }
        onChangeText={text => {
          onChangeDate(text)
          if (DATE_RE.test(text)) onConfirm?.(text)
        }}
        placeholder={placeholder ?? 'YYYY-MM-DD'}
        keyboardType="numbers-and-punctuation"
        testID={testID}
        accessibilityHint={accessibilityHint}
      />
    </TextField.Root>
  )
}
