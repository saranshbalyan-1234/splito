import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {BarChart} from '#/components/charts/BarChart'
import {type Point} from '#/components/charts/Cartesian'
import {DataTable} from '#/components/charts/DataTable'
import {HBarList} from '#/components/charts/HBarList'
import {ArrowRight_Stroke2_Corner0_Rounded as ArrowRightIcon} from '#/components/icons/Arrow'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {moneyGlyph, useMoneyStyle} from '#/components/MoneyDirection'
import {Text} from '#/components/Typography'

/*
 * The rich cards an Ask Splito answer can carry (ARCHITECTURE 26.19): a
 * balance card, a ranked list, a spending chart or table, an expense list and
 * an action card that opens the normal sheet. They draw what the answer holds
 * and read nothing themselves; every figure is exact money formatted for its
 * own currency, one line per currency, never summed across them.
 */

const tabular = {fontVariant: ['tabular-nums' as const]}

/** The shared card frame: a hairline border, the people-balance card's shape. */
export function Card({
  children,
  title,
  aside,
  testID,
}: {
  children: React.ReactNode
  title?: string
  aside?: string
  testID?: string
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      style={[a.rounded_md, a.border, t.atoms.border_contrast_low, t.atoms.bg, a.p_md, a.gap_md]}>
      {title ? (
        <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
          <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>{title}</Text>
          {aside ? <Text style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>{aside}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  )
}

/** One balance line: a currency, the direction in words and an arrow, the figure large and coloured. */
export function BalanceLine({
  amount,
  currency,
  locale,
  caption,
  detail,
  testID,
}: {
  testID: string
  amount: bigint
  currency: string
  locale: string
  /** "owes you" / "you owe" */
  caption: string
  /** Direct and per-group parts, already worded. */
  detail?: string[]
}) {
  const t = useTheme()
  const money = useMoneyStyle()
  return (
    <View style={[a.gap_2xs]}>
      <Text style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>{caption}</Text>
      <Text
        testID={testID}
        style={[a.text_3xl, a.font_bold, a.leading_tight, tabular, money.style(amount)]}>
        {`${moneyGlyph(amount)} ${formatAmount(magnitude(amount), currency, locale)}`}
      </Text>
      {detail?.map(d => (
        <Text key={d} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {d}
        </Text>
      ))}
    </View>
  )
}

/** A ranked list of people for one currency: avatar, name, a bar scaled to the largest, the amount. */
export function PeopleRanking({
  rows,
  currency,
  locale,
  title,
  testID,
}: {
  rows: Array<{id: string; name: string; amount: bigint}>
  currency: string
  locale: string
  title: string
  testID: string
}) {
  return (
    <Card title={title} aside={currency}>
      <HBarList
        testID={testID}
        currency={currency}
        locale={locale}
        bars={rows.map(r => ({
          key: r.id,
          value: r.amount,
          label: r.name,
          leading: <UserAvatar size={24} name={r.name} type="user" />,
        }))}
      />
    </Card>
  )
}

/** "Who pays whom" in a group: payer, an arrow, payee and the amount, one row per payment of the plan. */
export function PlanRows({
  rows,
  locale,
  testID,
}: {
  rows: Array<{key: string; from: string; to: string; fromAvatar?: string; toAvatar?: string; currency: string; amount: bigint}>
  locale: string
  testID: string
}) {
  const t = useTheme()
  return (
    <View testID={testID} style={[a.gap_sm]}>
      {rows.map(r => (
        <View key={r.key} style={[a.flex_row, a.align_center, a.gap_sm]}>
          <UserAvatar size={28} name={r.fromAvatar ?? r.from} type="user" />
          <Text numberOfLines={1} style={[a.flex_shrink, a.text_sm, a.font_semi_bold]}>
            {r.from}
          </Text>
          <ArrowRightIcon size="sm" style={t.atoms.text_contrast_medium} />
          <UserAvatar size={28} name={r.toAvatar ?? r.to} type="user" />
          <Text numberOfLines={1} style={[a.flex_1, a.text_sm, a.font_semi_bold]}>
            {r.to}
          </Text>
          <Text style={[a.text_sm, a.font_bold, tabular]}>{formatAmount(r.amount, r.currency, locale)}</Text>
        </View>
      ))}
    </View>
  )
}

/** A spending headline for one currency, then its split as ranked bars (or a table for screen readers' sake on request). */
export function SpendCard({
  currency,
  headline,
  caption,
  count,
  slices,
  locale,
  title,
  shareOf,
  isTable,
  testID,
}: {
  currency: string
  headline: bigint
  /** What the figure is: "Your share", "You paid", "Everyone's total". */
  caption: string
  count: number
  slices: Array<{key: string; label: string; value: bigint; count: number; color?: string}>
  locale: string
  /** The split's own title ("By category"). */
  title: string
  /** The whole the bars are a share of (percent labels); omitted when the bars are not parts of the headline. */
  shareOf?: bigint
  isTable: boolean
  testID: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Card testID={testID} title={caption} aside={currency}>
      <View style={[a.gap_2xs]}>
        <Text style={[a.text_3xl, a.font_bold, a.leading_tight, tabular]}>
          {formatAmount(headline, currency, locale)}
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {plural(count, {one: '# expense', other: '# expenses'})}
        </Text>
      </View>
      {slices.length > 1 || (slices.length === 1 && slices[0]!.value !== headline) ? (
        <View style={[a.gap_sm, a.pt_xs]}>
          <Text style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>{title}</Text>
          {isTable ? (
            <DataTable
              testID={`${testID}-table`}
              columns={[title, l`Amount`]}
              rows={slices.map(s => ({key: s.key, cells: [s.label, formatAmount(s.value, currency, locale)]}))}
            />
          ) : (
            <HBarList
              testID={`${testID}-chart`}
              currency={currency}
              locale={locale}
              shareOf={shareOf}
              bars={slices.map(s => ({key: s.key, value: s.value, label: s.label, color: s.color}))}
            />
          )}
        </View>
      ) : null}
    </Card>
  )
}

/** A spending trend for one currency as the Analytics bar chart, or its table. */
export function TrendCard({
  currency,
  caption,
  total,
  points,
  locale,
  isTable,
  testID,
}: {
  currency: string
  caption: string
  total: bigint
  points: Point[]
  locale: string
  isTable: boolean
  testID: string
}) {
  const {t: l} = useLingui()
  return (
    <Card testID={testID} title={caption} aside={currency}>
      <Text style={[a.text_2xl, a.font_bold, a.leading_tight, tabular]}>{formatAmount(total, currency, locale)}</Text>
      {isTable ? (
        <DataTable
          testID={`${testID}-table`}
          columns={[l`Period`, l`Amount`]}
          rows={points.filter(p => p.value !== ZERO).map(p => ({key: p.key, cells: [p.label, formatAmount(p.value, currency, locale)]}))}
        />
      ) : (
        <BarChart testID={`${testID}-chart`} points={points} currency={currency} locale={locale} height={170} />
      )}
    </Card>
  )
}

/** Matching expenses: title, date and group, the amount in its own currency. */
export function ExpenseList({
  rows,
  locale,
  testID,
  onOpen,
}: {
  rows: Array<{id: string; title: string; byline: string; currency: string; total: bigint}>
  locale: string
  testID: string
  onOpen: (id: string) => void
}) {
  const t = useTheme()
  return (
    <View testID={testID} style={[a.rounded_md, a.border, t.atoms.border_contrast_low, a.overflow_hidden]}>
      {rows.map((r, i) => (
        <Button
          key={r.id}
          testID={`ask-found-${r.id}`}
          label={r.title}
          onPress={() => onOpen(r.id)}>
          {({hovered, pressed, focused}) => (
            <View
              style={[
                a.flex_1,
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.px_md,
                a.py_sm,
                i > 0 && [a.border_t, t.atoms.border_contrast_low],
                (hovered || pressed || focused) && t.atoms.bg_contrast_25,
              ]}>
              <View style={[a.flex_1]}>
                <Text numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
                  {r.title}
                </Text>
                <Text numberOfLines={1} style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {r.byline}
                </Text>
              </View>
              <Text style={[a.text_md, a.font_bold, tabular]}>{formatAmount(r.total, r.currency, locale)}</Text>
              <ChevronIcon size="sm" style={t.atoms.text_contrast_low} />
            </View>
          )}
        </Button>
      ))}
    </View>
  )
}

/** A step the answer suggests: opens the normal sheet or page; nothing is written until it is confirmed there. */
export function ActionCard({
  title,
  subtitle,
  onPress,
  testID,
  tone = 'primary',
}: {
  title: string
  subtitle?: string
  onPress: () => void
  testID: string
  tone?: 'primary' | 'secondary'
}) {
  const t = useTheme()
  return (
    <Button testID={testID} label={subtitle ? `${title}. ${subtitle}` : title} onPress={onPress}>
      {({hovered, pressed, focused}) => (
        <View
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.rounded_md,
            a.border,
            a.px_md,
            a.py_sm,
            tone === 'primary' ? {borderColor: t.palette.primary_500} : t.atoms.border_contrast_medium,
            (hovered || pressed || focused) && t.atoms.bg_contrast_25,
          ]}>
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text style={[a.text_md, a.font_bold, tone === 'primary' && {color: t.palette.primary_500}]}>{title}</Text>
            {subtitle ? <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>{subtitle}</Text> : null}
          </View>
          <ChevronIcon size="sm" style={t.atoms.text_contrast_medium} />
        </View>
      )}
    </Button>
  )
}

/** A tappable suggested question, as the empty state and "try this" lines show them. */
export function QuestionChip({text, onPress, testID}: {text: string; onPress: () => void; testID?: string}) {
  const t = useTheme()
  return (
    <Button testID={testID} label={text} onPress={onPress}>
      {({hovered, pressed, focused}) => (
        <View
          style={[
            a.rounded_full,
            a.border,
            a.px_md,
            a.py_sm,
            t.atoms.border_contrast_medium,
            (hovered || pressed || focused) ? t.atoms.bg_contrast_25 : t.atoms.bg,
          ]}>
          <Text style={[a.text_sm, a.font_semi_bold, a.leading_snug]}>{text}</Text>
        </View>
      )}
    </Button>
  )
}

