import {useState} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type CurrencyTotal,
  formatAmount,
  getCurrency,
  magnitude,
  ZERO,
} from '@splito/domain'

import {Link} from '#/view/com/util/Link'
import {atoms as a, useAlf, useBreakpoints, useTheme} from '#/alf'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {MoneyArrow, useMoneyStyle} from '#/components/MoneyDirection'
import {AnimatedAmount} from '#/motion/AnimatedAmount'
import {usePressScale} from '#/motion/PressableScale'
import {amountSize, overviewColumns} from '../overviewGrid'
import {SectionHeader} from './SectionHeader'

const tabular = {fontVariant: ['tabular-nums' as const]}

const GAP = 12
/* Card padding (16) and border (1) either side: what the figure's room is measured from. */
const CARD_CHROME = 34
/* The direction arrow and its gap, beside the figure. */
const ARROW_ROOM = 28

/**
 * The Overview at the top of People and Groups (owner: "add overview in
 * both friends and groups"): one separate card per currency (own border,
 * radius and padding) with the net balance, in a balanced grid whose column
 * count comes from the measured width (ARCHITECTURE 26.12, owners 113/114),
 * the counts as plain text under the grid, and Analytics on the heading's
 * right. Currencies are never added together. Each card opens Analytics too.
 */
export function BalanceSummary({
  totals,
  locale,
  counts,
  captions = {},
  testID = 'people-summary',
  titleTestID = 'people-balances-title',
}: {
  totals: CurrencyTotal[]
  locale: string
  /** "6 friends · 2 settled", the plain line under the grid. */
  counts: string
  /** Per currency, who the card's figure comes from ("5 friends"). */
  captions?: Record<string, string>
  testID?: string
  titleTestID?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [width, setWidth] = useState(0)
  const columns = overviewColumns(width, totals.length)
  const cardWidth =
    width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : undefined
  /* One card with both sides open gives every card the same sub-lines, so none is shorter or emptier. */
  const hasBoth = totals.some(x => x.owed !== ZERO && x.owe !== ZERO)

  return (
    <View testID={testID}>
      <SectionHeader
        testID={titleTestID}
        title={l`Overview`}
        action={<AnalyticsLink />}
      />
      <View style={[a.px_lg, a.pb_sm, a.gap_sm]}>
        <View
          /* A tab that is hidden measures 0: keep the last real width, so showing it again re-renders nothing (owner 166). */
          onLayout={e => e.nativeEvent.layout.width > 0 && setWidth(e.nativeEvent.layout.width)}
          style={[a.flex_row, a.flex_wrap, {gap: GAP}]}>
          {totals.length === 0 ? (
            <View
              testID="summary-settled"
              style={[
                a.flex_1,
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.px_lg,
                a.py_md,
                a.rounded_md,
                a.border,
                t.atoms.border_contrast_low,
              ]}>
              <CheckIcon size="md" fill={t.palette.positive_600} />
              <Text style={[a.flex_1, a.text_md, a.leading_snug]}>
                <Trans>You’re all settled up.</Trans>
              </Text>
            </View>
          ) : (
            totals.map(total => (
              <SummaryCard
                key={total.currency}
                total={total}
                locale={locale}
                caption={captions[total.currency]}
                width={cardWidth}
                hasBoth={hasBoth}
              />
            ))
          )}
        </View>
        {/* Plain text under the grid, not a strip inside a box. */}
        <Text
          testID={`${testID}-counts`}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {counts}
        </Text>
      </View>
    </View>
  )
}

/** "Analytics ›" on the Overview heading, as Bluesky's section headers link out. */
function AnalyticsLink() {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Link
      testID="overview-analytics"
      href="/analytics"
      title={l`Open Analytics`}
      accessibilityLabel={l`Open Analytics`}
      asAnchor
      anchorNoUnderline
      accessibilityHint=""
      hoverStyle={t.atoms.bg_contrast_25}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_2xs,
        a.rounded_full,
        a.pl_sm,
        a.pr_xs,
        a.py_xs,
        a.transition_color,
      ]}>
      <Text
        style={[a.text_sm, a.font_semi_bold, {color: t.palette.primary_500}]}>
        <Trans>Analytics</Trans>
      </Text>
      <ChevronIcon size="sm" fill={t.palette.primary_500} />
    </Link>
  )
}

