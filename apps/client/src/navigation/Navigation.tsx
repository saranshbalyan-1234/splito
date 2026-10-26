import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {DarkTheme, DefaultTheme, NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'

import {type RootStackParams, type TabParams} from '#/lib/routes/types'
import {useBreakpoints, useTheme} from '#/alf'
import {linking} from '#/navigation/linking'
import {TabBar} from '#/navigation/TabBar'
import {ActivityScreen} from '#/screens/Activity'
import {AddExpenseScreen} from '#/screens/AddExpense'
import {GroupsScreen} from '#/screens/Groups'
import {PeopleScreen} from '#/screens/People'
import {ProfileScreen} from '#/screens/Profile'

const Stack = createNativeStackNavigator<RootStackParams>()
const Tab = createBottomTabNavigator<TabParams>()

function Tabs() {
  const {gtMobile} = useBreakpoints()
  return (
    <Tab.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{headerShown: false, tabBarPosition: gtMobile ? 'left' : 'bottom', animation: 'shift'}}>
      <Tab.Screen name="People" component={PeopleScreen} options={{title: 'Splito'}} />
      <Tab.Screen name="Groups" component={GroupsScreen} options={{title: 'Groups - Splito'}} />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{title: 'Activity - Splito'}} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{title: 'Profile - Splito'}} />
    </Tab.Navigator>
  )
}

export function Navigation() {
  const t = useTheme()
  const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme
  return (
    <NavigationContainer
      linking={linking}
      theme={{...base, colors: {...base.colors, primary: t.palette.primary_500, background: t.atoms.bg.backgroundColor, card: t.atoms.bg.backgroundColor, border: t.atoms.border_contrast_low.borderColor}}}>
      <Stack.Navigator screenOptions={{headerShown: false, gestureEnabled: true}}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{presentation: 'formSheet', title: 'Add expense - Splito'}} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
