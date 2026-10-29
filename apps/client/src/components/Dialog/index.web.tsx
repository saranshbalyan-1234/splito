// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Dialog/index.web.tsx
import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  FlatList,
  type FlatListProps,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  type ScrollView,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import Animated from 'react-native-reanimated'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import * as DismissableLayer from '@radix-ui/react-dismissable-layer'
import * as FocusGuards from '@radix-ui/react-focus-guards'
import * as FocusScope from '@radix-ui/react-focus-scope'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {logger} from '#/logger'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {useDialogStateControlContext} from '#/state/dialogs'
import {useShowShell} from '#/state/shell/minimal-mode'
import {type ListMethods} from '#/view/com/util/List'
import {atoms as a, flatten, useBreakpoints, useTheme, web} from '#/alf'
import {Context, SheetOwnerContext} from '#/components/Dialog/context'
import {
  DrawerContext,
  DrawerHandle,
  DrawerScrim,
  useDrawer,
  useDrawerContext,
  useIsWebDrawer,
} from '#/components/Dialog/drawer.web'
import {
  type DialogControlProps,
  type DialogInnerProps,
  type DialogOuterProps,
} from '#/components/Dialog/types'
import {Portal} from '#/components/Portal'

export {useDialogContext, useDialogControl} from '#/components/Dialog/context'
export * from '#/components/Dialog/shared'
export * from '#/components/Dialog/types'
export * from '#/components/Dialog/utils'
export {Input} from '#/components/forms/TextField'

// 100 minus 10vh of paddingVertical
export const WEB_DIALOG_HEIGHT = '80vh'

const stopPropagation = (e: any) => e.stopPropagation()
const preventDefault = (e: any) => e.preventDefault()

export function Outer({
  children,
  control,
  onOpen,
  onClose,
  webOptions,
}: React.PropsWithChildren<DialogOuterProps>) {
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()
  const [isOpen, setIsOpen] = useState(false)
  const {setDialogIsOpen} = useDialogStateControlContext()
  /* A dialog opening shows the header, bottom bar and FAB again (ARCHITECTURE 26.4). */
  const showShell = useShowShell()
  /*
   * Splito: on phones the dialog is a drawer that slides away before it
   * unmounts; close callbacks wait for that, as they wait for the native
   * sheet's dismissal.
   */
  const isDrawer = useIsWebDrawer()
  const reduceMotion = useShouldReduceMotion()
  const [isClosing, setIsClosing] = useState(false)
  const pendingClose = useRef<{cb?: () => void} | null>(null)

  const open = useCallback(() => {
    showShell()
    onOpen?.()
    setDialogIsOpen(control.id, true)
    control.url?.notifyOpen()
    pendingClose.current = null
    setIsClosing(false)
    setIsOpen(true)
  }, [setIsOpen, setDialogIsOpen, control.id, control.url, onOpen, showShell])

  const finishClose = useCallback(
    (cb?: () => void) => {
      setDialogIsOpen(control.id, false)
      setIsOpen(false)
      setIsClosing(false)

      try {
        /*
         * Nested rather than `&&`: React Compiler cannot lower a logical
         * expression in a test position inside a `try`.
         */
        if (cb) {
          if (typeof cb === 'function') {
            // This timeout ensures that the callback runs at the same time as it would on native. I.e.
            // console.log('Step 1') -> close(() => console.log('Step 3')) -> console.log('Step 2')
            // This should always output 'Step 1', 'Step 2', 'Step 3', but without the timeout it would output
            // 'Step 1', 'Step 3', 'Step 2'.
            setTimeout(cb)
          }
        }
      } catch (e: any) {
        logger.error(`Dialog closeCallback failed`, {
          message: e.message,
        })
      }

      control.url?.notifyClosed()
      onClose?.()
    },
    [control.id, control.url, onClose, setDialogIsOpen],
  )

  const animateExit = isOpen && isDrawer && !reduceMotion
  const close = useCallback<DialogControlProps['close']>(
    cb => {
      if (!animateExit) return finishClose(cb)
      // A second close while sliding away keeps the first one's callback.
      pendingClose.current = {cb: pendingClose.current?.cb ?? cb}
      setIsClosing(true)
    },
    [animateExit, finishClose],
  )
  const onExited = useCallback(() => {
    const pending = pendingClose.current
    pendingClose.current = null
    if (pending) finishClose(pending.cb)
  }, [finishClose])
  const drawer = useMemo(
    () => ({isDrawer, isClosing, onExited}),
    [isDrawer, isClosing, onExited],
  )

  /*
   * When a press starts inside the dialog and ends on the backdrop, such as
   * a drag to select text in a field, the browser fires the click on their
   * common ancestor, which is outside the dialog. Only a press that started
   * where it ended counts as a background press.
   */
  const pressStartTarget = useRef<unknown>(null)

  const handleBackgroundPress = useCallback(
    async (e: GestureResponderEvent) => {
      const startTarget = pressStartTarget.current
      pressStartTarget.current = null
      if (startTarget && startTarget !== e.target) return
      if (isClosing) return
      webOptions?.onBackgroundPress ? webOptions.onBackgroundPress(e) : close()
    },
    [webOptions, close, isClosing],
  )

  /* A host that wanted this dialog open before it existed (an address, a held link) is told it can now. */
  const notifyMounted = control.url?.notifyMounted
  useEffect(() => notifyMounted?.(), [notifyMounted])

  useImperativeHandle(
    control.ref,
    () => ({
      open,
      close,
    }),
    [close, open],
  )

  const context = useMemo(
    () => ({
      close,
      isNativeDialog: false,
      presentationBottomOffset: 0,
      isNativePopover: false,
      nativeSnapPoint: 0,
      disableDrag: false,
      setDisableDrag: () => {},
      isWithinDialog: true,
      isHeightConstrained: false,
      shouldMeasureContentHeight: false,
      setDesiredContentHeight: () => {},
    }),
    [close],
  )

  return (
    <>
      {isOpen && (
        <Portal>
          <Context.Provider value={context}>
            <DrawerContext.Provider value={drawer}>
              <RemoveScrollBar />
              <Pressable
                accessibilityHint={undefined}
                accessibilityLabel={_(msg`Close active dialog`)}
                onPointerDown={e => {
                  pressStartTarget.current = e.target
                }}
                onPress={handleBackgroundPress}>
                <View
                  style={[
                    web(a.fixed),
                    a.inset_0,
                    a.z_10,
                    !isDrawer && a.px_xl,
                    webOptions?.alignCenter ? a.justify_center : undefined,
                    a.align_center,
                    isDrawer
                      ? {overflowY: 'hidden'}
                      : {
                          overflowY: 'auto',
                          paddingVertical: gtMobile
                            ? '10vh'
                            : a.pt_xl.paddingTop,
                        },
                    // Clicks fall through to the page while a drawer slides away.
                    isClosing && web({pointerEvents: 'none'}),
                  ]}>
                  {/* A drawer draws its own scrim, which follows the sheet. */}
                  {!isDrawer && <Backdrop />}
                  {/**
                   * This is needed to prevent centered dialogs from overflowing
                   * above the screen, and provides a "natural" centering so that
                   * stacked dialogs appear relatively aligned.
                   */}
                  <View
                    style={[
                      a.w_full,
                      a.z_20,
                      a.align_center,
                      web({minHeight: '60vh', position: 'static'}),
                    ]}>
                    {control.url ? (
                      <SheetOwnerContext.Provider value={control.url.owner}>
                        {children}
                      </SheetOwnerContext.Provider>
                    ) : (
                      children
                    )}
                  </View>
                </View>
              </Pressable>
            </DrawerContext.Provider>
          </Context.Provider>
        </Portal>
      )}
    </>
  )
}

