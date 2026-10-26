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

  /* One cell of the stat strip: label, figure, and a line saying what it counts. */
  const stat = (
    testID: string,
    label: string,
    value: string,
    hint: string,
    isFirst = false,
  ) =>
    gtMobile ? (
      <View
        style={[
          a.flex_1,
          a.gap_2xs,
          a.px_md,
          a.py_md,
          !isFirst && [a.border_l, t.atoms.border_contrast_low],
        ]}>
        <Text
          numberOfLines={1}
          style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          {label}
        </Text>
        <Text
          testID={testID}
          numberOfLines={1}
          style={[a.text_lg, a.font_bold, a.leading_snug, tabular]}>
          {value}
        </Text>
        <Text
          numberOfLines={2}
          style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
          {hint}
        </Text>
      </View>
    ) : (
      /* Phones: one stat per line, so no figure is ever cut short. */
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.gap_md,
          a.px_md,
          a.py_sm,
          !isFirst && [a.border_t, t.atoms.border_contrast_low],
        ]}>
        <View style={[a.flex_1]}>
          <Text
            numberOfLines={1}
            style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
            {hint}
          </Text>
        </View>
        <Text
          testID={testID}
          numberOfLines={1}
          style={[a.text_md, a.font_bold, a.leading_snug, tabular]}>
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
          <Trans>Your share of expenses</Trans>
        </Text>
        <AnimatedAmount
          testID="analytics-total-share"
          minor={totals.share}
          currency={currency}
          locale={locale}
          style={[a.text_5xl, a.font_bold, a.leading_tight]}
        />
      </View>
      <View
        style={[
          gtMobile && a.flex_row,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
          {maxWidth: 720},
        ]}>
        {stat(
          'analytics-total-paid',
          l`You paid`,
          formatAmount(totals.paid, currency, locale),
          l`Out of your pocket`,
          true,
        )}
        {stat(
          'analytics-total-all',
          l`Group total`,
          formatAmount(totals.total, currency, locale),
          l`Everyone’s shares`,
        )}
        {stat(
          'analytics-count',
          l`Expenses`,
          new Intl.NumberFormat(locale).format(totals.count),
          l`In this period`,
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
