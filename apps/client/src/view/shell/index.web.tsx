// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/index.web.tsx
import {View} from 'react-native'

import {FlatNavigator, RoutesContainer} from '#/navigation/Navigation'
import {atoms as a, useTheme} from '#/alf'
import {Outlet as PortalOutlet} from '#/components/Portal'

/*
 * Bluesky's web shell also mounts the mobile drawer, composer, global
 * dialogs (sign-in, report, muted words ...), age-assurance and account
 * status screens. Splito has none of those, so only the navigator and the
 * portal outlet remain.
 */
function ShellInner() {
  return (
    <>
      <FlatNavigator />
      <PortalOutlet />
    </>
  )
}

export function Shell() {
  const t = useTheme()
  return (
    <View style={[a.util_screen_outer, t.atoms.bg]}>
      <RoutesContainer>
        <ShellInner />
      </RoutesContainer>
    </View>
  )
}
