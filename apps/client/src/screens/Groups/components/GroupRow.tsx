// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/FeedCard.tsx (list card layout)
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Entity, type Group} from '@splito/sync'

import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {BalanceText} from '#/components/BalanceText'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'

const AVATAR_SIZE = 42

/** A local `YYYY-MM-DD` as a Date at UTC midnight, so formatting never shifts the day. */
function utcDate(d: string) {
  return new Date(`${d}T00:00:00Z`)
}

/**
 * Bluesky's list card as a row: square avatar, title, byline (kind, trip
 * dates, members), and my balance in the group per currency on the right.
 */
export function GroupRow({
  group,
  balances,
  locale,
  hideTopBorder = false,
}: {
  group: Entity<Group>
  balances: Record<string, bigint>
  locale: string
  hideTopBorder?: boolean
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {name, kind, startDate, endDate, members} = group.data
  const kindLabel = {
    trip: l`Trip`,
    home: l`Home`,
    couple: l`Couple`,
    other: l`Group`,
  }[kind]
  const memberCount = members.filter(m => m.leftAt === null).length
  const dates =
    startDate && endDate
      ? `${i18n.date(utcDate(startDate), {day: 'numeric', month: 'short', timeZone: 'UTC'})} – ${i18n.date(utcDate(endDate), {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'})}`
      : null
  const memberText = memberCount === 1 ? l`1 member` : l`${memberCount} members`
  const byline = [kindLabel, dates, memberText].filter(Boolean).join(' · ')
  const open = Object.keys(balances)
    .filter(c => balances[c] !== 0n)
    .sort()

  const balanceView = (
    <View style={[a.align_end, a.gap_2xs, a.flex_shrink_0]}>
      {open.length === 0 ? (
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>settled up</Trans>
        </Text>
      ) : (
        open.map(currency => (
          <BalanceText
            key={currency}
            testID={`group-balance-${currency}`}
            amount={balances[currency]!}
            currency={currency}
            locale={locale}
            subject="group"
            style={a.text_right}
          />
        ))
      )}
    </View>
  )

  return (
    <Link
      testID={`group-${name}`}
      href={`/groups/${group.id}`}
      asAnchor
      anchorNoUnderline
      accessibilityLabel={name}
      accessibilityHint=""
      hoverStyle={t.atoms.bg_contrast_25}
      style={[a.px_lg, a.py_md, !hideTopBorder && a.border_t, t.atoms.border_contrast_low, a.transition_color]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <UserAvatar size={AVATAR_SIZE} name={name} type="list" />
        <View style={[a.flex_1, a.gap_2xs]}>
          {/* Phones: the balance shares the title's line so the byline gets the full width. */}
          <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
            <Text emoji numberOfLines={1} style={[a.flex_1, a.text_md, a.font_semi_bold, a.leading_snug]}>
              {name}
            </Text>
            {!gtMobile && balanceView}
          </View>
          <Text numberOfLines={1} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {byline}
          </Text>
        </View>
        {gtMobile && balanceView}
      </View>
    </Link>
  )
}

/** Loading shape of one row. */
export function GroupRowPlaceholder({hideTopBorder = false}: {hideTopBorder?: boolean}) {
  const t = useTheme()
  return (
    <View style={[a.px_lg, a.py_md, !hideTopBorder && a.border_t, t.atoms.border_contrast_low]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <Skeleton.Block style={{width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 8}} />
        <View style={[a.flex_1, a.gap_xs]}>
          <Skeleton.Text style={[a.text_md, {width: 140}]} />
          <Skeleton.Text style={[a.text_sm, {width: 220}]} />
        </View>
      </View>
    </View>
  )
}
