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
import {useIsStoreCovered} from '#/state/demo'
import {atoms as a, web} from '#/alf'
import * as Composer from '#/components/Composer'
import * as Prompt from '#/components/Prompt'
import {IS_IOS, IS_IPAD, IS_LIQUID_GLASS} from '#/env'
import {
  DiscardPrompt,
  Footer,
  type FooterProps,
  Header,
  SheetBody,
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
  deferBody,
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
  /** Mount the body a frame after the open motion starts (heavy bodies only); `true` shows a blank stand-in, a node replaces it. */
  deferBody?: boolean | React.ReactNode
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

  /* A swipe down, Back or the browser's Back is a route removal, so ask before it happens (web too, audit m27). */
  // Not while a demo-mode switch swaps the store: the app is covered, and the store this sheet was typed for is going away, so it is
  // dropped, not asked about. While the first seeding runs behind its pill the app is usable and Back asks as usual.
  const isSwitchingStore = useIsStoreCovered()
  usePreventRemove(isDirty && !isSwitchingStore, ({data}) => {
    pendingAction.current = data.action
    discardControl.open()
  })

  // A dirty close is a route removal too: the prevent-remove prompt above asks.
  const requestClose = onClose
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
            {deferBody ? <SheetBody standIn={deferBody === true ? undefined : deferBody}>{children}</SheetBody> : children}
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
