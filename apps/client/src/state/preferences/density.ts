import {atoms as a} from '#/alf'
import {device, useStorage} from '#/storage'

/**
 * The List density preference (Settings > Appearance), read synchronously
 * from its device mirror so rows never jump on launch.
 */
export function useListDensity() {
  const [density = 'comfortable'] = useStorage(device, ['density'])
  return density
}

/** Vertical padding for a list row at the current density. */
export function useRowPadding() {
  return useListDensity() === 'compact' ? a.py_sm : a.py_md
}
