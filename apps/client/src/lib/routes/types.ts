import {type NavigationProp as BaseNavigationProp} from '@react-navigation/native'

export type TabParams = {
  People: undefined
  Groups: undefined
  Activity: undefined
  Profile: undefined
}

export type RootStackParams = {
  Tabs: undefined
  Person: {personId: string}
  Group: {groupId: string}
  AddExpense: {personId?: string; groupId?: string; expenseId?: string}
  AddPerson: undefined
  CreateGroup: undefined
  Settings: undefined
}

export type NavigationProp = BaseNavigationProp<RootStackParams & TabParams>
