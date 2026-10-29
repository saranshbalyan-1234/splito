import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount} from '@splito/domain'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon,
  ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeftIcon,
  ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon,
} from '#/components/icons/Chevron'
import * as Menu from '#/components/Menu'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'
import {RangeDialog} from '#/screens/Analytics/components/RangeDialog'
import {type PeriodChoice, type Report} from '#/screens/Analytics/useReport'

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

/**
 * The period control: step back and forward, or open the label to pick the kind of period. It sits in the
 * filter row with currency and scope, so every filter is on one line (owner 171).
 */
export function PeriodControl({report}: {report: Report}) {
  const {t: l} = useLingui()
  const canStep = report.period !== 'all' && report.period !== 'custom'
  return (
    <View style={[a.flex_row, a.align_center, a.gap_2xs]}>
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
      <PeriodMenu report={report} />
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
  )
}

/** The period's name as a menu: week, month, year, all time or a custom range. */
function PeriodMenu({report}: {report: Report}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const rangeControl = Dialog.useDialogControl({url: 'range'})
  const periods: Array<{
    value: Exclude<PeriodChoice, 'custom'>
    label: string
  }> = [
    {value: 'week', label: l`Week`},
    {value: 'month', label: l`Month`},
    {value: 'year', label: l`Year`},
    {value: 'all', label: l`All time`},
  ]
  const periodName =
    report.period === 'custom'
      ? l`Custom range`
      : periods.find(p => p.value === report.period)!.label

  return (
    <>
      <Menu.Root>
        <Menu.Trigger label={l`Period: ${periodName}, ${report.periodLabel}`}>
          {({props, state, control}) => (
            <Button
              testID="analytics-period"
              {...props}
              label={props.accessibilityLabel}
              size="small"
              variant="ghost"
              color="secondary"
              style={[
                a.px_sm,
                (state.hovered || state.pressed || control.isOpen) &&
                  t.atoms.bg_contrast_50,
              ]}>
              <Text
                testID="analytics-period-label"
                style={[a.text_lg, a.font_semi_bold, a.leading_snug]}>
                {report.periodLabel}
              </Text>
              <ButtonIcon icon={ChevronDownIcon} size="sm" />
            </Button>
          )}
        </Menu.Trigger>
        <Menu.Outer>
          <Menu.Group>
            {periods.map(p => (
              <Menu.Item
                key={p.value}
                testID={`analytics-period-${p.value}`}
                label={p.label}
                onPress={() => report.setPeriod(p.value)}>
                <Menu.ItemText>{p.label}</Menu.ItemText>
                <Menu.ItemRadio selected={report.period === p.value} />
              </Menu.Item>
            ))}
          </Menu.Group>
          <Menu.Divider />
          <Menu.Group>
            <Menu.Item
              testID="analytics-period-custom"
              label={l`Custom range…`}
              onPress={() => rangeControl.open()}>
              <Menu.ItemText>
                <Trans>Custom range…</Trans>
              </Menu.ItemText>
              <Menu.ItemRadio selected={report.period === 'custom'} />
            </Menu.Item>
          </Menu.Group>
        </Menu.Outer>
      </Menu.Root>
      <RangeDialog
        control={rangeControl}
        initial={report.customRange}
        today={report.today}
        weekStart={report.weekStart}
        onApply={report.setCustom}
      />
    </>
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
        {/* Shares of the row, never fixed widths: three 120 px columns plus gaps overflowed a 390 px screen and widened the page (the fixed bottom bar slipped below the fold). */}
        {[0, 1, 2].map(i => (
          <View key={i} style={[a.flex_1, a.gap_xs, {minWidth: 0}]}>
            <Skeleton.Text style={[a.text_sm, {width: '60%'}]} />
            <Skeleton.Text style={[a.text_md, {width: '85%'}]} />
          </View>
        ))}
      </View>
    </View>
  )
}
