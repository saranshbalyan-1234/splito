import {useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {balanceTotals, personSummary} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {
  HIDING_HEADER_HEIGHT,
  HomeHeaderModeProvider,
  MainScrollProvider,
} from '#/lib/MainScrollProvider'
import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useLedger, useMe, usePref} from '#/data/hooks'
import {HomeHeaderLayout} from '#/view/com/home/HomeHeaderLayout'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useBreakpoints} from '#/alf'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {myBalances} from '#/components/groups/net'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as FilterIcon} from '#/components/icons/SettingsSlider'
import * as Layout from '#/components/Layout'
import * as Pills from '#/components/Pills'
import {Shimmer} from '#/motion/Shimmer'
import {HistoryFilterDialog} from '#/screens/Person/components/HistoryFilterDialog'
import {
  BalanceSummary,
  BalanceSummaryPlaceholder,
} from './components/BalanceSummary'
import {
  PersonRow,
  type PersonRowData,
  PersonRowPlaceholder,
} from './components/PersonRow'
import {SectionHeader} from './components/SectionHeader'
import {lastActivity, sortFriends} from './sort'

const PLACEHOLDER_ROWS = 6

/**
 * Home: balances per currency, then one row per friend with their balance
 * per currency and each group's part. No page title, by spec. The Include
 * groups filter (default from preferences, applied with Apply) drives the
 * totals and the rows.
 */
export function PeopleScreen() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {gtMobile} = useBreakpoints()
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const ledger = useLedger()
  const [sort = 'amount'] = usePref('peopleSort')
  const [currency = 'INR'] = usePref('defaultCurrency')
  const [includeDefault] = usePref('includeGroupsDefault')
  const [applied, setApplied] = useState<boolean | null>(null)
  const includeGroups = applied ?? includeDefault ?? true
  const filterControl = useDialogControl()

  const isLoading = !me || !people || !groups || !ledger
  const summaries =
    me && ledger && groups
      ? personSummary(myBalances(ledger, me.id, groups), {includeGroups})
      : []
  const totals = balanceTotals(summaries)
  const byPerson = new Map(summaries.map(s => [s.person, s]))
  const groupNames = new Map((groups ?? []).map(g => [g.id, g.data.name]))
  const rows: PersonRowData[] = sortFriends(
    (people ?? [])
      .filter(p => !p.data.isMe)
      .map(p => ({id: p.id, name: p.data.name, summary: byPerson.get(p.id)})),
    sort,
    {
      currency,
      activity: sort === 'recent' && ledger ? lastActivity(ledger) : new Map(),
    },
  )
  const friendsAction = (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      {!includeGroups && (
        <Pills.Tag>
          <Trans>Direct only</Trans>
        </Pills.Tag>
      )}
      <Button
        testID="people-filter"
        label={l`Filter`}
        size="small"
        color="secondary"
        onPress={() => filterControl.open()}>
        <ButtonIcon icon={FilterIcon} />
        <ButtonText>
          <Trans>Filter</Trans>
        </ButtonText>
      </Button>
    </View>
  )

  return (
    <Layout.Screen testID="screen-people">
      <HomeHeaderModeProvider>
        <HomeHeaderLayout tabBarAnchor={null}>{null}</HomeHeaderLayout>
        {isLoading ? (
          <Shimmer
            testID="people-loading"
            style={!gtMobile && {paddingTop: HIDING_HEADER_HEIGHT}}>
            <BalanceSummaryPlaceholder />
            <FriendsHeader count={undefined} />
            {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
              <PersonRowPlaceholder key={i} />
            ))}
          </Shimmer>
        ) : (
          /* Upstream's list idiom: rows already there on mount appear at once; later inserts and removals animate. */
          <LayoutAnimationConfig skipEntering skipExiting>
            <MainScrollProvider>
              <List
                headerOffset={gtMobile ? undefined : HIDING_HEADER_HEIGHT}
                data={rows}
                keyExtractor={(row: PersonRowData) => row.id}
                renderItem={({item}: {item: PersonRowData}) => (
                  <PersonRow
                    row={item}
                    groupNames={groupNames}
                    locale={locale}
                  />
                )}
                ListHeaderComponent={
                  rows.length > 0 ? (
                    <>
                      {totals.length > 0 && (
                        <BalanceSummary totals={totals} locale={locale} />
                      )}
                      <FriendsHeader
                        count={rows.length}
                        action={friendsAction}
                      />
                    </>
                  ) : undefined
                }
                ListEmptyComponent={
                  <EmptyState
                    testID="people-empty"
                    illustration="empty-people"
                    message={l`Split anything with anyone. Add an expense or a friend to get started – friends don’t need the app.`}
                    button={{
                      label: l`Add friend`,
                      text: l`Add friend`,
                      icon: PersonPlusIcon,
                      onPress: () => navigation.navigate('AddFriend'),
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
      <HistoryFilterDialog
        control={filterControl}
        includeGroups={includeGroups}
        onFilterApplied={setApplied}
      />
    </Layout.Screen>
  )
}

/* The friends list heading with the filter; Add friend is the header's action (owner header rule). */
function FriendsHeader({
  count,
  action,
}: {
  count: number | undefined
  action?: React.ReactNode
}) {
  const {t: l} = useLingui()
  return (
    <SectionHeader
      title={l`Friends`}
      testID="people-friends-title"
      count={count}
      action={action}
    />
  )
}
