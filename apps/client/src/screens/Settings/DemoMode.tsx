import {View} from 'react-native'
import {DatabaseZap} from 'lucide-react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useDemoMode} from '#/state/demo'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as ResetIcon} from '#/components/icons/ArrowRotate'
import {createIcon} from '#/components/icons/lucide'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

const DemoIcon = createIcon(DatabaseZap)

/** The blocking dialog and the banner are the outcome of a switch or reset; only a failure is told. */
function failure(e: unknown, message: string) {
  logger.error(e, {where: 'DemoMode'})
  Toast.show(message, {type: 'error'})
}

/**
 * Settings > Data > Demo mode (ARCHITECTURE 26.1, owner decisions 94 + 95): a
 * switch onto a separate local database holding sample data, and while on, a
 * "Reset demo" row. Dev and e2e builds only: loaded on demand (the
 * `demoStaticImport` rule).
 */
export function DemoModeRows() {
  const {t: l} = useLingui()
  const t = useTheme()
  const haptics = useHaptics()
  const {demo, busy, setDemo, resetDemo} = useDemoMode()
  const resetPrompt = Prompt.usePromptControl()

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
          type="checkbox"
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
          <Toggle.Platform />
        </Toggle.Item>
      </SettingsList.Item>
      {demo && (
        <SettingsList.PressableItem testID="settings-demo-reset" label={l`Reset demo`} disabled={busy} onPress={() => resetPrompt.open()}>
          <SettingsList.ItemIcon icon={ResetIcon} />
          <SettingsList.ItemText>
            <Trans>Reset demo</Trans>
          </SettingsList.ItemText>
        </SettingsList.PressableItem>
      )}

      <Prompt.Basic
        control={resetPrompt}
        title={l`Reset demo?`}
        description={l`Puts the sample data back as it was and drops what you changed in demo mode. Your own data is not touched.`}
        confirmButtonCta={l`Reset`}
        confirmButtonColor="negative"
        onConfirm={() => resetDemo().then(undefined, e => failure(e, l`Couldn’t reset the demo. Try again.`))}
      />
    </>
  )
}
