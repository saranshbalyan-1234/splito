// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/composer/Composer.tsx (KeyboardAvoidingView, useKeyboardVerticalOffset)
import {useRef} from 'react'
import {ScrollView} from 'react-native'
import {KeyboardAvoidingView} from 'react-native-keyboard-controller'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {
  type NavigationAction,
  useNavigation,
  usePreventRemove,
} from '@react-navigation/native'

import {useWorkAtStake} from '#/lib/pwa/workAtStake'
import {atoms as a, web} from '#/alf'
import * as Composer from '#/components/Composer'
import * as Prompt from '#/components/Prompt'
import {IS_IOS, IS_IPAD, IS_LIQUID_GLASS, IS_NATIVE} from '#/env'
import {
  DiscardPrompt,
  Footer,
  type FooterProps,
  Header,
  SheetContext,
  useIsScrolled,
} from './shared'

/**
 * A form sheet that is a route of its own (Add / Edit expense, Add friend,
 * New group), presented the way Bluesky presents its composer: an iOS page
 * sheet, Android's full-screen slide-up, and on web the same centred dialog
 * or phone sheet as `FormSheet.Outer`. Same top bar, footer and "Discard
 * changes?" as the dialog sheets; on native a swipe down or Back with
 * unsaved changes asks first too.
 */
export function Screen({
  testID,
  title,
  closeHint,
  isDirty,
  onClose,
  discardDescription,
  renderDiscardPrompt,
  footer,
  readout,
  scrollTestID,
  overlay,
  children,
}: {
  testID: string
  title: string
  closeHint?: string
  /** Unsaved changes, and not saving: closing asks first. */
  isDirty: boolean
  /** Leaves the route. */
  onClose: () => void
  discardDescription?: string
  /** Replaces the "Discard changes?" prompt (the composer offers to keep a draft). */
  renderDiscardPrompt?: (props: {
    control: Prompt.PromptControlProps
    onDiscardConfirmed: () => void
  }) => React.ReactNode
  footer?: FooterProps
  readout?: React.ReactNode
  scrollTestID?: string
  /** Drawn over the whole sheet, e.g. the saved check. */
  overlay?: React.ReactNode
  children: React.ReactNode
}) {
  const navigation = useNavigation()
  const discardControl = Prompt.usePromptControl()
  const keyboardVerticalOffset = useKeyboardVerticalOffset()
  const pendingAction = useRef<NavigationAction | null>(null)
  const [isScrolled, onScroll] = useIsScrolled()
  useWorkAtStake(isDirty)

  /* Native: a swipe down or Back is a route removal, so ask before it happens. */
  usePreventRemove(IS_NATIVE && isDirty, ({data}) => {
    pendingAction.current = data.action
    discardControl.open()
  })

  const requestClose = () => {
    if (!isDirty || IS_NATIVE) onClose()
    else discardControl.open()
  }
  const leave = () => {
    const action = pendingAction.current
    pendingAction.current = null
    if (action) navigation.dispatch(action)
    else onClose()
  }

  return (
    <SheetContext.Provider value={{requestClose, setIsDirty: () => {}, testID}}>
      <Composer.Outer testID={testID} onDismiss={requestClose}>
        <Header
          title={title}
          onClose={requestClose}
          closeHint={closeHint}
          isScrolled={isScrolled}
        />
        <KeyboardAvoidingView
          behavior={IS_IOS ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          automaticOffset={IS_IPAD}
          style={[a.flex_1, web([a.flex_shrink, {minHeight: 0}])]}>
          <ScrollView
            testID={scrollTestID}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={50}
            style={[a.flex_1, web([a.flex_shrink, {minHeight: 0}])]}
            contentContainerStyle={[a.pb_2xl]}>
            {children}
          </ScrollView>
          {footer ? <Footer {...footer} readout={readout} /> : null}
        </KeyboardAvoidingView>
        {overlay}
        {renderDiscardPrompt ? (
          renderDiscardPrompt({
            control: discardControl,
            onDiscardConfirmed: leave,
          })
        ) : (
          <DiscardPrompt
            control={discardControl}
            description={discardDescription}
            onDiscardConfirmed={leave}
          />
        )}
      </Composer.Outer>
    </SheetContext.Provider>
  )
}

function useKeyboardVerticalOffset() {
  const insets = useSafeAreaInsets()

  // the keyboardavoidingview has bottom padding to avoid being obscured by the safe area when keyboard is closed.
  // however, this leads to a gap when the keyboard is open. we account for that by subtracting the bottom inset when open.
  let keyboardVerticalOffset = insets.bottom * -1

  // iPad sheets measure their own position via automaticOffset.
  if (IS_IPAD) return keyboardVerticalOffset

  // iOS requires a bit of extra offset to account for the native sheet not being at the top of the screen
  if (IS_IOS) {
    // they ditched the gap behaviour on 26
    if (IS_LIQUID_GLASS) {
      keyboardVerticalOffset += insets.top
    }

    // iPhone SE
    else if (insets.top === 20) {
      keyboardVerticalOffset += 40
    }

    // all other iPhones on <26
    else {
      keyboardVerticalOffset += insets.top + 10
    }
  }

  return keyboardVerticalOffset
}
