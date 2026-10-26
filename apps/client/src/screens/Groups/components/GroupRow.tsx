// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/FeedCard.tsx (list card layout)
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {ZERO} from '@splito/domain'
import {type Entity, type Group} from '@splito/sync'

import {useRowPadding} from '#/state/preferences/density'
import {Link} from '#/view/com/util/Link'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {BalanceText} from '#/components/BalanceText'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'

const AVATAR_SIZE = 42

/** A local `YYYY-MM-DD` as a Date at UTC midnight, so formatting never shifts the day. */
function utcDate(d: string) {
  return new Date(`${d}T00:00:00Z`)
}

/**
 * Bluesky's list card as a row: the group's kind tile, title, byline (kind,
 * trip dates, members), and my balance in the group per currency on the
 * right.
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
  const rowPadding = useRowPadding()
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const listAnimations = useListAnimations()
  const press = usePressScale()
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
    .filter(c => balances[c] !== ZERO)
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
            isCompact
            style={a.text_right}
          />
        ))
      )}
    </View>
  )

  /* The row content shrinks on press; the separator stays put. */
  return (
    <Animated.View {...listAnimations}>
      <Link
        testID={`group-${name}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        href={`/groups/${group.id}`}
        asAnchor
        anchorNoUnderline
        accessibilityLabel={name}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.px_lg,
          rowPadding,
          !hideTopBorder && a.border_t,
          t.atoms.border_contrast_low,
          a.transition_color,
        ]}>
        <Animated.View
          style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
          <GroupAvatar kind={kind} name={name} size={AVATAR_SIZE} />
          <View style={[a.flex_1, a.gap_2xs]}>
            {/* Phones: the balance shares the title's line so the byline gets the full width. */}
            <View
              style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
              <Text
                emoji
                numberOfLines={1}
                style={[a.flex_1, a.text_md, a.font_semi_bold, a.leading_snug]}>
                {name}
              </Text>
              {!gtMobile && balanceView}
            </View>
            <Text
              numberOfLines={1}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {byline}
            </Text>
          </View>
          {gtMobile && balanceView}
        </Animated.View>
      </Link>
    </Animated.View>
  )
}

/** Loading shape of one row. */
export function GroupRowPlaceholder({
  hideTopBorder = false,
}: {
  hideTopBorder?: boolean
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.px_lg,
        a.py_md,
        !hideTopBorder && a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <Skeleton.Block
          style={{width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 8}}
        />
        <View style={[a.flex_1, a.gap_xs]}>
          <Skeleton.Text style={[a.text_md, {width: 140}]} />
          <Skeleton.Text style={[a.text_sm, {width: 220}]} />
        </View>
      </View>
    </View>
  )
}
