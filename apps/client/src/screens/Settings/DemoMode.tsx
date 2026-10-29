import {View} from 'react-native'
import {DatabaseZap} from 'lucide-react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useDemoMode} from '#/state/demo'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {createIcon} from '#/components/icons/lucide'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

const DemoIcon = createIcon(DatabaseZap)

/** The blocking dialog is the outcome of a switch; only a failure is told. */
function failure(e: unknown, message: string) {
  logger.error(e, {where: 'DemoMode'})
  Toast.show(message, {type: 'error'})
}

/**
 * Settings > Data > Demo mode (ARCHITECTURE 26.1, owner decisions 94 + 95): a
 * switch onto a separate local database holding sample data; turning it off
 * erases that database (owner 136), turning it on seeds a fresh one. Dev and e2e builds only: loaded on demand (the
 * `demoStaticImport` rule).
 */
export function DemoModeRows() {
  const {t: l} = useLingui()
  const t = useTheme()
  const haptics = useHaptics()
  const {demo, busy, setDemo} = useDemoMode()

  const toggle = (on: boolean) => {
    haptics.confirm()
    const failed = l`Couldn’t switch demo mode. Try again.`
    // The first switch on seeds a year of data; the provider shows its progress in a blocking dialog.
    setDemo(on).then(
      () => haptics.success(),
      e => failure(e, failed),
    )
  }

  return (
    <>
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={DemoIcon} />
        <Toggle.Item
          type="switch"
          testID="settings-demo-mode"
          name="demo-mode"
          label={l`Demo mode`}
          disabled={busy}
          value={demo}
          onChange={toggle}
          style={[a.flex_1, a.gap_md]}>
          <View style={[a.flex_1, a.gap_2xs]}>
            <Toggle.LabelText>
              <Trans>Demo mode</Trans>
            </Toggle.LabelText>
            <Text numberOfLines={3} style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>Explore Splito with sample data. Your own data is kept separately and untouched.</Trans>
            </Text>
          </View>
          <Toggle.Switch />
        </Toggle.Item>
      </SettingsList.Item>
    </>
  )
}
