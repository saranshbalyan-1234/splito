import {SafeAreaProvider} from 'react-native-safe-area-context'
import {I18nProvider} from '@lingui/react'

import {i18n} from '#/locale/i18n'
import {LocaleFromPrefs} from '#/locale/LocaleFromPrefs'
import {Provider as A11yProvider} from '#/state/a11y'
import {Provider as DialogStateProvider} from '#/state/dialogs'
import {Provider as ShellStateProvider} from '#/state/shell'
import {ThemeProvider as Alf} from '#/alf'
import {useColorModeTheme} from '#/alf/util/useColorModeTheme'
import {Provider as PortalProvider} from '#/components/Portal'
import {ToastOutlet} from '#/components/Toast'
import {StoreProvider} from '#/data/StoreProvider'
import {Shell} from '#/view/shell'

function Themed() {
  const theme = useColorModeTheme()
  return (
    <Alf theme={theme}>
      <PortalProvider>
        <DialogStateProvider>
          <ShellStateProvider>
            <StoreProvider>
              <LocaleFromPrefs />
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
    <SafeAreaProvider>
      <I18nProvider i18n={i18n}>
        <A11yProvider>
          <Themed />
        </A11yProvider>
      </I18nProvider>
    </SafeAreaProvider>
  )
}
