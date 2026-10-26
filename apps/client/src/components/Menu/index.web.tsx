// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Menu/index.web.tsx (phone drawer items and groups from src/components/Menu/index.tsx)
import {
  cloneElement,
  createContext,
  forwardRef,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import {Pressable, type StyleProp, type TextStyle, View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import flattenReactChildren from 'react-keyed-flatten-children'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, flatten, flattenToCSS, useTheme, web} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {useIsWebDrawer} from '#/components/Dialog/drawer.web'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {
  Context,
  ItemContext,
  useMenuContext,
  useMenuItemContext,
} from '#/components/Menu/context'
import {
  type ContextType,
  type GroupProps,
  type ItemIconProps,
  type ItemProps,
  type ItemTextProps,
  type OuterProps,
  type RadixPassThroughTriggerProps,
  type TriggerProps,
} from '#/components/Menu/types'
import {Portal} from '#/components/Portal'
import {Text} from '#/components/Typography'

export {type DialogControlProps as MenuControlProps} from '#/components/Dialog'

export {useMenuContext}

/*
 * Splito (owner rule: every modal on a phone is a drawer): below 800px the
 * menu opens as Dialog's bottom drawer with Bluesky's native menu rows, not
 * a Radix dropdown. Same control, same consumers.
 */
const InDrawer = createContext(false)
InDrawer.displayName = 'MenuInDrawer'

export function useMenuControl(): Dialog.DialogControlProps {
  const id = useId()
  const [isOpen, setIsOpen] = useState(false)

  return useMemo(
    () => ({
      id,
      ref: {current: null},
      isOpen,
      open() {
        setIsOpen(true)
      },
      close(cb) {
        setIsOpen(false)
        if (cb) setTimeout(cb)
      },
    }),
    [id, isOpen, setIsOpen],
  )
}

export function Root({
  children,
  control,
}: React.PropsWithChildren<{
  control?: Dialog.DialogControlProps
}>) {
  const {_} = useLingui()
  const isDrawer = useIsWebDrawer()
  const defaultControl = useMenuControl()
  const context = useMemo<ContextType>(
    () => ({
      control: control || defaultControl,
    }),
    [control, defaultControl],
  )
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (context.control.isOpen && !open) {
        context.control.close()
      } else if (!context.control.isOpen && open) {
        context.control.open()
      }
    },
    [context.control],
  )

  return (
    <Context.Provider value={context}>
      {context.control.isOpen && !isDrawer && (
        <Portal>
          <Pressable
            style={[a.fixed, a.inset_0, a.z_50]}
            onPress={() => context.control.close()}
            accessibilityHint=""
            accessibilityLabel={_(
              msg`Context menu backdrop, click to close the menu.`,
            )}
          />
        </Portal>
      )}
      <DropdownMenu.Root
        open={context.control.isOpen && !isDrawer}
        onOpenChange={onOpenChange}>
        {children}
      </DropdownMenu.Root>
    </Context.Provider>
  )
}

const RadixTriggerPassThrough = forwardRef(
  (
    props: {
      children: (
        props: RadixPassThroughTriggerProps & {
          ref: React.Ref<HTMLElement>
        },
      ) => React.ReactNode
    },
    ref,
  ) => {
    // @ts-expect-error Radix provides no types of this stuff
    return props.children({...props, ref})
  },
)
RadixTriggerPassThrough.displayName = 'RadixTriggerPassThrough'

export function Trigger({
  children,
  label,
  role = 'button',
  hint,
}: TriggerProps) {
  const {control} = useMenuContext()
  const {
    state: hovered,
    onIn: onMouseEnter,
    onOut: onMouseLeave,
  } = useInteractionState()
  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()

  return (
    <DropdownMenu.Trigger asChild>
      <RadixTriggerPassThrough>
        {props =>
          children({
            IS_NATIVE: false,
            control,
            state: {
              hovered,
              focused,
              pressed: false,
            },
            props: {
              ...props,
              // No-op override to prevent false positive that interprets mobile scroll as a tap.
              // This requires the custom onPress handler below to compensate.
              // https://github.com/radix-ui/primitives/issues/1912
              onPointerDown: undefined,
              onPress: () => {
                if (window.event instanceof KeyboardEvent) {
                  // The onPointerDown hack above is not relevant to this press, so don't do anything.
                  return
                }
                // Compensate for the disabled onPointerDown above by triggering it manually.
                if (control.isOpen) {
                  control.close()
                } else {
                  control.open()
                }
              },
              onFocus: onFocus,
              onBlur: onBlur,
              onMouseEnter,
              onMouseLeave,
              accessibilityHint: hint,
              accessibilityLabel: label,
              accessibilityRole: role,
            },
          })
        }
      </RadixTriggerPassThrough>
    </DropdownMenu.Trigger>
  )
}

