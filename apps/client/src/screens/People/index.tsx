import {useEffect, useMemo} from 'react'
import {Deferred} from '#/components/Deferred'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {personSummary} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type Params, readSort} from '#/lib/links/listState'
import {perfMark} from '#/lib/perfMark'
import {type NavigationProp} from '#/lib/routes/types'
import {type PeopleState, usePublishPeopleState, useTourRef} from '#/lib/tour/registry'
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
import {useDialogControl} from '#/components/Dialog'
import {SearchAskButton, SearchAskSpacer} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import {TabScreen} from '#/components/TabScreen'
import {DEFAULT_LIST_SORT} from '#/components/ListSortMenu'
import {Shimmer} from '#/motion/Shimmer'
import {type PersonRowData, PersonRowPlaceholder} from './components/PersonRow'
import {FriendsList} from './components/FriendsList'
import {FriendsOverview} from './components/FriendsOverview'
import {analyticsHref} from '#/screens/Analytics/overviewScope'
import {openLink} from '#/lib/links/open'
import {
  FriendsFilterDialog,
  type PeopleFilters,
} from './components/FriendsFilterDialog'
import {SectionHeader} from '#/components/SectionHeader'
import {peopleParams, readPeopleParams} from './urlState'
import {filterFriends, listedFriends, seenByPerson, sortFriends} from './sort'

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
  const route = useRoute()
  /*
   * The filters are the address (`/people?sort=name&show=owesYou`, F-241): a param that is present wins over the saved
   * preference. Memoised on the values (useRoute hands back a new, equal route on many navigation updates).
   */
  const fromAddress = readPeopleParams(route.params as Params)
  const filters: PeopleFilters = useMemo(
    () => ({
      includeGroups: fromAddress.includeGroups ?? includeDefault ?? true,
      currency: fromAddress.currency ?? 'all',
      show: fromAddress.show ?? 'all',
      showHidden: fromAddress.showHidden ?? showHidden,
      showSettled: fromAddress.showSettled ?? showSettled,
    }),
    [fromAddress.includeGroups, fromAddress.currency, fromAddress.show, fromAddress.showHidden, fromAddress.showSettled, includeDefault, showHidden, showSettled],
  )
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
  /* The launch budget's end point: People, the start tab, has its figures (the perf specs read the mark; Home used to carry it). */
  useEffect(() => {
    if (!isLoading) perfMark('splito:people-ready')
  }, [isLoading])
  const groupNames = useGroupChipNames(groups)
  /*
   * Memoised by hand on the projections (each keeps its identity while unchanged): the compiler left this chain
   * unmemoised (measured in the compiled output), so every render of the screen built every friend's summary and row
   * again and each row re-rendered with a new object (17.1).
   */
  const {friends, seenCurrencies, currencies, filtered} = useMemo(() => {
    const summaries = balanceRows ? personSummary(balanceRows, {includeGroups}) : []
    const byPerson = new Map(summaries.map(s => [s.person, s]))
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
    return {friends, seenCurrencies, currencies, filtered}
  }, [balanceRows, includeGroups, people, hiddenIds, seen, filters, showHidden, sort, currency, lastActivity])

  const addFriendRef = useTourRef('add-friend')

  return (
    <TabScreen testID="screen-people">
      {/* The guided tour starts here once People has loaded (F-253). */}
      <PublishPeopleState state={isLoading ? 'loading' : friends.length === 0 ? 'empty' : 'friends'} />
      <Layout.Header.Outer>
        <HeaderAvatar />
        {/* Balances Search & Ask on the right (start tab only, owner 218), so the title stays centred. */}
        <SearchAskSpacer tab="people" />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>People</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <SearchAskButton tab="people" />
        <Layout.Header.ActionButton
          testID="people-add-friend"
          ref={addFriendRef}
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
          <FriendsList
            overview={
              /* Balances with friends right now (owner 219), counted as the list counts them: Include groups on, every
                 balance; off, the non-group ones. A card opens Analytics in that currency and scope. Built here, so a
                 search keystroke (which renders only the list) reuses it. */
              <FriendsOverview
                testID="people-overview"
                titleTestID="people-overview-title"
                friends={friends}
                showHidden={showHidden}
                onCurrencyPress={currency => openLink(analyticsHref(includeGroups ? 'all' : 'direct', currency))}
              />
            }
            filtered={filtered}
            friendsCount={friends.length}
            filters={filters}
            seenCurrencies={seenCurrencies}
            groupNames={groupNames}
            locale={locale}
            activeFilterCount={activeCount}
            onFiltersPress={() => filterControl.open()}
            sort={sort}
            onSortChange={next => {
              /* Absent means the saved choice, and the saved choice is now `next`: only a non-stock order is written. */
              navigation.setParams({sort: next === DEFAULT_LIST_SORT ? undefined : next} as never)
              void setSortSaved(next)
            }}
            onShowSettled={() => void setShowSettled(true)}
            onClearFilters={() => {
              navigation.setParams(peopleParams(STOCK as PeopleFilters, STOCK as PeopleFilters) as never)
              void setIncludeDefault(true)
              void setShowSettled(false)
              void setShowHidden(false)
            }}
          />
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

/*
 * A leaf, so the focus it follows (`useIsFocused`) re-renders only it: in the screen, every switch to or from People
 * re-rendered the whole screen (owner 166; the renders gate's "switching back" legs caught it).
 */
function PublishPeopleState({state}: {state: PeopleState}) {
  usePublishPeopleState(state)
  return null
}
