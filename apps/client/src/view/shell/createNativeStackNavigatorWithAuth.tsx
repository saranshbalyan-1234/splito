// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/createNativeStackNavigatorWithAuth.tsx
import {useEffect, useRef} from 'react'
import {View} from 'react-native'
// Based on @react-navigation/native-stack/src/navigators/createNativeStackNavigator.ts
// MIT License
// Copyright (c) 2017 React Navigation Contributors
import {
  createNavigatorFactory,
  type EventArg,
  type NavigatorTypeBagBase,
  type ParamListBase,
  type StackActionHelpers,
  StackActions,
  type StackNavigationState,
  StackRouter,
  type StackRouterOptions,
  type StaticConfig,
  type TypedNavigator,
  useNavigationBuilder,
} from '@react-navigation/native'
import {NativeStackView} from '@react-navigation/native-stack'
import {
  type NativeStackNavigationEventMap,
  type NativeStackNavigationOptions,
  type NativeStackNavigationProp,
  type NativeStackNavigatorProps,
} from '@react-navigation/native-stack'

import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {useShellLayout} from '#/state/shell/shell-layout'
import {atoms as a} from '#/alf'
import {IS_WEB} from '#/env'
import {BottomBarWeb} from './bottom-bar/BottomBarWeb'
import {DesktopLeftNav, useLeftNavWidth} from './desktop/LeftNav'
import {DesktopRightNav, useRightNavWidth} from './desktop/RightNav'

// On web, only this many screens (beyond Home + focused) stay mounted.
// Older screens are unmounted to prevent memory growth during long sessions.
const WEB_MAX_CACHED_SCREENS = 5

export type NativeStackNavigationOptionsWithAuth =
  NativeStackNavigationOptions & {
    requireAuth?: boolean
  }

