import {plural} from '@lingui/core/macro'
import {balanceTotals, isSettledBalance} from '@splito/domain'
import {useLingui} from '@lingui/react/macro'

import {useNumberLocale} from '#/locale/numberLocale'
import {type ListedFriend} from '../sort'
import {Overview} from '#/components/overview/Overview'

/**
 * The balances with friends right now, one card per currency (owner 219), at the top of People. It counts exactly the
 * friends and figures the Friends list holds (`friends`, with the summaries People computed under its Include groups
 * choice), so the list and its summary never disagree. It reads nothing itself: a second subscription and a second
 * `personSummary` per commit cost 5.7 s of the demo seed (ARCHITECTURE 17.1). A card opens `onCurrencyPress`. Hidden with
 * no friends. Not on Analytics (owner 221: everything there follows its filters, and balances right now cannot).
 */
export function FriendsOverview({
  friends,
  showHidden,
  onCurrencyPress,
  testID,
  titleTestID,
}: {
  friends: ListedFriend[]
  showHidden: boolean
  onCurrencyPress: (currency: string) => void
  testID?: string
  titleTestID?: string
}) {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  /* A removed friend is in the list but is no friend now: the counts and figures cover the live rows. */
  const live = friends.filter(f => (showHidden || !f.isHidden) && f.deletedAt === undefined)
  if (live.length === 0) return null
  /* Choosing rows is not arithmetic: the sums stay in the domain (balanceTotals). */
  const totals = balanceTotals(live.flatMap(row => row.summary ?? []))
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
