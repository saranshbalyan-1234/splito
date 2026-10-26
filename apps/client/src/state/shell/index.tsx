// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/state/shell/index.tsx
import {useStorage, device} from '#/storage'
import {Provider as MinimalModeProvider} from './minimal-mode'
import {Provider as ShellLayoutProvider} from './shell-layout'
import {Provider as TickEveryMinuteProvider} from './tick-every-minute'

export {
  useEnableMinimalShellMode,
  useEnableMinimalShellModeForScreen,
} from './minimal-mode'
export {useTickEveryMinute} from './tick-every-minute'

/*
 * Bluesky also provides the drawer, drawer-swipe, onboarding and color-mode
 * state here. Splito has no drawer or onboarding, and its theme comes from
 * the preferences registry.
 */
export function Provider({children}: React.PropsWithChildren<{}>) {
  return (
    <ShellLayoutProvider>
      <MinimalModeProvider>
        <TickEveryMinuteProvider>{children}</TickEveryMinuteProvider>
      </MinimalModeProvider>
    </ShellLayoutProvider>
  )
}

/** Theme mode comes from the `theme` and `darkTheme` preferences, mirrored to device storage for first paint (see `#/state/preferences/mirror`). */
export function useThemePrefs() {
  const [colorMode = 'system'] = useStorage(device, ['colorMode'])
  const [darkTheme = 'dark'] = useStorage(device, ['darkTheme'])
  return {colorMode, darkTheme}
}

/** Splito has no drawer; the menu button opens Profile instead (see navigation). */
export function useSetDrawerOpen() {
  return (_open: boolean) => {}
}
