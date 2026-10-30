// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/forms/ToggleButton.tsx (Toggle semantics: radio / checkbox role, one checked state, one haptic; pills instead of the joined bar)
import {type StyleProp, View, type ViewStyle} from 'react-native'

import {HITSLOP_10} from '#/lib/constants'
import {useHaptics} from '#/lib/haptics'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText, type ButtonProps} from '#/components/Button'
import {type Props as SVGIconProps} from '#/components/icons/common'

export type ChoiceOption<V extends string> = {
  value: V
  /** The words on the chip. */
  label: string
  /** The accessibility label when it needs to say more than the chip does. */
  accessibilityLabel?: string
  testID?: string
  icon?: React.ComponentType<SVGIconProps>
}

type Common<V extends string> = {
  /** Names the group for screen readers. */
  label: string
  options: readonly ChoiceOption<V>[]
  size?: 'small' | 'tiny'
  variant?: ButtonProps['variant']
  gap?: 'xs' | 'sm'
  /** False for a single row inside a horizontal ScrollView. */
  wrap?: boolean
  style?: StyleProp<ViewStyle>
}

type Props<V extends string> = Common<V> &
  (
    | {
        /** Pick one; `onChange` gets the pressed value, selected or not. */
        type?: 'radio'
        value: V | null
        onChange: (value: V) => void
      }
    | {
        /** Pick any; `onChange` gets the pressed value, the caller adds or removes it. */
        type: 'checkbox'
        value: readonly V[]
        onChange: (value: V) => void
      }
  )

/**
 * A row of pick-one (or pick-many) pills: the selected one is filled. The one
 * implementation of every chip row, so role, checked state and haptic agree.
 */
export function ChoiceChips<V extends string>({
  label,
  options,
  size = 'small',
  variant,
  gap = 'xs',
  wrap = true,
  style,
  ...props
}: Props<V>) {
  const haptics = useHaptics()
  const type = props.type ?? 'radio'
  return (
    <View
      role={type === 'radio' ? 'radiogroup' : 'group'}
      accessibilityLabel={label}
      style={[a.flex_row, wrap && a.flex_wrap, gap === 'sm' ? a.gap_sm : a.gap_xs, style]}>
      {options.map(option => {
        const isOn = Array.isArray(props.value)
          ? props.value.includes(option.value)
          : props.value === option.value
        return (
          <Button
            key={option.value}
            testID={option.testID}
            label={option.accessibilityLabel ?? option.label}
            role={type}
            aria-checked={isOn}
            accessibilityState={{checked: isOn}}
            size={size}
            variant={variant}
            color={isOn ? 'primary' : 'secondary'}
            /* The roomier row keeps its taller tap area; tight rows would overlap. */
            hitSlop={gap === 'sm' ? HITSLOP_10 : undefined}
            onPress={() => {
              haptics.selection()
              props.onChange(option.value)
            }}>
            {option.icon ? <ButtonIcon icon={option.icon} /> : null}
            <ButtonText>{option.label}</ButtonText>
          </Button>
        )
      })}
    </View>
  )
}