export function Outer(props: OuterProps) {
  return useIsWebDrawer() ? (
    <DrawerOuter {...props} />
  ) : (
    <DropdownOuter {...props} />
  )
}

/** Bluesky's native menu: Dialog (here the web drawer) driven by the menu's control. */
function DrawerOuter({children}: OuterProps) {
  const {_} = useLingui()
  const context = useMenuContext()
  const dialog = Dialog.useDialogControl()
  const isOpen = Boolean(context.control.isOpen)
  const shown = useRef(false)

  useEffect(() => {
    if (isOpen) {
      shown.current = true
      dialog.open()
    } else if (shown.current) {
      shown.current = false
      dialog.close()
    }
  }, [isOpen, dialog])

  return (
    <Dialog.Outer
      control={dialog}
      onClose={() => {
        shown.current = false
        if (context.control.isOpen) context.control.close()
      }}>
      {/* Re-wrap with context since Dialogs are portal-ed to root */}
      <Context.Provider value={context}>
        <InDrawer.Provider value>
          <Dialog.ScrollableInner label={_(msg`Menu`)}>
            <View style={[a.gap_lg]}>{children}</View>
          </Dialog.ScrollableInner>
        </InDrawer.Provider>
      </Context.Provider>
    </Dialog.Outer>
  )
}

function DropdownOuter({
  children,
  style,
  onCloseAutoFocus,
  align,
  sideOffset = 5,
}: OuterProps) {
  const t = useTheme()
  const reduceMotionEnabled = useShouldReduceMotion()

  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={{left: 5, right: 5, bottom: 5}}
        loop
        aria-label="Test"
        onCloseAutoFocus={onCloseAutoFocus}
        className="dropdown-menu-transform-origin dropdown-menu-constrain-size">
        <View
          style={[
            a.rounded_sm,
            a.p_xs,
            a.border,
            t.name === 'light' ? t.atoms.bg : t.atoms.bg_contrast_25,
            t.atoms.shadow_md,
            t.atoms.border_contrast_low,
            a.overflow_auto,
            !reduceMotionEnabled && a.zoom_fade_in,
            style,
          ]}>
          {children}
        </View>

        {/* Disabled until we can fix positioning
        <DropdownMenu.Arrow
          className="DropdownMenuArrow"
          fill={
            (t.name === 'light' ? t.atoms.bg : t.atoms.bg_contrast_25)
              .backgroundColor
          }
        />
          */}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

export function Item(props: ItemProps) {
  return useContext(InDrawer) ? (
    <DrawerItem {...props} />
  ) : (
    <DropdownItem {...props} />
  )
}

/** Bluesky's native menu row (bordered, 44pt tall), closing the menu after its action. */
function DrawerItem({
  children,
  label,
  style,
  onPress,
  destructive = false,
  ...rest
}: ItemProps) {
  const t = useTheme()
  const {control} = useMenuContext()
  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()
  const {
    state: pressed,
    onIn: onPressIn,
    onOut: onPressOut,
  } = useInteractionState()

  return (
    <Pressable
      {...rest}
      role="menuitem"
      accessibilityHint=""
      accessibilityLabel={label}
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={e => {
        onPress(e)
        if (!e.defaultPrevented) control.close()
      }}
      onPressIn={e => {
        onPressIn()
        rest.onPressIn?.(e)
      }}
      onPressOut={e => {
        onPressOut()
        rest.onPressOut?.(e)
      }}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_md,
        a.rounded_md,
        a.overflow_hidden,
        a.border,
        t.atoms.bg_contrast_25,
        t.atoms.border_contrast_low,
        {minHeight: 44, paddingVertical: 10},
        style,
        (focused || pressed) && !rest.disabled && [t.atoms.bg_contrast_50],
      ]}>
      <ItemContext.Provider
        value={{disabled: Boolean(rest.disabled), destructive}}>
        {children}
      </ItemContext.Provider>
    </Pressable>
  )
}

