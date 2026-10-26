import {useSyncExternalStore} from 'react'
import {View} from 'react-native'
import {DatabaseZap} from 'lucide-react-native'
import {DEMO_LARGE_PREFIX, type MutationCtx, type Store} from '@splito/sync'
import {plural, t} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {addLargeDemo, removeLargeDemo} from '#/data/demoLarge'
import {useEntities, useMutationCtx, useStore} from '#/data/hooks'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {createIcon} from '#/components/icons/lucide'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

const DemoIcon = createIcon(DatabaseZap)

/* What is running and how far along: one tiny module store, read by the toast and the rows. */
let progress: {action: 'add' | 'remove'; done: number} | null = null
const listeners = new Set<() => void>()
function setProgress(next: typeof progress) {
  progress = next
  listeners.forEach(l => l())
}
const subscribe = (l: () => void) => (
  listeners.add(l),
  () => void listeners.delete(l)
)
const getProgress = () => progress
const useProgress = () => useSyncExternalStore(subscribe, getProgress)

function ProgressText() {
  const p = useProgress()
  const percent = Math.round((p?.done ?? 1) * 100)
  return p?.action === 'remove' ? (
    <Trans>Removing demo data…</Trans>
  ) : (
    <Trans>Adding demo data… {percent}%</Trans>
  )
}

/**
 * Adds or removes the large demo set with a live progress toast (dev and e2e
 * builds only; callers check). Used by Settings and by `?demo=large`.
 */
export async function runLargeDemo(
  store: Store,
  ctx: MutationCtx,
  action: 'add' | 'remove',
) {
  if (progress) return
  setProgress({action, done: 0})
  Toast.show(
    <Toast.Outer>
      <Toast.Icon />
      <Toast.Text>
        <ProgressText />
      </Toast.Text>
    </Toast.Outer>,
    {duration: 120_000},
  )
  const started = performance.now()
  try {
    if (action === 'add') {
      const counts = await addLargeDemo(store, ctx, done =>
        setProgress({action, done}),
      )
      const ms = Math.round(performance.now() - started)
      Toast.api.dismiss()
      if (counts) {
        // Kept in the console for the owner's timing checks (dev and e2e builds only).
        logger.info('demo.large.added', {ms, ...counts})
        Toast.show(
          t`Demo data added: ${plural(counts.expenses, {one: '# expense', other: '# expenses'})}`,
          {type: 'success'},
        )
      } else Toast.show(t`Demo data is already added`)
    } else {
      await removeLargeDemo(store)
      Toast.api.dismiss()
      Toast.show(t`Demo data removed`, {type: 'success'})
    }
  } catch (e) {
    Toast.api.dismiss()
    logger.error(e, {where: 'runLargeDemo'})
    Toast.show(t`Couldn't finish. Try Remove demo data, then add it again.`, {
      type: 'error',
    })
  } finally {
    setProgress(null)
  }
}

/**
 * Settings > About and data rows for the large demo set (ARCHITECTURE 26.1).
 * The caller renders them only in dev and e2e builds.
 */
export function DemoDataRows() {
  const {t: l} = useLingui()
  const t = useTheme()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const addPrompt = Prompt.usePromptControl()
  const removePrompt = Prompt.usePromptControl()
  const busy = useProgress()
  const isDemo = (e: {id: string}) => e.id.startsWith(DEMO_LARGE_PREFIX)
  const friends = useEntities('person')?.filter(isDemo).length ?? 0
  const groups = useEntities('group')?.filter(isDemo).length ?? 0
  const expenses = useEntities('expense')?.filter(isDemo).length ?? 0
  const isLoaded = friends + groups > 0

  const run = (action: 'add' | 'remove') => {
    haptics.confirm()
    void runLargeDemo(store, ctx, action).then(() => haptics.success())
  }

  return (
    <>
      <SettingsList.PressableItem
        testID="settings-demo-add"
        label={l`Add demo data`}
        disabled={!!busy}
        onPress={() =>
          isLoaded
            ? Toast.show(l`Demo data is already added`)
            : addPrompt.open()
        }>
        <SettingsList.ItemIcon icon={DemoIcon} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <SettingsList.ItemText>
            <Trans>Add demo data</Trans>
          </SettingsList.ItemText>
          <Text
            testID="settings-demo-summary"
            numberOfLines={2}
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {busy?.action === 'add' ? (
              <Trans>Adding… {Math.round(busy.done * 100)}%</Trans>
            ) : isLoaded ? (
              <Trans>
                Added: {plural(friends, {one: '# friend', other: '# friends'})},{' '}
                {plural(groups, {one: '# group', other: '# groups'})},{' '}
                {plural(expenses, {one: '# expense', other: '# expenses'})}
              </Trans>
            ) : (
              <Trans>A year of friends, groups and expenses, for testing</Trans>
            )}
          </Text>
        </View>
      </SettingsList.PressableItem>
      {isLoaded && (
        <SettingsList.PressableItem
          testID="settings-demo-remove"
          destructive
          label={l`Remove demo data`}
          disabled={!!busy}
          onPress={() => removePrompt.open()}>
          <SettingsList.ItemIcon icon={TrashIcon} />
          <SettingsList.ItemText>
            <Trans>Remove demo data</Trans>
          </SettingsList.ItemText>
        </SettingsList.PressableItem>
      )}

      <Prompt.Basic
        control={addPrompt}
        title={l`Add demo data?`}
        description={l`Adds about 30 friends, 12 groups and 1,500 expenses from the past year next to your own data. You can remove exactly this later.`}
        confirmButtonCta={l`Add demo data`}
        onConfirm={() => run('add')}
      />
      <Prompt.Basic
        control={removePrompt}
        title={l`Remove demo data?`}
        description={l`Removes the demo friends, groups, expenses and payments, with their history. Everything you added yourself stays.`}
        confirmButtonCta={l`Remove`}
        confirmButtonColor="negative"
        onConfirm={() => run('remove')}
      />
    </>
  )
}
