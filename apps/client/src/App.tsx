import {useEffect} from 'react'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {I18nProvider} from '@lingui/react'

import {i18n} from '#/locale/i18n'
import {LocaleFromPrefs} from '#/locale/LocaleFromPrefs'
import {Provider as A11yProvider} from '#/state/a11y'
import {Provider as DialogStateProvider} from '#/state/dialogs'
import {Provider as ShellStateProvider} from '#/state/shell'
import {ThemeProvider as Alf} from '#/alf'
import {useColorModeTheme} from '#/alf/util/useColorModeTheme'
import {GestureRoot} from '#/components/GestureRoot'
import {Provider as PortalProvider} from '#/components/Portal'
import {ToastOutlet} from '#/components/Toast'
import {usePref} from '#/data/hooks'
import {StoreProvider} from '#/data/StoreProvider'
import {device} from '#/storage'
import {Shell} from '#/view/shell'

/*
 * The theme reads device storage synchronously so the first paint is right;
 * the `theme` preference (Settings, the avatar menu's shortcut) is the source
 * of truth and is mirrored there.
 */
function ThemeFromPrefs() {
  const [theme] = usePref('theme')
  useEffect(() => {
    if (theme && device.get(['colorMode']) !== theme) {
      device.set(['colorMode'], theme)
    }
  }, [theme])
  return null
}

function Themed() {
  const theme = useColorModeTheme()
  return (
    <Alf theme={theme}>
      <PortalProvider>
        <DialogStateProvider>
          <ShellStateProvider>
            <StoreProvider>
              <LocaleFromPrefs />
              <ThemeFromPrefs />
              <Shell />
            </StoreProvider>
            <ToastOutlet />
          </ShellStateProvider>
        </DialogStateProvider>
      </PortalProvider>
    </Alf>
  )
}

export default function App() {
  return (
    <GestureRoot>
      <SafeAreaProvider>
        <I18nProvider i18n={i18n}>
          <A11yProvider>
            <Themed />
          </A11yProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureRoot>
  )
}
