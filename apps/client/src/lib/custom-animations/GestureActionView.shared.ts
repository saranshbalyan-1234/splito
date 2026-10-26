// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/custom-animations/GestureActionView.shared.ts
import {type ColorValue} from 'react-native'

export interface GestureAction {
  color: ColorValue
  action: () => void
  threshold: number
  icon: React.ElementType
}

export interface GestureActions {
  leftFirst?: GestureAction
  leftSecond?: GestureAction
  rightFirst?: GestureAction
  rightSecond?: GestureAction
}
