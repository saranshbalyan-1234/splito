import {useNavigation} from '@react-navigation/native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Deferred} from '#/components/Deferred'
import {Trans, useLingui} from '@lingui/react/macro'

import {useNumberLocale} from '#/locale/numberLocale'
import {usePref} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {ActivityLink} from '#/components/ActivityLink'
import {AddExpenseFABInset} from '#/components/AddExpenseFAB'
import {useExportSheet} from '#/features/export/ExportSheet'
import {SearchAskButton, SearchAskSpacer} from '#/components/SearchAsk/SearchAskButton'
import {HeaderAvatar} from '#/components/HeaderAvatar'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {TabScreen} from '#/components/TabScreen'
import {Text} from '#/components/Typography'
import {type NavigationProp} from '#/lib/routes/types'
import {Shimmer} from '#/motion/Shimmer'
import {Charts, ChartsPlaceholder} from '#/screens/Analytics/components/Charts'
import {FilterBar} from '#/screens/Analytics/components/FilterBar'
import {
  Summary,
  SummaryPlaceholder,
} from '#/screens/Analytics/components/Summary'
import {expensesPath} from '#/screens/Analytics/expensesPath'
import {useExportPreset} from '#/screens/Analytics/exportPreset'
import {type Report, useReport} from '#/screens/Analytics/useReport'

/* The page scrolls as the one `List` every tab uses (pull to refresh, the header that hides, the FAB inset); it has no rows. */
const NO_ROWS: string[] = []

/**
 * Analytics: one filter bar (period, currency, group, Include groups) drives
 * the headline totals, every chart and the Export sheet's starting filters, so the numbers agree
 * everywhere. It lists no expenses (owner 226): "See these expenses" and a tap on a bar, slice or
 * row open Activity on the expenses behind it. Charts switch to tables for screen readers.
 */
export function AnalyticsScreen() {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const locale = useNumberLocale()
  const report = useReport()
  const [view = 'charts', setView] = usePref('analyticsView')
  const isTable = view === 'table'
  /* The one Export sheet (Settings > Your data opens the same), starting on what Analytics shows (F-275). */
  const exportSheet = useExportSheet(useExportPreset(report), {isLoading: !report})

  return (
    <TabScreen testID="screen-analytics">
      <Layout.Header.Outer>
        <HeaderAvatar />
        {/* Balances Search & Ask on the right (start tab only, owner 218), so the title stays centred. */}
        <SearchAskSpacer tab="analytics" />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Analytics</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <SearchAskButton tab="analytics" />
        <Layout.Header.ActionButton
          testID="analytics-export"
          label={l`Export`}
          icon={DownloadIcon}
          edge
          disabled={!report}
          onPress={exportSheet.open}
        />
      </Layout.Header.Outer>
      {exportSheet.element}
      {/* Shell first (owner 152): the header paints at once, a skeleton while the data is missing, the charts and list mount after as a transition. */}
      <Deferred
        when={!!report}
        fallback={
        <>
        <Shimmer testID="analytics-loading">
          <SummaryPlaceholder />
          <ChartsPlaceholder />
        </Shimmer>
        </>
        }>
        {() => !report ? null : !report.hasExpenses ? (
        /* No expenses yet: the empty state (balances right now live on People and Groups, owner 221). */
        <List
          data={NO_ROWS}
          keyExtractor={(id: string) => id}
          renderItem={() => null}
          ListFooterComponent={
            <EmptyState
              testID="analytics-empty"
              illustration="empty-analytics"
              message={l`Your spending shows up here – by month, category, person and group – once you add an expense.`}
              /* The next step (owner 213): one small secondary button; the FAB stays the primary action (owner 146). */
              button={{
                testID: 'analytics-empty-add-expense',
                label: l`Add expense`,
                text: l`Add expense`,
                icon: PlusIcon,
                onPress: () => navigation.navigate('AddExpense', {}),
                size: 'small',
                color: 'secondary',
              }}
            />
          }
        />
      ) : (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            data={NO_ROWS}
            keyExtractor={(id: string) => id}
            renderItem={() => null}
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
                {/* Its own commit, a frame after the list (a 120 ms layout otherwise blocks the next tap); the chart placeholder holds the chart's height, the table view (another height) just waits empty. */}
                <Deferred sameSize={!isTable} fallback={<ChartsPlaceholder />}>
                  <Charts report={report} locale={locale} isTable={isTable} />
                </Deferred>
                {report.totals.count > 0 && <SeeExpensesLink report={report} />}
              </>
            }
            ListFooterComponent={<AddExpenseFABInset />}
          />
        </LayoutAnimationConfig>
        )}
      </Deferred>
    </TabScreen>
  )
}

/* The one way into the expenses behind the figures: Activity, pushed with Back, carrying the page's period, currency and scope (owner 226). */
function SeeExpensesLink({report}: {report: Report}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <ActivityLink
      testID="analytics-see-expenses"
      href={expensesPath(report)}
      label={l`See these expenses`}
      style={[a.mx_lg, a.mb_md, a.justify_between]}>
      <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
        <Trans>See these expenses</Trans>
      </Text>
      <ChevronRightIcon style={{width: 16, height: 16}} fill={t.atoms.text_contrast_medium.color} />
    </ActivityLink>
  )
}