function SummaryCard({
  total,
  locale,
  caption,
  width,
  hasBoth,
}: {
  total: CurrencyTotal
  locale: string
  caption: string | undefined
  /** Px, from the grid's measured width; undefined until measured (one full-width column). */
  width: number | undefined
  hasBoth: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {fonts} = useAlf()
  const {currency, owed, owe, net} = total
  const press = usePressScale()
  const money = useMoneyStyle()
  const isBoth = owed !== ZERO && owe !== ZERO
  const figure = formatAmount(magnitude(net), currency, locale)
  /* The figure shrinks to fit its card, down to text_lg, then wraps: never ellipsized. */
  const size = amountSize(
    figure,
    (width ?? 288) - CARD_CHROME - ARROW_ROOM,
    gtMobile ? 'text_3xl' : 'text_2xl',
    fonts.scaleMultiplier,
  )
  const subStyle = [a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]

  return (
    <Animated.View
      style={[
        width === undefined ? a.w_full : {width},
        a.rounded_md,
        a.border,
        a.overflow_hidden,
        t.atoms.border_contrast_low,
        press.style,
      ]}>
      <Link
        testID={`summary-${currency}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        href={`/analytics?currency=${currency}`}
        asAnchor
        anchorNoUnderline
        accessibilityLabel={l`${getCurrency(currency).name} balance - open analytics`}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[a.flex_1, a.px_lg, a.py_md, a.transition_color]}>
        <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
          <Text
            testID={`summary-${currency}-label`}
            style={[
              a.flex_1,
              a.text_sm,
              a.font_medium,
              t.atoms.text_contrast_medium,
            ]}>
            {net > ZERO ? (
              <Trans>You are owed</Trans>
            ) : net < ZERO ? (
              <Trans>You owe</Trans>
            ) : (
              <Trans>All settled up</Trans>
            )}
          </Text>
          {/* Which currency this card is: cards are never added together. */}
          <View
            style={[
              a.rounded_xs,
              a.px_xs,
              a.flex_shrink_0,
              {paddingVertical: 1},
              t.atoms.bg_contrast_50,
            ]}>
            <Text
              style={[
                a.text_2xs,
                a.font_semi_bold,
                {letterSpacing: 0.4},
                t.atoms.text_contrast_medium,
              ]}>
              {currency}
            </Text>
          </View>
        </View>
        <View style={[a.pt_2xs, a.flex_row, a.align_center, a.gap_xs]}>
          <MoneyArrow amount={net} size={gtMobile ? 'lg' : 'md'} />
          <View style={[a.flex_1, {minWidth: 0}]}>
            <AnimatedAmount
              testID={`summary-${currency}-net`}
              minor={magnitude(net)}
              currency={currency}
              locale={locale}
              style={[a[size], a.font_bold, a.leading_tight, money.style(net)]}
            />
          </View>
        </View>
        {/* Both sides only when both are open; otherwise the caption. Cards without them hold the same lines. */}
        {isBoth ? (
          <View style={[a.pt_xs, a.gap_2xs]}>
            <Text style={subStyle}>
              <Trans>
                Owed to you{' '}
                <Text
                  style={[a.text_xs, a.font_semi_bold, t.atoms.text, tabular]}>
                  {formatAmount(owed, currency, locale)}
                </Text>
              </Trans>
            </Text>
            <Text style={subStyle}>
              <Trans>
                You owe{' '}
                <Text
                  style={[a.text_xs, a.font_semi_bold, t.atoms.text, tabular]}>
                  {formatAmount(owe, currency, locale)}
                </Text>
              </Trans>
            </Text>
          </View>
        ) : (
          <View style={[a.pt_xs, a.gap_2xs]}>
            <Text testID={`summary-${currency}-caption`} style={subStyle}>
              {caption ?? '\u00a0'}
            </Text>
            {hasBoth && (
              <Text aria-hidden style={subStyle}>
                {'\u00a0'}
              </Text>
            )}
          </View>
        )}
      </Link>
    </Animated.View>
  )
}

/** Loading shape of the summary. */
export function BalanceSummaryPlaceholder() {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View>
      <SectionHeader title={l`Overview`} />
      <View style={[a.px_lg, a.pb_md]}>
        <View
          style={[
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_low,
            a.px_lg,
            a.py_md,
            a.gap_sm,
          ]}>
          <Skeleton.Text style={[a.text_sm, {width: 90}]} />
          <Skeleton.Text style={[a.text_3xl, {width: 180}]} />
          <Skeleton.Text style={[a.text_sm, {width: 220}]} />
        </View>
      </View>
    </View>
  )
}
