import {useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {groupTotals, ZERO} from '@splito/domain'
import {type Entity, type Group, type Person} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {
  useEntities,
  useGroupActivity,
  useMe,
  useMyGroupBalances,
  usePref,
} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {AddExpenseFAB, AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
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
  const groups = useEntities<Group>('group')
  const people = useEntities<Person>('person')
  const myBalances = useMyGroupBalances()
  const groupActivity = useGroupActivity()
  const [defaultCurrency = 'INR'] = usePref('defaultCurrency')
  const [applied, setApplied] = useState<GroupFilters | null>(null)
  const filters = applied ?? DEFAULT_GROUP_FILTERS
  /* The filter dot counts what differs from the defaults. */
  const activeCount = (Object.keys(filters) as (keyof GroupFilters)[]).filter(
    k => filters[k] !== DEFAULT_GROUP_FILTERS[k],
  ).length
  const filterControl = useDialogControl()
  const [query, setQuery] = useState('')

  const isLoading = !me || !groups || !myBalances || !people
  const balances = myBalances ?? {}
  const names = new Map((people ?? []).map(p => [p.id, p.data.name]))
  const byId = new Map((groups ?? []).map(g => [g.id, g]))
  const all: GroupRowData[] = (groups ?? []).map(g => ({
    id: g.id,
    name: g.data.name,
    kind: g.data.kind,
    archived: g.data.archived,
    balances: balances[g.id] ?? {},
    members: g.data.members
      .filter(m => m.leftAt === null)
      .map(m => names.get(m.personId) ?? ''),
  }))
  const currencies = [
    ...new Set(all.flatMap(g => Object.keys(g.balances))),
  ].sort()
  const listed = sortGroups(filterGroups(all, filters), filters.sort, {
    currency: filters.currency === 'all' ? defaultCurrency : filters.currency,
    activity: filters.sort === 'recent' ? (groupActivity ?? new Map()) : new Map(),
  })
  /* Search narrows the list only; the Overview keeps showing what the filters chose. */
  const shown = listed.filter(g => matchesGroupSearch(g, query))
  const createGroup = () => navigation.navigate('CreateGroup')
  /* Per currency, never across currencies; owed and owe summed apart (domain). */
  const overall = groupTotals(listed.map(g => g.balances))
  const settledCount = listed.filter(g =>
    Object.values(g.balances).every(v => v === ZERO),
  ).length
  const captions = Object.fromEntries(
    overall.map(({currency}) => {
      const n = listed.filter(
        g => (g.balances[currency] ?? ZERO) !== ZERO,
      ).length
      return [currency, plural(n, {one: '# group', other: '# groups'})]
    }),
  )
  const counts = [
    plural(listed.length, {one: '# group', other: '# groups'}),
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
      {isLoading ? (
        <Shimmer testID="groups-loading">
          <BalanceSummaryPlaceholder />
          <SectionHeader title={l`Groups`} />
          {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
            <GroupRowPlaceholder key={i} hideTopBorder={i === 0} />
          ))}
        </Shimmer>
      ) : (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            data={shown}
            keyExtractor={(group: GroupRowData) => group.id}
            renderItem={({item}: {item: GroupRowData}) => (
              <GroupRow
                group={byId.get(item.id) as Entity<Group>}
                balances={item.balances}
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
                    count={shown.length}
                    total={listed.length}
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
                <EmptyState
                  testID="groups-filtered-empty"
                  icon={null}
                  message={l`No groups match these filters.`}
                  button={{
                    testID: 'groups-clear-filters',
                    label: l`Clear filters`,
                    text: l`Clear filters`,
                    onPress: () => setApplied(null),
                    size: 'small',
                    color: 'secondary',
                  }}
                />
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
      <AddExpenseFAB />
      <GroupsFilterDialog
        control={filterControl}
        filters={filters}
        currencies={currencies}
        onFiltersApplied={setApplied}
      />
    </Layout.Screen>
  )
}
