import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'
import {type Entity, type Repayment, type WriteOff} from '@splito/sync'

import {Link} from '#/view/com/util/Link'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useTheme} from '#/alf'
import {DeletedMeta, useStruck} from '#/components/DeletedMeta'
import {EntryIcon} from '#/components/people/EntryIcon'
import {SyncDot} from '#/components/SyncStatus'
import {type HistoryEntry, utcDate} from '#/components/people/ledger'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {moneyGlyph, useMoneyStyle} from '#/components/MoneyDirection'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * One expense or recorded payment, laid out like Bluesky's profile-card row:
 * a leading tile, a title, a byline and - where Bluesky has Follow - what
 * the entry did to the balance, in words. `effect` is the entry's effect on
 * my balance with the person (person context) or on my net in the group
 * (group context).
 */
export function HistoryRow({
  entry,
  context,
  effect,
  me,
  names,
  groupName,
  locale,
  onRepaymentPress,
  hideTopBorder = false,
  menu,
  isHidden = false,
}: {
  /** The first row under a month heading: the heading's rule already separates them. */
  hideTopBorder?: boolean
  entry: HistoryEntry
  context: 'person' | 'group'
  effect: bigint
  /** My person id. */
  me: string
  /** Display names by person id. */
  names: Map<string, string>
  /** The group's name, shown in a person's history. */
  groupName?: string | null
  locale: string
  /** A deleted row's "..." menu (Hide / Unhide), drawn beside the row. Live rows have none. */
  menu?: React.ReactNode
  /** Hidden by me and brought back by "Show hidden": says so. */
  isHidden?: boolean
  /** Opens a payment's or a write-off's details (`kind` says which). */
  onRepaymentPress: (
    repayment: Entity<Repayment | WriteOff>,
    kind: 'repayment' | 'writeoff',
  ) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  const data = entry.entity.data
  /* A deleted record stays in its place, drawn struck (owner 98, 103); only live ones say what they did to a balance. */
  const isDeleted = entry.entity.deleted
  const struck = useStruck()
  const name = (id: string) => names.get(id) ?? l`Someone`
  /* Bylines are short enough for a phone: first names, and no date (the month heading has it). */
  const firstName = (id: string) => name(id).split(' ')[0]!
  const amount = (minor: bigint) => formatAmount(minor, data.currency, locale)

  let title: string
  let byline: string[]
  let trailing: React.ReactNode
  if (entry.kind === 'expense') {
    const e = entry.entity.data
    const payers = Object.keys(e.payers).filter(id => e.payers[id] !== ZERO)
    const total = amount(e.total)
    title = e.title
    byline = [
      payers.length !== 1
        ? l`${payers.length} people paid ${total}`
        : payers[0] === me
          ? l`You paid ${total}`
          : l`${firstName(payers[0]!)} paid ${total}`,
    ]
    trailing = isDeleted ? (
      <Text style={[a.text_md, a.font_semi_bold, a.leading_snug, tabular, struck]}>{total}</Text>
    ) : (
      <EffectText
        effect={effect}
        context={context}
        figure={amount(magnitude(effect))}
      />
    )
  } else if (entry.kind === 'writeoff') {
    const w = entry.entity.data
    title =
      w.to === me
        ? l`You forgave ${name(w.from)}`
        : w.from === me
          ? l`${name(w.to)} forgave you`
          : l`${name(w.to)} forgave ${name(w.from)}`
    byline = [l`Called it even`]
    if (w.note) byline.push(w.note)
    trailing = (
      <Text
        style={[
          a.text_md,
          a.font_semi_bold,
          a.leading_snug,
          t.atoms.text_contrast_medium,
          tabular,
          isDeleted && struck,
        ]}>
        {amount(w.amount)}
      </Text>
    )
  } else {
    const r = entry.entity.data
    title =
      r.from === me
        ? l`You paid ${name(r.to)}`
        : r.to === me
          ? l`${name(r.from)} paid you`
          : l`${name(r.from)} paid ${name(r.to)}`
    byline = [l`Payment`]
    if (r.note) byline.push(r.note)
    trailing = (
      <Text
        style={[
          a.text_md,
          a.font_semi_bold,
          a.leading_snug,
          t.atoms.text,
          tabular,
          isDeleted && struck,
        ]}>
        {amount(r.amount)}
      </Text>
    )
  }
  if (groupName) byline.push(groupName)

  /*
   * Splitwise's money column: what it means on top, the amount under it,
   * both right-aligned, so the title and byline keep the row's width.
   */
  const content = (
    <Animated.View style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
      <EntryIcon
        category={
          entry.kind === 'expense' ? entry.entity.data.category : undefined
        }
        isPayment={entry.kind === 'repayment'}
        isWriteOff={entry.kind === 'writeoff'}
      />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          emoji
          numberOfLines={1}
          style={[a.text_md, a.font_semi_bold, a.leading_snug, isDeleted && struck]}>
          {title}
        </Text>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Text
            emoji
            numberOfLines={1}
            style={[
              a.flex_shrink,
              a.text_sm,
              a.leading_snug,
              t.atoms.text_contrast_medium,
              {minWidth: 0},
            ]}>
            {byline.join(' · ')}
          </Text>
          <SyncDot row={entry.entity} testID={`sync-${entry.entity.id}`} />
        </View>
        {isDeleted ? (
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            <DeletedMeta testID={`history-${entry.entity.id}-deleted`} at={entry.entity.updatedAt} />
            {isHidden ? (
              <Text testID={`history-${entry.entity.id}-hidden`} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                {'· '}
                <Trans>Hidden</Trans>
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={[a.align_end, a.flex_shrink_0, {maxWidth: '45%'}]}>
        {trailing}
      </View>
    </Animated.View>
  )
  const rowStyle = [
    a.px_lg,
    a.py_md,
    !hideTopBorder && !menu && [a.border_t, t.atoms.border_contrast_low],
    a.transition_color,
  ]

  const row =
    entry.kind === 'expense' ? (
      <Link
        testID={`history-${entry.entity.id}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        href={`/expense/${entry.entity.id}`}
        asAnchor
        anchorNoUnderline
        accessibilityLabel={title}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={rowStyle}>
        {content}
      </Link>
    ) : (
      <PressableWithHover
        testID={`history-${entry.entity.id}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => onRepaymentPress(entry.entity, entry.kind)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={
          isDeleted
            ? l`Shows the deleted record and lets you restore it`
            : entry.kind === 'writeoff'
              ? l`Shows the write-off and lets you undo it`
              : l`Shows the payment and lets you delete it`
        }
        hoverStyle={t.atoms.bg_contrast_25}
        style={rowStyle}>
        {content}
      </PressableWithHover>
    )

  return (
    <Animated.View {...listAnimations}>
      {menu ? (
        <View
          style={[
            a.flex_row,
            a.align_center,
            !hideTopBorder && [a.border_t, t.atoms.border_contrast_low],
          ]}>
          <View style={[a.flex_1]}>{row}</View>
          {menu}
        </View>
      ) : (
        row
      )}
    </Animated.View>
  )
}

/**
 * What one expense did, Splitwise's words: "you lent" / "you borrowed"
 * above the amount, coloured by direction. Balances (People, a friend's
 * total) say "owes you" / "you owe".
 */
function EffectText({
  effect,
  context,
  figure,
}: {
  effect: bigint
  context: 'person' | 'group'
  figure: string
}) {
  const t = useTheme()
  const money = useMoneyStyle()
  const label =
    effect === ZERO ? (
      context === 'person' ? (
        <Trans>no balance change</Trans>
      ) : (
        <Trans>not involved</Trans>
      )
    ) : effect > ZERO ? (
      <Trans>you lent</Trans>
    ) : (
      <Trans>you borrowed</Trans>
    )
  return (
    <>
      <Text
        numberOfLines={1}
        style={[
          a.text_sm,
          a.leading_tight,
          a.text_right,
          t.atoms.text_contrast_medium,
        ]}>
        {label}
      </Text>
      {effect !== ZERO && (
        <Text
          numberOfLines={1}
          style={[
            a.text_md,
            a.font_semi_bold,
            a.leading_snug,
            a.text_right,
            tabular,
            money.style(effect),
          ]}>
          {`${moneyGlyph(effect)}\u00a0${figure}`}
        </Text>
      )}
    </>
  )
}

/** A month heading inside a history list. */
export function MonthHeader({month}: {month: string}) {
  const t = useTheme()
  const {i18n} = useLingui()
  return (
    <View
      style={[
        a.px_lg,
        a.pt_lg,
        a.pb_sm,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
        {i18n.date(utcDate(month), {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })}
      </Text>
    </View>
  )
}

/** Loading shape of one history row. */
export function HistoryRowPlaceholder() {
  const t = useTheme()
  return (
    <View style={[a.px_lg, a.py_md, a.border_t, t.atoms.border_contrast_low]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <Skeleton.Block style={{width: 42, height: 42, borderRadius: 10}} />
        <View style={[a.flex_1, a.gap_xs]}>
          <Skeleton.Text style={[a.text_md, {width: 160}]} />
          <Skeleton.Text style={[a.text_sm, {width: 220}]} />
        </View>
      </View>
    </View>
  )
}
