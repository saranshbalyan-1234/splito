// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/lib/styles.ts
import {type StyleProp} from 'react-native'

export function addStyle<T>(
  base: StyleProp<T>,
  addedStyle: StyleProp<T>,
): StyleProp<T> {
  if (Array.isArray(base)) {
    return base.concat([addedStyle])
  }
  return [base, addedStyle]
}
