// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/forms/DateField/index.web.tsx
import {forwardRef} from 'react'
import {StyleSheet, type TextInput, type TextInputProps} from 'react-native'
// @ts-expect-error untyped
import {unstable_createElement} from 'react-native-web'

import * as TextField from '#/components/forms/TextField'
import {ClockIcon} from './icons'

const InputBase = forwardRef<HTMLInputElement, TextInputProps>(({style, ...props}, ref) =>
  unstable_createElement('input', {...props, ref, type: 'time', style: [StyleSheet.flatten(style), {background: 'transparent', border: 0}]}),
)
InputBase.displayName = 'TimeInputBase'

const Input = TextField.createInput(InputBase as unknown as typeof TextInput)

/** A time of day as `HH:MM` (24-hour), in the browser's own time input. */
export function TimeField({value, onChange, label, isInvalid, testID}: {value: string; onChange: (time: string) => void; label: string; isInvalid?: boolean; testID?: string}) {
  return (
    <TextField.Root isInvalid={isInvalid}>
      <TextField.Icon icon={ClockIcon} />
      <Input value={value} label={label} onChange={e => onChange((e.target as unknown as HTMLInputElement).value)} testID={testID} />
    </TextField.Root>
  )
}
