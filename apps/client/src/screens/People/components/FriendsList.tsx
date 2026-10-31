import {useDeferredValue, useEffect, useMemo, useState} from 'react'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type ListSort} from '@splito/sync'

import {HITSLOP_10} from '#/lib/constants'
import {type NavigationProp} from '#/lib/routes/types'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {Button, ButtonIcon} from '#/components/Button'
import {SettingsGear2_Stroke2_Corner0_Rounded as GearIcon} from '#/components/icons/Settings'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import {ListToolsHeader} from '#/components/ListToolsHeader'
import {QuietRowsProvider, useQuietRows} from '#/motion/listAnimations'
import {type PeopleFilters} from './FriendsFilterDialog'
import {PersonRow, type PersonRowData} from './PersonRow'
import {RequestsSection} from './RequestsSection'
import {searchFriends} from '../sort'

/**
 * The friends list with its own search (26.12): the heading with search, Filters, Sort and the gear, then the rows.
 * The query lives here, not in `PeopleScreen`, so a keystroke renders this list and nothing above it (the screen's
 * balances, requests, filter sheet and header): before, every key re-rendered the whole screen and recomputed every
 * friend's summary, so each row got a new object and re-rendered too (17.1). The rows follow the query as a deferred
 * value, so the field echoes the key first; rows a key removes or brings back swap without their exit or enter fade.
 */
export function FriendsList({
  overview,
  filtered,
  friendsCount,
  filters,
  seenCurrencies,
  groupNames,
  locale,
  activeFilterCount,
  onFiltersPress,
  sort,
  onSortChange,
  onShowSettled,
  onClearFilters,
}: {
  /** The balances Overview above the requests (made by the screen, so a keystroke leaves it alone). */
  overview: React.ReactNode
  /** Friends after the filters and in order; the search picks from these (never re-derives them). */
  filtered: PersonRowData[]
  /** Friends before any filter: none means the first-use empty state. */
  friendsCount: number
  filters: PeopleFilters
  seenCurrencies: ReadonlyMap<string, ReadonlySet<string>>
  groupNames: Map<string, string>
  locale: string
  activeFilterCount: number
  onFiltersPress: () => void
  sort: ListSort
  onSortChange: (sort: ListSort) => void
  onShowSettled: () => void
  onClearFilters: () => void
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  /* Not kept after leaving the screen. */
  const [query, setQuery] = useState('')
  const listQuery = useDeferredValue(query)
  const quietRows = useQuietRows()
  const changeQuery = (next: string) => {
    quietRows.hush(next)
    setQuery(next)
  }
  useEffect(() => {
    if (listQuery === query) quietRows.settle(listQuery)
  }, [listQuery, query, quietRows])
  /*
   * Memoised by hand: the compiler left this call unmemoised in the screen (measured), and a new `listed` per render
   * hands the List new data. Keyed on the deferred query, so a key's urgent render reuses it.
   */
  const {listed, count, total} = useMemo(
    () => searchFriends(filtered, listQuery, filters, seenCurrencies),
    [filtered, listQuery, filters, seenCurrencies],
  )
  const trimmed = listQuery.trim()

  return (
    /* Upstream's list idiom: rows already there on mount appear at once; later inserts and removals animate. */
    <LayoutAnimationConfig skipEntering skipExiting>
      <QuietRowsProvider value={quietRows}>
        <List
          data={listed}
          keyExtractor={(row: PersonRowData) => row.id}
          renderItem={({item, index}: {item: PersonRowData; index: number}) => (
            <PersonRow row={item} groupNames={groupNames} locale={locale} isTourTarget={index === 0} />
          )}
          ListHeaderComponent={
            friendsCount > 0 ? (
              <>
                {overview}
                <RequestsSection />
                <ListToolsHeader
                  title={l`Friends`}
                  titleTestID="people-friends-title"
                  count={count}
                  /* "N of M": M is what the search runs over (settled friends included), so N never exceeds it. */
                  total={total}
                  query={query}
                  onQueryChange={changeQuery}
                  searchLabel={l`Search friends`}
                  activeFilterCount={activeFilterCount}
                  onFiltersPress={onFiltersPress}
                  sort={{value: sort, onChange: onSortChange}}
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
            friendsCount > 0 && trimmed ? (
              <EmptyState
                testID="people-search-empty"
                illustration="empty-search"
                message={l`No matches for “${listQuery.trim()}”`}
                button={{
                  testID: 'people-search-clear',
                  label: l`Clear search`,
                  text: l`Clear search`,
                  onPress: () => changeQuery(''),
                  size: 'small',
                  color: 'secondary',
                }}
              />
            ) : friendsCount > 0 ? (
              filtered.length > 0 && !filters.showSettled ? (
                /* Everything that matches is settled up: one button brings it back (it sets the preference). */
                <EmptyState
                  testID="people-all-settled"
                  illustration="empty-settled"
                  message={l`All settled up`}
                  button={{
                    testID: 'people-show-settled',
                    label: l`Show settled`,
                    text: l`Show settled`,
                    onPress: onShowSettled,
                    size: 'small',
                    color: 'secondary',
                  }}
                />
              ) : (
                <EmptyState
                  testID="people-filtered-empty"
                  illustration="empty-filter"
                  message={l`No friends match these filters.`}
                  button={{
                    testID: 'people-clear-filters',
                    label: l`Clear filters`,
                    text: l`Clear filters`,
                    onPress: onClearFilters,
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
      </QuietRowsProvider>
    </LayoutAnimationConfig>
  )
}
