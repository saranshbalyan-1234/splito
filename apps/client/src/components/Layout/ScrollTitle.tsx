import {useEffect, useState} from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native'

import {atoms as a} from '#/alf'
import {IS_WEB} from '#/env'

/**
 * A page header title that appears only once the page's own hero (which
 * already shows the name) has scrolled away, as Bluesky's profile header
 * does. Feed `onScrolledDownChange` to Bluesky's `List`, which fires past
 * the fold of its header.
 */
export function useScrollTitle() {
  const [isShown, setIsShown] = useState(false)
  return {isShown, onScrolledDownChange: setIsShown}
}

/**
 * The same for a plain `Layout.Content` page: shown past `threshold` px. The
 * web page scrolls the window, so web listens there; native uses `onScroll`.
 */
export function useContentScrollTitle(threshold = 120) {
  const [isShown, setIsShown] = useState(false)
  useEffect(() => {
    if (!IS_WEB) return
    const check = () => setIsShown(window.scrollY > threshold)
    window.addEventListener('scroll', check, {passive: true})
    return () => window.removeEventListener('scroll', check)
  }, [threshold])
  return {
    isShown,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) =>
      setIsShown(e.nativeEvent.contentOffset.y > threshold),
  }
}

/** Fades the header title in and out; it keeps its space so nothing shifts. */
export function ScrollTitle({
  isShown,
  children,
}: {
  isShown: boolean
  children: React.ReactNode
}) {
  return (
    <View
      aria-hidden={!isShown}
      style={[a.transition_opacity, {opacity: isShown ? 1 : 0}]}>
      {children}
    </View>
  )
}
