// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/lib/batchedUpdates.ts
import {unstable_batchedUpdates} from 'react-native'

export function batchedUpdates(fn: () => void): void {
  unstable_batchedUpdates(fn, undefined)
}
