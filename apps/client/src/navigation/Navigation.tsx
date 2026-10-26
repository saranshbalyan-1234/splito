// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/Navigation.tsx
import {useEffect} from 'react'
import {msg} from '@lingui/core/macro'
import {
  type BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs'
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'

import {useWebScrollRestoration} from '#/lib/hooks/useWebScrollRestoration'
import {
  type FlatNavigatorParams,
  type RootStackParams,
  type TabParams,
} from '#/lib/routes/types'
import {i18n} from '#/locale/i18n'
import {useShellLayout} from '#/state/shell/shell-layout'
import {BottomBar} from '#/view/shell/bottom-bar/BottomBar'
import {createNativeStackNavigatorWithAuth} from '#/view/shell/createNativeStackNavigatorWithAuth'
import {DesktopLeftNav, type SidebarTab} from '#/view/shell/desktop/LeftNav'
import {type Theme, useBreakpoints, useTheme} from '#/alf'
import {linking} from '#/navigation/linking'
import {ActivityScreen} from '#/screens/Activity'
import {AddExpenseScreen} from '#/screens/AddExpense'
import {GroupsScreen} from '#/screens/Groups'
import {PeopleScreen} from '#/screens/People'
import {ProfileScreen} from '#/screens/Profile'

const Stack = createNativeStackNavigator<RootStackParams>()
const Tab = createBottomTabNavigator<TabParams>()
const Flat = createNativeStackNavigatorWithAuth<FlatNavigatorParams>()

function title(page: string) {
  return page ? `${page} - Splito` : 'Splito'
}

function screenOptions(t: Theme) {
  return {
    fullScreenGestureEnabled: true,
    headerShown: false,
    contentStyle: t.atoms.bg,
  } as const
}

function NativeTabBar(props: BottomTabBarProps) {
  const {gtMobile} = useBreakpoints()
  const {footerHeight} = useShellLayout()
  const currentRouteName = props.state.routes[props.state.index]?.name ?? ''

  useEffect(() => {
    if (gtMobile) {
      footerHeight.set(0)
    }
  }, [gtMobile, footerHeight])

  // Splito tabs are single screens, so a tab press only needs to switch tabs.
  const onNavigateTab = (tab: SidebarTab) => props.navigation.navigate(tab)

  if (gtMobile) {
    return (
      <DesktopLeftNav
        routeName={currentRouteName}
        onNavigateTab={onNavigateTab}
      />
    )
  }

  return <BottomBar {...props} />
}

function Tabs() {
  return (
    <Tab.Navigator
      initialRouteName="People"
      backBehavior="initialRoute"
      screenOptions={{headerShown: false, lazy: true}}
      tabBar={props => <NativeTabBar {...props} />}>
      <Tab.Screen name="People" component={PeopleScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

/**
 * The TabsNavigator is used by native mobile to represent the routes
 * as tabs, with full-screen flows (Add expense) pushed above them.
 */
export function TabsNavigator() {
  const t = useTheme()
  return (
    <Stack.Navigator screenOptions={screenOptions(t)}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{presentation: 'formSheet'}}
      />
    </Stack.Navigator>
  )
}

/**
 * The FlatNavigator is used by Web to represent the routes
 * in a single ("flat") stack.
 */
export function FlatNavigator() {
  const t = useTheme()
  const screenListeners = useWebScrollRestoration()

  return (
    <Flat.Navigator
      screenListeners={screenListeners}
      screenOptions={screenOptions(t)}>
      <Flat.Screen
        name="People"
        component={PeopleScreen}
        options={{title: title('')}}
      />
      <Flat.Screen
        name="Groups"
        component={GroupsScreen}
        options={{title: title(i18n._(msg`Groups`))}}
      />
      <Flat.Screen
        name="Activity"
        component={ActivityScreen}
        options={{title: title(i18n._(msg`Activity`))}}
      />
      <Flat.Screen
        name="Profile"
        component={ProfileScreen}
        options={{title: title(i18n._(msg`Profile`))}}
      />
      <Flat.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{title: title(i18n._(msg`Add expense`))}}
      />
    </Flat.Navigator>
  )
}

/**
 * The RoutesContainer should wrap all components which need access
 * to the navigation context.
 */
export function RoutesContainer({children}: React.PropsWithChildren<{}>) {
  const t = useTheme()
  const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme
  return (
    <NavigationContainer
      linking={linking}
      theme={{
        ...base,
        colors: {
          ...base.colors,
          primary: t.palette.primary_500,
          background: t.atoms.bg.backgroundColor,
          card: t.atoms.bg.backgroundColor,
          border: t.atoms.border_contrast_low.borderColor,
        },
      }}>
      {children}
    </NavigationContainer>
  )
}
