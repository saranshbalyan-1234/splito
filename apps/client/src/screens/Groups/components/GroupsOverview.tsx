import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {groupTotals, ZERO} from '@splito/domain'

import {openLink} from '#/lib/links/open'
import {useNumberLocale} from '#/locale/numberLocale'
import {Overview, OverviewPlaceholder} from '#/components/overview/Overview'
import {analyticsHref} from '#/screens/Analytics/overviewScope'
import {type GroupRowData, isGroupSettledUp} from '../filter'

/**
 * My balances inside groups right now, one card per currency (owner 219): what every group owes me or I owe it,
 * groups that owe me and groups I owe summed apart (`groupTotals`). Money is never hidden (owner 89): inactive and
 * hidden groups count, whatever the list's filters show; deleted groups do not. The counts line says how many groups
 * and how many are settled up (everyone square, not only me). A card opens Analytics in that currency, scoped to
 * groups. Hidden with no groups.
 */
export function GroupsOverview({rows}: {rows: GroupRowData[] | undefined}) {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  if (!rows) return <OverviewPlaceholder />
  const live = rows.filter(g => !g.deleted)
  if (live.length === 0) return null
  const totals = groupTotals(live.map(g => g.balances))
  /* Per currency: how many groups the card's figure is made of. */
  const captions = Object.fromEntries(
    totals.map(({currency: c}) => {
      const n = live.filter(g => g.balances[c] !== undefined && g.balances[c] !== ZERO).length
      return [c, plural(n, {one: '# group', other: '# groups'})]
    }),
  )
  const settledCount = live.filter(isGroupSettledUp).length
  const counts = [plural(live.length, {one: '# group', other: '# groups'}), l`${settledCount} settled`].join(' · ')
  return (
    <Overview
      testID="groups-overview"
      titleTestID="groups-overview-title"
      totals={totals}
      locale={locale}
      counts={counts}
      captions={captions}
      onCurrencyPress={currency => openLink(analyticsHref('groups', currency))}
    />
  )
}
