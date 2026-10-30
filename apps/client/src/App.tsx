import {KeyboardProvider as KeyboardControllerProvider} from 'react-native-keyboard-controller'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {BottomSheetOutlet, BottomSheetProvider} from '@bsky.app/bottom-sheet'
import {I18nProvider} from '@lingui/react'

import {i18n} from '#/locale/i18n'
import {LocaleFromPrefs} from '#/locale/LocaleFromPrefs'
import {Provider as A11yProvider} from '#/state/a11y'
import {Provider as DialogStateProvider} from '#/state/dialogs'
import {PrefsMirror} from '#/state/preferences/mirror'
import {Provider as ShellStateProvider} from '#/state/shell'
import {useAccentThemes} from '#/state/theme'
import {ThemeProvider as Alf} from '#/alf'
import {useColorModeTheme} from '#/alf/util/useColorModeTheme'
import {GestureRoot} from '#/components/GestureRoot'
import {LaunchScreen} from '#/components/LaunchScreen'
import {Provider as PortalProvider} from '#/components/Portal'
import {LinkHost} from '#/features/links/LinkHost'
import {PwaHost} from '#/features/pwa/PwaHost'
import {DisputeHost} from '#/features/disputes/DisputeHost'
import {RemindHost} from '#/features/remind/RemindHost'
import {ToastOutlet} from '#/components/Toast'
import {StoreProvider} from '#/data/StoreProvider'
import {Shell} from '#/view/shell'

/*
 * Theme, accent and text size read device storage synchronously so the first
 * paint is right; `PrefsMirror` keeps that copy in step with the preferences
 * registry (Settings, the drawer's dark-theme switch).
 */
function Themed() {
  const theme = useColorModeTheme()
  const themesOverride = useAccentThemes()
  return (
    <Alf theme={theme} themesOverride={themesOverride}>
      <PortalProvider>
        <DialogStateProvider>
          <ShellStateProvider>
            <StoreProvider>
              <LocaleFromPrefs />
              <PrefsMirror />
              <PwaHost />
              {/* RemindHost and LinkHost sit above the Shell, outside its BottomSheetProvider: their sheets need a portal of their own on native. */}
              <BottomSheetProvider>
                <RemindHost />
                <DisputeHost />
                <LinkHost />
                <BottomSheetOutlet />
              </BottomSheetProvider>
              <Shell />
              <ToastOutlet />
            </StoreProvider>
            {/* Outside the provider: it shows while the store opens, then fades out over the first screen. */}
            <LaunchScreen />
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
            {/* As Bluesky's App.tsx: form sheets keep their footer above the keyboard. */}
            <KeyboardControllerProvider preload={false}>
              <Themed />
            </KeyboardControllerProvider>
          </A11yProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureRoot>
  )
}
