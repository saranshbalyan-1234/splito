import {useState} from 'react'
import {Pressable, View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type CurrencyTotal,
  formatAmount,
  getCurrency,
  magnitude,
  ZERO,
} from '@splito/domain'

import {atoms as a, useAlf, useBreakpoints, useTheme} from '#/alf'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {MoneyArrow, useMoneyStyle} from '#/components/MoneyDirection'
import {AnimatedAmount} from '#/motion/AnimatedAmount'
import {usePressScale} from '#/motion/PressableScale'
import {amountSize, overviewColumns} from './overviewGrid'
import {SectionHeader} from '#/components/SectionHeader'

const tabular = {fontVariant: ['tabular-nums' as const]}

const GAP = 8
/* Card padding (14) and border (1) either side: what the figure's room is measured from. */
const CARD_CHROME = 30
/* The direction arrow and its gap, beside the figure. */
const ARROW_ROOM = 28
/* The label and currency chip on the card's left ("You are owed" + "INR"), which the figure leaves room for. */
const LEFT_ROOM = 124

/**
 * The Overview (owners 198, 219): balances right now, at the top of People, Groups and Analytics; it ignores any
 * period or currency filter. One separate compact card per currency (own border, radius and padding) in a
 * balanced grid whose column count comes from the measured width (ARCHITECTURE 26.12, owners 113/114, 156-161),
 * the counts as plain text under the grid. Currencies are never added together. A card opens the rest of Analytics
 * in its currency (`onCurrencyPress`).
 */
export function Overview({
  totals,
  locale,
  counts,
  title,
  onCurrencyPress,
  captions = {},
  testID = 'analytics-overview',
  titleTestID = 'analytics-overview-title',
}: {
  totals: CurrencyTotal[]
  locale: string
  /** "6 friends · 2 settled", the plain line under the grid. */
  counts: string
  /** The heading; "Balances right now" when absent. */
  title?: string
  /** A card was pressed: opens Analytics (or narrows it) to this currency. */
  onCurrencyPress: (currency: string) => void
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

  return (
    <View testID={testID}>
      <SectionHeader
        testID={titleTestID}
        title={title ?? l`Balances right now`}
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
                onPress={() => onCurrencyPress(total.currency)}
                width={cardWidth}
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

/**
 * One currency (owners 156-161): line 1 is the label and the currency chip on the left and the NET on the right,
 * large, with its arrow (the only coloured figure); when both directions are open, "Owed to you" and "You owe"
 * follow on the left, small, in the normal text colours; the count line ends the card. About 64-96 px tall.
 */
export function SummaryCard({
  total,
  locale,
  caption,
  onPress,
  width,
}: {
  total: CurrencyTotal
  locale: string
  caption: string | undefined
  onPress: () => void
  /** Px, from the grid's measured width; undefined until measured (one full-width column). */
  width: number | undefined
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
  /* The figure shrinks to fit what the label leaves, down to text_lg, then wraps: never ellipsized. */
  const size = amountSize(
    figure,
    (width ?? 288) - CARD_CHROME - ARROW_ROOM - LEFT_ROOM,
    gtMobile ? 'text_3xl' : 'text_2xl',
    fonts.scaleMultiplier,
  )
  const subStyle = [a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]

  return (
    <Animated.View
      testID={`summary-${currency}-card`}
      style={[
        width === undefined ? a.w_full : {width},
        a.rounded_md,
        a.border,
        a.overflow_hidden,
        t.atoms.border_contrast_low,
        press.style,
      ]}>
      <Pressable
        testID={`summary-${currency}`}
        accessibilityRole="button"
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        accessibilityLabel={l`${getCurrency(currency).name} balance - show in analytics`}
        accessibilityHint=""
        style={[a.flex_1, a.px_md, {paddingVertical: 10}]}>
        <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
          <View style={[a.flex_row, a.align_center, a.gap_sm, a.flex_shrink_0]}>
            <Text
              testID={`summary-${currency}-label`}
              style={[a.text_sm, a.font_medium, t.atoms.text_contrast_medium]}>
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
          {/* The net, right-aligned with its arrow: the only coloured figure on the card. */}
          <View
            testID={`summary-${currency}-net-box`}
            style={[a.flex_row, a.align_center, a.justify_end, a.gap_xs, a.flex_shrink, {minWidth: 0}]}>
            <MoneyArrow amount={net} size={gtMobile ? 'lg' : 'md'} />
            <View style={[a.flex_shrink, {minWidth: 0}]}>
              <AnimatedAmount
                testID={`summary-${currency}-net`}
                minor={magnitude(net)}
                currency={currency}
                locale={locale}
                style={[a[size], a.font_bold, a.leading_tight, a.text_right, money.style(net)]}
              />
            </View>
          </View>
        </View>
        {/* Both sides only when both are open; plain text colours, never coloured. */}
        {isBoth && (
          <View style={[a.pt_2xs, a.gap_2xs]}>
            <Text testID={`summary-${currency}-owed`} style={subStyle}>
              <Trans>
                Owed to you{' '}
                <Text style={[a.text_xs, a.font_semi_bold, t.atoms.text, tabular]}>
                  {formatAmount(owed, currency, locale)}
                </Text>
              </Trans>
            </Text>
            <Text testID={`summary-${currency}-owe`} style={subStyle}>
              <Trans>
                You owe{' '}
                <Text style={[a.text_xs, a.font_semi_bold, t.atoms.text, tabular]}>
                  {formatAmount(owe, currency, locale)}
                </Text>
              </Trans>
            </Text>
          </View>
        )}
        <Text testID={`summary-${currency}-caption`} style={[subStyle, a.pt_2xs]}>
          {caption ?? '\u00a0'}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

/** Loading shape of the summary. */
export function OverviewPlaceholder() {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View>
      <SectionHeader title={l`Balances right now`} />
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
