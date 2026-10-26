import {device, useStorage} from '#/storage'

/** Mirrors the `haptics` device preference; read synchronously so the first tap respects it. */
export function useHapticsDisabled() {
  const [enabled = true] = useStorage(device, ['hapticsEnabled'])
  return !enabled
}
