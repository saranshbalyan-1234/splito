import {accentThemes} from '#/alf/swatches'
import {device, useStorage} from '#/storage'

/**
 * ALF themes for the Accent colour preference (mirrored to device storage so
 * the first frame is already tinted), or undefined for Bluesky blue.
 */
export function useAccentThemes() {
  const [accent] = useStorage(device, ['accent'])
  return accentThemes(accent)
}
