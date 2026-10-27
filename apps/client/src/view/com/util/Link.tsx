// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/Link.tsx
import {memo, useCallback} from 'react'
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  type StyleProp,
  type TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native'
import {StackActions} from '@react-navigation/native'

import {openExternalUrl} from '#/lib/externalUrl'
import {
  type DebouncedNavigationProp,
  useNavigationDeduped,
} from '#/lib/hooks/useNavigationDeduped'
import {getTabState, TabState} from '#/lib/routes/helpers'
import {WebAuxClickWrapper} from '#/view/com/util/WebAuxClickWrapper'
import {useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {router} from '../../../routes'
import {PressableWithHover} from './PressableWithHover'

type Event =
  React.MouseEvent<HTMLAnchorElement, MouseEvent> | GestureResponderEvent

interface Props extends React.ComponentProps<typeof TouchableOpacity> {
  testID?: string
  style?: StyleProp<ViewStyle>
  href?: string
  title?: string
  children?: React.ReactNode
  hoverStyle?: StyleProp<ViewStyle>
  noFeedback?: boolean
  asAnchor?: boolean
  dataSet?: any
  anchorNoUnderline?: boolean
  navigationAction?: 'push' | 'replace' | 'navigate'
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onBeforePress?: () => void
}

/**
 * @deprecated use Link from `#/components/Link.tsx` instead
 */
export const Link = memo(function Link({
  testID,
  style,
  href,
  title,
  children,
  noFeedback,
  asAnchor,
  accessible,
  anchorNoUnderline,
  navigationAction,
  onBeforePress,
  accessibilityActions,
  onAccessibilityAction,
  dataSet: dataSetProp,
  ...props
}: Props) {
  const t = useTheme()
  const navigation = useNavigationDeduped()
  // Splito hrefs are app-internal route paths, so no URL sanitising is needed.
  const anchorHref = asAnchor ? href : undefined

  const onPress = useCallback(
    (e?: Event) => {
      onBeforePress?.()
      if (typeof href === 'string') {
        return onPressInner(navigation, href, navigationAction, e)
      }
    },
    [navigation, navigationAction, href, onBeforePress],
  )

  const accessibilityActionsWithActivate = [
    ...(accessibilityActions || []),
    {name: 'activate', label: title},
  ]

  const dataSet = anchorNoUnderline
    ? {...dataSetProp, noUnderline: 1}
    : dataSetProp

  if (noFeedback) {
    return (
      <WebAuxClickWrapper>
        <Pressable
          testID={testID}
          onPress={onPress}
          accessible={accessible}
          accessibilityRole="link"
          accessibilityActions={accessibilityActionsWithActivate}
          onAccessibilityAction={e => {
            if (e.nativeEvent.actionName === 'activate') {
              onPress()
            } else {
              onAccessibilityAction?.(e)
            }
          }}
          // @ts-expect-error web only -sfn
          dataSet={dataSet}
          {...props}
          android_ripple={{
            color: t.atoms.bg_contrast_25.backgroundColor,
          }}>
          {/* @ts-expect-error web only -prf */}
          <View style={style} href={anchorHref}>
            {children ? children : <Text>{title || 'link'}</Text>}
          </View>
        </Pressable>
      </WebAuxClickWrapper>
    )
  }

  const Com = props.hoverStyle ? PressableWithHover : Pressable
  return (
    <Com
      testID={testID}
      style={style}
      onPress={onPress}
      accessible={accessible}
      accessibilityRole="link"
      accessibilityLabel={props.accessibilityLabel ?? title}
      accessibilityHint={props.accessibilityHint}
      // @ts-expect-error web only -prf
      href={anchorHref}
      dataSet={dataSet}
      {...props}>
      {children ? children : <Text>{title || 'link'}</Text>}
    </Com>
  )
})

const EXEMPT_PATHS = ['/robots.txt', '/security.txt', '/.well-known/']

// NOTE
// we can't use the onPress given by useLinkProps because it will
// match most paths to the HomeTab routes while we actually want to
// preserve the tab the app is currently in
//
// we also have some additional behaviors - closing the current modal,
// converting bsky urls, and opening http/s links in the system browser
//
// this method copies from the onPress implementation but adds our
// needed customizations
// -prf
function onPressInner(
  navigation: DebouncedNavigationProp,
  href: string,
  navigationAction: 'push' | 'replace' | 'navigate' = 'push',
  e?: Event,
) {
  let shouldHandle = false
  const isLeftClick =
    // @ts-expect-error Web only -prf
    Platform.OS === 'web' && (e.button == null || e.button === 0)
  // @ts-expect-error Web only -prf
  const isMiddleClick = Platform.OS === 'web' && e.button === 1
  const isMetaKey =
    // @ts-expect-error Web only -prf
    Platform.OS === 'web' && (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
  const newTab = isMetaKey || isMiddleClick

  if (Platform.OS !== 'web' || !e) {
    shouldHandle = e ? !e.defaultPrevented : true
  } else if (
    !e.defaultPrevented && // onPress prevented default
    (isLeftClick || isMiddleClick) && // ignore everything but left and middle clicks
    // @ts-expect-error Web only -prf
    [undefined, null, '', 'self'].includes(e.currentTarget?.target) // let browser handle "target=_blank" etc.
  ) {
    e.preventDefault()
    shouldHandle = true
  }

  if (shouldHandle) {
    if (
      newTab ||
      href.startsWith('http') ||
      href.startsWith('mailto') ||
      EXEMPT_PATHS.some(path => href.startsWith(path))
    ) {
      void openExternalUrl(href)
    } else {
      const [routeName, params] = router.matchPath(href)
      if (navigationAction === 'push') {
        navigation.dispatch(StackActions.push(routeName, params))
      } else if (navigationAction === 'replace') {
        navigation.dispatch(StackActions.replace(routeName, params))
      } else if (navigationAction === 'navigate') {
        const state = navigation.getState()
        const tabState = getTabState(state, routeName)
        // Splito screens have no soft reset (scroll-to-top/refresh) yet, so a press on the current tab root is a no-op.
        if (tabState !== TabState.InsideAtRoot) {
          // note: 'navigate' actually acts the same as 'push' nowadays
          // therefore we need to add 'pop' -sfn
          // @ts-expect-error we're not able to type check on this one -prf
          navigation.navigate(routeName, params, {pop: true})
        }
      } else {
        throw Error('Unsupported navigator action.')
      }
    }
  }
}
