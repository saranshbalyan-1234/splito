import {useSyncExternalStore} from 'react'
import {View} from 'react-native'
import {DatabaseZap} from 'lucide-react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useDemoMode} from '#/data/hooks'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as ResetIcon} from '#/components/icons/ArrowRotate'
import {createIcon} from '#/components/icons/lucide'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {dismiss as dismissToast} from '#/components/Toast/sonner'
import {Text} from '#/components/Typography'

const DemoIcon = createIcon(DatabaseZap)

/* How far the first-time setup (or a reset) has got: one tiny module store, read by the toast. */
let progress: number | null = null
const listeners = new Set<() => void>()
function setProgress(next: number | null) {
  progress = next
  listeners.forEach(l => l())
}
const subscribe = (l: () => void) => (
  listeners.add(l),
  () => void listeners.delete(l)
)
const useProgress = () => useSyncExternalStore(subscribe, () => progress)

function ProgressText() {
  const done = useProgress()
  return <Trans>Setting up the demo… {Math.round((done ?? 0) * 100)}%</Trans>
}

/** Runs a switch or reset with a live progress toast; the outcome is the banner itself, only a failure is told. */
async function withProgress(run: (onProgress: (done: number) => void) => Promise<void>, failed: string) {
  setProgress(0)
  const toast = Toast.show(
    <Toast.Outer>
      <Toast.Icon />
      <Toast.Text>
        <ProgressText />
      </Toast.Text>
    </Toast.Outer>,
    {duration: 120_000},
  )
  try {
    await run(setProgress)
  } catch (e) {
    logger.error(e, {where: 'DemoMode'})
    setTimeout(() => Toast.show(failed, {type: 'error'}), 400)
  } finally {
    setProgress(null)
    dismissToast(toast)
  }
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
    // Turning it off is quick; turning it on the first time seeds a year of data, which shows its progress.
    const failed = l`Couldn’t switch demo mode. Try again.`
    void (on ? withProgress(p => setDemo(true, p), failed) : setDemo(false).catch(() => Toast.show(failed, {type: 'error'}))).then(() => haptics.success())
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
        onConfirm={() => void withProgress(p => resetDemo(p), l`Couldn’t reset the demo. Try again.`)}
      />
    </>
  )
}
