import {View} from 'react-native'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {goBack} from '#/navigation/goBack'
import {LoggedOut} from '#/screens/LoggedOut'
import {atoms as a, web} from '#/alf'
import {Portal} from '#/components/Portal'
import {IS_WEB} from '#/env'

/**
 * Sign in / Create account (ARCHITECTURE 26.15, decision 65): Bluesky's
 * logged-out flow (splash, Login, Signup) shown full screen over the app and
 * closable, because Splito works without an account. Splito has no auth
 * server yet, so every submit ends in the honest "arrives with sync" note and
 * no account or session is made.
 *
 * Native: a pushed screen already covers the app. Web: the screen mounts the
 * flow in the shell's portal outlet, so it sits above the sidebar, header and
 * right column (their stacking contexts are siblings of the page). No z-index: the
 * outlet already sits above the page, and a sheet opened from inside the flow (the
 * language select) is mounted later, so it stacks above the flow.
 */
export function SignInScreen() {
  const navigation = useNavigation<NavigationProp>()
  const flow = (
    <View
      testID="screen-sign-in"
      role="dialog"
      aria-modal={true}
      style={[a.flex_1, web({position: 'fixed', inset: 0})]}>
      <LoggedOut onDismiss={() => goBack(navigation, {name: 'Home'})} />
    </View>
  )
  return IS_WEB ? <Portal>{flow}</Portal> : flow
}
