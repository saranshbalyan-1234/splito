import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as Toggle from '#/components/forms/Toggle'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Text} from '#/components/Typography'
import {useTaxClasses} from './hooks'
import {TagIcon} from './icons'

/**
 * An item's tax class as a chip (F-403). A tap opens the class picker; a long
 * press or right-click starts selecting several items to set at once, and
 * then a tap on the chip ticks or unticks its item.
 */
export function ItemClassChip({
  testID,
  classId,
  isSelecting,
  isSelected,
  onPress,
  onSelectionStarted,
}: {
  testID: string
  classId: string | undefined
  isSelecting: boolean
  isSelected: boolean
  /** A tap: opens the picker, or ticks the item while selecting. */
  onPress: () => void
  onSelectionStarted: () => void
}) {
  const {t: l} = useLingui()
  const {nameOf} = useTaxClasses()
  const name = nameOf(classId)
  return (
    <Button
      testID={testID}
      label={
        isSelecting
          ? isSelected
            ? l`${name}, selected. Tap to unselect`
            : l`${name}. Tap to select`
          : l`Tax class: ${name}`
      }
      accessibilityHint={
        isSelecting ? undefined : l`Tap to change; hold to change several items`
      }
      accessibilityState={isSelecting ? {selected: isSelected} : undefined}
      size="tiny"
      variant="outline"
      color={isSelecting && isSelected ? 'primary' : 'secondary'}
      onPress={onPress}
      onLongPress={isSelecting ? undefined : onSelectionStarted}
      {...web({
        onContextMenu: (e: {preventDefault: () => void}) => {
          e.preventDefault()
          if (!isSelecting) onSelectionStarted()
        },
      })}>
      <ButtonIcon icon={isSelecting && isSelected ? CheckIcon : TagIcon} size="xs" />
      <ButtonText>{name}</ButtonText>
    </Button>
  )
}

/** Pick one tax class for one item. */
export function ClassPickerDialog({
  control,
  value,
  onClassPicked,
}: {
  control: Dialog.DialogControlProps
  value: string | undefined
  onClassPicked: (id: string) => void
}) {
  return (
    <FormSheet.Outer control={control} testID="class-picker">
      <PickerInner value={value} onClassPicked={onClassPicked} />
    </FormSheet.Outer>
  )
}

function PickerInner({
  value,
  onClassPicked,
}: {
  value: string | undefined
  onClassPicked: (id: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const {visible, all, nameOf} = useTaxClasses()
  const current = value ?? 'standard'
  /* A class hidden since still shows on the item that has it. */
  const list = visible.some(c => c.id === current)
    ? visible
    : [...visible, ...all.filter(c => c.id === current)]
  return (
    <FormSheet.Inner title={l`Tax class`}>
      <Toggle.Group
        type="radio"
        label={l`Tax class`}
        values={[current]}
        onChange={([id]) => id && control.close(() => onClassPicked(id))}>
        {list.map((c, i) => (
          <Toggle.Item
            key={c.id}
            name={c.id}
            label={nameOf(c.id)}
            testID={`class-option-${c.id}`}
            style={[
              t.atoms.border_contrast_low,
              i < list.length - 1 && a.border_b,
              a.rounded_0,
              a.px_0,
              a.py_md,
              a.gap_md,
            ]}>
            <Text style={[a.flex_1, a.text_md, a.font_medium]}>{nameOf(c.id)}</Text>
            <Toggle.Radio />
          </Toggle.Item>
        ))}
      </Toggle.Group>
    </FormSheet.Inner>
  )
}

/** Shown while several items are selected: set their class in one tap. */
export function ClassSelectionBar({
  count,
  onClassApplied,
  onDone,
}: {
  count: number
  onClassApplied: (id: string) => void
  onDone: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const {visible} = useTaxClasses()
  return (
    <View
      testID="class-selection-bar"
      style={[a.gap_sm, a.p_md, a.rounded_md, t.atoms.bg_contrast_25]}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
        <Text style={[a.flex_1, a.text_sm, a.font_semi_bold]}>
          <Trans>Set the tax class of {count} selected</Trans>
        </Text>
        <Button
          testID="class-selection-done"
          label={l`Done`}
          size="tiny"
          color="secondary"
          onPress={onDone}>
          <ButtonText>
            <Trans>Done</Trans>
          </ButtonText>
        </Button>
      </View>
      <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
        {visible.map(c => (
          <ClassApply
            key={c.id}
            id={c.id}
            disabled={count === 0}
            onPress={() => {
              haptics.selection()
              onClassApplied(c.id)
            }}
          />
        ))}
      </View>
    </View>
  )
}

function ClassApply({
  id,
  disabled,
  onPress,
}: {
  id: string
  disabled: boolean
  onPress: () => void
}) {
  const {nameOf} = useTaxClasses()
  return (
    <Button
      testID={`class-apply-${id}`}
      label={nameOf(id)}
      size="tiny"
      color="primary_subtle"
      disabled={disabled}
      onPress={onPress}>
      <ButtonText>{nameOf(id)}</ButtonText>
    </Button>
  )
}
