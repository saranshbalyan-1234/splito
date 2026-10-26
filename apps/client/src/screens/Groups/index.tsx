import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {groupBalances} from '@splito/domain'
import {type Entity, type Group} from '@splito/sync'

import {
  HIDING_HEADER_HEIGHT,
  HidingHeader,
  HomeHeaderModeProvider,
  MainScrollProvider,
} from '#/lib/MainScrollProvider'
import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useLedger, useMe} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {useBreakpoints} from '#/alf'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'
import {myBalances} from '#/components/groups/net'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {NotificationsBell} from '#/components/NotificationsBell'
import {Shimmer} from '#/motion/Shimmer'
import {GroupRow, GroupRowPlaceholder} from './components/GroupRow'

const PLACEHOLDER_ROWS = 4

/** Groups list: Bluesky's Lists screen (header with a create action, list-card rows). */
export function GroupsScreen() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {gtMobile} = useBreakpoints()
  const me = useMe()
  const groups = useEntities<Group>('group')
  const ledger = useLedger()

  const isLoading = !me || !groups || !ledger
  const balances =
    me && ledger && groups
      ? groupBalances(myBalances(ledger, me.id, groups))
      : {}
  const rows = (groups ?? [])
    .filter(g => !g.data.archived)
    .sort((x, y) => x.data.name.localeCompare(y.data.name))
  const createGroup = () => navigation.navigate('CreateGroup')

  return (
    <Layout.Screen testID="screen-groups">
      <HomeHeaderModeProvider>
        <HidingHeader>
          <Layout.Header.Outer>
            {/* Empty slots as wide as the action, bell and avatar on the right, so the title stays centred. */}
            <Layout.Header.Slot />
            <Layout.Header.Slot />
            <Layout.Header.Slot />
            <Layout.Header.Content>
              <Layout.Header.TitleText>
                <Trans>Groups</Trans>
              </Layout.Header.TitleText>
            </Layout.Header.Content>
            <Layout.Header.IconButton
              testID="groups-new"
              icon={PlusIcon}
              label={l`Create group`}
              onPress={createGroup}
            />
            <NotificationsBell />
            <HeaderAvatar />
          </Layout.Header.Outer>
        </HidingHeader>
        {isLoading ? (
          <Shimmer
            testID="groups-loading"
            style={!gtMobile && {paddingTop: HIDING_HEADER_HEIGHT}}>
            {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
              <GroupRowPlaceholder key={i} hideTopBorder={i === 0} />
            ))}
          </Shimmer>
        ) : (
          <LayoutAnimationConfig skipEntering skipExiting>
            <MainScrollProvider>
              <List
                headerOffset={gtMobile ? undefined : HIDING_HEADER_HEIGHT}
                data={rows}
                keyExtractor={(group: Entity<Group>) => group.id}
                renderItem={({
                  item,
                  index,
                }: {
                  item: Entity<Group>
                  index: number
                }) => (
                  <GroupRow
                    group={item}
                    balances={balances[item.id] ?? {}}
                    locale={locale}
                    hideTopBorder={index === 0}
                  />
                )}
                ListEmptyComponent={
                  <EmptyState
                    testID="groups-empty"
                    illustration="empty-groups"
                    message={l`No groups yet. A group keeps a trip’s or a flat’s expenses and balances in one place.`}
                    button={{
                      label: l`New group`,
                      text: l`New group`,
                      icon: PlusIcon,
                      onPress: createGroup,
                      size: 'small',
                      color: 'secondary',
                    }}
                  />
                }
                ListFooterComponent={
                  !gtMobile ? <View style={{height: 100}} /> : undefined
                }
              />
            </MainScrollProvider>
          </LayoutAnimationConfig>
        )}
        <AddExpenseFAB />
      </HomeHeaderModeProvider>
    </Layout.Screen>
  )
}
