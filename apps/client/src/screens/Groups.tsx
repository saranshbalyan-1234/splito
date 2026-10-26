import {Button, ButtonText} from '#/components/Button'
import {EmptyState} from '#/screens/EmptyState'
import {TabScreen} from '#/screens/TabScreen'

export function GroupsScreen() {
  return (
    <TabScreen testID="screen-groups" title="Groups">
      <EmptyState title="No groups yet" body="Make a group for a trip, a flat or a couple. Everyone's balances stay in one place.">
        <Button label="Create group" color="primary" size="large">
          <ButtonText>Create group</ButtonText>
        </Button>
      </EmptyState>
    </TabScreen>
  )
}
