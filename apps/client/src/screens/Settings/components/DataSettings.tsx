import {View} from 'react-native'
import {resetAllPrefs} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'
import {useRoute} from '@react-navigation/native'

import {useHaptics} from '#/lib/haptics'
import {useHasLegacyStore} from '#/data/account'
import {useData} from '#/data/StoreProvider'
import {requestLegacyOffer} from '#/features/account/LegacyDataOffer'
import {useExportSheet} from '#/features/export/ExportSheet'
import {useImportSheet} from '#/features/export/ImportSheet'
import {useDemoMode} from '#/state/demo'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as ResetIcon} from '#/components/icons/ArrowRotate'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {FileExport_Stroke2_Corner0_Rounded as ExportIcon, Upload_Stroke2_Corner0_Rounded as ImportIcon} from '#/components/icons/Export'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * `/settings/data` (owner 205, "Your data"): Export, Import, Move this device's older data (while an old database
 * exists), Reset all settings and the deleted-items note. The Export and Import sheets live here, so their addresses
 * are `/settings/data/export` and `/settings/data/import`.
 */
export function DataSettings() {
  const {t: l} = useLingui()
  const t = useTheme()
  const {store, ctx} = useData()
  const haptics = useHaptics()
  const resetPrompt = Prompt.usePromptControl()
  const hasLegacyStore = useHasLegacyStore()
  const {demo: isDemo} = useDemoMode()
  const note = (useRoute().params as {note?: string} | undefined)?.note
  const exportSheet = useExportSheet()
  const importSheet = useImportSheet()
  return (
    <>
      {note === 'deleted-stay' && (
        <View testID="settings-deleted-note" style={[a.flex_row, a.gap_sm, a.px_xl, a.pb_sm]}>
          <InfoIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
          <Text style={[a.flex_1, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>Deleted items now stay in their lists.</Trans>
          </Text>
        </View>
      )}
      {/* F-2007 and F-2001: CSV, PDF and the full JSON backup out; a backup back in. */}
      <SettingsList.PressableItem testID="settings-export" label={l`Export`} onPress={exportSheet.open}>
        <SettingsList.ItemIcon icon={ExportIcon} />
        <SettingsList.ItemText>
          <Trans>Export</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      <SettingsList.PressableItem testID="settings-import" label={l`Import`} onPress={importSheet.open}>
        <SettingsList.ItemIcon icon={ImportIcon} />
        <SettingsList.ItemText>
          <Trans>Import</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      {/* F-2104: while the pre-account database exists, ask again (the one-time offer after sign-in may have been put off). */}
      {hasLegacyStore && !isDemo && (
        <SettingsList.PressableItem testID="settings-move-legacy" label={l`Move this device’s older data`} onPress={requestLegacyOffer}>
          <SettingsList.ItemIcon icon={ImportIcon} />
          <SettingsList.ItemText>
            <Trans>Move this device’s older data</Trans>
          </SettingsList.ItemText>
        </SettingsList.PressableItem>
      )}
      <SettingsList.PressableItem testID="settings-reset-all" destructive label={l`Reset all settings`} onPress={() => resetPrompt.open()}>
        <SettingsList.ItemIcon icon={ResetIcon} />
        <SettingsList.ItemText>
          <Trans>Reset all settings</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>

      {exportSheet.element}
      {importSheet.element}
      <Prompt.Basic
        control={resetPrompt}
        title={l`Reset all settings?`}
        description={l`Theme, tabs, categories, language and every other setting go back to how Splito starts. Your people, groups and expenses stay as they are.`}
        confirmButtonCta={l`Reset all`}
        confirmButtonColor="negative"
        onConfirm={() => {
          resetAllPrefs(store, ctx).then(
            () => {
              haptics.success()
              Toast.show(l`Settings reset`)
            },
            () => Toast.show(l`Couldn’t reset settings. Please try again.`, {type: 'error'}),
          )
        }}
      />
    </>
  )
}
