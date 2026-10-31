import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Deferred} from '#/components/Deferred'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {
  type Entity,
  type Group,
  isGroupInactive,
  type Person,
} from '@splito/sync'

import {type Params} from '#/lib/links/listState'
import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useHiddenGroups} from '#/data/groupVisibility'
import {useShowHidden} from '#/data/hiddenItems'
import {
  useAllEntities,
  useGroupActivity,
  useMe,
  useMyGroupBalances,
  useOpenGroups,
  useSeenCurrencies,
  usePref,
} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ChevronExpand_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {useDialogControl} from '#/components/Dialog'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {TabScreen} from '#/components/TabScreen'
import {ListToolsHeader} from '#/components/ListToolsHeader'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {SectionHeader} from '#/components/SectionHeader'
import {GroupRequestsSection} from './components/GroupRequestsSection'
import {GroupRow, GroupRowPlaceholder} from './components/GroupRow'
import {GroupsFilterDialog} from './components/GroupsFilterDialog'
import {
  DEFAULT_GROUP_FILTERS,
  filterGroups,
  type GroupFilters,
  type GroupRowData,
  matchesGroupSearch,
  sortGroups,
} from './filter'
import {groupParams, readGroupParams} from './urlState'

const PLACEHOLDER_ROWS = 4

/**
 * Groups list: Bluesky's Lists screen (list-card rows); Create group is the
 * header's action, and the FAB adds an expense as on every tab. No Overview
 * (it lives on Home only, owner 153); search and filters sit on the list's
 * heading.
 */
