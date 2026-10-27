import {useSyncExternalStore} from 'react'
import {View} from 'react-native'
import {DatabaseZap} from 'lucide-react-native'
import {type MutationCtx, type Store, touches} from '@splito/sync'
import {plural, t} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {addLargeDemo, type DemoCounts, demoCounts, removeLargeDemo} from '#/data/demoLarge'
import {useMutationCtx, useProjection, useStore} from '#/data/hooks'
import {type Query} from '#/data/projections'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {createIcon} from '#/components/icons/lucide'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {dismiss as dismissToast} from '#/components/Toast/sonner'
import {Text} from '#/components/Typography'

const DemoIcon = createIcon(DatabaseZap)

const demoCountsQuery: Query<DemoCounts> = {
  key: 'demoCounts',
  isTouchedBy: c => touches(c, 'person') || touches(c, 'group') || touches(c, 'expense'),
  loader: store => async (_c, prev) => {
    const next = await demoCounts(store)
    return prev && prev.friends === next.friends && prev.groups === next.groups && prev.expenses === next.expenses ? prev : next
  },
}

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
  const toast = Toast.show(
    <Toast.Outer>
      <Toast.Icon />
      <Toast.Text>
        <ProgressText />
      </Toast.Text>
    </Toast.Outer>,
    {duration: 120_000},
  )
  const started = performance.now()
  let done: {text: string; type: Toast.ToastType}
  try {
    if (action === 'add') {
      const counts = await addLargeDemo(store, ctx, part =>
        setProgress({action, done: part}),
      )
      if (counts) {
        // Kept in the log for the owner's timing checks (dev and e2e builds only).
        logger.info('demo.large.added', {
          ms: Math.round(performance.now() - started),
          ...counts,
        })
        done = {
          text: t`Demo data added: ${plural(counts.expenses, {one: '# expense', other: '# expenses'})}`,
          type: 'success',
        }
      } else done = {text: t`Demo data is already added`, type: 'default'}
    } else {
      await removeLargeDemo(store)
      done = {text: t`Demo data removed`, type: 'success'}
    }
  } catch (e) {
    logger.error(e, {where: 'runLargeDemo'})
    done = {
      text: t`Couldn't finish. Try Remove demo data, then add it again.`,
      type: 'error',
    }
  }
  setProgress(null)
  dismissToast(toast)
  // The progress toast leaves first, then the outcome takes its place.
  setTimeout(() => Toast.show(done.text, {type: done.type}), 400)
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
  const {friends = 0, groups = 0, expenses = 0} = useProjection(demoCountsQuery) ?? {}
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
