// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/index.tsx
import {View} from 'react-native'

import {RoutesContainer, TabsNavigator} from '#/navigation/Navigation'
import {atoms as a, useTheme} from '#/alf'
import {Outlet as PortalOutlet} from '#/components/Portal'

/*
 * Bluesky's native shell also mounts the drawer, composer, global dialogs,
 * push-notification and OTA hooks, system bars and account status screens.
 * Splito has none of those yet, so only the navigator and portal outlet remain.
 */
function ShellInner() {
  return (
    <>
      <View style={[a.h_full]}>
        <TabsNavigator />
      </View>
      <PortalOutlet />
    </>
  )
}

export function Shell() {
  const t = useTheme()
  return (
    <View testID="mobileShellView" style={[a.h_full, t.atoms.bg]}>
      <RoutesContainer>
        <ShellInner />
      </RoutesContainer>
    </View>
  )
}
