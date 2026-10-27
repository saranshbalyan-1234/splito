// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/UserAvatar.tsx (the alert badge pinned bottom-right on an avatar)
import {useEffect, useRef} from 'react'
import {Pressable, View} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {type SyncDotState} from '#/lib/syncState'
import {useSyncDot} from '#/lib/useSyncDot'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, useTheme} from '#/alf'
import {IS_WEB} from '#/env'

export const SYNC_LABELS = {
  synced: msg`Synced`,
  syncing: msg`Syncing`,
  local: msg`On this device only`,
} as const satisfies Record<SyncDotState, unknown>

/** The state and its words, for the avatar's accessibility label and tooltip. */
export function useSyncLabel() {
  const {_} = useLingui()
  const state = useSyncDot()
  return {state, label: _(SYNC_LABELS[state])}
}

/**
 * The sync-status dot (ARCHITECTURE 26.7): green synced, yellow syncing or
 * waiting, red on this device only. Bluesky's avatar badge geometry
 * (bottom-right, a ring in the background colour). Colour is never the only
 * signal: the avatar carries the label (`useSyncLabel`), and web shows it as
 * a hover tooltip.
 */
export function SyncStatusDot({
  avatarSize,
  state,
  label,
  onPress,
}: {
  avatarSize: number
  state: SyncDotState
  label: string
  /** The drawer's dot opens Settings > Account / Sync. */
  onPress?: () => void
}) {
  const t = useTheme()
  const reduceMotion = useShouldReduceMotion()
  const ref = useRef<View>(null)
  const dot = Math.max(10, Math.round(avatarSize * 0.3))
  const color =
    state === 'synced'
      ? t.palette.positive_500
      : state === 'syncing'
        ? t.palette.yellow
        : t.palette.negative_500

  /* The dot pops between states (instant under reduced motion). */
  const scale = useSharedValue(1)
  useEffect(() => {
    if (reduceMotion) return
    scale.set(0.6)
    scale.set(withTiming(1, {duration: 220}))
  }, [state, reduceMotion, scale])
  const animated = useAnimatedStyle(() => ({
    transform: [{scale: scale.get()}],
  }))

  /* react-native-web drops `title`, so the hover tooltip is set on the element. */
  useEffect(() => {
    if (IS_WEB && ref.current) {
      ;(ref.current as unknown as HTMLElement).title = label
    }
  }, [label])

  const Container = onPress ? Pressable : View
  return (
    <Container
      ref={ref as never}
      testID="sync-dot"
      {...(onPress
        ? {
            onPress,
            hitSlop: 10,
            accessible: true,
            accessibilityRole: 'button' as const,
            accessibilityLabel: label,
          }
        : {accessible: false})}
      style={[
        a.absolute,
        a.rounded_full,
        a.align_center,
        a.justify_center,
        t.atoms.bg,
        {width: dot + 4, height: dot + 4, right: -2, bottom: -2},
      ]}>
      <Animated.View
        testID={`sync-dot-${state}`}
        style={[
          a.rounded_full,
          {width: dot, height: dot, backgroundColor: color},
          animated,
        ]}
      />
    </Container>
  )
}
