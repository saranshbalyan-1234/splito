// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Search/components/ModuleHeader.tsx (SectionHeader)
// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Search/components/SearchProfileCard.tsx (result rows)
// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Search/SearchResults.tsx (NoResults)
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, ZERO} from '@splito/domain'
import {
  type Entity,
  type Expense,
  type Group,
  highlightRanges,
  type Person,
} from '@splito/sync'

import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, type TextStyleProp, useTheme} from '#/alf'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {EntryIcon} from '#/components/people/EntryIcon'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'
import {type SearchSection} from './model'

const tabular = {fontVariant: ['tabular-nums' as const]}

/** Text with the query's word matches drawn in the accent, bold. */
export function Highlight({
  text,
  terms,
  style,
  numberOfLines = 1,
}: {
  text: string
  terms: string[]
} & TextStyleProp & {numberOfLines?: number}) {
  const t = useTheme()
  const ranges = highlightRanges(text, terms)
  const parts: React.ReactNode[] = []
  let at = 0
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <Text key={start} style={[a.font_bold, {color: t.palette.primary_500}]}>
        {text.slice(start, end)}
      </Text>,
    )
    at = end
  }
  if (at < text.length) parts.push(text.slice(at))
  return (
    <Text emoji numberOfLines={numberOfLines} style={style}>
      {parts}
    </Text>
  )
}

/**
 * Bluesky's Explore module header (title, then a muted subtitle), heading
 * each result section; expenses carry their totals, one per currency.
 */