function DropdownItem({
  children,
  label,
  onPress,
  style,
  destructive = false,
  ...rest
}: ItemProps) {
  const t = useTheme()
  const {control} = useMenuContext()
  const {
    state: hovered,
    onIn: onMouseEnter,
    onOut: onMouseLeave,
  } = useInteractionState()
  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()

  return (
    <DropdownMenu.Item asChild>
      <Pressable
        {...rest}
        className="radix-dropdown-item"
        accessibilityHint=""
        accessibilityLabel={label}
        onPress={e => {
          onPress(e)

          /**
           * Ported forward from Radix
           * @see https://www.radix-ui.com/primitives/docs/components/dropdown-menu#item
           */
          if (!e.defaultPrevented) {
            control.close()
          }
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        // need `flatten` here for Radix compat
        style={flatten([
          a.flex_row,
          a.align_center,
          a.gap_lg,
          a.py_sm,
          a.rounded_xs,
          a.overflow_hidden,
          {minHeight: 32, paddingHorizontal: 10},
          web({outline: 0}),
          (hovered || focused) &&
            !rest.disabled && [
              web({outline: '0 !important'}),
              t.name === 'light'
                ? t.atoms.bg_contrast_25
                : t.atoms.bg_contrast_50,
            ],
          style,
        ])}
        {...web({
          onMouseEnter,
          onMouseLeave,
        })}>
        <ItemContext.Provider
          value={{disabled: Boolean(rest.disabled), destructive}}>
          {children}
        </ItemContext.Provider>
      </Pressable>
    </DropdownMenu.Item>
  )
}

export function ItemText({children, style}: ItemTextProps) {
  const t = useTheme()
  const {disabled, destructive} = useMenuItemContext()
  const inDrawer = useContext(InDrawer)
  return (
    <Text
      numberOfLines={inDrawer ? 1 : undefined}
      style={[
        a.flex_1,
        inDrawer && a.text_md,
        a.font_semi_bold,
        t.atoms.text_contrast_high,
        style,
        destructive && {color: t.palette.negative_500},
        disabled && t.atoms.text_contrast_low,
      ]}>
      {children}
    </Text>
  )
}

export function ItemIcon({icon: Comp, position = 'left', fill}: ItemIconProps) {
  const t = useTheme()
  const {disabled, destructive} = useMenuItemContext()
  const inDrawer = useContext(InDrawer)
  return (
    <View
      style={[
        position === 'left' && {
          marginLeft: -2,
        },
        position === 'right' && {
          marginRight: -2,
          marginLeft: 12,
        },
      ]}>
      <Comp
        size={inDrawer ? 'lg' : 'md'}
        fill={
          fill
            ? fill({disabled})
            : disabled
              ? t.atoms.text_contrast_low.color
              : destructive
                ? t.palette.negative_500
                : t.atoms.text_contrast_medium.color
        }
      />
    </View>
  )
}

export function ItemRadio({selected}: {selected: boolean}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.justify_center,
        a.align_center,
        a.rounded_full,
        t.atoms.border_contrast_high,
        {
          borderWidth: 1,
          height: 20,
          width: 20,
        },
      ]}>
      {selected ? (
        <View
          style={[
            a.absolute,
            a.rounded_full,
            {height: 14, width: 14},
            selected
              ? {
                  backgroundColor: t.palette.primary_500,
                }
              : {},
          ]}
        />
      ) : null}
    </View>
  )
}

export function LabelText({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<TextStyle>
}) {
  const t = useTheme()
  if (useContext(InDrawer)) {
    return (
      <Text
        style={[
          a.font_semi_bold,
          t.atoms.text_contrast_medium,
          {marginBottom: -8},
          style,
        ]}>
        {children}
      </Text>
    )
  }
  return (
    <Text
      style={[
        a.font_semi_bold,
        a.p_sm,
        t.atoms.text_contrast_low,
        a.leading_snug,
        {paddingHorizontal: 10},
        style,
      ]}>
      {children}
    </Text>
  )
}

export function Group({children, style}: GroupProps) {
  const t = useTheme()
  if (!useContext(InDrawer)) return children
  // Bluesky's native group: one bordered card, a hairline between rows.
  return (
    <View
      style={[
        a.rounded_lg,
        a.curve_continuous,
        a.overflow_hidden,
        a.border,
        t.atoms.border_contrast_low,
        style,
      ]}>
      {flattenReactChildren(children).map((child, i) =>
        isValidElement(child) && child.type === Item ? (
          <Fragment key={i}>
            {i > 0 ? (
              <View style={[a.border_b, t.atoms.border_contrast_low]} />
            ) : null}
            {cloneElement(child, {
              // @ts-expect-error cloneElement is not aware of the types
              style: {borderRadius: 0, borderWidth: 0},
            })}
          </Fragment>
        ) : (
          child
        ),
      )}
    </View>
  )
}

export function Divider() {
  const t = useTheme()
  if (useContext(InDrawer)) return null
  return (
    <DropdownMenu.Separator
      style={flattenToCSS([
        a.my_xs,
        t.atoms.bg_contrast_100,
        a.flex_shrink_0,
        {height: 1},
      ])}
    />
  )
}

export function ContainerItem() {
  return null
}