/**
 * @deprecated use `Dialog.ScrollableInner` instead
 */
export function Inner({
  children,
  style,
  label,
  accessibilityLabelledBy,
  accessibilityDescribedBy,
  header,
  footer,
  contentContainerStyle,
}: DialogInnerProps) {
  const t = useTheme()
  const {close} = useContext(Context)
  const {gtMobile} = useBreakpoints()
  const {isDrawer, isClosing, onExited} = useDrawerContext()
  /*
   * Splito: a phone drawer. `close` is the context's, so a form sheet's
   * "Discard changes?" check runs on a drag down too.
   */
  const drawer = useDrawer({
    enabled: isDrawer,
    onRequestClose: () => close(),
    isClosing,
    onExited,
  })
  const reduceMotionEnabled = drawer.reduceMotion
  FocusGuards.useFocusGuards()
  return (
    <>
      {isDrawer && (
        <DrawerScrim
          scrimStyle={drawer.scrimStyle}
          reduceMotion={reduceMotionEnabled}
        />
      )}
      {/*
       * The drawer's moving frame. Outside the focus scope: its Slot spreads a
       * style array into an object, so the dialog's own style stays flat.
       * Without a drawer it lays out nothing (`display: contents`).
       */}
      <Animated.View
        onLayout={isDrawer ? drawer.onLayout : undefined}
        style={[
          isDrawer ? drawer.frameStyle : web({display: 'contents'}),
          drawer.sheetStyle,
        ]}>
        {/*
         * Once the sheet starts to leave, focus is free: a trap held for the
         * whole exit pulled focus back from a field the user had already
         * tapped, and their first keystrokes went nowhere. On unmount focus
         * returns to the opener only if it was left inside the sheet.
         */}
        <FocusScope.FocusScope
          loop
          asChild
          trapped={!isClosing}
          onUnmountAutoFocus={e => {
            const active = document.activeElement
            if (active && active !== document.body) e.preventDefault()
          }}>
          <View
            role="dialog"
            aria-role="dialog"
            aria-label={label}
            aria-labelledby={accessibilityLabelledBy}
            aria-describedby={accessibilityDescribedBy}
            onClick={stopPropagation}
            onStartShouldSetResponder={_ => true}
            onTouchEnd={stopPropagation}
            // note: flatten is required for some reason -sfn
            style={flatten([
              a.relative,
              a.rounded_md,
              a.w_full,
              a.border,
              t.atoms.bg,
              {
                cursor: 'default', // The overlay applies `cursor: 'pointer'` to all children.
                maxWidth: 600,
                borderColor: t.palette.contrast_200,
                shadowColor: t.palette.black,
                shadowOpacity: t.name === 'light' ? 0.1 : 0.4,
                shadowRadius: 30,
              },
              isDrawer
                ? reduceMotionEnabled && a.fade_in
                : !reduceMotionEnabled && a.zoom_fade_in,
              style,
              // After `style`: a caller's popup width or radius never applies to the drawer.
              isDrawer && drawer.sheetFrameStyle,
            ])}>
            {isDrawer && <DrawerHandle handleProps={drawer.handleProps} />}
            <DismissableLayer.DismissableLayer
              onInteractOutside={preventDefault}
              onFocusOutside={preventDefault}
              onDismiss={close}
              style={
                isDrawer
                  ? {
                      display: 'flex',
                      flexDirection: 'column',
                      flexGrow: 1,
                      flexShrink: 1,
                      minHeight: 0,
                    }
                  : {height: '100%', display: 'flex', flexDirection: 'column'}
              }>
              {header}
              <View
                style={[
                  gtMobile ? a.p_2xl : a.p_xl,
                  isDrawer &&
                    web({flexShrink: 1, minHeight: 0, overflowY: 'auto'}),
                  contentContainerStyle,
                ]}>
                {children}
              </View>
              {footer}
            </DismissableLayer.DismissableLayer>
          </View>
        </FocusScope.FocusScope>
      </Animated.View>
    </>
  )
}

