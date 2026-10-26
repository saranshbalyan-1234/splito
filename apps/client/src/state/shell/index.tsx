import {useStorage, device} from '#/storage'

/** Theme mode comes from the Splito `theme` preference, mirrored to device storage for first paint. */
export function useThemePrefs() {
  const [colorMode = 'system'] = useStorage(device, ['colorMode'])
  return {colorMode, darkTheme: 'dark' as const}
}

/** Bluesky hides its shell on scroll; Splito keeps navigation visible. */
export function useEnableMinimalShellModeForScreen(_opts?: {enabled: boolean}) {}

/** Splito has no drawer; the menu button opens Profile instead (see navigation). */
export function useSetDrawerOpen() {
  return (_open: boolean) => {}
}
