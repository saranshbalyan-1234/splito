import {plural} from '@lingui/core/macro'
import {balanceTotals, isSettledBalance, personSummary} from '@splito/domain'
import {type Person} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'

import {useHiddenItems, useShowHidden} from '#/data/hiddenItems'
import {useAllEntities, useBalanceRows} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {listedFriends} from '../sort'
import {Overview, OverviewPlaceholder} from '#/components/overview/Overview'

/**
 * The balances with friends right now, one card per currency (owner 219), at the top of People, counting only the
 * balance rows `countsRow` keeps (by group: `null` is a non-group balance), which People sets from the Friends list's
 * Include groups choice. A card opens `onCurrencyPress`. Hidden with no friends. Not on Analytics (owner 221: everything
 * there follows its filters, and balances right now cannot).
 */
export function FriendsOverview({
  countsRow,
  onCurrencyPress,
  testID,
  titleTestID,
}: {
  countsRow: (groupId: string | null) => boolean
  onCurrencyPress: (currency: string) => void
  testID?: string
  titleTestID?: string
}) {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  /* Tombstones too: a removed friend with an open balance stays counted until it is settled (decision 103). */
  const people = useAllEntities<Person>('person')
  const balanceRows = useBalanceRows()
  const [showHidden] = useShowHidden()
  const hiddenIds = useHiddenItems()
  if (!people || !balanceRows) return <OverviewPlaceholder />

  const byPerson = new Map(personSummary(balanceRows, {includeGroups: true}).map(s => [s.person, s]))
  /* Choosing rows is not arithmetic: the sums stay in the domain (personSummary, balanceTotals). */
  const scoped = new Map(personSummary(balanceRows.filter(r => countsRow(r.groupId)), {includeGroups: true}).map(s => [s.person, s]))
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
      onCurrencyPress={onCurrencyPress}
      {...(testID ? {testID} : {})}
      {...(titleTestID ? {titleTestID} : {})}
    />
  )
}
