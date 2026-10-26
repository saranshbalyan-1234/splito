/* STUB-OWNER: analytics - placeholder route body until the analytics stream replaces this file. The header (avatar | Analytics | Export CSV + bell) is the shell's and stays. */
import {useLingui} from '@lingui/react/macro'

import {ChartPie_Stroke2_Corner0_Rounded as ChartPieIcon} from '#/components/icons/ChartPie'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import * as Layout from '#/components/Layout'
import {StubScreen} from '#/screens/StubScreen'

export function AnalyticsScreen() {
  const {t: l} = useLingui()
  return (
    <StubScreen
      testID="screen-analytics"
      title={l`Analytics`}
      canGoBack={false}
      icon={ChartPieIcon}
      action={
        <Layout.Header.ActionButton
          testID="analytics-export"
          label={l`Export CSV`}
          icon={DownloadIcon}
          // Nothing to export until the analytics stream lands.
          disabled
          hint={l`CSV export arrives with Analytics.`}
          onPress={() => {}}
        />
      }
    />
  )
}
