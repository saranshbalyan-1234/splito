import {EmptyState} from '#/screens/EmptyState'
import {TabScreen} from '#/screens/TabScreen'

export function ActivityScreen() {
  return (
    <TabScreen testID="screen-activity" title="Activity">
      <EmptyState title="Nothing here yet" body="Expenses, payments and group changes will show up here." />
    </TabScreen>
  )
}
