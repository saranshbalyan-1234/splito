import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {groupBalances, pairwiseBalances} from '@splito/domain'
import {type Entity, type Group} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useLedger, useMe} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {useBreakpoints} from '#/alf'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {Shimmer} from '#/motion/Shimmer'
import {GroupRow, GroupRowPlaceholder} from './components/GroupRow'

const PLACEHOLDER_ROWS = 4

/** Groups list: Bluesky's Lists screen (list-card rows); Create group is the header's action. */
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
    me && ledger ? groupBalances(pairwiseBalances(ledger, me.id)) : {}
  const rows = (groups ?? [])
    .filter(g => !g.data.archived)
    .sort((x, y) => x.data.name.localeCompare(y.data.name))
  const createGroup = () => navigation.navigate('CreateGroup')

  return (
    <Layout.Screen testID="screen-groups">
      <Layout.Header.Outer>
        <HeaderAvatar />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Groups</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.ActionButton
          testID="groups-new"
          label={l`Create group`}
          icon={PlusIcon}
          edge
          onPress={createGroup}
        />
      </Layout.Header.Outer>
      {isLoading ? (
        <Shimmer testID="groups-loading">
          {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
            <GroupRowPlaceholder key={i} hideTopBorder={i === 0} />
          ))}
        </Shimmer>
      ) : (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
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
                  label: l`Create group`,
                  text: l`Create group`,
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
        </LayoutAnimationConfig>
      )}
      <AddExpenseFAB />
    </Layout.Screen>
  )
}
