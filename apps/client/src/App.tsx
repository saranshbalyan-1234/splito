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
import {useSession} from '#/state/session'
import {useAccentThemes} from '#/state/theme'
import {ThemeProvider as Alf} from '#/alf'
import {useColorModeTheme} from '#/alf/util/useColorModeTheme'
import {GestureRoot} from '#/components/GestureRoot'
import {Provider as PortalProvider} from '#/components/Portal'
import {LegacyDataOffer} from '#/features/account/LegacyDataOffer'
import {LoggingOut} from '#/features/account/LoggingOut'
import {LogOutHost} from '#/features/account/LogOutPrompt'
import {LinkHost} from '#/features/links/LinkHost'
import {PwaHost} from '#/features/pwa/PwaHost'
import {RemindHost} from '#/features/remind/RemindHost'
import {ToastOutlet} from '#/components/Toast'
import {StoreProvider} from '#/data/StoreProvider'
import {LoggedOutApp, LoggedOutShell} from '#/screens/LoggedOut'
import {AddMissingContact} from '#/screens/Login/AddMissingContact'
import {Shell} from '#/view/shell'

/**
 * Sign-in is required (ARCHITECTURE 26.15, F-250): signed out, the app is the intro and the Continue flow and no database
 * is opened; an account missing its email or phone is held on the blocking "Add ..." step; otherwise the account's own
 * database opens (`StoreProvider`, keyed by the account so two accounts never share one) and the app shows.
 */
function AuthGate() {
  const {currentAccount, missingContact, isLoggingOut} = useSession()
  if (!currentAccount) return <LoggedOutApp />
  /* A log out in progress (owner 186): its data is erased before anything else shows, and a restart finishes it. */
  if (isLoggingOut) {
    return (
      <LoggedOutShell>
        <LoggingOut accountId={currentAccount.id} />
      </LoggedOutShell>
    )
  }
  if (missingContact) {
    return (
      <LoggedOutShell>
        <AddMissingContact account={currentAccount} kind={missingContact} />
      </LoggedOutShell>
    )
  }
  return <SignedInApp key={currentAccount.id} accountId={currentAccount.id} />
}

function SignedInApp({accountId}: {accountId: string}) {
  return (
    <StoreProvider accountId={accountId}>
      <LocaleFromPrefs />
      <PrefsMirror />
      <PwaHost />
      {/* RemindHost and LinkHost sit above the Shell, outside its BottomSheetProvider: their sheets need a portal of their own on native. */}
      <BottomSheetProvider>
        <RemindHost />
        <LinkHost />
        <LegacyDataOffer />
        <LogOutHost />
        <BottomSheetOutlet />
      </BottomSheetProvider>
      <Shell />
      <ToastOutlet />
    </StoreProvider>
  )
}

/*
 * Theme, accent and text size read device storage synchronously so the first
 * paint is right; `PrefsMirror` keeps that copy in step with the preferences
 * registry (Settings, the drawer's dark-theme switch).
 */
function Themed() {
  /* First on purpose: Metro inlines requires, so this is what loads `state/session`, which sets the account's device-key scope before the theme reads its first-frame copies. */
  useSession()
  const theme = useColorModeTheme()
  const themesOverride = useAccentThemes()
  return (
    <Alf theme={theme} themesOverride={themesOverride}>
      <PortalProvider>
        <DialogStateProvider>
          <ShellStateProvider>
            <AuthGate />
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
