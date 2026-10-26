import {useEffect} from 'react'
import {ScrollView, View} from 'react-native'

import {atoms as a} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {Context as DialogContext} from '#/components/Dialog/context'
import {
  Footer,
  type FooterProps,
  Header,
  useFormSheet,
  useIsScrolled,
  useIsSheet,
} from './shared'
import {useSheetDrag, WebHandle} from './webDrag'

export * from './shared'
export {Screen} from './Screen'

/**
 * Web: Bluesky's centred dialog (scrim, focus trap, Escape), or on a phone
 * Dialog's drawer from the bottom edge (handle, drag down to close). The body scrolls between the fixed top
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
  const [isScrolled, onScroll] = useIsScrolled()
  useEffect(() => setIsDirty(isDirty), [isDirty, setIsDirty])
  const drag = useSheetDrag({
    isEnabled: isSheet,
    isDirty,
    reduceMotion,
    onDismiss: requestClose,
  })

  /*
   * Bluesky's dialog closes on Escape through its context; route that
   * through the sheet's close request so unsaved changes are asked about.
   * The body sees the real context again.
   */
  return (
    <DialogContext.Provider value={{...dialog, close: () => requestClose()}}>
      <Dialog.Inner
        label={title}
        style={{marginTop: 'auto', marginBottom: 'auto'}}
        contentContainerStyle={[a.p_0]}>
        <DialogContext.Provider value={dialog}>
          <View
            testID={testID}
            style={[
              /* The drawer caps its own height, above the keyboard too. */
              isSheet ? {flexShrink: 1, minHeight: 0} : {maxHeight: '80vh'},
              a.overflow_hidden,
            ]}>
            {/* The handle and top bar drag the sheet down to close it (owner rule, 26.8). */}
            <View {...drag}>
              {isSheet && <WebHandle />}
              <Header
                title={title}
                onClose={requestClose}
                isScrolled={isScrolled}
                style={isSheet && a.pt_lg}
              />
            </View>
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
