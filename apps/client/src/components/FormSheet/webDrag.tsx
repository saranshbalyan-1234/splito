import {type ViewProps} from 'react-native'

/* Native sheets get their handle and drag from the bottom-sheet module and the native stack. */
export function WebHandle() {
  return null
}

export function useSheetDrag(_options: {
  isEnabled: boolean
  isDirty: boolean
  reduceMotion: boolean
  onDismiss: () => void
}): ViewProps {
  return {}
}
