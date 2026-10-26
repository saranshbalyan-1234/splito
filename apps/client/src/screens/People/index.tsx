import {useState} from 'react'
import {useWindowDimensions, View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {balanceTotals, personSummary} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useLedger, useMe, usePref} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'
import {LogoMark} from '#/components/brand/Logo'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {myBalances} from '#/components/groups/net'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as FilterIcon} from '#/components/icons/SettingsSlider'
import * as Layout from '#/components/Layout'
import * as Pills from '#/components/Pills'
import {Text} from '#/components/Typography'
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
import {SectionHeader} from './components/SectionHeader'
import {filterFriends, lastActivity, sortFriends} from './sort'

const PLACEHOLDER_ROWS = 6

/**
 * Home: balances per currency, then one row per friend with their balance
 * per currency and each group's part. No page title, by spec: the header
 * centres the logo, as Bluesky's home header does. The Include groups
 * filter (default from preferences, applied with Apply) drives the totals
 * and the rows.
 */
export function PeopleScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {gtMobile} = useBreakpoints()
  const {height} = useWindowDimensions()
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const ledger = useLedger()
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
  /* The filter button counts what differs from the defaults (Settings › Sorting and filters). */
  const activeCount = (
    ['includeGroups', 'currency', 'show', 'sort'] as const
  ).filter(k => filters[k] !== defaults[k]).length
  const filterControl = useDialogControl()

  const isLoading = !me || !people || !groups || !ledger
  const summaries =
    me && ledger && groups
      ? personSummary(myBalances(ledger, me.id, groups), {includeGroups})
      : []
  const byPerson = new Map(summaries.map(s => [s.person, s]))
  const groupNames = new Map((groups ?? []).map(g => [g.id, g.data.name]))
  const friends = (people ?? [])
    .filter(p => !p.data.isMe)
    .map(p => ({id: p.id, name: p.data.name, summary: byPerson.get(p.id)}))
  const currencies = [
    ...new Set(summaries.flatMap(s => Object.keys(s.byCurrency))),
  ].sort()
  const rows: PersonRowData[] = sortFriends(
    filterFriends(friends, filters),
    sort,
    {
      currency: filters.currency === 'all' ? currency : filters.currency,
      activity: sort === 'recent' && ledger ? lastActivity(ledger) : new Map(),
    },
  )
  /* The summary follows the filters too, so its figures always match the list. */
  const totals = balanceTotals(
    rows.flatMap(row => (row.summary ? [row.summary] : [])),
  )
  const isFiltered = activeCount > 0
  const friendsAction = (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      {!includeGroups && (
        <Pills.Tag>
          <Trans>Direct only</Trans>
        </Pills.Tag>
      )}
      <Button
        testID="friends-filters"
        label={activeCount > 0 ? l`Filters, ${activeCount} on` : l`Filters`}
        size="small"
        color={activeCount > 0 ? 'primary_subtle' : 'secondary'}
        onPress={() => filterControl.open()}>
        <ButtonIcon icon={FilterIcon} />
        <ButtonText>
          <Trans>Filters</Trans>
        </ButtonText>
        {activeCount > 0 && (
          <View
            testID="friends-filters-count"
            style={[
              a.rounded_full,
              a.align_center,
              a.justify_center,
              {
                minWidth: 18,
                height: 18,
                paddingHorizontal: 5,
                backgroundColor: t.palette.primary_500,
              },
            ]}>
            <Text
              style={[
                a.text_xs,
                a.font_semi_bold,
                {color: t.palette.white, lineHeight: 14},
              ]}>
              {activeCount}
            </Text>
          </View>
        )}
      </Button>
    </View>
  )

  return (
    <Layout.Screen testID="screen-people">
      <Layout.Header.Outer>
        <HeaderAvatar />
        <Layout.Header.Content>
          {/* The home link, inactive here because this header is on People. */}
          <PressableScale
            testID="header-logo"
            targetScale={0.9}
            accessibilityRole="link"
            accessibilityLabel={l`Splito - People`}
            aria-disabled={true}
            disabled={true}>
            <LogoMark size={30} />
          </PressableScale>
        </Layout.Header.Content>
        <Layout.Header.ActionButton
          testID="people-add-friend"
          label={l`Add friend`}
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
              rows.length > 0 || isFiltered ? (
                <>
                  {totals.length > 0 && (
                    <BalanceSummary totals={totals} locale={locale} />
                  )}
                  <FriendsHeader count={rows.length} action={friendsAction} />
                </>
              ) : undefined
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
            ListFooterComponent={
              !gtMobile ? <View style={{height: 100}} /> : undefined
            }
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
