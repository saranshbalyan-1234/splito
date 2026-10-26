import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude} from '@splito/domain'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {BalanceText} from '#/components/BalanceText'
import {Button, ButtonText} from '#/components/Button'
import {BarChart} from '#/components/charts/BarChart'
import {ChartCard} from '#/components/charts/ChartCard'
import {DataTable} from '#/components/charts/DataTable'
import {DonutChart} from '#/components/charts/DonutChart'
import {HBarList} from '#/components/charts/HBarList'
import {LineChart} from '#/components/charts/LineChart'
import {percentOf} from '#/components/charts/scale'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {DIRECT_KEY, type Report} from '#/screens/Analytics/useReport'

/** Two half-width cards per row on desktop, one per row below that. */
const HALF = {flexGrow: 1, flexShrink: 1, flexBasis: 480, minWidth: 0}
const FULL = {flexBasis: '100%' as const}
const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * Every chart for the current filter, or their tables when `isTable`. Each
 * chart's bars, slices and rows select what the expense list below shows.
 */
export function Charts({
  report,
  locale,
  isTable,
}: {
  report: Report
  locale: string
  isTable: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtTablet} = useBreakpoints()
  const {currency, totals, selection, select, granularity} = report
  const money = (v: bigint) => formatAmount(v, currency, locale)
  const pct = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })
  const count = (n: number) => new Intl.NumberFormat(locale).format(n)

  if (totals.count === 0) {
    return (
      <View
        testID="analytics-period-empty"
        style={[
          a.mx_lg,
          a.my_md,
          a.p_2xl,
          a.gap_md,
          a.align_center,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
          <Trans>
            No {currency} expenses in {report.periodLabel}
          </Trans>
        </Text>
        <Text style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
          <Trans>
            Try another period, or see everything you have recorded.
          </Trans>
        </Text>
        {report.period !== 'all' && (
          <Button
            testID="analytics-show-all"
            label={l`Show all time`}
            size="small"
            color="secondary"
            onPress={() => report.setPeriod('all')}>
            <ButtonText>
              <Trans>Show all time</Trans>
            </ButtonText>
          </Button>
        )}
      </View>
    )
  }

  const perBucket = {
    day: l`Your share each day`,
    week: l`Your share each week`,
    month: l`Your share each month`,
    year: l`Your share each year`,
  }[granularity]
  const trendNote = {
    day: l`Your net balance at the end of each day, all friends together`,
    week: l`Your net balance at the end of each week, all friends together`,
    month: l`Your net balance at the end of each month, all friends together`,
    year: l`Your net balance at the end of each year, all friends together`,
  }[granularity]
  const balanceWords = (v: bigint) =>
    v > 0n
      ? l`Owed to you ${money(v)}`
      : v < 0n
        ? l`You owe ${money(magnitude(v))}`
        : l`Settled up`

  const timePoints = report.overTime.map(b => ({
    key: b.key,
    value: b.share,
    axisLabel: b.axisLabel,
    label: b.label,
  }))
  const slices = report.byCategory.map(c => {
    const cat = report.category(c.key)
    return {key: c.key, value: c.share, color: cat.color, label: cat.name}
  })
  const people = report.byPerson.map(p => ({
    key: p.key,
    value: p.share,
    label: report.nameOfPerson(p.key),
    count: p.count,
  }))
  const groups = report.byGroup.map(g => ({
    key: g.key ?? DIRECT_KEY,
    groupId: g.key,
    value: g.share,
    label: report.nameOfGroup(g.key),
    count: g.count,
  }))
  const lastBalance = report.trend.at(-1)?.balance ?? 0n

  return (
    <View style={[a.flex_row, a.flex_wrap, a.gap_md, a.px_lg, a.py_md]}>
      <ChartCard
        testID="analytics-over-time"
        title={l`Spending over time`}
        subtitle={perBucket}
        style={FULL}>
        {isTable ? (
          <DataTable
            testID="analytics-over-time-table"
            columns={[l`Period`, l`Your share`, l`You paid`, l`Expenses`]}
            rows={report.overTime.map(b => ({
              key: b.key,
              cells: [b.label, money(b.share), money(b.paid), count(b.count)],
            }))}
          />
        ) : (
          <BarChart
            testID="analytics-over-time-chart"
            points={timePoints}
            currency={currency}
            locale={locale}
            selectedKey={selection?.kind === 'time' ? selection.key : undefined}
            onSelect={key => {
              const b = report.overTime.find(x => x.key === key)
              select(
                b
                  ? {
                      kind: 'time',
                      key: b.key,
                      from: b.from,
                      to: b.to,
                      label: b.label,
                    }
                  : null,
              )
            }}
          />
        )}
      </ChartCard>

      {slices.length > 0 && (
        <ChartCard
          testID="analytics-by-category"
          title={l`By category`}
          subtitle={l`Your share of each category`}
          style={HALF}>
          {isTable ? (
            <DataTable
              testID="analytics-by-category-table"
              columns={[l`Category`, l`Your share`, l`Of total`, l`Expenses`]}
              rows={report.byCategory.map(c => ({
                key: c.key,
                cells: [
                  report.category(c.key).name,
                  money(c.share),
                  pct.format(percentOf(c.share, totals.share) / 100),
                  count(c.count),
                ],
              }))}
            />
          ) : (
            <DonutChart
              testID="analytics-by-category-chart"
              slices={slices}
              total={totals.share}
              caption={l`Your share`}
              currency={currency}
              locale={locale}
              isWide={gtTablet}
              selectedKey={
                selection?.kind === 'category' ? selection.key : undefined
              }
              onSelect={key => {
                const s = slices.find(x => x.key === key)
                select(
                  s ? {kind: 'category', key: s.key, label: s.label} : null,
                )
              }}
            />
          )}
        </ChartCard>
      )}

      <ChartCard
        testID="analytics-paid-vs-share"
        title={l`Paid vs your share`}
        subtitle={l`What you paid for everyone, against what was yours`}
        style={HALF}>
        <View style={a.gap_2xs}>
          <Text
            testID="analytics-covered"
            style={[a.text_2xl, a.font_bold, a.leading_tight, tabular]}>
            {money(magnitude(totals.covered))}
          </Text>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {totals.covered > 0n ? (
              <Trans>you paid for others, beyond your share</Trans>
            ) : totals.covered < 0n ? (
              <Trans>of your share was paid by others</Trans>
            ) : (
              <Trans>You paid exactly your share.</Trans>
            )}
          </Text>
        </View>
        {isTable ? (
          <DataTable
            testID="analytics-paid-vs-share-table"
            columns={[l`Measure`, l`Amount`]}
            rows={[
              {key: 'paid', cells: [l`You paid`, money(totals.paid)]},
              {key: 'share', cells: [l`Your share`, money(totals.share)]},
            ]}
          />
        ) : (
          <HBarList
            testID="analytics-paid-vs-share-chart"
            currency={currency}
            locale={locale}
            bars={[
              {key: 'paid', value: totals.paid, label: l`You paid`},
              {
                key: 'share',
                value: totals.share,
                label: l`Your share`,
                color: t.palette.primary_300,
              },
            ]}
          />
        )}
      </ChartCard>

      {people.length > 0 && (
        <ChartCard
          testID="analytics-by-person"
          title={l`By person`}
          subtitle={l`Everyone’s share of these expenses`}
          style={HALF}>
          {isTable ? (
            <DataTable
              testID="analytics-by-person-table"
              columns={[l`Person`, l`Share`, l`Expenses`]}
              rows={people.map(p => ({
                key: p.key,
                cells: [p.label, money(p.value), count(p.count)],
              }))}
            />
          ) : (
            <HBarList
              testID="analytics-by-person-chart"
              currency={currency}
              locale={locale}
              bars={people.map(p => ({
                ...p,
                leading: <UserAvatar size={24} name={p.label} type="user" />,
              }))}
              selectedKey={
                selection?.kind === 'person' ? selection.key : undefined
              }
              onSelect={key => {
                const p = people.find(x => x.key === key)
                select(p ? {kind: 'person', key: p.key, label: p.label} : null)
              }}
            />
          )}
        </ChartCard>
      )}

      {!report.groupId && groups.length > 0 && (
        <ChartCard
          testID="analytics-by-group"
          title={l`By group`}
          subtitle={l`Your share in each group`}
          style={HALF}>
          {isTable ? (
            <DataTable
              testID="analytics-by-group-table"
              columns={[l`Group`, l`Your share`, l`Expenses`]}
              rows={groups.map(g => ({
                key: g.key || 'direct',
                cells: [g.label, money(g.value), count(g.count)],
              }))}
            />
          ) : (
            <HBarList
              testID="analytics-by-group-chart"
              currency={currency}
              locale={locale}
              bars={groups}
              selectedKey={
                selection?.kind === 'group' ? selection.key : undefined
              }
              onSelect={key => {
                const g = groups.find(x => x.key === key)
                select(
                  g
                    ? {
                        kind: 'group',
                        key: g.key,
                        groupId: g.groupId,
                        label: g.label,
                      }
                    : null,
                )
              }}
            />
          )}
        </ChartCard>
      )}

      <ChartCard
        testID="analytics-trend"
        title={l`Balance over time`}
        subtitle={trendNote}
        aside={
          <BalanceText
            testID="analytics-trend-latest"
            amount={lastBalance}
            currency={currency}
            locale={locale}
            subject="group"
            style={a.text_right}
          />
        }
        style={FULL}>
        {isTable ? (
          <DataTable
            testID="analytics-trend-table"
            columns={[l`Period`, l`Balance`]}
            rows={report.trend.map(b => ({
              key: b.key,
              cells: [b.label, balanceWords(b.balance)],
            }))}
          />
        ) : (
          <LineChart
            testID="analytics-trend-chart"
            points={report.trend.map(b => ({
              key: b.key,
              value: b.balance,
              axisLabel: b.axisLabel,
              label: b.label,
            }))}
            currency={currency}
            locale={locale}
            format={balanceWords}
          />
        )}
      </ChartCard>
    </View>
  )
}

/** Loading shape of the chart grid. */
export function ChartsPlaceholder() {
  const t = useTheme()
  const card = (style: object, height: number, key: string) => (
    <View
      key={key}
      style={[
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        a.p_lg,
        a.gap_lg,
        style,
      ]}>
      <View style={a.gap_xs}>
        <Skeleton.Text style={[a.text_md, {width: 160}]} />
        <Skeleton.Text style={[a.text_sm, {width: 220}]} />
      </View>
      <Skeleton.Block style={[a.rounded_sm, {height}]} />
    </View>
  )
  return (
    <View style={[a.flex_row, a.flex_wrap, a.gap_md, a.px_lg, a.py_md]}>
      {card(FULL, 220, 'time')}
      {card(HALF, 184, 'category')}
      {card(HALF, 184, 'paid')}
    </View>
  )
}
