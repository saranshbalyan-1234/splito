import {useState} from 'react'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Deferred} from '#/components/Deferred'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {personSummary} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type Params, readSort} from '#/lib/links/listState'
import {type NavigationProp} from '#/lib/routes/types'
import {useGroupChipNames} from '#/data/groupVisibility'
import {useHiddenItems, useShowHidden} from '#/data/hiddenItems'
import {useNumberLocale} from '#/locale/numberLocale'
import {
  useAllEntities,
  useBalanceRows,
  useSeenCurrencies,
  useEntities,
  useLastActivity,
  useMe,
  usePref,
} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {useSuppressFab} from '#/components/RouteFAB'
import {useDialogControl} from '#/components/Dialog'
import {Button, ButtonIcon} from '#/components/Button'
import {HITSLOP_10} from '#/lib/constants'
import {SettingsGear2_Stroke2_Corner0_Rounded as GearIcon} from '#/components/icons/Settings'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import {TabScreen} from '#/components/TabScreen'
import {ListToolsHeader} from '#/components/ListToolsHeader'
import {DEFAULT_LIST_SORT} from '#/components/ListSortMenu'
import {Shimmer} from '#/motion/Shimmer'
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
import {peopleParams, readPeopleParams} from './urlState'
import {filterFriends, listedFriends, searchFriends, seenByPerson, sortFriends} from './sort'

const PLACEHOLDER_ROWS = 6

/* What the filter dot compares with: the stock choices. Include groups is saved on Apply (owner 128), so they are the defaults only until changed. */
const STOCK = {includeGroups: true, currency: 'all', show: 'all', showHidden: false, showSettled: false} as const

/**
 * People (F-256, owners 153, 175): the requests waiting for an answer and the Invites sent rows, then one row per
 * friend with their balance per currency and each group's part, under a heading with search and filters (Show
 * settled included). The Overview is the top of Analytics (owner 198). The Include groups filter (default from preferences,
 * applied with Apply) drives the rows.
 */
