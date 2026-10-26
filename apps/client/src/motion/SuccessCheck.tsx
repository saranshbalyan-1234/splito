import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {scheduleOnRN} from 'react-native-worklets'

import {useTheme} from '#/alf'
import {
  AnimatedCheck,
  type AnimatedCheckRef,
} from '#/components/anim/AnimatedCheck'
import {CircleCheck_Stroke2_Corner0_Rounded as CircleCheck} from '#/components/icons/CircleCheck'
import {useHaptics} from '#/lib/haptics'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/**
 * Bluesky's drawn check (circle, then tick) with the success haptic as the
 * tick lands. Mount it when the save is committed locally - this is a "done"
 * signal, never a "synced" one. Under reduce motion the finished check shows
 * at once and the haptic still plays.
 */
export function SuccessCheck({
  size = 64,
  fill,
  onCheckShown,
  testID,
}: {
  size?: number
  /** Defaults to the theme's primary. */
  fill?: string
  /** Called once the check is fully drawn. */
  onCheckShown?: () => void
  testID?: string
}) {
  const t = useTheme()
  const {success} = useHaptics()
  const shouldReduceMotion = useShouldReduceMotion()
  const ref = useRef<AnimatedCheckRef>(null)
  const color = fill ?? t.palette.primary_500

  useEffect(() => {
    const shown = () => {
      success()
      onCheckShown?.()
    }
    if (shouldReduceMotion) {
      shown()
      return
    }
    ref.current?.play(() => {
      'worklet'
      scheduleOnRN(shown)
    })
    // Plays once per mount; a new save mounts a new check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {shouldReduceMotion ? (
        <CircleCheck width={size} fill={color} />
      ) : (
        <AnimatedCheck ref={ref} width={size} fill={color} />
      )}
    </View>
  )
}
