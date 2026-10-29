import {useEffect, useState} from 'react'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {balanceTotals, isSettledBalance, personSummary} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type Params} from '#/lib/links/listState'
import {type NavigationProp} from '#/lib/routes/types'
import {perfMark} from '#/lib/perfMark'
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
import {useDemoMode} from '#/state/demo'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {AddExpenseFAB, AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {LogoMark} from '#/components/brand/Logo'
import {useDialogControl} from '#/components/Dialog'
import {Button, ButtonText} from '#/components/Button'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as SearchIcon} from '#/components/icons/MagnifyingGlass'
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
import {peopleParams, readPeopleParams} from './urlState'
import {filterFriends, listedFriends, searchFriends, seenByPerson, sortFriends} from './sort'

const PLACEHOLDER_ROWS = 6

/* What the filter dot compares with: the stock choices. Sort and Include groups are saved on Apply (owner 128), so they are the defaults only until changed. */
const STOCK = {includeGroups: true, currency: 'all', show: 'all', sort: 'amount', showHidden: false, showSettled: false} as const

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
  const t = useTheme()
  const {demo} = useDemoMode()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const me = useMe()
  /* Tombstones too: a removed friend stays in the list, struck through (decision 103). */
  const people = useAllEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const balanceRows = useBalanceRows()
  const seen = useSeenCurrencies()
  const [sortDefault = 'amount', setSortDefault] = usePref('peopleSort')
  const [currency = 'INR'] = usePref('defaultCurrency')
  const [includeDefault, setIncludeDefault] = usePref('includeGroupsDefault')
  const [showHidden, setShowHidden] = useShowHidden()
  const [showSettled = false, setShowSettled] = usePref('people.showSettled')
  const hiddenIds = useHiddenItems()
  const defaults: PeopleFilters = {
    includeGroups: includeDefault ?? true,
    currency: 'all',
    show: 'all',
    sort: sortDefault,
    showHidden: false,
    showSettled: false,
  }
  /* The list's own search (26.12): by name, combined with the filters; not kept after leaving. */
  const [query, setQuery] = useState('')
  const route = useRoute()
  /* The filters are the address (`/?sort=name&show=owesYou`, F-241): a param that is present wins over the saved preference. */
  const filters: PeopleFilters = {
    ...defaults,
    showHidden,
    showSettled,
    ...readPeopleParams(route.params as Params),
  }
  const {includeGroups, sort} = filters
  const lastActivity = useLastActivity(sort === 'recent')
  /* The filter button counts what differs from the defaults (Settings › Sorting and filters). */
  const activeCount = (
    ['includeGroups', 'currency', 'show', 'sort', 'showHidden', 'showSettled'] as const
  ).filter(k => filters[k] !== STOCK[k]).length
  const filterControl = useDialogControl({url: 'filters'})

  const isLoading = !me || !people || !groups || !balanceRows
  /* The launch budget's end point: Home has its figures (perf spec reads the mark). */
  useEffect(() => {
    if (!isLoading) perfMark('splito:home-ready')
  }, [isLoading])
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
  /* A removed friend is in the list but is no friend now: the counts and figures cover the live rows. */
  const rows = filtered.filter(row => row.deletedAt === undefined)
  /*
   * Settled up friends leave the list only (owner 90, 112): the figures and the counts below still cover them,
   * and a search still finds them.
   */
  const {listed, count: listedCount, total: searchTotal} = searchFriends(filtered, query, filters, seenCurrencies)
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
              style={[a.flex_row, a.align_center, a.gap_xs]}
              disabled={true}>
              <LogoMark size={30} />
              {demo ? (
                <Text testID="header-demo-label" style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
                  <Trans>Demo</Trans>
                </Text>
              ) : null}
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
            data={listed}
            keyExtractor={(row: PersonRowData) => row.id}
            renderItem={({item}: {item: PersonRowData}) => (
              <PersonRow row={item} groupNames={groupNames} locale={locale} />
            )}
            ListHeaderComponent={
              friends.length > 0 ? (
                <>
                  <BalanceSummary
                    totals={totals}
                    locale={locale}
                    counts={counts}
                    captions={captions}
                  />
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
                    action={
                      <Button
                        testID="people-manage-friends"
                        label={l`Manage friends and invites`}
                        size="small"
                        variant="ghost"
                        color="secondary"
                        onPress={() => navigation.navigate('FriendsAndInvites')}>
                        <ButtonText>
                          <Trans>Manage</Trans>
                        </ButtonText>
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
                  icon={SearchIcon}
                  message={l`No matches for “${query.trim()}”`}
                />
              ) : friends.length > 0 ? (
                filtered.length > 0 && !showSettled ? (
                  /* Everything that matches is settled up: one button brings it back (it sets the preference). */
                  <EmptyState
                    testID="people-all-settled"
                    icon={null}
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
                  icon={null}
                  message={l`No friends match these filters.`}
                  button={{
                    testID: 'people-clear-filters',
                    label: l`Clear filters`,
                    text: l`Clear filters`,
                    onPress: () => {
                      navigation.setParams(peopleParams(STOCK as PeopleFilters, STOCK as PeopleFilters) as never)
                      void setSortDefault('amount')
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
      {/* The empty state's own buttons are the actions; a FAB would be a third Add. */}
      {(isLoading || friends.length > 0) && <AddExpenseFAB />}
      <FriendsFilterDialog
        control={filterControl}
        filters={filters}
        currencies={currencies}
        onFiltersApplied={f => {
          navigation.setParams(peopleParams(f, STOCK as PeopleFilters, {sort: sortDefault, includeGroups: includeDefault ?? true, showSettled, showHidden}) as never)
          if (f.showHidden !== showHidden) void setShowHidden(f.showHidden)
          if (f.showSettled !== showSettled) void setShowSettled(f.showSettled)
          /* Sort and Include groups are saved too (owner 128): the choice is the new default and survives a reload. */
          if (f.sort !== sortDefault) void setSortDefault(f.sort)
          if (f.includeGroups !== (includeDefault ?? true)) void setIncludeDefault(f.includeGroups)
        }}
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
