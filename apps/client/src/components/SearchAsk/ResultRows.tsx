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
  isGroupInactive,
  type MatchedField,
  type Person,
  type Repayment,
  removeChip,
  type RowSyncStatus,
  type SearchChip,
  type SearchStatus,
  type WriteOff,
} from '@splito/sync'

import {HITSLOP_10} from '#/lib/constants'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, type TextStyleProp, useTheme} from '#/alf'
import {DeletedMeta, useStruck} from '#/components/DeletedMeta'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Sparkles_Stroke2_Corner0_Rounded as SparklesIcon} from '#/components/icons/Sparkles'
import {EntryIcon} from '#/components/people/EntryIcon'
import * as Pills from '#/components/Pills'
import {SyncToneContext, useSyncTone} from '#/components/SyncTone'
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
  isPartial = false,
  totals,
  locale,
}: {
  section: SearchSection
  count: number
  /** Only what has been found so far: shown as "30+". */
  isPartial?: boolean
  totals?: Record<string, bigint>
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const title = {people: l`People`, groups: l`Groups`, expenses: l`Expenses`, payments: l`Payments`}[section]
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
          {isPartial ? '+' : ''}
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
  syncStatus,
  children,
}: {
  nav: number
  label: string
  isActive: boolean
  onPress: () => void
  /** The record's sync state, from the entity already in hand: unsynced rows are drawn lighter (owner 111). */
  syncStatus?: RowSyncStatus
  children: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  const tone = useSyncTone(syncStatus)
  return (
    <Animated.View {...listAnimations}>
      <PressableWithHover
        testID={`search-row-${nav}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="link"
        accessibilityLabel={tone.isUnsynced ? l`${label}, not synced yet` : label}
        accessibilityHint=""
        aria-selected={isActive}
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.px_lg,
          a.py_md,
          a.transition_color,
          isActive && t.atoms.bg_contrast_25,
        ]}>
        <SyncToneContext.Provider value={tone.isUnsynced}>
          <Animated.View
            style={[a.flex_row, a.align_center, a.gap_md, press.style, tone.fade]}>
            {children}
          </Animated.View>
        </SyncToneContext.Provider>
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
  match,
  isActive,
  onPress,
}: {
  nav: number
  expense: Entity<Expense>
  terms: string[]
  /** Which fields matched besides the title (`matchedFields`): each is named and its words are marked. */
  match: MatchedField[]
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
  const struck = useStruck()
  /* A deleted expense stays among the results, struck through; the totals above never count it (decision 103). */
  const isDeleted = expense.deleted
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
  const fieldLabel = useFieldLabel()
  const isInGroup = !!e.groupId
  const title = e.title
  const shown = match.slice(0, 2)
  /* Screen readers hear why it is here too: "Notes: Farewell dinner", "Comment: Please send the receipt". */
  const why = shown.map(m => ('text' in m ? `${fieldLabel(m, isInGroup)}: ${m.text}` : fieldLabel(m, isInGroup))).join(', ')

  return (
    <ResultRow
      nav={nav}
      label={why ? l`${title}, ${total}, ${date}, ${why}` : l`${title}, ${total}, ${date}`}
      isActive={isActive}
      syncStatus={expense.syncStatus}
      onPress={onPress}>
      <EntryIcon category={e.category} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Highlight
          text={e.title}
          terms={terms}
          style={[a.text_md, a.font_semi_bold, a.leading_snug, isDeleted && struck]}
        />
        {/* Payer and group names match too, so they light up here. */}
        <Highlight
          text={byline}
          terms={terms}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}
        />
        {/* Why it is here: the field that matched, named, with the matched words marked. */}
        {shown.map(m => (
          <View key={m.field} testID={`search-match-${expense.id}-${m.field}`} style={[a.flex_row, a.align_center, a.gap_xs]}>
            <Pills.Tag>{fieldLabel(m, isInGroup)}</Pills.Tag>
            {/* An amount, date, currency or status is already on the row (right column, tag): the tag alone says it matched. */}
            {'text' in m ? (
              <View style={[a.flex_1]}>
                <Highlight text={m.text} terms={terms} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]} />
              </View>
            ) : null}
          </View>
        ))}
        {isDeleted ? <DeletedMeta testID={`search-deleted-${expense.id}`} at={expense.updatedAt} /> : null}
      </View>
      <View style={[a.align_end, a.gap_2xs, a.flex_shrink_0]}>
        <Text
          numberOfLines={1}
          style={[a.text_md, a.font_semi_bold, a.leading_snug, tabular, isDeleted && struck]}>
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

/** The name of a matched field, in the person's language; a balance status says where it applies. */
function useFieldLabel() {
  const {t: l} = useLingui()
  const status = (s: SearchStatus, isInGroup: boolean): string => {
    switch (s) {
      case 'settled':
        return isInGroup ? l`Settled in group` : l`Settled`
      case 'owed':
        return isInGroup ? l`Owed in group` : l`Owed`
      case 'owe':
        return isInGroup ? l`You owe in group` : l`You owe`
      case 'disputed':
        return l`Disputed`
      case 'deleted':
        return l`Deleted`
      case 'hidden':
        return l`Hidden`
      case 'inactive':
        return l`Inactive`
    }
  }
  return (m: MatchedField, isInGroup: boolean): string => {
    switch (m.field) {
      case 'notes':
        return l`Notes`
      case 'item':
        return l`Item`
      case 'group':
        return l`Group`
      case 'place':
        return l`Place`
      case 'category':
        return l`Category`
      case 'person':
        return l`With`
      case 'payer':
        return l`Paid by`
      case 'comment':
        return l`Comment`
      case 'amount':
        return l`Amount`
      case 'date':
        return l`Date`
      case 'currency':
        return l`Currency`
      case 'status':
        return status(m.status, isInGroup)
    }
  }
}

/** A payment or write-off result: who paid whom, the note, the amount and the date (a comment that matched shows too). */
export function PaymentResult({
  nav,
  payment,
  terms,
  me,
  names,
  locale,
  date,
  comment,
  isActive,
  onPress,
}: {
  nav: number
  payment: Entity<Repayment | WriteOff>
  terms: string[]
  me: string | undefined
  names: Map<string, string>
  locale: string
  date: string
  /** The text of the comment this payment was found through. */
  comment: string | undefined
  isActive: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const struck = useStruck()
  const p = payment.data
  const isWriteOff = payment.type === 'writeoff'
  const amount = formatAmount(p.amount, p.currency, locale)
  const nameOf = (id: string) => (id === me ? l`You` : (names.get(id) ?? l`Someone`).split(' ')[0]!)
  const from = nameOf(p.from)
  const to = nameOf(p.to)
  const who = isWriteOff ? l`${to} let ${from} off` : l`${from} paid ${to}`
  return (
    <ResultRow
      nav={nav}
      label={comment ? l`${who}, ${amount}, ${date}, comment: ${comment}` : l`${who}, ${amount}, ${date}`}
      isActive={isActive}
      syncStatus={payment.syncStatus}
      onPress={onPress}>
      <EntryIcon isPayment={!isWriteOff} isWriteOff={isWriteOff} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Highlight text={who} terms={terms} style={[a.text_md, a.font_semi_bold, a.leading_snug, payment.deleted && struck]} />
        {p.note ? <Highlight text={p.note} terms={terms} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]} /> : null}
        {comment ? (
          <View testID={`search-match-${payment.id}-comment`} style={[a.flex_row, a.align_center, a.gap_xs]}>
            <Pills.Tag>{l`Comment`}</Pills.Tag>
            <View style={[a.flex_1]}>
              <Highlight text={comment} terms={terms} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]} />
            </View>
          </View>
        ) : null}
        {payment.deleted ? <DeletedMeta testID={`search-deleted-${payment.id}`} at={payment.updatedAt} /> : null}
      </View>
      <View style={[a.align_end, a.gap_2xs, a.flex_shrink_0]}>
        <Text numberOfLines={1} style={[a.text_md, a.font_semi_bold, a.leading_snug, tabular, payment.deleted && struck]}>
          {amount}
        </Text>
        <Text numberOfLines={1} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {date}
        </Text>
      </View>
    </ResultRow>
  )
}

/**
 * The facets the query was read as, one removable chip each, under the search box (F-246): "Paid by riya", "last
 * month", "over 500". Removing one takes its words out of the query and the search runs again.
 */
export function SearchChips({chips, query, onQueryChange}: {chips: SearchChip[]; query: string; onQueryChange: (query: string) => void}) {
  const {t: l} = useLingui()
  const kind = (c: SearchChip): string => {
    switch (c.facet) {
      case 'amount':
        return l`Amount`
      case 'period':
        return l`Date`
      case 'person':
        return c.role === 'payer' ? l`Paid by` : l`With`
      case 'place':
        return l`In`
      case 'currency':
        return l`Currency`
      case 'status':
        return l`Status`
      case 'type':
        return l`Type`
      case 'any':
        return l`Any of`
    }
  }
  if (chips.length === 0) return null
  return (
    <View testID="search-chips" style={[a.flex_row, a.flex_wrap, a.gap_xs, a.px_lg, a.pt_sm]}>
      {chips.map(c => {
        const name = kind(c)
        const typed = c.text
        return (
          <Button
            key={`${c.span[0]}-${c.text}`}
            testID={`search-chip-${c.facet}`}
            label={l`Remove ${name}: ${typed}`}
            size="small"
            color="secondary"
            hitSlop={HITSLOP_10}
            onPress={() => onQueryChange(removeChip(query, c))}>
            <ButtonText>{l`${name}: ${typed}`}</ButtonText>
            <ButtonIcon icon={XIcon} />
          </Button>
        )
      })}
    </View>
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
  const struck = useStruck()
  return (
    <ResultRow
      nav={nav}
      label={person.data.name}
      isActive={isActive}
      syncStatus={person.syncStatus}
      onPress={onPress}>
      <UserAvatar size={42} name={person.data.name} type="user" />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Highlight
          text={person.data.name}
          terms={terms}
          style={[a.text_md, a.font_semi_bold, a.leading_snug, person.deleted && struck]}
        />
        {person.deleted ? (
          <DeletedMeta testID={`search-deleted-${person.id}`} at={person.updatedAt} />
        ) : (
          <Text
            numberOfLines={1}
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>Friend</Trans>
          </Text>
        )}
      </View>
      <ChevronIcon size="sm" style={t.atoms.text_contrast_low} />
    </ResultRow>
  )
}

export function GroupResult({
  nav,
  group,
  isHidden = false,
  terms,
  isActive,
  onPress,
}: {
  nav: number
  group: Entity<Group>
  /** I have hidden this group (decision 89). */
  isHidden?: boolean
  terms: string[]
  isActive: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const struck = useStruck()
  const {name, kind, members} = group.data
  const kindLabel = {
    trip: l`Trip`,
    home: l`Home`,
    couple: l`Couple`,
    other: l`Group`,
  }[kind]
  const memberCount = members.filter(m => m.leftAt === null).length
  const byline = [
    kindLabel,
    kind === 'trip' ? group.data.location : undefined,
    memberCount === 1 ? l`1 member` : l`${memberCount} members`,
    group.deleted ? l`Deleted` : isGroupInactive(group.data) ? l`Inactive` : undefined,
    isHidden ? l`Hidden` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <ResultRow nav={nav} label={name} isActive={isActive} syncStatus={group.syncStatus} onPress={onPress}>
      <GroupAvatar kind={kind} name={name} size={42} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Highlight
          text={name}
          terms={terms}
          style={[a.text_md, a.font_semi_bold, a.leading_snug, group.deleted && struck]}
        />
        <Text
          numberOfLines={1}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {byline}
        </Text>
        {group.deleted ? <DeletedMeta testID={`search-deleted-${group.id}`} at={group.updatedAt} /> : null}
      </View>
      <ChevronIcon size="sm" style={t.atoms.text_contrast_low} />
    </ResultRow>
  )
}

/** The search could not be answered: say so, with Try again (never an endless wait). */
export function SearchFailed({onRetry}: {onRetry: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View testID="search-failed" style={[a.p_xl]}>
      <View style={[t.atoms.bg_contrast_25, a.rounded_sm, a.p_lg, a.gap_sm, a.align_start]}>
        <Text style={[a.text_md]}>
          <Trans>Search isn’t ready on this device.</Trans>
        </Text>
        <Button testID="search-retry" label={l`Try search again`} size="small" color="secondary" onPress={onRetry}>
          <ButtonText>
            <Trans>Try again</Trans>
          </ButtonText>
        </Button>
      </View>
    </View>
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

/** The "Ask Splito: '<query>'" row that heads the results: Enter on a question or a tap opens the chat. */
export function AskResult({
  nav,
  query,
  isActive,
  onPress,
}: {
  nav: number
  query: string
  isActive: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <ResultRow nav={nav} label={l`Ask Splito: ${query}`} isActive={isActive} onPress={onPress}>
      <View
        style={[
          a.rounded_full,
          a.align_center,
          a.justify_center,
          {width: 40, height: 40, backgroundColor: t.palette.primary_100},
        ]}>
        <SparklesIcon size="md" fill={t.palette.primary_600} />
      </View>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text numberOfLines={1} style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
          <Trans>Ask Splito: “{query}”</Trans>
        </Text>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]} numberOfLines={1}>
          <Trans>Answered on this device</Trans>
        </Text>
      </View>
      <ChevronIcon size="sm" style={t.atoms.text_contrast_low} />
    </ResultRow>
  )
}
