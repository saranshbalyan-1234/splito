// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/constants.ts (subset)
import {type Insets} from 'react-native'

export const CARD_ASPECT_RATIO = 1200 / 630

export const createHitslop = (size: number): Insets => ({
  top: size,
  left: size,
  bottom: size,
  right: size,
})
export const HITSLOP_10 = createHitslop(10)
export const HITSLOP_20 = createHitslop(20)
export const HITSLOP_30 = createHitslop(30)
export const BACK_HITSLOP = HITSLOP_30
