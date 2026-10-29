import {useEffect, useRef} from 'react'
import {type StyleProp, type ViewStyle} from 'react-native'
import {type RowSyncStatus} from '@splito/sync'
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated'

import {isUnsynced} from '#/lib/sync/rowStatus'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {SyncToneContext} from '#/alf/syncTone'

export {SyncToneContext}

/**
 * Unsynced data is drawn lighter (ARCHITECTURE 9.8, owner 111). The status comes
 * with the row's view-model, so a row needs no store subscription of its own:
 * wrap the row's content in `<SyncToneContext.Provider value={tone.isUnsynced}>`
 * and put `tone.fade` on a view that is already animated. When the server
 * acknowledges (unsynced to synced) the row eases in from a lighter step to full
 * strength on the UI thread; reduced motion switches at once.
 */
export function useSyncTone(status: RowSyncStatus | undefined) {
  const isLighter = status !== undefined && isUnsynced(status)
  const reduceMotion = useShouldReduceMotion()
  const wasLighter = useRef(isLighter)
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (wasLighter.current && !isLighter && !reduceMotion) {
      opacity.set(0.55)
      opacity.set(withTiming(1, {duration: 450}))
    }
    wasLighter.current = isLighter
  }, [isLighter, reduceMotion, opacity])
  const fade = useAnimatedStyle(() => ({opacity: opacity.get()}))
  return {isUnsynced: isLighter, fade}
}

/** A detail page's (or dialog's) content in the record's tone; rows use `useSyncTone` on a view they already animate. */
export function SyncToned({status, style, children}: {status: RowSyncStatus | undefined; style?: StyleProp<ViewStyle>; children: React.ReactNode}) {
  const tone = useSyncTone(status)
  return (
    <SyncToneContext.Provider value={tone.isUnsynced}>
      <Animated.View style={[style, tone.fade]}>{children}</Animated.View>
    </SyncToneContext.Provider>
  )
}
