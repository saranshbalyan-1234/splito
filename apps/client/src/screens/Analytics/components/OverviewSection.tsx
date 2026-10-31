import {plural} from '@lingui/core/macro'
import {useNavigation, useRoute} from '@react-navigation/native'
import {balanceTotals, isSettledBalance, personSummary, type SummaryScope} from '@splito/domain'
import {type Person} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'

import {type Params} from '#/lib/links/listState'
import {type NavigationProp} from '#/lib/routes/types'
import {useHiddenItems, useShowHidden} from '#/data/hiddenItems'
import {useAllEntities, useBalanceRows, usePref} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {listedFriends} from '#/screens/People/sort'
import {Overview, OverviewPlaceholder} from './Overview'
import {analyticsScopeParam, overviewParam, readOverviewScope} from '../overviewScope'

/**
 * The first section of Analytics (owner 198): every balance right now, one card per currency, with the All / Groups /
 * Direct choice (owner 176; the preference `home.overviewScope` and the address `?overview=`). It does not follow the
 * period, currency or scope filters below it; a card narrows them to its currency. Hidden with no friends.
 */
export function OverviewSection() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute()
  /* Tombstones too: a removed friend with an open balance stays counted until it is settled (decision 103). */
  const people = useAllEntities<Person>('person')
  const balanceRows = useBalanceRows()
  const [savedScope = 'all', setSavedScope] = usePref('home.overviewScope')
  const [showHidden] = useShowHidden()
  const hiddenIds = useHiddenItems()
  /* The scope is the address (`/analytics?overview=groups`, owner 176); a param that is present wins over the saved choice. */
  const scope: SummaryScope = readOverviewScope(route.params as Params) ?? savedScope
  if (!people || !balanceRows) return <OverviewPlaceholder />

  const byPerson = new Map(personSummary(balanceRows, {includeGroups: true}).map(s => [s.person, s]))
  const scoped = new Map(personSummary(balanceRows, {includeGroups: true, scope}).map(s => [s.person, s]))
  /* A removed friend is in the list but is no friend now: the counts and figures cover the live rows. */
  const live = listedFriends(people, byPerson, hiddenIds).filter(f => (showHidden || !f.isHidden) && f.deletedAt === undefined)
  if (live.length === 0) return null
  const scopedOf = (id: string) => scoped.get(id)
  const totals = balanceTotals(live.flatMap(row => scopedOf(row.id) ?? []))
  /* Settled means every part is zero, not just the net (audit M10). */
  const settledCount = live.filter(row => Object.values(scopedOf(row.id)?.byCurrency ?? {}).every(isSettledBalance)).length
  /* Per currency: how many friends the card's figure is made of. */
  const captions = Object.fromEntries(
    totals.map(({currency: c}) => {
      const n = live.filter(row => {
        const balance = scopedOf(row.id)?.byCurrency[c]
        return !!balance && !isSettledBalance(balance)
      }).length
      return [c, plural(n, {one: '# friend', other: '# friends'})]
    }),
  )
  const counts = [plural(live.length, {one: '# friend', other: '# friends'}), l`${settledCount} settled`].join(' · ')

  return (
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
      /* The card carries the Overview's scope as Analytics' scope (owner 176), written out so Analytics never keeps the one it saved last. */
      onCurrencyPress={currency => navigation.setParams({currency, scope: analyticsScopeParam(scope)} as never)}
    />
  )
}
