import {useEffect, useState} from 'react'
import {useWindowDimensions} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {balanceTotals, isSettledBalance, personSummary} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {perfMark} from '#/lib/perfMark'
import {useNumberLocale} from '#/locale/numberLocale'
import {
  useBalanceRows,
  useSeenCurrencies,
  useEntities,
  useLastActivity,
  useMe,
  usePref,
} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useBreakpoints} from '#/alf'
import {AddExpenseFAB, AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {LogoMark} from '#/components/brand/Logo'
import {useDialogControl} from '#/components/Dialog'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import {ListToolsHeader} from '#/components/ListToolsHeader'
import {PressableScale} from '#/motion/PressableScale'
import {Shimmer} from '#/motion/Shimmer'
import {
  BalanceSummary,
  BalanceSummaryPlaceholder,
} from './components/BalanceSummary'
import {
  PersonRow,
  type PersonRowData,
  PersonRowPlaceholder,
} from './components/PersonRow'
import {
  FriendsFilterDialog,
  type PeopleFilters,
} from './components/FriendsFilterDialog'
import {RequestsSection} from './components/RequestsSection'
import {SectionHeader} from './components/SectionHeader'
import {filterFriends, sortFriends} from './sort'

const PLACEHOLDER_ROWS = 6

/**
 * Home: the Overview (balances per currency, counts, Analytics), then one
 * row per friend with their balance per currency and each group's part,
 * under a heading with search and filters. No page title, by spec: the header
 * centres the logo, as Bluesky's home header does. The Include groups
 * filter (default from preferences, applied with Apply) drives the totals
 * and the rows.
 */
export function PeopleScreen() {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {height} = useWindowDimensions()
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const balanceRows = useBalanceRows()
  const seen = useSeenCurrencies()
  const [sortDefault = 'amount'] = usePref('peopleSort')
  const [currency = 'INR'] = usePref('defaultCurrency')
  const [includeDefault] = usePref('includeGroupsDefault')
  const defaults: PeopleFilters = {
    includeGroups: includeDefault ?? true,
    currency: 'all',
    show: 'all',
    sort: sortDefault,
  }
  const [applied, setApplied] = useState<PeopleFilters | null>(null)
  const filters = applied ?? defaults
  const {includeGroups, sort} = filters
  const lastActivity = useLastActivity(sort === 'recent')
  /* The filter button counts what differs from the defaults (Settings › Sorting and filters). */
  const activeCount = (
    ['includeGroups', 'currency', 'show', 'sort'] as const
  ).filter(k => filters[k] !== defaults[k]).length
  const filterControl = useDialogControl()

  const isLoading = !me || !people || !groups || !balanceRows
  /* The launch budget's end point: Home has its figures (perf spec reads the mark). */
  useEffect(() => {
    if (!isLoading) perfMark('splito:home-ready')
  }, [isLoading])
  const summaries = balanceRows
    ? personSummary(balanceRows, {includeGroups})
    : []
  const byPerson = new Map(summaries.map(s => [s.person, s]))
  const groupNames = new Map((groups ?? []).map(g => [g.id, g.data.name]))
  const friends = (people ?? [])
    .filter(p => !p.data.isMe)
    .map(p => ({id: p.id, name: p.data.name, summary: byPerson.get(p.id)}))
  /* Settled currencies stay on offer and filterable (audit m3). */
  const seenByPerson = new Map(
    Object.entries(seen?.people ?? {}).map(([id, cs]) => [id, new Set(cs)]),
  )
  const currencies = [
    ...new Set([
      ...summaries.flatMap(s => Object.keys(s.byCurrency)),
      ...friends.flatMap(f => [...(seenByPerson.get(f.id) ?? [])]),
    ]),
  ].sort()
  const rows: PersonRowData[] = sortFriends(
    filterFriends(friends, filters, seenByPerson),
    sort,
    {
      currency: filters.currency === 'all' ? currency : filters.currency,
      activity: lastActivity ?? new Map(),
    },
  )
  /* The summary follows the filters too, so its figures always match the list. */
  const totals = balanceTotals(
    rows.flatMap(row => (row.summary ? [row.summary] : [])),
  )
  /* Settled means every part is zero, not just the net (audit M10). */
  const settledCount = rows.filter(row =>
    Object.values(row.summary?.byCurrency ?? {}).every(isSettledBalance),
  ).length
  /* Per currency: how many friends the cell's figure is made of. */
  const captions = Object.fromEntries(
    totals.map(({currency: c}) => {
      const n = rows.filter(row => {
        const balance = row.summary?.byCurrency[c]
        return !!balance && !isSettledBalance(balance)
      }).length
      return [c, plural(n, {one: '# friend', other: '# friends'})]
    }),
  )
  const counts = [
    plural(rows.length, {one: '# friend', other: '# friends'}),
    l`${settledCount} settled`,
  ].join(' · ')

  return (
    <Layout.Screen testID="screen-people">
      <Layout.Header.Outer>
        <HeaderAvatar />
        {/* Search & Ask and Add friend on the right, so the logo stays centred. */}
        <Layout.Header.Slot />
        <Layout.Header.Content>
          {/* Phones show the home mark (inactive here); rail and desktop already show it in the sidebar, so the title (ARCHITECTURE 26.4). */}
          {gtMobile ? (
            <Layout.Header.TitleText>{l`Home`}</Layout.Header.TitleText>
          ) : (
            <PressableScale
              testID="header-logo"
              targetScale={0.9}
              accessibilityRole="link"
              accessibilityLabel={l`Splito - Home`}
              aria-disabled={true}
              disabled={true}>
              <LogoMark size={30} />
            </PressableScale>
          )}
        </Layout.Header.Content>
        <SearchAskButton />
        <Layout.Header.ActionButton
          testID="people-add-friend"
          label={l`Invite people`}
          icon={PersonPlusIcon}
          edge
          onPress={() => navigation.navigate('AddFriend')}
        />
      </Layout.Header.Outer>
      {isLoading ? (
        <Shimmer testID="people-loading">
          <BalanceSummaryPlaceholder />
          <FriendsHeader count={undefined} />
          {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
            <PersonRowPlaceholder key={i} />
          ))}
        </Shimmer>
      ) : (
        /* Upstream's list idiom: rows already there on mount appear at once; later inserts and removals animate. */
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            data={rows}
            keyExtractor={(row: PersonRowData) => row.id}
            renderItem={({item}: {item: PersonRowData}) => (
              <PersonRow row={item} groupNames={groupNames} locale={locale} />
            )}
            ListHeaderComponent={
              friends.length > 0 ? (
                <>
                  <RequestsSection />
                  <BalanceSummary
                    totals={totals}
                    locale={locale}
                    counts={counts}
                    captions={captions}
                  />
                  <ListToolsHeader
                    title={l`Friends`}
                    titleTestID="people-friends-title"
                    count={rows.length}
                    activeFilterCount={activeCount}
                    onFiltersPress={() => filterControl.open()}
                  />
                </>
              ) : (
                <RequestsSection />
              )
            }
            ListEmptyComponent={
              friends.length > 0 ? (
                <EmptyState
                  testID="people-filtered-empty"
                  icon={null}
                  message={l`No friends match these filters.`}
                  button={{
                    testID: 'people-clear-filters',
                    label: l`Clear filters`,
                    text: l`Clear filters`,
                    onPress: () => setApplied(null),
                    size: 'small',
                    color: 'secondary',
                  }}
                />
              ) : (
                <EmptyState
                  testID="people-empty"
                  /* Centred in the space under the header, as Bluesky's empty states sit. */
                  style={[a.justify_center, {minHeight: height - 160}]}
                  illustration="empty-people"
                  title={l`Split with friends`}
                  message={l`Add a friend, then split any bill with them. They don’t need the app.`}
                  button={{
                    testID: 'people-empty-add-friend',
                    label: l`Add a friend`,
                    text: l`Add a friend`,
                    icon: PersonPlusIcon,
                    onPress: () => navigation.navigate('AddFriend'),
                    size: 'large',
                    color: 'primary',
                  }}
                  secondaryButton={{
                    testID: 'people-empty-add-expense',
                    label: l({message: 'Add expense', context: 'action'}),
                    text: l({message: 'Add expense', context: 'action'}),
                    onPress: () => navigation.navigate('AddExpense', {}),
                    size: 'large',
                    color: 'secondary',
                  }}
                />
              )
            }
            ListFooterComponent={<AddExpenseFABInset />}
          />
        </LayoutAnimationConfig>
      )}
      {/* The empty state's own buttons are the actions; a FAB would be a third Add. */}
      {(isLoading || friends.length > 0) && <AddExpenseFAB />}
      <FriendsFilterDialog
        control={filterControl}
        filters={filters}
        currencies={currencies}
        onFiltersApplied={setApplied}
      />
    </Layout.Screen>
  )
}

/* The friends list heading while loading; Add friend is the header's action (owner header rule). */
function FriendsHeader({count}: {count: number | undefined}) {
  const {t: l} = useLingui()
  return (
    <SectionHeader
      title={l`Friends`}
      testID="people-friends-title"
      count={count}
    />
  )
}