/*
 * There is no inner ScrollView on web - the ref is accepted for parity with
 * the native variant and never attached, so native-only scrolling code in
 * shared callers stays a no-op here.
 */
export function ScrollableInner({
  ref: _ref,
  ...props
}: DialogInnerProps & {
  ref?: React.Ref<React.ComponentRef<typeof ScrollView>>
}) {
  return <Inner {...props} />
}

export const InnerFlatList = forwardRef<
  ListMethods,
  FlatListProps<any> & {label?: string} & {
    webInnerStyle?: StyleProp<ViewStyle>
    webInnerContentContainerStyle?: StyleProp<ViewStyle>
    footer?: React.ReactNode
  }
>(function InnerFlatList(
  {
    label,
    style,
    webInnerStyle,
    webInnerContentContainerStyle,
    footer,
    ...props
  },
  ref,
) {
  const {gtMobile} = useBreakpoints()
  const {isDrawer} = useDrawerContext()
  return (
    <Inner
      /*
       * Most shared callers cannot pass a label since the native variant has
       * no such prop; aria-label is simply absent for them, as before.
       */
      label={label as string}
      style={[
        a.overflow_hidden,
        a.px_0,
        web({maxHeight: WEB_DIALOG_HEIGHT}),
        // A drawer's list gets a set height to scroll in; the drawer caps it above the keyboard.
        isDrawer && web({height: WEB_DIALOG_HEIGHT}),
        webInnerStyle,
      ]}
      contentContainerStyle={[a.h_full, a.px_0, webInnerContentContainerStyle]}>
      <FlatList
        /*
         * The FlatList instance satisfies the (web) ListMethods interface
         * shared callers hold their refs as, except scrollToTop, which no
         * platform-agnostic caller can use since the native ListMethods
         * (FlatList) lacks it too.
         */
        ref={ref as React.Ref<FlatList>}
        style={[a.h_full, gtMobile ? a.px_2xl : a.px_xl, style]}
        {...props}
      />
      {footer}
    </Inner>
  )
})

export function FlatListFooter({
  children,
  onLayout,
  border = true,
}: {
  children: React.ReactNode
  onLayout?: (event: LayoutChangeEvent) => void
  border?: boolean
}) {
  const t = useTheme()

  return (
    <View
      onLayout={onLayout}
      style={[
        a.absolute,
        a.bottom_0,
        a.w_full,
        a.z_10,
        t.atoms.bg,
        border && a.border_t,
        t.atoms.border_contrast_low,
        a.px_lg,
        a.py_md,
      ]}>
      {children}
    </View>
  )
}

export {CloseButton as Close} from '#/components/Dialog/CloseButton'

/*
 * Splito: a phone drawer draws its handle inside `Inner`, where the drag
 * lives; props are accepted for parity with the native variant.
 */
export function Handle(_props: {difference?: boolean; fill?: string}) {
  return null
}

export function Backdrop() {
  const t = useTheme()
  const reduceMotionEnabled = useShouldReduceMotion()
  return (
    <View style={{opacity: 0.8}}>
      <View
        style={[
          a.fixed,
          a.inset_0,
          {backgroundColor: t.palette.black},
          !reduceMotionEnabled && a.fade_in,
        ]}
      />
    </View>
  )
}
