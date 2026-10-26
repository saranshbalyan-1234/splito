import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude} from '@splito/domain'
import {type Entity, type Repayment} from '@splito/sync'

import {Link} from '#/view/com/util/Link'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {EntryIcon} from '#/components/people/EntryIcon'
import {type HistoryEntry, utcDate} from '#/components/people/ledger'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
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
}: {
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
  onRepaymentPress: (repayment: Entity<Repayment>) => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  const data = entry.entity.data
  const date = i18n.date(utcDate(data.date), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const name = (id: string) => names.get(id) ?? l`Someone`
  const amount = (minor: bigint) => formatAmount(minor, data.currency, locale)

  let title: string
  let byline: string[]
  let trailing: React.ReactNode
  if (entry.kind === 'expense') {
    const e = entry.entity.data
    const payers = Object.keys(e.payers).filter(id => e.payers[id] !== 0n)
    const total = amount(e.total)
    title = e.title
    byline = [
      payers.length !== 1
        ? l`${payers.length} people paid ${total}`
        : payers[0] === me
          ? l`You paid ${total}`
          : l`${name(payers[0]!)} paid ${total}`,
    ]
    trailing = (
      <EffectText
        effect={effect}
        context={context}
        figure={amount(magnitude(effect))}
      />
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
        ]}>
        {amount(r.amount)}
      </Text>
    )
  }
  if (groupName) byline.push(groupName)
  byline.push(date)

  const trailingView = (
    <View style={[a.align_end, a.flex_shrink_0]}>{trailing}</View>
  )
  const content = (
    <Animated.View style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
      <EntryIcon
        category={
          entry.kind === 'expense' ? entry.entity.data.category : undefined
        }
        isPayment={entry.kind === 'repayment'}
      />
      <View style={[a.flex_1, a.gap_2xs]}>
        {/* Phones: the effect shares the title's line so the byline gets the full width. */}
        <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
          <Text
            emoji
            numberOfLines={1}
            style={[a.flex_1, a.text_md, a.font_semi_bold, a.leading_snug]}>
            {title}
          </Text>
          {!gtMobile && trailingView}
        </View>
        <Text
          emoji
          numberOfLines={1}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {byline.join(' · ')}
        </Text>
      </View>
      {gtMobile && trailingView}
    </Animated.View>
  )
  const rowStyle = [
    a.px_lg,
    a.py_md,
    a.border_t,
    t.atoms.border_contrast_low,
    a.transition_color,
  ]

  return (
    <Animated.View {...listAnimations}>
      {entry.kind === 'expense' ? (
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
          onPress={() => onRepaymentPress(entry.entity)}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityHint={l`Shows the payment and lets you delete it`}
          hoverStyle={t.atoms.bg_contrast_25}
          style={rowStyle}>
          {content}
        </PressableWithHover>
      )}
    </Animated.View>
  )
}

/** "owes you" / "you owe" (person) or "you lent" / "you borrowed" (group), the amount coloured by direction. */
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
  const figureStyle = [
    a.text_md,
    a.font_semi_bold,
    {
      color: effect > 0n ? t.palette.positive_600 : t.palette.negative_500,
      ...tabular,
    },
  ]
  return (
    <Text
      numberOfLines={1}
      style={[
        a.text_sm,
        a.leading_snug,
        t.atoms.text_contrast_medium,
        a.text_right,
      ]}>
      {effect === 0n ? (
        context === 'person' ? (
          <Trans>no balance change</Trans>
        ) : (
          <Trans>not involved</Trans>
        )
      ) : effect > 0n ? (
        context === 'person' ? (
          <Trans>
            owes you <Text style={figureStyle}>{figure}</Text>
          </Trans>
        ) : (
          <Trans>
            you lent <Text style={figureStyle}>{figure}</Text>
          </Trans>
        )
      ) : context === 'person' ? (
        <Trans>
          you owe <Text style={figureStyle}>{figure}</Text>
        </Trans>
      ) : (
        <Trans>
          you borrowed <Text style={figureStyle}>{figure}</Text>
        </Trans>
      )}
    </Text>
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
