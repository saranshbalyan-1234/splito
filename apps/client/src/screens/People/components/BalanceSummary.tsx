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
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'
import {usePressScale} from '#/motion/PressableScale'
import {SectionHeader} from './SectionHeader'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * The top of People: one card holding a cell per currency with the net
 * balance (and both sides when both are open). Currencies are never added
 * together. Each cell opens Analytics. Cells sit side by side - two to a
 * row on phones - so the card stays one compact block above the list.
 */
export function BalanceSummary({
  totals,
  locale,
  title,
  testID = 'people-summary',
  titleTestID = 'people-balances-title',
}: {
  totals: CurrencyTotal[]
  locale: string
  /** Default "Balances"; Groups heads it "Across your groups". */
  title?: string
  testID?: string
  titleTestID?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <View testID={testID}>
      <SectionHeader testID={titleTestID} title={title ?? l`Balances`} />
      <View style={[a.px_lg, a.pb_md]}>
        <View
          style={[
            a.flex_row,
            a.flex_wrap,
            a.rounded_md,
            a.border,
            a.overflow_hidden,
            t.atoms.border_contrast_low,
          ]}>
          {totals.map((total, i) => (
            <SummaryCell
              key={total.currency}
              total={total}
              locale={locale}
              hasDivider={i > 0}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

function SummaryCell({
  total,
  locale,
  hasDivider,
}: {
  total: CurrencyTotal
  locale: string
  hasDivider: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {currency, owed, owe, net} = total
  const press = usePressScale()
  const netColor =
    net > ZERO
      ? t.palette.positive_600
      : net < ZERO
        ? t.palette.negative_500
        : t.atoms.text.color

  return (
    <Animated.View
      style={[
        {flexBasis: gtMobile ? 260 : 140, flexGrow: 1},
        hasDivider && [a.border_l, t.atoms.border_contrast_low],
        press.style,
      ]}>
      <Link
        testID={`summary-${currency}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        href="/analytics"
        asAnchor
        anchorNoUnderline
        accessibilityLabel={l`${getCurrency(currency).name} balance - open analytics`}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[a.h_full, a.px_lg, a.py_md, a.transition_color]}>
        <Text
          numberOfLines={1}
          style={[a.text_sm, a.font_medium, t.atoms.text_contrast_medium]}>
          {net > ZERO ? (
            <Trans>You are owed</Trans>
          ) : net < ZERO ? (
            <Trans>You owe</Trans>
          ) : (
            <Trans>All settled up</Trans>
          )}
        </Text>
        <View style={a.pt_2xs}>
          <AnimatedAmount
            testID={`summary-${currency}-net`}
            minor={magnitude(net)}
            currency={currency}
            locale={locale}
            style={[
              gtMobile ? a.text_3xl : a.text_2xl,
              a.font_bold,
              a.leading_tight,
              {color: netColor},
            ]}
          />
        </View>
        {/* Both sides only when both are open; otherwise they repeat the headline. */}
        {owed !== ZERO && owe !== ZERO && (
          <View style={[a.pt_xs, a.gap_2xs]}>
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>
                Owed to you{' '}
                <Text
                  style={[a.text_xs, a.font_semi_bold, t.atoms.text, tabular]}>
                  {formatAmount(owed, currency, locale)}
                </Text>
              </Trans>
            </Text>
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>
                You owe{' '}
                <Text
                  style={[a.text_xs, a.font_semi_bold, t.atoms.text, tabular]}>
                  {formatAmount(owe, currency, locale)}
                </Text>
              </Trans>
            </Text>
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
      <SectionHeader title={l`Balances`} />
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
