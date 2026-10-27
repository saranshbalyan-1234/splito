import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {install, usePwa} from '#/lib/pwa'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * Settings > "Install app" (F-1901): the browser's install prompt where it
 * gave us one, the Home Screen steps on iPhone and iPad. Absent where there
 * is nothing to install: native, an installed app, browsers without a prompt.
 */
export function InstallAppItem() {
  const {t: l} = useLingui()
  const t = useTheme()
  const haptics = useHaptics()
  const {installKind, isStandalone} = usePwa()
  if (installKind === null || isStandalone) return null
  return (
    <SettingsList.PressableItem
      testID="settings-install"
      label={l`Install app`}
      contentContainerStyle={[a.py_md]}
      onPress={() => {
        void install().then(outcome => {
          if (outcome !== 'accepted') return
          haptics.success()
          Toast.show(l`Splito is installed`, {type: 'success'})
        })
      }}>
      <SettingsList.ItemIcon icon={DownloadIcon} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <SettingsList.ItemText>
          <Trans>Install app</Trans>
        </SettingsList.ItemText>
        <Text
          numberOfLines={2}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Opens full screen from your Home Screen and works offline.</Trans>
        </Text>
      </View>
    </SettingsList.PressableItem>
  )
}
