import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {Button, ButtonText} from '#/components/Button'
import {EmptyState} from '#/screens/EmptyState'
import {TabScreen} from '#/screens/TabScreen'

export function PeopleScreen() {
  const navigation = useNavigation<NavigationProp>()
  return (
    <TabScreen testID="screen-people" isHome>
      <EmptyState title="Split anything with anyone" body="Add a friend to start. They don't need the app - you can invite them later.">
        <Button label="Add expense" color="primary" size="large" onPress={() => navigation.navigate('AddExpense', {})}>
          <ButtonText>Add expense</ButtonText>
        </Button>
        <Button label="Add a friend" color="secondary" size="large" onPress={() => navigation.navigate('AddExpense', {})}>
          <ButtonText>Add a friend</ButtonText>
        </Button>
      </EmptyState>
    </TabScreen>
  )
}
