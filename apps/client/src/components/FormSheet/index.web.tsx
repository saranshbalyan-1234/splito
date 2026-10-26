import {useEffect} from 'react'
import {ScrollView, View} from 'react-native'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, web} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {Context as DialogContext} from '#/components/Dialog/context'
import {
  Footer,
  type FooterProps,
  Header,
  SLIDE_UP,
  useFormSheet,
  useIsScrolled,
  useIsSheet,
  webSheetStyle,
} from './shared'

export * from './shared'
export {Screen} from './Screen'

/**
 * Web: Bluesky's centred dialog (scrim, focus trap, Escape), or on a phone
 * a sheet risen from the bottom edge. The body scrolls between the fixed top
 * bar and footer, so Cancel and Save stay at the bottom right however long
 * the form is.
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
  const {requestClose, setIsDirty, testID, inset} = useFormSheet()
  const dialog = Dialog.useDialogContext()
  const isSheet = useIsSheet()
  const reduceMotion = useShouldReduceMotion()
  const [isScrolled, onScroll] = useIsScrolled()
  useEffect(() => setIsDirty(isDirty), [isDirty, setIsDirty])

  /*
   * Bluesky's dialog closes on Escape through its context; route that
   * through the sheet's close request so unsaved changes are asked about.
   * The body sees the real context again.
   */
  return (
    <DialogContext.Provider value={{...dialog, close: () => requestClose()}}>
      <Dialog.Inner
        label={title}
        style={[
          isSheet ? webSheetStyle : {marginTop: 'auto', marginBottom: 'auto'},
          isSheet && !reduceMotion && web({animation: SLIDE_UP}),
        ]}
        contentContainerStyle={[a.p_0]}>
        <DialogContext.Provider value={dialog}>
          <View
            testID={testID}
            style={[
              {maxHeight: isSheet ? 'calc(100dvh - 48px)' : '80vh'},
              a.overflow_hidden,
            ]}>
            <Header
              title={title}
              onClose={requestClose}
              isScrolled={isScrolled}
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={50}
              style={[a.flex_shrink, {minHeight: 0}]}
              contentContainerStyle={[inset, a.pt_xs, a.pb_xl]}>
              {children}
            </ScrollView>
            {footer ? <Footer {...footer} readout={readout} /> : null}
          </View>
        </DialogContext.Provider>
      </Dialog.Inner>
    </DialogContext.Provider>
  )
}
