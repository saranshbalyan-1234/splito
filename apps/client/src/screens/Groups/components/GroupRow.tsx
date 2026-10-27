// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/FeedCard.tsx (list card layout)
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {ZERO} from '@splito/domain'
import {type Entity, type Group, isGroupInactive} from '@splito/sync'

import {useRowPadding} from '#/state/preferences/density'
import {Link} from '#/view/com/util/Link'
import {atoms as a, useTheme} from '#/alf'
import {BalanceBlock, SettledPill} from '#/components/BalanceText'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import * as Pills from '#/components/Pills'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {useFormatDay} from '#/locale/useDates'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'

const AVATAR_SIZE = 42

/**
 * Bluesky's list card as a row: the group's tile, title, byline (kind,
 * trip dates, members), and my balance in the group per currency as a
 * right-aligned label-over-amount block.
 */
export function GroupRow({
  group,
  balances,
  locale,
  isHidden = false,
  hideTopBorder = false,
}: {
  group: Entity<Group>
  balances: Record<string, bigint>
  locale: string
  /** I have hidden this group (decision 89); its chip says so. */
  isHidden?: boolean
  hideTopBorder?: boolean
}) {
  const t = useTheme()
  const rowPadding = useRowPadding()
  const {t: l} = useLingui()
  const formatDay = useFormatDay()
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
      ? `${formatDay(startDate, {intl: {day: 'numeric', month: 'short'}})} – ${formatDay(endDate, {intl: {day: 'numeric', month: 'short', year: 'numeric'}})}`
      : null
  const memberText = memberCount === 1 ? l`1 member` : l`${memberCount} members`
  const byline = [kindLabel, dates, memberText].filter(Boolean).join(' · ')
  const open = Object.keys(balances)
    .filter(c => balances[c] !== ZERO)
    .sort()

  const balanceView = (
    <View style={[a.align_end, a.gap_xs, a.flex_shrink_0]}>
      {open.length === 0 ? (
        <SettledPill testID="group-settled" />
      ) : (
        open.map(currency => (
          <BalanceBlock
            key={currency}
            testID={`group-balance-${currency}`}
            amount={balances[currency]!}
            currency={currency}
            locale={locale}
            subject="group"
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
            <View style={[a.flex_row, a.align_center, a.gap_sm]}>
              <Text
                emoji
                numberOfLines={1}
                style={[a.flex_shrink, a.text_md, a.font_semi_bold, a.leading_snug]}>
                {name}
              </Text>
              {isGroupInactive(group.data) && (
                <Pills.Tag>
                  <Trans>Inactive</Trans>
                </Pills.Tag>
              )}
              {isHidden && (
                <Pills.Tag>
                  <Trans>Hidden</Trans>
                </Pills.Tag>
              )}
            </View>
            {/* Two lines at most, so a trip's dates are never cut off by the balance beside them. */}
            <Text
              numberOfLines={2}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {byline}
            </Text>
          </View>
          {balanceView}
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