function NativeStackNavigator({
  id,
  initialRouteName,
  UNSTABLE_routeNamesChangeBehavior,
  children,
  layout,
  screenListeners,
  screenOptions,
  screenLayout,
  UNSTABLE_router,
  ...rest
}: NativeStackNavigatorProps) {
  // --- this is copy and pasted from the original native stack navigator ---
  const {state, describe, descriptors, navigation, NavigationContent} =
    useNavigationBuilder<
      StackNavigationState<ParamListBase>,
      StackRouterOptions,
      StackActionHelpers<ParamListBase>,
      NativeStackNavigationOptionsWithAuth,
      NativeStackNavigationEventMap
    >(StackRouter, {
      id,
      initialRouteName,
      UNSTABLE_routeNamesChangeBehavior,
      children,
      layout,
      screenListeners,
      screenOptions,
      screenLayout,
      UNSTABLE_router,
    })

  useEffect(
    () =>
      // @ts-expect-error: there may not be a tab navigator in parent
      navigation?.addListener?.('tabPress', (e: any) => {
        const isFocused = navigation.isFocused()

        // Run the operation in the next frame so we're sure all listeners have been run
        // This is necessary to know if preventDefault() has been called
        requestAnimationFrame(() => {
          if (
            state.index > 0 &&
            isFocused &&
            !(e as EventArg<'tabPress', true>).defaultPrevented
          ) {
            // When user taps on already focused tab and we're inside the tab,
            // reset the stack to replicate native behaviour
            navigation.dispatch({
              ...StackActions.popToTop(),
              target: state.key,
            })
          }
        })
      }),
    [navigation, state.index, state.key],
  )

  // --- our custom logic starts here ---
  // Web LRU: tracks route keys in most-recently-focused order
  const lruKeysRef = useRef<string[]>([])
  const activeRoute = state.routes[state.index]
  const {isMobile} = useWebMediaQueries()
  const leftNavWidth = useLeftNavWidth()
  const rightNavWidth = useRightNavWidth()
  const {footerHeight} = useShellLayout()
  useEffect(() => {
    // The bottom bar reports its height; nothing replaces it on wider windows.
    if (!isMobile) footerHeight.set(0)
  }, [isMobile, footerHeight])
  // Splito has no sign-in, sign-up queue or onboarding gate (Bluesky's auth branches are removed).
  // On web, limit how many screens stay mounted to prevent memory growth.
  // Home is always pinned, the focused screen is always mounted, and the
  // most recently visited screens are kept up to WEB_MAX_CACHED_SCREENS.
  // Evicted screens render a lightweight placeholder — the route stays in
  // state so browser back/forward still works; the component just re-mounts.
  let finalDescriptors = descriptors
  if (IS_WEB) {
    const focusedKey = activeRoute.key

    // Update LRU: move focused key to front
    const lru = lruKeysRef.current
    const idx = lru.indexOf(focusedKey)
    if (idx > 0) {
      lru.splice(idx, 1)
      lru.unshift(focusedKey)
    } else if (idx === -1) {
      lru.unshift(focusedKey)
    }

    // Remove keys for routes no longer in the stack
    const routeKeySet = new Set(state.routes.map(r => r.key))
    lruKeysRef.current = lruKeysRef.current.filter(k => routeKeySet.has(k))

    // Build mount set: Home (pinned) + focused + N most recent
    const mountSet = new Set<string>()
    mountSet.add(focusedKey)
    const homeKey = state.routes.find(r => r.name === 'People')?.key
    if (homeKey) mountSet.add(homeKey)
    /* A sheet's page stays mounted under its `Sheet` marker (F-241), also on a cold start where it was never focused. */
    state.routes.forEach((route, i) => {
      if (route.name !== 'Sheet') return
      let below = i - 1
      while (below > 0 && state.routes[below]!.name === 'Sheet') below--
      mountSet.add(state.routes[below]!.key)
    })
    let cached = 0
    for (const key of lruKeysRef.current) {
      if (cached >= WEB_MAX_CACHED_SCREENS) break
      if (!mountSet.has(key)) {
        mountSet.add(key)
        cached++
      }
    }

    // Evicted screens get a lightweight placeholder instead of their full tree
    finalDescriptors = {}
    for (const key in descriptors) {
      if (mountSet.has(key)) {
        finalDescriptors[key] = descriptors[key]
      } else {
        finalDescriptors[key] = {
          ...descriptors[key],
          render: () => <View />,
        }
      }
    }
  }

  // Bluesky shows the bottom bar on mobile web when signed in; Splito is always "signed in" locally.
  const showBottomBar = isMobile

  return (
    <NavigationContent>
      {/* Splito: content fills the window beside the fixed sidebar (owner directive). */}
      <View
        role="main"
        style={[
          a.flex_1,
          IS_WEB && {marginLeft: leftNavWidth, marginRight: rightNavWidth},
        ]}>
        <NativeStackView
          {...rest}
          state={state}
          navigation={navigation}
          descriptors={finalDescriptors}
          describe={describe}
        />
      </View>
      {IS_WEB && (
        <>
          {showBottomBar ? (
            <BottomBarWeb />
          ) : (
            <>
              <DesktopLeftNav routeName={activeRoute.name} />
              <DesktopRightNav />
            </>
          )}
        </>
      )}
    </NavigationContent>
  )
}

export function createNativeStackNavigatorWithAuth<
  const ParamList extends ParamListBase,
  const NavigatorID extends string | undefined = string | undefined,
  const TypeBag extends NavigatorTypeBagBase = {
    ParamList: ParamList
    NavigatorID: NavigatorID
    State: StackNavigationState<ParamList>
    ScreenOptions: NativeStackNavigationOptionsWithAuth
    EventMap: NativeStackNavigationEventMap
    NavigationList: {
      [RouteName in keyof ParamList]: NativeStackNavigationProp<
        ParamList,
        RouteName,
        NavigatorID
      >
    }
    Navigator: typeof NativeStackNavigator
  },
  const Config extends StaticConfig<TypeBag> = StaticConfig<TypeBag>,
>(config?: Config): TypedNavigator<TypeBag, Config> {
  return createNavigatorFactory(NativeStackNavigator)(config)
}
