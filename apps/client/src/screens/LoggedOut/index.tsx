// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/auth/LoggedOut.tsx
import {useState} from 'react'
import {View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useLingui} from '@lingui/react/macro'

import {PressableScale} from '#/motion/PressableScale'
import {Login} from '#/screens/Login'
import {Signup} from '#/screens/Signup'
import {atoms as a, native, tokens, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {SplashScreen} from './SplashScreen'

enum ScreenState {
  S_LoginOrCreateAccount,
  S_Login,
  S_CreateAccount,
}

/**
 * Bluesky's logged-out view: the splash with Create account and Sign in, then
 * the Login or Signup flow. Splito shows it full screen over the app and it
 * can always be closed (Splito works without an account, 26.15).
 */
export function LoggedOut({onDismiss}: {onDismiss: () => void}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const [screenState, setScreenState] = useState<ScreenState>(
    ScreenState.S_LoginOrCreateAccount,
  )

  /* Back from the login or create-account step returns to the splash. */
  const onPressBack = () => setScreenState(ScreenState.S_LoginOrCreateAccount)

  return (
    <View
      testID="noSessionView"
      style={[
        a.util_screen_outer,
        t.atoms.bg,
        {paddingTop: insets.top, paddingBottom: insets.bottom},
      ]}>
      {screenState === ScreenState.S_LoginOrCreateAccount && (
        <Button
          testID="authClose"
          label={l`Close`}
          variant="solid"
          color="secondary_inverted"
          size="small"
          shape="round"
          PressableComponent={native(PressableScale)}
          style={[
            a.absolute,
            {
              top: insets.top + tokens.space.xl,
              right: tokens.space.xl,
              zIndex: 100,
            },
          ]}
          onPress={onDismiss}>
          <ButtonIcon icon={XIcon} />
        </Button>
      )}

      {screenState === ScreenState.S_LoginOrCreateAccount && (
        <SplashScreen
          onPressSignin={() => setScreenState(ScreenState.S_Login)}
          onPressCreateAccount={() => setScreenState(ScreenState.S_CreateAccount)}
        />
      )}
      {screenState === ScreenState.S_Login && (
        <Login
          onPressBack={onPressBack}
          onPressCreateAccount={() =>
            setScreenState(ScreenState.S_CreateAccount)
          }
        />
      )}
      {screenState === ScreenState.S_CreateAccount && (
        <Signup onPressBack={onPressBack} />
      )}
    </View>
  )
}
