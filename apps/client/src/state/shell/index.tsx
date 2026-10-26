// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/state/shell/index.tsx
import {useStorage, device} from '#/storage'
import {Provider as DrawerOpenProvider} from './drawer-open'
import {Provider as MinimalModeProvider} from './minimal-mode'
import {Provider as ShellLayoutProvider} from './shell-layout'
import {Provider as TickEveryMinuteProvider} from './tick-every-minute'

export {useIsDrawerOpen, useSetDrawerOpen} from './drawer-open'
export {
  useEnableMinimalShellMode,
  useEnableMinimalShellModeForScreen,
} from './minimal-mode'
export {useTickEveryMinute} from './tick-every-minute'

/*
 * Bluesky also provides the drawer-swipe, onboarding and color-mode state
 * here. Splito's drawer swipe follows the route (see the native shell), it
 * has no onboarding, and its theme comes from the preferences registry.
 */
export function Provider({children}: React.PropsWithChildren<{}>) {
  return (
    <ShellLayoutProvider>
      <DrawerOpenProvider>
        <MinimalModeProvider>
          <TickEveryMinuteProvider>{children}</TickEveryMinuteProvider>
        </MinimalModeProvider>
      </DrawerOpenProvider>
    </ShellLayoutProvider>
  )
}

/** Theme mode comes from the `theme` and `darkTheme` preferences, mirrored to device storage for first paint (see `#/state/preferences/mirror`). */
export function useThemePrefs() {
  const [colorMode = 'system'] = useStorage(device, ['colorMode'])
  const [darkTheme = 'dim'] = useStorage(device, ['darkTheme'])
  return {colorMode, darkTheme}
}
