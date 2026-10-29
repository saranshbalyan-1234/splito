import {Deferred} from '#/components/Deferred'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {balanceTotals, isSettledBalance, personSummary, type SummaryScope} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'
import {useEffect} from 'react'

import {type Params} from '#/lib/links/listState'
import {type NavigationProp} from '#/lib/routes/types'
import {perfMark} from '#/lib/perfMark'
import {useGroupChipNames} from '#/data/groupVisibility'
import {useHiddenItems, useShowHidden} from '#/data/hiddenItems'
import {useNumberLocale} from '#/locale/numberLocale'
import {
  useAllEntities,
  useBalanceRows,
  useEntities,
  useLastActivity,
  useMe,
  usePref,
  useSeenCurrencies,
} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {useDemoMode} from '#/state/demo'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {AddExpenseFAB, AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {LogoMark} from '#/components/brand/Logo'
import {SearchAskButton} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import {PressableScale} from '#/motion/PressableScale'
import {Shimmer} from '#/motion/Shimmer'
import {PersonRowPlaceholder, type PersonRowData} from '#/screens/People/components/PersonRow'
import {RequestsSection} from '#/screens/People/components/RequestsSection'
import {hideSettled, listedFriends, seenByPerson, sortFriends} from '#/screens/People/sort'
import {Overview, OverviewPlaceholder} from './components/Overview'
import {overviewParam, readOverviewScope} from './overviewScope'
import {HOME_ROWS, RecentGroups, RecentPeople, RecentTransactions} from './components/Recent'

const NO_ROWS: never[] = []
const renderNothing = () => null

/**
 * Home (F-256, owners 153/154), top to bottom, each section at most 5 rows and gone when empty: the Overview
 * (one compact card per currency), the Requests waiting for an answer with "N invites waiting", Recent
 * transactions, Recently active people, Recently active groups. The Friends list lives on People, the groups list
 * on Groups. The header holds Search & Ask only. No page title on phones: the header centres the logo, as
 * Bluesky's home header does.
 */
export function HomeScreen() {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const t = useTheme()
  const {demo} = useDemoMode()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const me = useMe()
  /* Tombstones too: a removed friend with an open balance stays counted until it is settled (decision 103). */
  const people = useAllEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const balanceRows = useBalanceRows()
  const seen = useSeenCurrencies()
  const lastActivity = useLastActivity(true)
  const [savedScope = 'all', setSavedScope] = usePref('home.overviewScope')
  const route = useRoute()
  /* The Overview's scope is the address (`/?overview=groups`, owner 176); a param that is present wins over the saved choice. */
  const scope: SummaryScope = readOverviewScope(route.params as Params) ?? savedScope
  const [showHidden] = useShowHidden()
  const [showSettled = false] = usePref('people.showSettled')
  const hiddenIds = useHiddenItems()

  const isLoading = !me || !people || !groups || !balanceRows
  /* The launch budget's end point: Home has its figures (perf spec reads the mark). */
  useEffect(() => {
    if (!isLoading) perfMark('splito:home-ready')
  }, [isLoading])

  const summaries = balanceRows ? personSummary(balanceRows, {includeGroups: true, scope}) : []
  const byPerson = new Map(summaries.map(s => [s.person, s]))
  const groupNames = useGroupChipNames(groups)
  const friends = listedFriends(people ?? [], byPerson, hiddenIds).filter(f => showHidden || !f.isHidden)
  /* A removed friend is in the list but is no friend now: the counts and figures cover the live rows. */
  const live = friends.filter(f => f.deletedAt === undefined)
  const seenCurrencies = seenByPerson(seen?.people ?? {}, true)
  /* The newest change first; a friend with no record yet has no activity to show. */
  const activity = lastActivity ?? new Map<string, number>()
  const recentPeople: PersonRowData[] = hideSettled(
    sortFriends(live, 'recent', {currency: 'INR', activity}).filter(f => (activity.get(f.id) ?? 0) > 0),
    {showSettled, show: 'all'},
    seenCurrencies,
  ).slice(0, HOME_ROWS)

  const totals = balanceTotals(live.flatMap(row => (row.summary ? [row.summary] : [])))
  /* Settled means every part is zero, not just the net (audit M10). */
  const settledCount = live.filter(row => Object.values(row.summary?.byCurrency ?? {}).every(isSettledBalance)).length
  /* Per currency: how many friends the card's figure is made of. */
  const captions = Object.fromEntries(
    totals.map(({currency: c}) => {
      const n = live.filter(row => {
        const balance = row.summary?.byCurrency[c]
        return !!balance && !isSettledBalance(balance)
      }).length
      return [c, plural(n, {one: '# friend', other: '# friends'})]
    }),
  )
  const counts = [plural(live.length, {one: '# friend', other: '# friends'}), l`${settledCount} settled`].join(' · ')
  const hasFriends = live.length > 0

  return (
    <Layout.Screen testID="screen-home">
      <Layout.Header.Outer>
        <HeaderAvatar />
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
        <SearchAskButton edge />
      </Layout.Header.Outer>
      {/* Shell first (owner 152): the header paints at once, a skeleton while the data is missing, the sections mount after as a transition. */}
      <Deferred
        when={!isLoading}
        fallback={
          <Shimmer testID="home-loading">
            <OverviewPlaceholder />
            <PersonRowPlaceholder />
            <PersonRowPlaceholder />
          </Shimmer>
        }>
        {() => (
          /* Bluesky's List with the sections as its header, so the phone header hides on scroll like on every tab (owner 81, 87). */
          <List
            data={NO_ROWS}
            renderItem={renderNothing}
            ListHeaderComponent={
              <>
                {hasFriends && (
                  <Overview
                    totals={totals}
                    locale={locale}
                    counts={counts}
                    captions={captions}
                    scope={scope}
                    onScopeChange={next => {
                      navigation.setParams({overview: overviewParam(next, savedScope)} as never)
                      void setSavedScope(next)
                    }}
                  />
                )}
                <RequestsSection />
                <RecentTransactions locale={locale} />
                <RecentPeople rows={recentPeople} groupNames={groupNames} locale={locale} />
                <RecentGroups locale={locale} />
                {!hasFriends && (groups?.length ?? 0) === 0 && (
                  <EmptyState
                    testID="home-empty"
                    /* Same layout, motion and button as every other screen's empty state (owner 146). */
                    illustration="empty-people"
                    message={l`No friends yet. Add a friend, then split any bill with them. They don’t need the app.`}
                    button={{
                      testID: 'home-empty-add-friend',
                      label: l`Add a friend`,
                      text: l`Add a friend`,
                      icon: PersonPlusIcon,
                      onPress: () => navigation.navigate('AddFriend'),
                      size: 'small',
                      color: 'secondary',
                    }}
                  />
                )}
              </>
            }
            ListFooterComponent={<AddExpenseFABInset />}
          />
        )}
      </Deferred>
      {/* The empty state's own buttons are the actions; a FAB would be a third Add. */}
      {(isLoading || hasFriends || (groups?.length ?? 0) > 0) && <AddExpenseFAB />}
    </Layout.Screen>
  )
}