export function GroupsScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const me = useMe()
  /* Tombstones too: a deleted group stays in the list, struck through (decision 103). */
  const groups = useAllEntities<Group>('group')
  const people = useAllEntities<Person>('person')
  const myBalances = useMyGroupBalances()
  const openGroups = useOpenGroups()
  const seen = useSeenCurrencies()
  const groupActivity = useGroupActivity()
  const [defaultCurrency = 'INR'] = usePref('defaultCurrency')
  const hiddenIds = useHiddenGroups()
  const [isFoldOpen, setIsFoldOpen] = useState(false)
  const [showHidden, setShowHidden] = useShowHidden()
  const [showSettled = false, setShowSettled] = usePref('groups.showSettled')
  const [sortDefault = 'recent', setSortDefault] = usePref('groups.sort')
  const route = useRoute()
  /* The filters are the address (`/groups?sort=name&show=owe`, F-241): a param that is present wins over the saved preference. */
  const filters: GroupFilters = {
    ...DEFAULT_GROUP_FILTERS,
    sort: sortDefault,
    showHidden,
    showSettled,
    ...readGroupParams(route.params as Params),
  }
  /* The filter dot counts what differs from the defaults. */
  const activeCount = (Object.keys(filters) as (keyof GroupFilters)[]).filter(
    k => filters[k] !== DEFAULT_GROUP_FILTERS[k],
  ).length
  const filterControl = useDialogControl({url: 'filters'})
  const [query, setQuery] = useState('')

  const isLoading = !me || !groups || !myBalances || !openGroups || !people
  const balances = myBalances ?? {}
  const names = new Map((people ?? []).map(p => [p.id, p.data.name]))
  const byId = new Map((groups ?? []).map(g => [g.id, g]))
  const all: GroupRowData[] = (groups ?? []).map(g => ({
    id: g.id,
    name: g.data.name,
    kind: g.data.kind,
    inactive: isGroupInactive(g.data),
    hidden: hiddenIds.has(g.id),
    deleted: g.deleted,
    balances: balances[g.id] ?? {},
    isOpen: openGroups?.has(g.id) ?? false,
    currencies: seen?.groups[g.id],
    members: g.data.members
      .filter(m => m.leftAt === null)
      .map(m => names.get(m.personId) ?? ''),
  }))
  /* Settled currencies stay on offer and filterable (audit m3). */
  const currencies = [
    ...new Set(
      all.flatMap(g => [...Object.keys(g.balances), ...(g.currencies ?? [])]),
    ),
  ].sort()
  const order = (rows: GroupRowData[]) =>
    sortGroups(rows, filters.sort, {
      currency: filters.currency === 'all' ? defaultCurrency : filters.currency,
      activity: filters.sort === 'recent' ? (groupActivity ?? new Map()) : new Map(),
    })
  const listed = order(filterGroups(all, filters))
  /* Search reaches inactive and hidden groups too (decision 89); it narrows the list only. */
  const isSearching = query.trim() !== ''
  const searched = isSearching
    ? order(filterGroups(all, {...filters, status: 'all', showHidden: true, showSettled: true}))
    : listed
  const shown = searched.filter(g => matchesGroupSearch(g, query))
  /* The Inactive (N) fold at the end of the default view: inactive groups I have not hidden. */
  const isDefaultView = filters.status === 'active' && !filters.showHidden
  const folded =
    isDefaultView && !isSearching
      ? order(filterGroups(all, {...filters, status: 'inactive'}))
      : []
  const createGroup = () => navigation.navigate('CreateGroup')

  return (
    <TabScreen testID="screen-groups">
      <Layout.Header.Outer>
        <HeaderAvatar />
        {/* Balances Search & Ask on the right, so the title stays centred. */}
        <Layout.Header.Slot />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Groups</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <SearchAskButton />
        <Layout.Header.ActionButton
          testID="groups-new"
          label={l`Create group`}
          icon={PlusIcon}
          edge
          onPress={createGroup}
        />
      </Layout.Header.Outer>
      {/* Shell first (owner 152): the header paints at once, a skeleton while the data is missing, the list mounts after as a transition. */}
      <Deferred
        when={!isLoading}
        fallback={
        <Shimmer testID="groups-loading">
          <SectionHeader title={l`Groups`} />
          {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
            <GroupRowPlaceholder key={i} hideTopBorder={i === 0} />
          ))}
        </Shimmer>
        }>
        {() => (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            data={shown}
            keyExtractor={(group: GroupRowData) => group.id}
            renderItem={({item}: {item: GroupRowData}) => (
              <GroupRow
                group={byId.get(item.id) as Entity<Group>}
                balances={item.balances}
                isHidden={item.hidden}
                locale={locale}
              />
            )}
            ListHeaderComponent={
              <>
                <GroupRequestsSection />
                {all.length > 0 ? (
                  <ListToolsHeader
                    title={l`Groups`}
                    titleTestID="groups-list-title"
                    count={shown.filter(g => !g.deleted).length}
                    total={listed.filter(g => !g.deleted).length}
                    query={query}
                    onQueryChange={setQuery}
                    searchLabel={l`Search groups or members`}
                    activeFilterCount={activeCount}
                    onFiltersPress={() => filterControl.open()}
                  />
                ) : null}
              </>
            }
            ListEmptyComponent={
              all.length > 0 && query.trim() ? (
                <EmptyState
                  testID="groups-search-empty"
                  illustration="empty-search"
                  message={l`No matches for “${query.trim()}”`}
                  button={{
                    testID: 'groups-search-clear',
                    label: l`Clear search`,
                    text: l`Clear search`,
                    onPress: () => setQuery(''),
                    size: 'small',
                    color: 'secondary',
                  }}
                />
              ) : all.length > 0 ? (
                filterGroups(all, {...filters, showSettled: true}).length > 0 && !showSettled ? (
                  /* Everything that matches is settled up: one button brings it back (it sets the preference). */
                  <EmptyState
                    testID="groups-all-settled"
                    illustration="empty-settled"
                    message={l`All settled up`}
                    button={{
                      testID: 'groups-show-settled',
                      label: l`Show settled`,
                      text: l`Show settled`,
                      onPress: () => void setShowSettled(true),
                      size: 'small',
                      color: 'secondary',
                    }}
                  />
                ) : (
                <EmptyState
                  testID="groups-filtered-empty"
                  illustration="empty-filter"
                  message={l`No groups match these filters.`}
                  button={{
                    testID: 'groups-clear-filters',
                    label: l`Clear filters`,
                    text: l`Clear filters`,
                    onPress: () => {
                      navigation.setParams(groupParams(DEFAULT_GROUP_FILTERS, DEFAULT_GROUP_FILTERS) as never)
                      void setSortDefault(DEFAULT_GROUP_FILTERS.sort)
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
              )
            }
            ListFooterComponent={
              <>
                {folded.length > 0 && (
                  <View testID="groups-inactive-fold">
                    <Pressable
                      testID="groups-inactive-fold-toggle"
                      accessibilityRole="button"
                      accessibilityLabel={l`Inactive groups`}
                      accessibilityState={{expanded: isFoldOpen}}
                      onPress={() => setIsFoldOpen(o => !o)}
                      style={[
                        a.flex_row,
                        a.align_center,
                        a.gap_xs,
                        a.px_lg,
                        a.py_md,
                        a.border_t,
                        t.atoms.border_contrast_low,
                      ]}>
                      <Text
                        style={[
                          a.text_sm,
                          a.font_semi_bold,
                          t.atoms.text_contrast_medium,
                        ]}>
                        <Trans>Inactive ({folded.length})</Trans>
                      </Text>
                      <ChevronDownIcon
                        size="sm"
                        fill={t.atoms.text_contrast_medium.color}
                        active={isFoldOpen}
                      />
                    </Pressable>
                    {isFoldOpen &&
                      folded.map(item => (
                        <GroupRow
                          key={item.id}
                          group={byId.get(item.id) as Entity<Group>}
                          balances={item.balances}
                          isHidden={item.hidden}
                          locale={locale}
                        />
                      ))}
                  </View>
                )}
                {shown.length > 0 && (
                  /* The list ends on a next step, not on blank space. */
                  <View
                    style={[
                      a.align_center,
                      a.gap_sm,
                      a.px_lg,
                      a.py_2xl,
                      a.border_t,
                      t.atoms.border_contrast_low,
                    ]}>
                    <Text
                      style={[
                        a.text_sm,
                        a.text_center,
                        a.leading_snug,
                        t.atoms.text_contrast_medium,
                      ]}>
                      <Trans>
                        Planning a trip or sharing a flat? Keep its expenses in
                        one place.
                      </Trans>
                    </Text>
                    <Button
                      testID="groups-footer-create"
                      label={l`Create group`}
                      size="small"
                      color="secondary"
                      onPress={createGroup}>
                      <ButtonIcon icon={PlusIcon} />
                      <ButtonText>
                        <Trans>Create group</Trans>
                      </ButtonText>
                    </Button>
                  </View>
                )}
                <AddExpenseFABInset />
              </>
            }
          />
        </LayoutAnimationConfig>
        )}
      </Deferred>
      <GroupsFilterDialog
        control={filterControl}
        filters={filters}
        currencies={currencies}
        onFiltersApplied={f => {
          navigation.setParams(groupParams(f, DEFAULT_GROUP_FILTERS, {sort: sortDefault, showSettled, showHidden}) as never)
          if (f.showHidden !== showHidden) void setShowHidden(f.showHidden)
          if (f.showSettled !== showSettled) void setShowSettled(f.showSettled)
          if (f.sort !== sortDefault) void setSortDefault(f.sort)
        }}
      />
    </TabScreen>
  )
}
