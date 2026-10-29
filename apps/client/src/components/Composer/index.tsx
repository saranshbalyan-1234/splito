// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/Composer.tsx
import {View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {OpenedContext} from '#/lib/hooks/useAfterTransition'
import {useScreenOpened} from '#/lib/hooks/useScreenOpened'
import {atoms as a, useTheme} from '#/alf'
import {IS_ANDROID} from '#/env'

/**
 * Bluesky's composer surface. On native the route itself is presented like
 * Bluesky's composer (iOS page sheet, Android full-screen slide-up; see
 * `Navigation`), so this only paints the background and, on Android, clears
 * the status bar.
 */
export function Outer({
  children,
  testID,
}: {
  children: React.ReactNode
  onDismiss: () => void
  testID?: string
}) {
  const t = useTheme()
  const {top} = useSafeAreaInsets()
  /* The page sheet's present transition ends before the heavy body mounts (owner 168). */
  const opened = useScreenOpened()
  return (
    <View
      testID={testID}
      aria-modal
      accessibilityViewIsModal
      style={[a.flex_1, t.atoms.bg, IS_ANDROID && {paddingTop: top}]}>
      <OpenedContext.Provider value={opened}>{children}</OpenedContext.Provider>
    </View>
  )
}
