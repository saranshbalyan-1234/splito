import {useEffect, useState} from 'react'
import {Image, StyleSheet, useColorScheme} from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import {scheduleOnRN} from 'react-native-worklets'

import {atoms as a} from '#/alf'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {dim, light} from '#/alf/themes'

/*
 * The native splash cannot animate, so this is the same picture drawn by JS (ARCHITECTURE 26.11, owner 185): the
 * same PNG as the `expo-splash-screen` plugin in app.config.ts, 200 dp wide ("contain"), centred in the whole window
 * (the storyboard and Android's splash centre in the window, not in the safe area, so insets must not move it), on the
 * same background: white, or ALF Dim when the system is dark (the splash follows the system, not the in-app theme).
 * The native splash hides the moment the picture is drawn, so the handover does not jump; this then breathes on the
 * UI thread until the store is open and fades out.
 */
const LOGO_WIDTH = 200
const LIGHT_MARK = require('../../../assets/brand/splash-mark.png')
const DARK_MARK = require('../../../assets/brand/splash-mark-dark.png')
/* CSS `ease-in-out`, as the web launch screen in public/index.html. */
const EASE = Easing.bezier(0.42, 0, 0.58, 1)
const FADE_OUT = 200

let isReady = false
let onReady: (() => void) | null = null

/** Ends the launch screen: the store is open (or cannot be), so the first screen shows. */
export function markLaunchReady() {
  isReady = true
  onReady?.()
}

function hideNativeSplash() {
  SplashScreen.hide()
}

export function LaunchScreen() {
  const isDark = useColorScheme() === 'dark'
  /* The launch screen sits above the store, so only the OS setting can be known here (`useShouldReduceMotion` falls
     back to it signed out); Reanimated's own read is synchronous, so the first frame is already right. */
  const isOsReduced = useReducedMotion()
  const shouldReduceMotion = useShouldReduceMotion() || isOsReduced
  const [isGone, setIsGone] = useState(false)
  const scale = useSharedValue(1)
  const pulse = useSharedValue(1)
  const opacity = useSharedValue(1)

  useEffect(() => {
    /* One cycle is 1.2 s: 0.6 s out, 0.6 s back. Reduced motion: a slow opacity pulse, no zoom. */
    if (shouldReduceMotion) {
      pulse.set(
        withRepeat(
          withSequence(
            withTiming(0.4, {duration: 1200, easing: EASE}),
            withTiming(1, {duration: 1200, easing: EASE}),
          ),
          -1,
        ),
      )
    } else {
      scale.set(
        withRepeat(
          withSequence(
            withTiming(1.08, {duration: 600, easing: EASE}),
            withTiming(1, {duration: 600, easing: EASE}),
          ),
          -1,
        ),
      )
    }
    const leave = () => {
      cancelAnimation(scale)
      cancelAnimation(pulse)
      opacity.set(
        withTiming(0, {duration: FADE_OUT}, finished => {
          if (finished) scheduleOnRN(setIsGone, true)
        }),
      )
    }
    if (isReady) leave()
    else onReady = leave
    return () => {
      onReady = null
      cancelAnimation(scale)
      cancelAnimation(pulse)
    }
  }, [shouldReduceMotion, scale, pulse, opacity])

  const fadeStyle = useAnimatedStyle(() => ({opacity: opacity.get()}))
  const markStyle = useAnimatedStyle(() => ({
    opacity: pulse.get(),
    transform: [{scale: scale.get()}],
  }))

  if (isGone) return null
  return (
    <Animated.View
      testID="launch-screen"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        a.align_center,
        a.justify_center,
        {
          zIndex: 1000,
          backgroundColor: (isDark ? dim : light).atoms.bg.backgroundColor,
        },
        fadeStyle,
      ]}>
      <Animated.View style={markStyle}>
        <Image
          source={isDark ? DARK_MARK : LIGHT_MARK}
          style={{width: LOGO_WIDTH, height: LOGO_WIDTH}}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={hideNativeSplash}
          onError={hideNativeSplash}
        />
      </Animated.View>
    </Animated.View>
  )
}
