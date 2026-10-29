import {HITSLOP_10} from '#/lib/constants'
import {Button, ButtonText} from '#/components/Button'

/** A pick-one pill (a reason, a person): the selected one is filled. */
export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string
  selected: boolean
  onPress: () => void
  testID?: string
}) {
  return (
    <Button
      testID={testID}
      label={label}
      accessibilityRole="radio"
      accessibilityState={{checked: selected}}
      size="small"
      hitSlop={HITSLOP_10}
      color={selected ? 'primary' : 'secondary'}
      onPress={onPress}>
      <ButtonText>{label}</ButtonText>
    </Button>
  )
}
