import {View} from 'react-native'
import {utils} from '@bsky.app/alf'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'
import {type Entity, type Group, isGroupInactive} from '@splito/sync'

import {useGroupActivity, useAllEntities, useMyGroupBalances, useOpenGroups, usePref, useSeenCurrencies} from '#/data/hooks'
import {useHiddenGroups} from '#/data/groupVisibility'
import {type RecentRow, useRecentRows} from '#/data/recentTransactionRows'
import {useFormatDay} from '#/locale/useDates'
import {seeAllTransactionsPath} from '#/lib/links/make'
import {Link} from '#/view/com/util/Link'
import {atoms as a, useTheme} from '#/alf'
import {EntryIcon} from '#/components/people/EntryIcon'
import {useMoneyStyle} from '#/components/MoneyDirection'
import {SyncToned} from '#/components/SyncTone'
import {Text} from '#/components/Typography'
import {GroupRow} from '#/screens/Groups/components/GroupRow'
import {
  DEFAULT_GROUP_FILTERS,
  filterGroups,
  type GroupRowData,
  sortGroups,
} from '#/screens/Groups/filter'
import {PersonRow, type PersonRowData} from '#/screens/People/components/PersonRow'
import {SectionHeader} from '#/screens/People/components/SectionHeader'
import {SectionLink} from '#/components/SectionLink'

/** Each short list on Home holds at most this many rows (owner 153). */
export const HOME_ROWS = 5

/**
 * Recent transactions (F-1415): the newest expenses and payments I am on, across every friend and group, each with
 * my part as a chip (per row, one currency, never summed). Hidden when there are none. "See all" opens Activity.
 */
export function RecentTransactions({locale}: {locale: string}) {
  const {t: l} = useLingui()
  const rows = useRecentRows(HOME_ROWS)
  if (rows.length === 0) return null
  return (
    <View testID="home-recent-transactions">
      <SectionHeader
        testID="home-recent-transactions-title"
        title={l`Recent transactions`}
        action={
          <SectionLink testID="home-recent-transactions-all" href={seeAllTransactionsPath()} label={l`See all transactions`}>
            <Trans>See all</Trans>
          </SectionLink>
        }
      />
      {rows.map((row, i) => (
        <TransactionRow key={row.id} row={row} locale={locale} hideTopBorder={i === 0} />
      ))}
    </View>
  )
}

function TransactionRow({row, locale, hideTopBorder}: {row: RecentRow; locale: string; hideTopBorder: boolean}) {
  const t = useTheme()
  const money = useMoneyStyle()
  const formatDay = useFormatDay()
  const color = row.net === ZERO ? t.atoms.text_contrast_medium.color : money.color(row.net)
  return (
    <Link
      testID={`home-transaction-${row.id}`}
      href={row.href}
      asAnchor
      anchorNoUnderline
      accessibilityLabel={row.title}
      accessibilityHint=""
      hoverStyle={t.atoms.bg_contrast_25}
      style={[a.px_lg, a.py_md, !hideTopBorder && a.border_t, t.atoms.border_contrast_low, a.transition_color]}>
      <SyncToned status={row.syncStatus} style={[a.flex_row, a.align_center, a.gap_md]}>
        <EntryIcon category={row.category ?? undefined} isPayment={row.category === null} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
            {row.title}
          </Text>
          <Text numberOfLines={1} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {formatDay(row.date, {intl: {day: 'numeric', month: 'short', year: 'numeric'}})}
          </Text>
        </View>
        {row.net !== ZERO && (
          <Text
            testID={`home-transaction-${row.id}-net`}
            numberOfLines={1}
            style={[
              a.text_sm,
              a.font_semi_bold,
              a.rounded_full,
              a.flex_shrink_0,
              {
                color,
                backgroundColor: utils.alpha(color, t.scheme === 'light' ? 0.1 : 0.18),
                paddingHorizontal: 8,
                paddingVertical: 3,
                fontVariant: ['tabular-nums'],
              },
            ]}>
            {(row.net > ZERO ? '+' : '−') + formatAmount(magnitude(row.net), row.currency, locale)}
          </Text>
        )}
      </SyncToned>
    </Link>
  )
}

/**
 * Recently active people: the friends with the newest change (by change time, not expense date), each with their net
 * per currency. Settled friends stay out unless "Show settled" is on (owner 90); hidden when none. "See all" opens
 * People. `rows` are the already filtered, newest first.
 */
export function RecentPeople({rows, groupNames, locale}: {rows: PersonRowData[]; groupNames: Map<string, string>; locale: string}) {
  const {t: l} = useLingui()
  if (rows.length === 0) return null
  return (
    <View testID="home-recent-people">
      <SectionHeader
        testID="home-recent-people-title"
        title={l`Recently active people`}
        action={
          <SectionLink testID="home-recent-people-all" href="/people" label={l`See all people`}>
            <Trans>See all</Trans>
          </SectionLink>
        }
      />
      {rows.slice(0, HOME_ROWS).map(row => (
        <PersonRow key={row.id} row={row} groupNames={groupNames} locale={locale} />
      ))}
    </View>
  )
}

/**
 * Recently active groups: the groups with the newest change (§ 26.17, the Groups list's "Recent activity" rule),
 * each with my balance in it per currency. Inactive, hidden and (unless "Show settled" is on) settled groups stay
 * out; hidden when none. "See all" opens Groups.
 */
export function RecentGroups({locale}: {locale: string}) {
  const {t: l} = useLingui()
  const groups = useAllEntities<Group>('group')
  const myBalances = useMyGroupBalances()
  const openGroups = useOpenGroups()
  const seen = useSeenCurrencies()
  const activity = useGroupActivity()
  const hidden = useHiddenGroups()
  const [showSettled = false] = usePref('groups.showSettled')
  const [defaultCurrency = 'INR'] = usePref('defaultCurrency')
  if (!groups || !myBalances || !openGroups) return null
  const byId = new Map(groups.map(g => [g.id, g]))
  const all: GroupRowData[] = groups.map(g => ({
    id: g.id,
    name: g.data.name,
    kind: g.data.kind,
    inactive: isGroupInactive(g.data),
    hidden: hidden.has(g.id),
    deleted: g.deleted,
    balances: myBalances[g.id] ?? {},
    isOpen: openGroups.has(g.id),
    currencies: seen?.groups[g.id],
    members: [],
  }))
  const recent = sortGroups(
    filterGroups(all, {...DEFAULT_GROUP_FILTERS, showSettled}).filter(g => !g.deleted && (activity?.get(g.id) ?? 0) > 0),
    'recent',
    {currency: defaultCurrency, activity: activity ?? new Map()},
  ).slice(0, HOME_ROWS)
  if (recent.length === 0) return null
  return (
    <View testID="home-recent-groups">
      <SectionHeader
        testID="home-recent-groups-title"
        title={l`Recently active groups`}
        action={
          <SectionLink testID="home-recent-groups-all" href="/groups" label={l`See all groups`}>
            <Trans>See all</Trans>
          </SectionLink>
        }
      />
      {recent.map((group, i) => (
        <GroupRow
          key={group.id}
          group={byId.get(group.id) as Entity<Group>}
          balances={group.balances}
          isHidden={group.hidden}
          locale={locale}
          hideTopBorder={i === 0}
        />
      ))}
    </View>
  )
}
