import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Deferred} from '#/components/Deferred'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {groupTotals, ZERO} from '@splito/domain'
import {
  type Entity,
  type Group,
  isGroupInactive,
  type Person,
} from '@splito/sync'

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
import {AddExpenseFAB, AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {useDialogControl} from '#/components/Dialog'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as SearchIcon} from '#/components/icons/MagnifyingGlass'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {ListToolsHeader} from '#/components/ListToolsHeader'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {
  BalanceSummary,
  BalanceSummaryPlaceholder,
} from '#/screens/People/components/BalanceSummary'
import {SectionHeader} from '#/screens/People/components/SectionHeader'
import {GroupRow, GroupRowPlaceholder} from './components/GroupRow'
import {GroupsFilterDialog} from './components/GroupsFilterDialog'
import {
  DEFAULT_GROUP_FILTERS,
  filterGroups,
  isGroupSettledUp,
  type GroupFilters,
  type GroupRowData,
  matchesGroupSearch,
  sortGroups,
} from './filter'

const PLACEHOLDER_ROWS = 4

/**
 * Groups list: Bluesky's Lists screen (list-card rows); Create group is the
 * header's action, and the FAB adds an expense as on every tab. The
 * Overview sums my balance across the listed groups per currency (never
 * across currencies); search and filters sit on the list's heading.
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
  const [applied, setApplied] = useState<GroupFilters | null>(null)
  const [showHidden, setShowHidden] = useShowHidden()
  const [showSettled = false, setShowSettled] = usePref('groups.showSettled')
  const [sortDefault = 'recent', setSortDefault] = usePref('groups.sort')
  const filters: GroupFilters = {...(applied ?? DEFAULT_GROUP_FILTERS), sort: applied?.sort ?? sortDefault, showHidden, showSettled}
  /* The filter dot counts what differs from the defaults. */
  const activeCount = (Object.keys(filters) as (keyof GroupFilters)[]).filter(
    k => filters[k] !== DEFAULT_GROUP_FILTERS[k],
  ).length
  const filterControl = useDialogControl()
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
  /* Per currency, never across currencies; owed and owe summed apart (domain). */
  /* Money is never hidden: inactive and hidden groups count in the Overview whatever the status and visibility filters say. */
  const overviewRows = filterGroups(all, {
    ...filters,
    status: 'all',
    showHidden: true,
    showSettled: true,
  }).filter(g => !g.deleted)
  const overall = groupTotals(overviewRows.map(g => g.balances))
  /* The captions and the count line cover the same groups as the totals above them. */
  const settledCount = overviewRows.filter(isGroupSettledUp).length
  const captions = Object.fromEntries(
    overall.map(({currency}) => {
      const n = overviewRows.filter(
        g => (g.balances[currency] ?? ZERO) !== ZERO,
      ).length
      return [currency, plural(n, {one: '# group', other: '# groups'})]
    }),
  )
  const counts = [
    plural(overviewRows.length, {one: '# group', other: '# groups'}),
    l`${settledCount} settled`,
  ].join(' · ')

  return (
    <Layout.Screen testID="screen-groups">
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
          <BalanceSummaryPlaceholder />
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
              all.length > 0 ? (
                <>
                  {/* People's Overview, so both tabs read the same way: my net across the groups, per currency. */}
                  <BalanceSummary
                    testID="groups-balances"
                    titleTestID="groups-balances-title"
                    totals={overall}
                    locale={locale}
                    counts={counts}
                    captions={captions}
                  />
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
                </>
              ) : undefined
            }
            ListEmptyComponent={
              all.length > 0 && query.trim() ? (
                <EmptyState
                  testID="groups-search-empty"
                  icon={SearchIcon}
                  message={l`No matches for “${query.trim()}”`}
                />
              ) : all.length > 0 ? (
                filterGroups(all, {...filters, showSettled: true}).length > 0 && !showSettled ? (
                  /* Everything that matches is settled up: one button brings it back (it sets the preference). */
                  <EmptyState
                    testID="groups-all-settled"
                    icon={null}
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
                  icon={null}
                  message={l`No groups match these filters.`}
                  button={{
                    testID: 'groups-clear-filters',
                    label: l`Clear filters`,
                    text: l`Clear filters`,
                    onPress: () => {
                      setApplied(null)
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
                        style={{
                          transform: [
                            {rotate: isFoldOpen ? '180deg' : '0deg'},
                          ],
                        }}
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
      <AddExpenseFAB />
      <GroupsFilterDialog
        control={filterControl}
        filters={filters}
        currencies={currencies}
        onFiltersApplied={f => {
          setApplied(f)
          if (f.showHidden !== showHidden) void setShowHidden(f.showHidden)
          if (f.showSettled !== showSettled) void setShowSettled(f.showSettled)
          if (f.sort !== sortDefault) void setSortDefault(f.sort)
        }}
      />
    </Layout.Screen>
  )
}
