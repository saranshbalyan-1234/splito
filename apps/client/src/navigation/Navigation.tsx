// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/Navigation.tsx
import {useEffect} from 'react'
import {type MessageDescriptor} from '@lingui/core'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {
  type BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs'
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native'
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack'

import {useWebScrollRestoration} from '#/lib/hooks/useWebScrollRestoration'
import {bootStartTab, TAB_ROUTE} from '#/lib/routes/tabs'
import {
  type FlatNavigatorParams,
  type RootStackParams,
  type TabParams,
} from '#/lib/routes/types'
import {useShellLayout} from '#/state/shell/shell-layout'
import {BottomBar} from '#/view/shell/bottom-bar/BottomBar'
import {createNativeStackNavigatorWithAuth} from '#/view/shell/createNativeStackNavigatorWithAuth'
import {DesktopLeftNav, type SidebarTab} from '#/view/shell/desktop/LeftNav'
import {type Theme, useBreakpoints, useTheme} from '#/alf'
import {IS_ANDROID, IS_IOS, IS_IPAD} from '#/env'
import {usePref} from '#/data/hooks'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {tabId} from '#/navigation/parkTabs'
import {DevTour} from '#/navigation/DevTour'
import {navigationRef} from '#/navigation/ref'
import {linking} from '#/navigation/linking'
import {AddExpenseScreen} from '#/screens/AddExpense'
import {AddFriendScreen} from '#/screens/AddFriend'
import {CreateInviteScreen} from '#/screens/Invites/CreateInvite'
import {InviteScreen} from '#/screens/Invites/Invite'
import {InviteLinksScreen} from '#/screens/Invites/InviteLinks'
import {ActivityScreen} from '#/screens/Activity'
import {AnalyticsScreen} from '#/screens/Analytics'
import {CreateGroupScreen} from '#/screens/CreateGroup'
import {EditExpenseScreen} from '#/screens/EditExpense'
import {ExpenseScreen} from '#/screens/Expense'
import {RepaymentScreen} from '#/screens/Repayment'
import {GroupScreen} from '#/screens/Group'
import {GroupsScreen} from '#/screens/Groups'
import {PeopleScreen} from '#/screens/People'
import {PersonScreen} from '#/screens/Person'
import {ProfileScreen} from '#/screens/Profile'
import {SettingsScreen} from '#/screens/Settings'
import {FriendsAndInvitesScreen} from '#/screens/FriendsAndInvites'
import {SettingsSectionScreen} from '#/screens/Settings/SettingsSection'
import {WelcomeScreen} from '#/screens/Welcome/Replay'
import {SearchScreen} from '#/screens/Search'
import {SettleScreen} from '#/screens/Settle'
import {useDemoMode} from '#/state/demo'

const Stack = createNativeStackNavigator<RootStackParams>()
const Tab = createBottomTabNavigator<TabParams>()
const Flat = createNativeStackNavigatorWithAuth<FlatNavigatorParams>()

/** Window titles for web; a page without one is just "Splito". */
const TITLES: Partial<Record<keyof FlatNavigatorParams, MessageDescriptor>> = {
  People: msg`People`,
  Groups: msg`Groups`,
  Analytics: msg`Analytics`,
  Activity: msg`Activity`,
  Profile: msg`Profile`,
  Settings: msg`Settings`,
  SettingsSection: msg`Settings`,
  Welcome: msg`Welcome`,
  FriendsAndInvites: msg`Friends and invites`,
  Search: msg`Search`,
  Person: msg`Person`,
  Group: msg`Group`,
  Settle: msg`Settle up`,
  AddExpense: msg`Add expense`,
  Expense: msg`Expense`,
  Repayment: msg`Payment`,
  EditExpense: msg`Edit expense`,
  AddFriend: msg`Add friend`,
  InviteLinks: msg`Invite links`,
  CreateInvite: msg`Invite link`,
  ShareInvite: msg`Invite link`,
  Invite: msg`Invite`,
  CreateGroup: msg`New group`,
}

function screenOptions(t: Theme) {
  return {
    fullScreenGestureEnabled: true,
    headerShown: false,
    contentStyle: t.atoms.bg,
  } as const
}

/*
 * Bluesky's composer presentation: an iOS page sheet (form sheet on iPad)
 * and a full-screen slide-up on Android. Web shows it as a dialog over the
 * page beneath, so the route is transparent there.
 */
const COMPOSER_NATIVE: NativeStackNavigationOptions = IS_IOS
  ? {
      /*
       * Owner rule (26.8): a bottom sheet with Bluesky's drag handle, full
       * height when the form needs it, swipe down to close (the sheet's
       * dirty check turns the gesture off while there are changes).
       */
      presentation: 'formSheet',
      sheetGrabberVisible: true,
      sheetAllowedDetents: IS_IPAD ? 'fitToContents' : [1],
      sheetCornerRadius: 20,
      fullScreenGestureEnabled: false,
    }
  : {
      presentation: 'modal',
      animation: IS_ANDROID ? 'slide_from_bottom' : 'default',
      fullScreenGestureEnabled: false,
    }
const COMPOSER_WEB: NativeStackNavigationOptions = {
  presentation: 'transparentModal',
  contentStyle: {backgroundColor: 'transparent'},
  animation: 'none',
}

/** The `Sheet` route draws nothing: the page beneath renders its own sheet (`useDialogControl({url})`), this route is the URL. */
function SheetMarkerScreen() {
  return null
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
  const {gtMobile} = useBreakpoints()
  const isReducedMotion = useShouldReduceMotion()
  return (
    <Tab.Navigator
      // The start tab preference (Settings > Navigation), mirrored for a synchronous read at launch.
      initialRouteName={TAB_ROUTE[bootStartTab()]}
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        lazy: true,
        // The main-tab switch shifts toward the side of the tab tapped (owner 174), instant under reduced motion.
        animation: isReducedMotion ? 'none' : 'shift',
        // Tablets: the sidebar sits beside full-width content, as on web.
        tabBarPosition: gtMobile ? 'left' : 'bottom',
      }}
      tabBar={props => <NativeTabBar {...props} />}>
      <Tab.Screen name="People" component={PeopleScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

/**
 * The TabsNavigator is used by native mobile to represent the routes
 * as tabs, with every other route pushed above them.
 */
export function TabsNavigator({
  layout,
}: {
  /** Wraps the navigator's content, inside its navigation state (the drawer). */
  layout?: React.ComponentProps<typeof Stack.Navigator>['layout']
}) {
  const t = useTheme()
  const [motion] = usePref('motion')
  const shouldReduceMotion = useShouldReduceMotion()
  /* Reduced motion swaps pushes and sheets for a cross-fade, as iOS does; "Off" cuts them. */
  const reducedAnimation =
    motion === 'off' ? 'none' : shouldReduceMotion ? 'fade' : undefined
  return (
    <Stack.Navigator
      layout={layout}
      screenOptions={{
        ...screenOptions(t),
        ...(reducedAnimation && {animation: reducedAnimation}),
      }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      {/* A main screen opened from a link: the same screen pushed above the tabs, with Back (owner 179). */}
      <Stack.Screen name="PushedPeople" component={PeopleScreen} />
      <Stack.Screen name="PushedGroups" component={GroupsScreen} />
      <Stack.Screen name="PushedAnalytics" component={AnalyticsScreen} />
      <Stack.Screen name="PushedActivity" component={ActivityScreen} />
      <Stack.Screen name="PushedSettings" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="SettingsSection" component={SettingsSectionScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="FriendsAndInvites" component={FriendsAndInvitesScreen} />
      <Stack.Screen name="Person" component={PersonScreen} />
      <Stack.Screen name="Group" component={GroupScreen} />
      <Stack.Screen name="Settle" component={SettleScreen} />
      <Stack.Screen name="Expense" component={ExpenseScreen} />
      <Stack.Screen name="Repayment" component={RepaymentScreen} />
      <Stack.Screen name="InviteLinks" component={InviteLinksScreen} />
      <Stack.Screen name="Invite" component={InviteScreen} />
      {/* The composers (owner: one sheet layout for Add / Edit expense, Add friend, New group) open like Bluesky's composer. */}
      <Stack.Group
        screenOptions={
          reducedAnimation
            ? {...COMPOSER_NATIVE, animation: reducedAnimation}
            : COMPOSER_NATIVE
        }>
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
        <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
        <Stack.Screen name="AddFriend" component={AddFriendScreen} />
        <Stack.Screen name="CreateInvite" component={CreateInviteScreen} />
        <Stack.Screen name="ShareInvite" component={CreateInviteScreen} />
        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      </Stack.Group>
    </Stack.Navigator>
  )
}

/**
 * The FlatNavigator is used by Web to represent the routes
 * in a single ("flat") stack.
 */
export function FlatNavigator({
  layout,
}: {
  /** Wraps the navigator's content, inside its navigation state (the drawer). */
  layout?: React.ComponentProps<typeof Flat.Navigator>['layout']
}) {
  const t = useTheme()
  const {_} = useLingui()
  const screenListeners = useWebScrollRestoration()
  const {demo} = useDemoMode()

  const title = (name: keyof FlatNavigatorParams) => {
    const page = TITLES[name]
    /* Demo mode follows the page name in the window title too (owner 134). */
    const demoTag = demo ? ` - ${_(msg`Demo`)}` : ''
    if (!page) return 'Splito'
    return `${_(page)}${demoTag} - Splito`
  }

  return (
    <Flat.Navigator
      layout={layout}
      screenListeners={screenListeners}
      screenOptions={screenOptions(t)}>
      <Flat.Screen
        name="People"
        component={PeopleScreen}
        getId={tabId}
        options={{title: title('People')}}
      />
      <Flat.Screen
        name="Groups"
        component={GroupsScreen}
        getId={tabId}
        options={{title: title('Groups')}}
      />
      <Flat.Screen
        name="Analytics"
        component={AnalyticsScreen}
        getId={tabId}
        options={{title: title('Analytics')}}
      />
      <Flat.Screen
        name="Activity"
        component={ActivityScreen}
        getId={tabId}
        options={{title: title('Activity')}}
      />
      <Flat.Screen
        name="Profile"
        component={ProfileScreen}
        options={{title: title('Profile')}}
      />
      <Flat.Screen
        name="Settings"
        component={SettingsScreen}
        getId={tabId}
        options={{title: title('Settings')}}
      />
      <Flat.Screen
        name="Search"
        component={SearchScreen}
        options={{title: title('Search')}}
      />
      <Flat.Screen
        name="SettingsSection"
        component={SettingsSectionScreen}
        options={{title: title('SettingsSection')}}
      />
      <Flat.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{title: title('Welcome')}}
      />
      <Flat.Screen
        name="FriendsAndInvites"
        component={FriendsAndInvitesScreen}
        options={{title: title('FriendsAndInvites')}}
      />
      <Flat.Screen
        name="Person"
        component={PersonScreen}
        options={{title: title('Person')}}
      />
      <Flat.Screen
        name="Group"
        component={GroupScreen}
        options={{title: title('Group')}}
      />
      <Flat.Screen
        name="Settle"
        component={SettleScreen}
        options={{title: title('Settle')}}
      />
      <Flat.Screen
        name="Expense"
        component={ExpenseScreen}
        options={{title: title('Expense')}}
      />
      <Flat.Screen
        name="Repayment"
        component={RepaymentScreen}
        options={{title: title('Repayment')}}
      />
      <Flat.Screen
        name="EditExpense"
        component={EditExpenseScreen}
        options={{...COMPOSER_WEB, title: title('EditExpense')}}
      />
      <Flat.Screen
        name="AddFriend"
        component={AddFriendScreen}
        options={{...COMPOSER_WEB, title: title('AddFriend')}}
      />
      <Flat.Screen
        name="InviteLinks"
        component={InviteLinksScreen}
        options={{title: title('InviteLinks')}}
      />
      <Flat.Screen
        name="Invite"
        component={InviteScreen}
        options={{title: title('Invite')}}
      />
      <Flat.Screen
        name="CreateInvite"
        component={CreateInviteScreen}
        options={{...COMPOSER_WEB, title: title('CreateInvite')}}
      />
      <Flat.Screen
        name="ShareInvite"
        component={CreateInviteScreen}
        options={{...COMPOSER_WEB, title: title('ShareInvite')}}
      />
      <Flat.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{...COMPOSER_WEB, title: title('CreateGroup')}}
      />
      <Flat.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{...COMPOSER_WEB, title: title('AddExpense')}}
      />
      {/* A sheet, popup or drawer open over a page (F-241): a route so it has a URL and Back closes it; the page draws the sheet. */}
      <Flat.Screen
        name="Sheet"
        component={SheetMarkerScreen}
        options={({route}) => ({
          ...COMPOSER_WEB,
          title: title(route.params.page as keyof FlatNavigatorParams),
        })}
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
      ref={navigationRef}
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
      <DevTour />
    </NavigationContainer>
  )
}