export function SectionHeader({
  section,
  count,
  totals,
  locale,
}: {
  section: SearchSection
  count: number
  totals?: Record<string, bigint>
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const title = {people: l`People`, groups: l`Groups`, expenses: l`Expenses`}[
    section
  ]
  const totalLine = totals
    ? Object.keys(totals)
        .sort()
        .map(c => formatAmount(totals[c]!, c, locale))
        .join('  ·  ')
    : ''
  return (
    <View
      testID={`search-section-${section}`}
      style={[
        a.flex_row,
        a.align_end,
        a.justify_between,
        a.gap_md,
        a.px_lg,
        a.pt_xl,
        a.pb_sm,
        t.atoms.bg,
      ]}>
      <Text style={[a.text_lg, a.font_bold, a.leading_snug]}>
        {title}
        <Text style={[a.text_lg, a.font_normal, t.atoms.text_contrast_medium]}>
          {'  '}
          {count}
        </Text>
      </Text>
      {totalLine ? (
        <Text
          testID="search-totals"
          accessibilityLabel={l`Total ${totalLine}`}
          numberOfLines={1}
          style={[
            a.flex_shrink,
            a.text_sm,
            a.font_semi_bold,
            a.leading_snug,
            a.text_right,
            t.atoms.text_contrast_medium,
            tabular,
          ]}>
          {totalLine}
        </Text>
      ) : null}
    </View>
  )
}

/** A result row: Bluesky's search card press and hover, plus the keyboard's current row. */
function ResultRow({
  nav,
  label,
  isActive,
  onPress,
  children,
}: {
  nav: number
  label: string
  isActive: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  const t = useTheme()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  return (
    <Animated.View {...listAnimations}>
      <PressableWithHover
        testID={`search-row-${nav}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityHint=""
        aria-selected={isActive}
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.px_lg,
          a.py_md,
          a.transition_color,
          isActive && t.atoms.bg_contrast_25,
        ]}>
        <Animated.View
          style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
          {children}
        </Animated.View>
      </PressableWithHover>
    </Animated.View>
  )
}

export function ExpenseResult({
  nav,
  expense,
  terms,
  me,
  names,
  groupNames,
  locale,
  date,
  isActive,
  onPress,
}: {
  nav: number
  expense: Entity<Expense>
  terms: string[]
  me: string | undefined
  names: Map<string, string>
  groupNames: Map<string, string>
  locale: string
  /** The expense's date as the Date format preference writes it. */
  date: string
  isActive: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const e = expense.data
  const total = formatAmount(e.total, e.currency, locale)
  const payers = Object.keys(e.payers).filter(id => e.payers[id] !== ZERO)
  const firstName = (id: string) => (names.get(id) ?? l`Someone`).split(' ')[0]!
  const byline = [
    payers.length !== 1
      ? l`${payers.length} people paid`
      : payers[0] === me
        ? l`You paid`
        : l`${firstName(payers[0]!)} paid`,
    e.groupId ? groupNames.get(e.groupId) : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  /* Found by a note or an item rather than the title: show where. */
  const snippet =
    highlightRanges(e.title, terms).length === 0
      ? [
          e.notes,
          ...(e.split.mode === 'items'
            ? e.split.items.map(i => i.name ?? '')
            : []),
        ].find(text => text && highlightRanges(text, terms).length > 0)
      : undefined

  return (
    <ResultRow
      nav={nav}
      label={l`${e.title}, ${total}, ${date}`}
      isActive={isActive}
      onPress={onPress}>
      <EntryIcon category={e.category} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Highlight
          text={e.title}
          terms={terms}
          style={[a.text_md, a.font_semi_bold, a.leading_snug]}
        />
        {/* Payer and group names match too, so they light up here. */}
        <Highlight
          text={byline}
          terms={terms}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}
        />
        {snippet ? (
          <Highlight
            text={snippet}
            terms={terms}
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}
          />
        ) : null}
      </View>
      <View style={[a.align_end, a.gap_2xs, a.flex_shrink_0]}>
        <Text
          numberOfLines={1}
          style={[a.text_md, a.font_semi_bold, a.leading_snug, tabular]}>
          {total}
        </Text>
        <Text
          numberOfLines={1}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {date}
        </Text>
      </View>
    </ResultRow>
  )
}

export function PersonResult({
  nav,
  person,
  terms,
  isActive,
  onPress,
}: {
  nav: number
  person: Entity<Person>
  terms: string[]
  isActive: boolean
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <ResultRow
      nav={nav}
      label={person.data.name}
      isActive={isActive}
      onPress={onPress}>
      <UserAvatar size={42} name={person.data.name} type="user" />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Highlight
          text={person.data.name}
          terms={terms}
          style={[a.text_md, a.font_semi_bold, a.leading_snug]}
        />
        <Text
          numberOfLines={1}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Friend</Trans>
        </Text>
      </View>
      <ChevronIcon size="sm" style={t.atoms.text_contrast_low} />
    </ResultRow>
  )
}

export function GroupResult({
  nav,
  group,
  terms,
  isActive,
  onPress,
}: {
  nav: number
  group: Entity<Group>
  terms: string[]
  isActive: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {name, kind, members, archived} = group.data
  const kindLabel = {
    trip: l`Trip`,
    home: l`Home`,
    couple: l`Couple`,
    other: l`Group`,
  }[kind]
  const memberCount = members.filter(m => m.leftAt === null).length
  const byline = [
    kindLabel,
    memberCount === 1 ? l`1 member` : l`${memberCount} members`,
    archived ? l`Archived` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <ResultRow nav={nav} label={name} isActive={isActive} onPress={onPress}>
      <GroupAvatar kind={kind} name={name} size={42} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Highlight
          text={name}
          terms={terms}
          style={[a.text_md, a.font_semi_bold, a.leading_snug]}
        />
        <Text
          numberOfLines={1}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {byline}
        </Text>
      </View>
      <ChevronIcon size="sm" style={t.atoms.text_contrast_low} />
    </ResultRow>
  )
}

/** Bluesky's "No results found for “…”." box. */
export function NoResults({query}: {query: string}) {
  const t = useTheme()
  return (
    <View testID="search-empty" style={[a.p_xl]}>
      <View style={[t.atoms.bg_contrast_25, a.rounded_sm, a.p_lg, a.gap_xs]}>
        <Text style={[a.text_md]}>
          <Trans>
            No results found for “
            <Text style={[a.text_md, a.font_semi_bold]}>{query}</Text>”.
          </Trans>
        </Text>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Try fewer words, part of a word, an amount like 450 or a month like
            march.
          </Trans>
        </Text>
      </View>
    </View>
  )
}
