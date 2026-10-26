import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  balanceSides,
  formatAmount,
  isSettledBalance,
  magnitude,
  type PersonSummary,
  ZERO,
} from '@splito/domain'

import {useRowPadding} from '#/state/preferences/density'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {BalanceText, SettledPill} from '#/components/BalanceText'
import * as Pills from '#/components/Pills'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {useMoneyStyle} from '#/components/MoneyDirection'
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
  const money = useMoneyStyle()
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

  /*
   * Chips explain the balance, so once any group is involved every part
   * shows - direct ones included, in every currency - and they add up to
   * the amounts on the right.
   */
  const hasGroupPart = currencies.some(c =>
    Object.values(byCurrency[c]!.groups).some(v => v !== ZERO),
  )
  const chips = !hasGroupPart
    ? []
    : currencies.flatMap(currency => {
        const c = byCurrency[currency]!
        const groups = Object.entries(c.groups)
          .filter(([, v]) => v !== ZERO)
          .map(([groupId, v]) => ({
            key: `${currency}-${groupId}`,
            name: groupNames.get(groupId) ?? l`Group`,
            v,
          }))
          .sort((x, y) => x.name.localeCompare(y.name))
        return [
          ...(c.direct !== ZERO
            ? [{key: `${currency}-direct`, name: l`Direct`, v: c.direct}]
            : []),
          ...groups,
        ].map(chip => ({...chip, currency}))
      })
  /* Settled means every part is zero, not just the net (audit M10). */
  const isSettled = currencies.every(c => isSettledBalance(byCurrency[c]!))

  const open = currencies.filter(c => !isSettledBalance(byCurrency[c]!))
  /*
   * Each way on its own line, never netted across direct and groups (as
   * the Overview adds them and a payment settles them): owed 10 directly
   * and owing 10 in a group reads both, not "Settled".
   */
  const lines = (currency: string) => {
    const {owed, owe} = balanceSides(byCurrency[currency]!)
    const isBoth = owed !== ZERO && owe !== ZERO
    return [
      {
        amount: owed,
        testID: isBoth ? `balance-${currency}-owed` : `balance-${currency}`,
      },
      {
        amount: -owe,
        testID: isBoth ? `balance-${currency}-owe` : `balance-${currency}`,
      },
    ].filter(line => line.amount !== ZERO)
  }
  const balanceColumn = (list: string[]) => (
    <View style={[a.align_end, a.gap_2xs, a.flex_shrink_0]}>
      {list.flatMap(currency =>
        lines(currency).map(line => (
          <BalanceText
            key={line.testID}
            testID={line.testID}
            amount={line.amount}
            currency={currency}
            locale={locale}
            style={a.text_right}
          />
        )),
      )}
    </View>
  )
  const balances = isSettled ? (
    <SettledPill testID="person-row-settled" />
  ) : (
    balanceColumn(open)
  )
  /*
   * Phones: the first currency shares the name's line and any others share
   * the chips' line, so a second currency never leaves a gap under the name.
   */
  const firstBalance = isSettled ? balances : balanceColumn(open.slice(0, 1))
  const moreBalances = open.length > 1 ? balanceColumn(open.slice(1)) : null

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
          style={[
            a.flex_row,
            /* Top-aligned at every width: the amount reads on the name's line. */
            a.align_start,
            a.gap_md,
            press.style,
          ]}>
          <UserAvatar size={AVATAR_SIZE} name={row.name} type="user" />
          {/*
           * Wide screens: name and chips are one column, the balances
           * another, so a second currency never pushes the chips down.
           */}
          <View style={[a.flex_1, a.gap_2xs]}>
            {/* Phones: the balance shares the name's line, so the chips get the full width. */}
            <View
              style={[a.flex_row, a.align_start, a.justify_between, a.gap_md]}>
              <View style={[a.flex_1]}>
                <ProfileCard.Name profile={row} />
              </View>
              {!gtMobile && firstBalance}
            </View>
            <View
              style={[a.flex_row, a.align_start, a.justify_between, a.gap_md]}>
              <View style={[a.flex_1]}>
                {chips.length > 0 ? (
                  <Pills.Row style={[a.pt_2xs]}>
                    {chips.map(chip => (
                      <Pills.Tag key={chip.key}>
                        {chip.name}{' '}
                        <Text
                          style={[
                            a.text_xs,
                            a.font_semi_bold,
                            {fontVariant: ['tabular-nums']},
                            money.style(chip.v),
                          ]}>
                          {(chip.v > ZERO ? '+' : '−') +
                            formatAmount(
                              magnitude(chip.v),
                              chip.currency,
                              locale,
                            )}
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
              {!gtMobile && moreBalances}
            </View>
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
