// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Select/index.tsx (the native sheet; also the phone-width web select)
import {
  createContext,
  Fragment,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {ChevronTopBottom_Stroke2_Corner0_Rounded as ChevronUpDownIcon} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import {BaseRadio} from '../forms/Toggle'
import {
  type ContentProps,
  type IconProps,
  type ItemIndicatorProps,
  type ItemProps,
  type ItemTextProps,
  type RootProps,
  type SelectedItem,
  type TriggerProps,
  type ValueProps,
} from './types'

type ContextType = {
  control: Dialog.DialogControlProps
} & Pick<RootProps, 'value' | 'onValueChange' | 'disabled'>

const Context = createContext<ContextType | null>(null)
Context.displayName = 'SelectContext'

const ValueTextContext = createContext<
  [
    SelectedItem | undefined,
    React.Dispatch<React.SetStateAction<SelectedItem | undefined>>,
  ]
>([undefined, () => {}])
ValueTextContext.displayName = 'ValueTextContext'

function useSelectContext() {
  const ctx = useContext(Context)
  if (!ctx) {
    throw new Error('Select components must must be used within a Select.Root')
  }
  return ctx
}

export function Root({children, value, onValueChange, disabled}: RootProps) {
  const control = Dialog.useDialogControl()
  const valueTextCtx = useState<SelectedItem>()

  const ctx = useMemo(
    () => ({
      control,
      value,
      onValueChange,
      disabled,
    }),
    [control, value, onValueChange, disabled],
  )
  return (
    <Context.Provider value={ctx}>
      <ValueTextContext.Provider value={valueTextCtx}>
        {children}
      </ValueTextContext.Provider>
    </Context.Provider>
  )
}

export function Trigger({children, hitSlop, label}: TriggerProps) {
  const {control} = useSelectContext()
  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()
  const {
    state: pressed,
    onIn: onPressIn,
    onOut: onPressOut,
  } = useInteractionState()

  if (typeof children === 'function') {
    return children({
      IS_NATIVE: true,
      control,
      state: {
        hovered: false,
        focused,
        pressed,
      },
      props: {
        onPress: control.open,
        onFocus,
        onBlur,
        onPressIn,
        onPressOut,
        accessibilityLabel: label,
      },
    })
  } else {
    return (
      <Button
        hitSlop={
          typeof hitSlop === 'number'
            ? {
                top: hitSlop,
                right: hitSlop,
                bottom: hitSlop,
                left: hitSlop,
              }
            : (hitSlop ?? undefined)
        }
        label={label}
        onPress={control.open}
        style={[a.flex_1, a.justify_between, a.pl_lg, a.pr_md]}
        color="secondary"
        size="large"
        shape="rectangular">
        <>{children}</>
      </Button>
    )
  }
}

const defaultValueText: NonNullable<ValueProps['children']> = value =>
  value.label

export function ValueText({
  placeholder,
  children = defaultValueText,
  style,
}: ValueProps) {
  const [value] = useContext(ValueTextContext)
  const t = useTheme()

  let text = value && children(value)
  if (!text) text = placeholder

  return (
    <ButtonText style={[t.atoms.text, a.font_normal, style]} emoji>
      {text}
    </ButtonText>
  )
}

export function Icon({}: IconProps) {
  return <ButtonIcon icon={ChevronUpDownIcon} />
}

export function Content<T>({
  items,
  valueExtractor = defaultItemValueExtractor,
  ...props
}: ContentProps<T>) {
  const {control, ...context} = useSelectContext()
  const [, setValue] = useContext(ValueTextContext)

  useLayoutEffect(() => {
    const item = items.find(item => valueExtractor(item) === context.value)
    if (item) {
      setValue(item as unknown as SelectedItem)
    }
  }, [items, context.value, valueExtractor, setValue])

  /* Splito: a picker is a FormSheet (§ 26.8: only the cross, a choice applies at once), not a bare Dialog with a FlatList. */
  return (
    <FormSheet.Outer control={control} testID="select-sheet">
      <ContentInner
        control={control}
        items={items}
        valueExtractor={valueExtractor}
        {...props}
        {...context}
      />
    </FormSheet.Outer>
  )
}

function ContentInner<T>({
  control,
  label,
  items,
  renderItem,
  valueExtractor,
  ...context
}: ContentProps<T> & ContextType) {
  const {_} = useLingui()

  return (
    <Context.Provider value={{control, ...context}}>
      <FormSheet.Inner deferBody title={label ?? _(msg`Select an option`)}>
        {items.map((item, index) => (
          <Fragment key={valueExtractor!(item)}>
            {renderItem(item, index, context.value)}
          </Fragment>
        ))}
      </FormSheet.Inner>
    </Context.Provider>
  )
}

function defaultItemValueExtractor(item: unknown) {
  return (item as {value: string}).value
}

const ItemContext = createContext<{
  selected: boolean
  hovered: boolean
  focused: boolean
  pressed: boolean
}>({
  selected: false,
  hovered: false,
  focused: false,
  pressed: false,
})
ItemContext.displayName = 'SelectItemContext'

export function useItemContext() {
  return useContext(ItemContext)
}

export function Item({children, value, label, testID, style}: ItemProps) {
  const t = useTheme()
  const control = Dialog.useDialogContext()
  const {value: selected, onValueChange} = useSelectContext()

  return (
    <Button
      /* Splito: a radio that says it is checked, so a screen reader hears the current option (was role="listitem"). */
      role="radio"
      aria-checked={value === selected}
      testID={testID}
      label={label}
      style={[a.flex_1]}
      onPress={() => {
        control.close(() => {
          onValueChange?.(value)
        })
      }}>
      {({hovered, focused, pressed}) => (
        <ItemContext.Provider
          value={{selected: value === selected, hovered, focused, pressed}}>
          <View
            style={[
              a.flex_1,
              a.px_xl,
              (focused || pressed) && t.atoms.bg_contrast_25,
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.py_md,
              style,
            ]}>
            {children}
          </View>
        </ItemContext.Provider>
      )}
    </Button>
  )
}

export function ItemText({children, style, emoji}: ItemTextProps) {
  const {selected} = useItemContext()

  return (
    <Text
      style={[a.text_md, selected && a.font_semi_bold, style]}
      emoji={emoji}>
      {children}
    </Text>
  )
}

export function ItemIndicator({icon: Icon}: ItemIndicatorProps) {
  const {selected, focused, hovered} = useItemContext()

  if (Icon) {
    return <View style={{width: 24}}>{selected && <Icon size="md" />}</View>
  }

  return (
    <BaseRadio
      selected={selected}
      focused={focused}
      hovered={hovered}
      isInvalid={false}
      disabled={false}
    />
  )
}

export function Separator() {
  const t = useTheme()

  return (
    <View
      style={[
        a.flex_1,
        a.border_b,
        t.atoms.border_contrast_low,
        a.mx_xl,
        a.my_xs,
      ]}
    />
  )
}