export function PeopleScreen() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const me = useMe()
  /* Tombstones too: a removed friend stays in the list, struck through (decision 103). */
  const people = useAllEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const balanceRows = useBalanceRows()
  const seen = useSeenCurrencies()
  const [sortSaved = DEFAULT_LIST_SORT, setSortSaved] = usePref('peopleSort')
  const [currency = 'INR'] = usePref('defaultCurrency')
  const [includeDefault, setIncludeDefault] = usePref('includeGroupsDefault')
  const [showHidden, setShowHidden] = useShowHidden()
  const [showSettled = false, setShowSettled] = usePref('people.showSettled')
  const hiddenIds = useHiddenItems()
  const defaults: PeopleFilters = {
    includeGroups: includeDefault ?? true,
    currency: 'all',
    show: 'all',
    showHidden: false,
    showSettled: false,
  }
  /* The list's own search (26.12): by name, combined with the filters; not kept after leaving. */
  const [query, setQuery] = useState('')
  const route = useRoute()
  /* The filters are the address (`/people?sort=name&show=owesYou`, F-241): a param that is present wins over the saved preference. */
  const filters: PeopleFilters = {
    ...defaults,
    showHidden,
    showSettled,
    ...readPeopleParams(route.params as Params),
  }
  const {includeGroups} = filters
  /* The order is the address (`/people?sort=name`, owner 199): a param that is present wins over the saved preference. */
  const sort = readSort((route.params as Params)?.sort) ?? sortSaved
  const lastActivity = useLastActivity(sort === 'lastActive')
  /* The filter button counts what differs from the defaults (Settings › Sorting and filters). */
  const activeCount = (
    ['includeGroups', 'currency', 'show', 'showHidden', 'showSettled'] as const
  ).filter(k => filters[k] !== STOCK[k]).length
  const filterControl = useDialogControl({url: 'filters'})

  const isLoading = !me || !people || !groups || !balanceRows
  const summaries = balanceRows
    ? personSummary(balanceRows, {includeGroups})
    : []
  const byPerson = new Map(summaries.map(s => [s.person, s]))
  const groupNames = useGroupChipNames(groups)
  const friends = listedFriends(people ?? [], byPerson, hiddenIds)
  /* Settled currencies stay on offer and filterable (audit m3). */
  const seenCurrencies = seenByPerson(seen?.people ?? {}, includeGroups)
  const currencies = [
    ...new Set([
      ...summaries.flatMap(s => Object.keys(s.byCurrency)),
      ...friends.flatMap(f => [...(seenCurrencies.get(f.id) ?? [])]),
    ]),
  ].sort()
  const filtered: PersonRowData[] = sortFriends(
    filterFriends(friends, filters, seenCurrencies).filter(f => showHidden || !f.isHidden),
    sort,
    {
      currency: filters.currency === 'all' ? currency : filters.currency,
      activity: lastActivity ?? new Map(),
    },
  )
  /* Settled up friends leave the list only (owner 90, 112): a search still finds them. */
  const {listed, count: listedCount, total: searchTotal} = searchFriends(filtered, query, filters, seenCurrencies)

  /* The empty state's own buttons are the actions; a FAB would be a third Add. */
  useSuppressFab(!isLoading && friends.length === 0)

  return (
    <TabScreen testID="screen-people">
      <Layout.Header.Outer>
        <HeaderAvatar />
        {/* Search & Ask and Add friend on the right, so the title stays centred. */}
        <Layout.Header.Slot />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>People</Trans>
          </Layout.Header.TitleText>
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
      {/* Shell first (owner 152): the header paints at once, a skeleton while the data is missing, the list mounts after as a transition. */}
      <Deferred
        when={!isLoading}
        fallback={
        <Shimmer testID="people-loading">
          <FriendsHeader count={undefined} />
          {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
            <PersonRowPlaceholder key={i} />
          ))}
        </Shimmer>
        }>
        {() => (
        /* Upstream's list idiom: rows already there on mount appear at once; later inserts and removals animate. */
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            data={listed}
            keyExtractor={(row: PersonRowData) => row.id}
            renderItem={({item}: {item: PersonRowData}) => (
              <PersonRow row={item} groupNames={groupNames} locale={locale} />
            )}
            ListHeaderComponent={
              friends.length > 0 ? (
                <>
                  <RequestsSection />
                  <ListToolsHeader
                    title={l`Friends`}
                    titleTestID="people-friends-title"
                    count={listedCount}
                    /* "N of M": M is what the search runs over (settled friends included), so N never exceeds it. */
                    total={searchTotal}
                    query={query}
                    onQueryChange={setQuery}
                    searchLabel={l`Search friends`}
                    activeFilterCount={activeCount}
                    onFiltersPress={() => filterControl.open()}
                    sort={{
                      value: sort,
                      onChange: next => {
                        /* Absent means the saved choice, and the saved choice is now `next`: only a non-stock order is written. */
                        navigation.setParams({sort: next === DEFAULT_LIST_SORT ? undefined : next} as never)
                        void setSortSaved(next)
                      },
                    }}
                    endAction={
                      <Button
                        testID="people-manage-friends"
                        label={l`Manage friends and invites`}
                        size="small"
                        variant="ghost"
                        color="secondary"
                        shape="round"
                        hitSlop={HITSLOP_10}
                        onPress={() => navigation.navigate('FriendsAndInvites')}>
                        <ButtonIcon icon={GearIcon} size="md" />
                      </Button>
                    }
                  />
                </>
              ) : (
                <RequestsSection />
              )
            }
            ListEmptyComponent={
              friends.length > 0 && query.trim() ? (
                <EmptyState
                  testID="people-search-empty"
                  illustration="empty-people"
                  message={l`No matches for “${query.trim()}”`}
                />
              ) : friends.length > 0 ? (
                filtered.length > 0 && !showSettled ? (
                  /* Everything that matches is settled up: one button brings it back (it sets the preference). */
                  <EmptyState
                    testID="people-all-settled"
                    illustration="empty-people"
                    message={l`All settled up`}
                    button={{
                      testID: 'people-show-settled',
                      label: l`Show settled`,
                      text: l`Show settled`,
                      onPress: () => void setShowSettled(true),
                      size: 'small',
                      color: 'secondary',
                    }}
                  />
                ) : (
                <EmptyState
                  testID="people-filtered-empty"
                  illustration="empty-people"
                  message={l`No friends match these filters.`}
                  button={{
                    testID: 'people-clear-filters',
                    label: l`Clear filters`,
                    text: l`Clear filters`,
                    onPress: () => {
                      navigation.setParams(peopleParams(STOCK as PeopleFilters, STOCK as PeopleFilters) as never)
                      void setIncludeDefault(true)
                      void setShowSettled(false)
                      void setShowHidden(false)
                    },
                    size: 'small',
                    color: 'secondary',
                  }}
                />
                )
              ) : (
                <EmptyState
                  testID="people-empty"
                  /* Same layout, motion and button as every other screen's empty state (owner 146). */
                  illustration="empty-people"
                  message={l`No friends yet. Add a friend, then split any bill with them. They don’t need the app.`}
                  button={{
                    testID: 'people-empty-add-friend',
                    label: l`Add a friend`,
                    text: l`Add a friend`,
                    icon: PersonPlusIcon,
                    onPress: () => navigation.navigate('AddFriend'),
                    size: 'small',
                    color: 'secondary',
                  }}
                />
              )
            }
            ListFooterComponent={<AddExpenseFABInset />}
          />
        </LayoutAnimationConfig>
        )}
      </Deferred>
      <FriendsFilterDialog
        control={filterControl}
        filters={filters}
        currencies={currencies}
        onFiltersApplied={f => {
          navigation.setParams(peopleParams(f, STOCK as PeopleFilters, {includeGroups: includeDefault ?? true, showSettled, showHidden}) as never)
          if (f.showHidden !== showHidden) void setShowHidden(f.showHidden)
          if (f.showSettled !== showSettled) void setShowSettled(f.showSettled)
          /* Include groups is saved too (owner 128): the choice is the new default and survives a reload. */
          if (f.includeGroups !== (includeDefault ?? true)) void setIncludeDefault(f.includeGroups)
        }}
      />
    </TabScreen>
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
