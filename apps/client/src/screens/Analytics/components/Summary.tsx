import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {
  ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeftIcon,
  ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon,
} from '#/components/icons/Chevron'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'
import {type Report} from '#/screens/Analytics/useReport'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * The headline: the period (stepping back and forward a week, month or
 * year), what you spent in it as the one big figure, and three supporting
 * figures. Every number is for the filter bar's currency only.
 */
export function Summary({report, locale}: {report: Report; locale: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {currency, totals} = report
  const canStep = report.period !== 'all' && report.period !== 'custom'

  const stat = (testID: string, label: string, value: string) => (
    <View style={[a.gap_2xs]}>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {label}
      </Text>
      <Text
        testID={testID}
        style={[a.text_md, a.font_semi_bold, a.leading_snug, tabular]}>
        {value}
      </Text>
    </View>
  )

  return (
    <View style={[a.px_lg, a.pt_md, a.pb_sm, a.gap_md]}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.gap_xs,
          canStep && {marginLeft: -8},
        ]}>
        {canStep && (
          <Button
            testID="analytics-prev"
            label={l`Previous period`}
            size="small"
            color="secondary"
            variant="ghost"
            shape="round"
            disabled={!report.canGoBack}
            onPress={() => report.step(-1)}>
            <ButtonIcon icon={ChevronLeftIcon} size="md" />
          </Button>
        )}
        <Text
          testID="analytics-period-label"
          style={[a.text_lg, a.font_semi_bold, a.leading_snug]}>
          {report.periodLabel}
        </Text>
        {canStep && (
          <Button
            testID="analytics-next"
            label={l`Next period`}
            size="small"
            color="secondary"
            variant="ghost"
            shape="round"
            disabled={!report.canGoForward}
            onPress={() => report.step(1)}>
            <ButtonIcon icon={ChevronRightIcon} size="md" />
          </Button>
        )}
      </View>
      <View style={a.gap_2xs}>
        <Text
          style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          <Trans>You spent</Trans>
        </Text>
        <AnimatedAmount
          testID="analytics-total-share"
          minor={totals.share}
          currency={currency}
          locale={locale}
          style={[a.text_5xl, a.font_bold, a.leading_tight]}
        />
      </View>
      <View style={[a.flex_row, a.flex_wrap, gtMobile ? a.gap_2xl : a.gap_lg]}>
        {stat(
          'analytics-total-paid',
          l`You paid`,
          formatAmount(totals.paid, currency, locale),
        )}
        {stat(
          'analytics-total-all',
          l`Total, everyone`,
          formatAmount(totals.total, currency, locale),
        )}
        {stat(
          'analytics-count',
          l`Expenses`,
          new Intl.NumberFormat(locale).format(totals.count),
        )}
      </View>
    </View>
  )
}

/** Loading shape of the summary. */
export function SummaryPlaceholder() {
  return (
    <View style={[a.px_lg, a.pt_lg, a.pb_sm, a.gap_md]}>
      <Skeleton.Text style={[a.text_md, {width: 120}]} />
      <View style={a.gap_xs}>
        <Skeleton.Text style={[a.text_sm, {width: 80}]} />
        <Skeleton.Text style={[a.text_5xl, {width: 260}]} />
      </View>
      <View style={[a.flex_row, a.gap_xl]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[a.gap_xs, {width: 120}]}>
            <Skeleton.Text style={[a.text_sm, {width: 70}]} />
            <Skeleton.Text style={[a.text_md, {width: 100}]} />
          </View>
        ))}
      </View>
    </View>
  )
}
