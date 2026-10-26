// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Dialog/index.tsx (FlatListFooter keyboard offset)
import {useEffect} from 'react'
import {View} from 'react-native'
import {useReanimatedKeyboardAnimation} from 'react-native-keyboard-controller'
import Animated, {useAnimatedStyle} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {atoms as a, ios} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {IS_IOS} from '#/env'
import {Footer, type FooterProps, Header, useFormSheet} from './shared'

export * from './shared'
export {Screen} from './Screen'

/**
 * The sheet's top bar, scrolling body and footer. With `footer` it is a form
 * (Cancel and the primary action at the bottom); without, a picker that
 * closes with the cross alone. `isDirty` arms the "Discard changes?" prompt.
 */
export function Inner({
  title,
  isDirty = false,
  footer,
  readout,
  children,
}: {
  title: string
  isDirty?: boolean
  footer?: FooterProps
  /** A live line just above the footer, e.g. what is left to assign. */
  readout?: React.ReactNode
  children: React.ReactNode
}) {
  const {requestClose, setIsDirty, inset} = useFormSheet()
  useEffect(() => setIsDirty(isDirty), [isDirty, setIsDirty])

  return (
    <Dialog.ScrollableInner
      label={title}
      contentContainerStyle={[a.pt_0, a.px_0]}
      header={<Header title={title} onClose={requestClose} />}
      footer={
        footer ? (
          <KeyboardSticky>
            <Footer {...footer} readout={readout} />
          </KeyboardSticky>
        ) : undefined
      }>
      <View style={[inset, a.pt_xs, a.pb_lg]}>{children}</View>
    </Dialog.ScrollableInner>
  )
}

/* Keeps the footer above the iOS keyboard, as Bluesky's Dialog.FlatListFooter does. */
function KeyboardSticky({children}: {children: React.ReactNode}) {
  const {bottom} = useSafeAreaInsets()
  const {presentationBottomOffset} = Dialog.useDialogContext()
  const {height} = useReanimatedKeyboardAnimation()
  const animatedStyle = useAnimatedStyle(() => {
    if (!IS_IOS) return {}
    return {
      transform: [
        {
          translateY: Math.min(
            0,
            height.get() + bottom + presentationBottomOffset - 10,
          ),
        },
      ],
    }
  })
  return (
    <Animated.View style={[a.z_10, ios(animatedStyle)]}>
      {children}
    </Animated.View>
  )
}
