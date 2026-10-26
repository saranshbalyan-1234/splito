import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {formatAmount, type ReportExpense, reportCsv} from '@splito/domain'

import {
  HIDING_HEADER_HEIGHT,
  HidingHeader,
  HomeHeaderModeProvider,
  MainScrollProvider,
} from '#/lib/MainScrollProvider'
import {type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {usePref} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Layout from '#/components/Layout'
import {NotificationsBell} from '#/components/NotificationsBell'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {Charts, ChartsPlaceholder} from '#/screens/Analytics/components/Charts'
import {
  ExpenseRow,
  ExpenseRowPlaceholder,
} from '#/screens/Analytics/components/ExpenseRow'
import {FilterBar} from '#/screens/Analytics/components/FilterBar'
import {
  Summary,
  SummaryPlaceholder,
} from '#/screens/Analytics/components/Summary'
import {exportCsv} from '#/screens/Analytics/exportCsv'
import {type Report, useReport} from '#/screens/Analytics/useReport'
import {SectionHeader} from '#/screens/People/components/SectionHeader'

const PLACEHOLDER_ROWS = 4

/**
 * Analytics: one filter bar (period, currency, group, Include groups) drives
 * the headline totals, every chart, the list of the expenses behind them and
 * the CSV export, so the numbers agree everywhere. Tapping a bar, slice or
 * row narrows the list to it. Charts switch to tables for screen readers.
 */
export function AnalyticsScreen() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {gtMobile} = useBreakpoints()
  const report = useReport()
  const [view = 'charts', setView] = usePref('analyticsView')
  const isTable = view === 'table'
  const exportRows = useExportRows()

  return (
    <Layout.Screen testID="screen-analytics">
      <HomeHeaderModeProvider>
        <HidingHeader>
          <Layout.Header.Outer>
            {/* Empty slots as wide as the action, bell and avatar on the right, so the title stays centred. */}
            <Layout.Header.Slot />
            <Layout.Header.Slot />
            <Layout.Header.Slot />
            <Layout.Header.Content>
              <Layout.Header.TitleText>
                <Trans>Analytics</Trans>
              </Layout.Header.TitleText>
            </Layout.Header.Content>
            <Layout.Header.IconButton
              testID="analytics-export"
              icon={DownloadIcon}
              label={l`Export CSV`}
              disabled={!report || report.rows.length === 0}
              onPress={() => report && void exportRows(report)}
            />
            <NotificationsBell />
            <HeaderAvatar />
          </Layout.Header.Outer>
        </HidingHeader>
        {!report ? (
          <Shimmer
            testID="analytics-loading"
            style={!gtMobile && {paddingTop: HIDING_HEADER_HEIGHT}}>
            <SummaryPlaceholder />
            <ChartsPlaceholder />
            {Array.from({length: PLACEHOLDER_ROWS}, (_, i) => (
              <ExpenseRowPlaceholder key={i} />
            ))}
          </Shimmer>
        ) : !report.hasExpenses ? (
          <EmptyState
            style={!gtMobile && {paddingTop: HIDING_HEADER_HEIGHT}}
            testID="analytics-empty"
            illustration="empty-analytics"
            message={l`Your spending shows up here – by month, category, person and group – once you add an expense.`}
            button={{
              label: l({message: 'Add expense', context: 'action'}),
              text: l({message: 'Add expense', context: 'action'}),
              icon: PlusIcon,
              onPress: () => navigation.navigate('AddExpense', {}),
              size: 'small',
              color: 'secondary',
            }}
          />
        ) : (
          <LayoutAnimationConfig skipEntering skipExiting>
            <MainScrollProvider>
              <List
                headerOffset={gtMobile ? undefined : HIDING_HEADER_HEIGHT}
                data={report.rows}
                keyExtractor={(e: ReportExpense) => e.id}
                renderItem={({item}: {item: ReportExpense}) => (
                  <ExpenseRow
                    expense={item}
                    shareOf={report.shareOf}
                    shareLabel={
                      report.shareOf === report.me
                        ? l`Your share`
                        : l`${report.nameOfPerson(report.shareOf)}’s share`
                    }
                    category={report.category(item.category ?? 'other')}
                    groupName={
                      item.groupId ? report.nameOfGroup(item.groupId) : null
                    }
                    locale={locale}
                  />
                )}
                ListHeaderComponent={
                  <>
                    <FilterBar
                      report={report}
                      isTable={isTable}
                      onToggleView={() =>
                        void setView(isTable ? 'charts' : 'table')
                      }
                    />
                    <Summary report={report} locale={locale} />
                    <Charts report={report} locale={locale} isTable={isTable} />
                    {report.totals.count > 0 && (
                      <ExpensesHeader report={report} locale={locale} />
                    )}
                  </>
                }
                ListFooterComponent={
                  !gtMobile ? <View style={{height: 100}} /> : undefined
                }
              />
            </MainScrollProvider>
          </LayoutAnimationConfig>
        )}
      </HomeHeaderModeProvider>
    </Layout.Screen>
  )
}

/* "Expenses", and the active chart selection as a clearable chip. */
function ExpensesHeader({report, locale}: {report: Report; locale: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {selection, rows, currency} = report

  return (
    <View>
      <SectionHeader
        title={l`Expenses`}
        count={rows.length}
        testID="analytics-expenses-title"
      />
      {selection && (
        <View
          style={[
            a.flex_row,
            a.flex_wrap,
            a.align_center,
            a.gap_sm,
            a.px_lg,
            a.pb_md,
          ]}>
          <Button
            testID="analytics-selection"
            label={l`Clear filter: ${selection.label}`}
            size="small"
            color="primary_subtle"
            onPress={() => report.select(null)}>
            <ButtonText>{selection.label}</ButtonText>
            <ButtonIcon icon={XIcon} />
          </Button>
          <Text
            testID="analytics-selection-total"
            style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {report.shareOf === report.me ? (
              <Trans>
                Your share{' '}
                <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text]}>
                  {formatAmount(report.rowsTotal, currency, locale)}
                </Text>
              </Trans>
            ) : (
              <Trans>
                {report.nameOfPerson(report.shareOf)}’s share{' '}
                <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text]}>
                  {formatAmount(report.rowsTotal, currency, locale)}
                </Text>
              </Trans>
            )}
          </Text>
        </View>
      )}
    </View>
  )
}

/** The header's Export CSV: the rows on screen (filters and chart selection applied), as a file. */
function useExportRows() {
  const {t: l} = useLingui()
  return async (report: Report) => {
    const {rows, currency} = report
    const csv = reportCsv(rows, report.me, {
      header: [
        l`Date`,
        l`Description`,
        l`Category`,
        l`Group`,
        l`Currency`,
        l`Total`,
        l`You paid`,
        l`Your share`,
      ],
      categoryName: id => report.category(id).name,
      groupName: id => (id === null ? '' : report.nameOfGroup(id)),
    })
    const name = `splito-${currency}-${report.range.from}-to-${report.range.to}.csv`
    try {
      if (await exportCsv(name, csv)) {
        Toast.show(
          rows.length === 1
            ? l`Exported 1 expense`
            : l`Exported ${rows.length} expenses`,
          {type: 'success'},
        )
      }
    } catch {
      Toast.show(l`Couldn’t export. Try again.`, {type: 'error'})
    }
  }
}
