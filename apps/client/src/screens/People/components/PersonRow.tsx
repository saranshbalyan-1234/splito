import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, type PersonSummary, ZERO} from '@splito/domain'

import {useRowPadding} from '#/state/preferences/density'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {BalanceText} from '#/components/BalanceText'
import * as Pills from '#/components/Pills'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'

export type PersonRowData = {
  id: string
  name: string
  summary: PersonSummary | undefined
}

const AVATAR_SIZE = 42

/**
 * Bluesky's profile-card row: avatar, name, a secondary line (here the
 * group chips), and on the right - where Bluesky has Follow - the balance
 * per currency in words.
 */
export function PersonRow({
  row,
  groupNames,
  locale,
}: {
  row: PersonRowData
  groupNames: Map<string, string>
  locale: string
}) {
  const t = useTheme()
  const rowPadding = useRowPadding()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  const byCurrency = row.summary?.byCurrency ?? {}
  const currencies = Object.keys(byCurrency)
    .filter(
      c =>
        byCurrency[c]!.total !== ZERO ||
        Object.keys(byCurrency[c]!.groups).length > 0,
    )
    .sort()

  const chips = currencies.flatMap(currency => {
    const c = byCurrency[currency]!
    const groups = Object.entries(c.groups)
      .filter(([, v]) => v !== ZERO)
      .map(([groupId, v]) => ({
        key: `${currency}-${groupId}`,
        name: groupNames.get(groupId) ?? l`Group`,
        v,
      }))
      .sort((x, y) => x.name.localeCompare(y.name))
    if (groups.length === 0) return []
    return [
      ...(c.direct !== ZERO
        ? [{key: `${currency}-direct`, name: l`Direct`, v: c.direct}]
        : []),
      ...groups,
    ].map(chip => ({
      ...chip,
      currency,
    }))
  })
  const isSettled = currencies.every(c => byCurrency[c]!.total === ZERO)

  const balances = (
    <View style={[a.align_end, a.gap_2xs, a.flex_shrink_0]}>
      {isSettled ? (
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>settled up</Trans>
        </Text>
      ) : (
        currencies
          .filter(c => byCurrency[c]!.total !== ZERO)
          .map(currency => (
            <BalanceText
              key={currency}
              testID={`balance-${currency}`}
              amount={byCurrency[currency]!.total}
              currency={currency}
              locale={locale}
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
        testID={`person-${row.name}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        href={`/people/${row.id}`}
        asAnchor
        anchorNoUnderline
        accessibilityLabel={row.name}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.px_lg,
          rowPadding,
          a.border_t,
          t.atoms.border_contrast_low,
          a.transition_color,
        ]}>
        <Animated.View
          style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
          <UserAvatar size={AVATAR_SIZE} name={row.name} type="user" />
          <View style={[a.flex_1, a.gap_2xs]}>
            {/* Phones: the balance shares the name's line so the chips get the full width. */}
            <View
              style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
              <View style={[a.flex_1]}>
                <ProfileCard.Name profile={row} />
              </View>
              {!gtMobile && balances}
            </View>
            {chips.length > 0 ? (
              <Pills.Row style={[a.pt_2xs]}>
                {chips.map(chip => (
                  <Pills.Tag key={chip.key}>
                    {chip.name}{' '}
                    <Text
                      style={[
                        a.text_xs,
                        a.font_semi_bold,
                        {
                          color:
                            chip.v > ZERO
                              ? t.palette.positive_600
                              : t.palette.negative_500,
                          fontVariant: ['tabular-nums'],
                        },
                      ]}>
                      {(chip.v > ZERO ? '+' : '−') +
                        formatAmount(magnitude(chip.v), chip.currency, locale)}
                    </Text>
                  </Pills.Tag>
                ))}
              </Pills.Row>
            ) : (
              <Text
                numberOfLines={1}
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                {isSettled ? (
                  <Trans>No open balances</Trans>
                ) : (
                  <Trans>Direct expenses</Trans>
                )}
              </Text>
            )}
          </View>
          {gtMobile && balances}
        </Animated.View>
      </Link>
    </Animated.View>
  )
}

/** Loading shape of one row. */
export function PersonRowPlaceholder() {
  const t = useTheme()
  return (
    <View style={[a.px_lg, a.py_md, a.border_t, t.atoms.border_contrast_low]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <ProfileCard.AvatarPlaceholder size={AVATAR_SIZE} />
        <ProfileCard.NameAndHandlePlaceholder />
        <View style={[a.align_end, {width: 120}]}>
          <View
            style={[
              a.rounded_sm,
              t.atoms.bg_contrast_50,
              {height: 12, width: 100},
            ]}
          />
        </View>
      </View>
    </View>
  )
}
