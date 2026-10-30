// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/createNativeStackNavigatorWithAuth.tsx
import {useCallback, useEffect, useRef} from 'react'
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
import {DesktopRightNav, useRightNavWidthFor} from './desktop/RightNav'
import {parkTabs, type RouteLike, shallowEqual} from '#/navigation/parkTabs'

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
  // Tabs are parked, over a caller's own router when it has one (parkTabs.ts); stable between renders.
  const router = useCallback(
    // oxlint-disable-next-line typescript/no-explicit-any -- the router's state and action types are generic here
    (original: any) => parkTabs(original, UNSTABLE_router),
    [UNSTABLE_router],
  )
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
      UNSTABLE_router: IS_WEB ? router : UNSTABLE_router,
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
  /* A `Sheet` marker is open over the page named in its params; that page decides the column. */
  const focusedPage =
    activeRoute.name === 'Sheet' ? String((activeRoute.params as {page?: string} | undefined)?.page ?? '') : activeRoute.name
  const rightNavWidth = useRightNavWidthFor(focusedPage)
  const {footerHeight} = useShellLayout()
  useEffect(() => {
    // The bottom bar reports its height; nothing replaces it on wider windows.
    if (!isMobile) footerHeight.set(0)
  }, [isMobile, footerHeight])
  // Splito has no sign-in, sign-up queue or onboarding gate (Bluesky's auth branches are removed).
  // On web, limit how many screens stay mounted to prevent memory growth.
  // Home is pinned once visited, the focused screen is always mounted, and the
  // most recently visited screens are kept up to WEB_MAX_CACHED_SCREENS.
  // Evicted screens render a lightweight placeholder — the route stays in
  // state so browser back/forward still works; the component just re-mounts.
  let finalDescriptors = descriptors
  const mountSet = new Set<string>()
  if (IS_WEB) {
    const focusedKey = activeRoute.key

    // Update LRU: move focused key to front. A `Sheet` marker draws nothing, so it never takes a cache slot.
    const lru = lruKeysRef.current
    const idx = lru.indexOf(focusedKey)
    if (activeRoute.name !== 'Sheet') {
      if (idx > 0) {
        lru.splice(idx, 1)
        lru.unshift(focusedKey)
      } else if (idx === -1) {
        lru.unshift(focusedKey)
      }
    }

    // Remove keys for routes no longer in the stack
    const routeKeySet = new Set(state.routes.map(r => r.key))
    lruKeysRef.current = lruKeysRef.current.filter(k => routeKeySet.has(k))

    // Build mount set: Home (pinned) + focused + N most recent
    mountSet.add(focusedKey)
    /* Pinned once visited. A deep link to another page puts Home under it in the state, but it is never drawn: its three lists would otherwise render hidden beside the page that was opened (and duplicate its rows). */
    const homeKey = state.routes.find(r => r.name === 'Home')?.key
    if (homeKey && lruKeysRef.current.includes(homeKey)) mountSet.add(homeKey)
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

  /*
   * A parked tab keeps the screen element it had while live, so neither parking nor reviving it re-renders it
   * (owner 166). `describe(route, true)` would make a new element on every navigator render, with the navigator's
   * own `navigation` instead of the route's, and a revived route comes back as a new object: both change what the
   * screen reads from context and re-render all of its rows. The live element stays valid: it is keyed by the
   * route key, which the router keeps, and its params are compared before it is re-used.
   */
  const lastLive = useRef(new Map<string, {route: RouteLike; descriptor: (typeof descriptors)[string]}>())
  const everParked = useRef(new Set<string>())
  const describeParked: typeof describe = (route, placeholder) => {
    const kept = IS_WEB && placeholder ? lastLive.current.get(route.key) : undefined
    return kept ? kept.descriptor : describe(route, placeholder)
  }
  if (IS_WEB) {
    for (const r of state.preloadedRoutes) everParked.current.add(r.key)
    const swapped: typeof finalDescriptors = {...finalDescriptors}
    for (const route of state.routes) {
      // The real descriptor, never the LRU stand-in in `finalDescriptors` (reusing that would blank the tab for good).
      const real = descriptors[route.key]
      if (!real) continue
      const before = lastLive.current.get(route.key)
      if (
        before &&
        mountSet.has(route.key) &&
        everParked.current.has(route.key) &&
        before.route.name === route.name &&
        before.route.path === route.path &&
        shallowEqual(before.route.params, route.params)
      ) {
        swapped[route.key] = {...real, render: before.descriptor.render}
      } else {
        lastLive.current.set(route.key, {route: route as RouteLike, descriptor: real})
      }
    }
    finalDescriptors = swapped
    for (const key of [...lastLive.current.keys()])
      if (!state.preloadedRoutes.some(r => r.key === key) && !state.routes.some(r => r.key === key)) {
        lastLive.current.delete(key)
        everParked.current.delete(key)
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
          describe={describeParked}
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
