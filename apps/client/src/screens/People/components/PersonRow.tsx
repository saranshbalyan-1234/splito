import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  balanceSides,
  isSettledBalance,
  type PersonSummary,
  ZERO,
} from '@splito/domain'
import {type RowSyncStatus} from '@splito/sync'

import {HideRow} from '#/features/hidden/HideItem'
import {useRowPadding} from '#/state/preferences/density'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {DeletedMeta, useStruck} from '#/components/DeletedMeta'
import {BalanceText, SettledPill} from '#/components/BalanceText'
import * as Pills from '#/components/Pills'
import {NeedsAttention} from '#/components/SyncStatus'
import {SyncToneContext, useSyncTone} from '#/components/SyncTone'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'

export type PersonRowData = {
  id: string
  name: string
  summary: PersonSummary | undefined
  /** A deleted friend stays in the list, struck through (decision 103); this is when. */
  deletedAt?: number
  /** Hidden by me (only a deleted friend can be): out of the list unless "Show hidden" is on. */
  isHidden?: boolean
  /** A removed friend who still has an open balance (shown until it is settled). */
  isRemoved?: boolean
  /** The friend record's sync state, so the row draws lighter until the server has it (decision 111). */
  syncStatus?: RowSyncStatus
}

const AVATAR_SIZE = 42
const MAX_CHIPS = 2
const MAX_NETS = 3

/** A group chip that shortens its name before it would wrap. */
function ChipTag({name}: {name: string}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.rounded_xs,
        a.justify_center,
        t.atoms.bg_contrast_50,
        {paddingHorizontal: 6, paddingVertical: 3},
      ]}>
      <Text numberOfLines={1} style={[a.text_xs, a.leading_tight]}>
        {name}
      </Text>
    </View>
  )
}

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
  const listAnimations = useListAnimations()
  const press = usePressScale()
  const struck = useStruck()
  const tone = useSyncTone(row.syncStatus)
  const isDeleted = row.deletedAt !== undefined
  const byCurrency = row.summary?.byCurrency ?? {}
  const currencies = Object.keys(byCurrency)
    .filter(
      c =>
        byCurrency[c]!.total !== ZERO ||
        Object.keys(byCurrency[c]!.groups).length > 0,
    )
    .sort()

  /*
   * Chips name the groups behind the balance (a group with any open part);
   * the nets stay on the right and are not repeated here. Two chips, then "+N".
   */
  const groupIds = [
    ...new Set(
      currencies.flatMap(c =>
        Object.entries(byCurrency[c]!.groups)
          .filter(([, v]) => v !== ZERO)
          .map(([groupId]) => groupId),
      ),
    ),
  ]
  const groupChips = groupIds
    .map(groupId => ({groupId, name: groupNames.get(groupId) ?? l`Group`}))
    .sort((x, y) => x.name.localeCompare(y.name))
  const chips = groupChips.slice(0, MAX_CHIPS)
  const moreChips = groupChips.length - chips.length
  /* Settled means every part is zero, not just the net (audit M10). */
  const isSettled = currencies.every(c => isSettledBalance(byCurrency[c]!))

  const open = currencies.filter(c => !isSettledBalance(byCurrency[c]!))
  /*
   * One net per currency (max 3, then "+N"). Only when a currency is open
   * both ways and nets to zero does it take two lines, owed and owe, so it
   * never reads "Settled" (audit M10).
   */
  const lines = (currency: string) => {
    const balance = byCurrency[currency]!
    const {owed, owe} = balanceSides(balance)
    if (owed !== ZERO && owe !== ZERO && balance.total === ZERO)
      return [
        {amount: owed, testID: `balance-${currency}-owed`},
        {amount: -owe, testID: `balance-${currency}-owe`},
      ]
    return [{amount: balance.total, testID: `balance-${currency}`}]
  }
  const shownCurrencies = open.slice(0, MAX_NETS)
  const moreNets = open.length - shownCurrencies.length
  const balances = isDeleted ? null : isSettled ? (
    <SettledPill testID="person-row-settled" />
  ) : (
    <View
      testID="person-row-nets"
      style={[a.align_end, a.gap_2xs, a.flex_shrink_0]}>
      {shownCurrencies.flatMap(currency =>
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
      {moreNets > 0 && (
        <Text
          testID="person-row-more-nets"
          style={[a.text_xs, t.atoms.text_contrast_medium]}>
          +{moreNets}
        </Text>
      )}
    </View>
  )

  /* The row content shrinks on press; the separator stays put. */
  const link = (onLongPress?: () => void) => (
      <Link
        onLongPress={onLongPress}
        testID={`person-${row.name}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        href={`/people/${row.id}`}
        asAnchor
        anchorNoUnderline
        accessibilityLabel={tone.isUnsynced ? l`${row.name}, not synced yet` : row.name}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.px_lg,
          rowPadding,
          !isDeleted && a.border_t,
          t.atoms.border_contrast_low,
          a.transition_color,
        ]}>
        <SyncToneContext.Provider value={tone.isUnsynced}>
        <Animated.View
          style={[
            a.flex_row,
            /* Avatar, name block and the amounts column are all vertically centred, however many lines each has (owner 130). */
            a.align_center,
            a.gap_md,
            press.style,
            tone.fade,
          ]}>
          <UserAvatar size={AVATAR_SIZE} name={row.name} type="user" />
          {/* Two lines at most: the name, then the group chips (or a state); the nets are the right column. */}
          <View style={[a.flex_1, a.gap_2xs, {minWidth: 0}]}>
            <ProfileCard.Name
              profile={row}
              textStyle={isDeleted ? struck : undefined}
            />
            {row.isRemoved ? (
              <Pills.Row style={[a.pt_2xs]}>
                <Pills.Tag>
                  <Trans>Removed</Trans>
                </Pills.Tag>
              </Pills.Row>
            ) : isDeleted ? (
              <View style={[a.flex_row, a.align_center, a.gap_sm, a.pt_2xs]}>
                <Pills.Tag>
                  <Trans>Deleted</Trans>
                </Pills.Tag>
                <DeletedMeta
                  testID={`person-${row.id}-deleted`}
                  at={row.deletedAt!}
                />
                {row.isHidden ? (
                  <Pills.Tag>
                    <Trans>Hidden</Trans>
                  </Pills.Tag>
                ) : null}
                <NeedsAttention status={row.syncStatus} testID={`person-${row.id}-sync`} />
              </View>
            ) : chips.length > 0 ? (
              /* Never wraps: a long group name shortens instead. */
              <View
                testID={`person-${row.id}-chips`}
                style={[a.flex_row, a.gap_xs, a.pt_2xs, a.overflow_hidden]}>
                {chips.map(chip => (
                  <View key={chip.groupId} style={[a.flex_shrink, {minWidth: 0}]}>
                    <ChipTag name={chip.name} />
                  </View>
                ))}
                {moreChips > 0 && (
                  <View style={a.flex_shrink_0}>
                    <ChipTag name={`+${moreChips}`} />
                  </View>
                )}
              </View>
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
          {balances}
        </Animated.View>
        </SyncToneContext.Provider>
      </Link>
  )

  return (
    <Animated.View {...listAnimations}>
      {isDeleted ? (
        /* The menu is a sibling of the link, never nested in it. */
        <HideRow
          style={[a.border_t, t.atoms.border_contrast_low]}
          testID={`person-${row.id}-more`}
          target={{type: 'person', id: row.id}}
          isHidden={!!row.isHidden}
          name={row.name}
          row={link}
        />
      ) : (
        link()
      )}
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
