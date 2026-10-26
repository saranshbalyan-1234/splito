import {GestureHandlerRootView} from 'react-native-gesture-handler'

import {atoms as a} from '#/alf'

/**
 * Gesture Handler's root view, which every gesture needs above it on native
 * (upstream wraps its native App the same way). Web has no Gesture Handler.
 */
export function GestureRoot({children}: {children: React.ReactNode}) {
  return (
    <GestureHandlerRootView style={a.flex_1}>{children}</GestureHandlerRootView>
  )
}
