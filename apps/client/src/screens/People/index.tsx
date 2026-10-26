import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {balanceTotals, pairwiseBalances, personSummary} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useLedger, useMe, usePref} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {useBreakpoints} from '#/alf'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'
import {LogoMark} from '#/components/brand/Logo'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import {PressableScale} from '#/motion/PressableScale'
import {Shimmer} from '#/motion/Shimmer'
import {HeaderBell} from '#/features/notifications/HeaderBell'
import {
  BalanceSummary,
  BalanceSummaryPlaceholder,
} from './components/BalanceSummary'
import {
  PersonRow,
  type PersonRowData,
  PersonRowPlaceholder,
} from './components/PersonRow'
import {SectionHeader} from './components/SectionHeader'

const PLACEHOLDER_ROWS = 6

/**
 * Home: balances per currency, then one row per friend with their balance
 * per currency and each group's part. No page title, by spec: the header
 * centres the logo, as Bluesky's home header does.
 */
export function PeopleScreen() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {gtMobile} = useBreakpoints()
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const ledger = useLedger()
  const [sort = 'amount'] = usePref('peopleSort')

  const isLoading = !me || !people || !groups || !ledger
  const summaries =
    me && ledger
      ? personSummary(pairwiseBalances(ledger, me.id), {includeGroups: true})
      : []
  const totals = balanceTotals(summaries)
  const byPerson = new Map(summaries.map(s => [s.person, s]))
  const groupNames = new Map((groups ?? []).map(g => [g.id, g.data.name]))
  const hasBalance = (row: PersonRowData) =>
    Object.values(row.summary?.byCurrency ?? {}).some(c => c.total !== 0n)
  const rows: PersonRowData[] = (people ?? [])
    .filter(p => !p.data.isMe)
    .map(p => ({id: p.id, name: p.data.name, summary: byPerson.get(p.id)}))
    .sort(
      (x, y) =>
        /*
         * ponytail: "amount" and "recent" put open balances first, then
         * names. Amounts in different currencies can't be ranked against
         * each other, and recency needs the activity index (Activity stream).
         */
        (sort === 'name' ? 0 : Number(hasBalance(y)) - Number(hasBalance(x))) ||
        x.name.localeCompare(y.name),
    )

  const addFriend = () => navigation.navigate('AddFriend')

  return (
    <Layout.Screen testID="screen-people">
      <Layout.Header.Outer>
        <HeaderAvatar />
        <Layout.Header.Slot />
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
          onPress={addFriend}
        />
        <HeaderBell />
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
              rows.length > 0 ? (
                <>
                  {totals.length > 0 && (
                    <BalanceSummary totals={totals} locale={locale} />
                  )}
                  <FriendsHeader count={rows.length} />
                </>
              ) : undefined
            }
            ListEmptyComponent={
              <EmptyState
                testID="people-empty"
                illustration="empty-people"
                message={l`Split anything with anyone. Add an expense or a friend to get started – friends don’t need the app.`}
                button={{
                  label: l`Add friend`,
                  text: l`Add friend`,
                  icon: PersonPlusIcon,
                  onPress: addFriend,
                  size: 'small',
                  color: 'secondary',
                }}
              />
            }
            ListFooterComponent={
              !gtMobile ? <View style={{height: 100}} /> : undefined
            }
          />
        </LayoutAnimationConfig>
      )}
      <AddExpenseFAB />
    </Layout.Screen>
  )
}

/* The friends list heading; Add friend is the header's action, so it isn't repeated here. */
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
