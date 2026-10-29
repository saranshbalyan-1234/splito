import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {cancelReminder, type Entity, type Group, nextOccurrence, type Reminder} from '@splito/sync'

import {requestRemind} from '#/lib/remind/bus'
import {useEntities, useMutationCtx, useStore} from '#/data/hooks'
import {useRemindersAbout} from '#/data/remind'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Pills from '#/components/Pills'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {logger} from '#/logger'
import {RemindMeIcon} from './icons'

/**
 * The reminders I set about this friend (F-1119), soonest first, under the balances: when each next fires,
 * how often, and Edit and Cancel. Hidden when there are none. Passed ones that were once-only drop off by
 * themselves.
 */
export function PersonReminders({personId}: {personId: string}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const store = useStore()
  const ctx = useMutationCtx()
  const reminders = useRemindersAbout(personId)
  const groups = useEntities<Group>('group')
  const tick = useTickEveryMinute()
  const now = tick || Date.now()

  const upcoming = (reminders ?? [])
    .map(r => ({r, next: nextOccurrence(r.data.dueAt ?? 0, r.data.repeat, now)}))
    .filter((x): x is {r: Entity<Reminder>; next: number} => x.next !== null)
    .sort((x, y) => x.next - y.next)
  if (upcoming.length === 0) return null

  const cancel = async (id: string) => {
    try {
      await cancelReminder(store, ctx, id)
      Toast.show(l`Reminder cancelled`)
    } catch (e) {
      logger.warn('could not cancel the reminder', {safeMessage: String(e)})
      Toast.show(l`Couldn’t cancel this reminder. Please try again.`, {type: 'error'})
    }
  }

  return (
    <View testID="person-reminders" style={[a.pt_lg, a.gap_sm]}>
      <Text accessibilityRole="header" style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
        <Trans>Your reminders</Trans>
      </Text>
      <View style={[a.rounded_md, a.border, t.atoms.border_contrast_low, a.overflow_hidden]}>
        {upcoming.map(({r, next}, i) => {
          const group = r.data.groupId ? groups?.find(g => g.id === r.data.groupId)?.data.name : undefined
          const when = i18n.date(new Date(next), {weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'})
          return (
            <View
              key={r.id}
              testID={`reminder-${r.id}`}
              style={[a.flex_row, a.align_center, a.gap_md, a.px_md, a.py_sm, i > 0 && a.border_t, t.atoms.border_contrast_low]}>
              <View style={[a.align_center, a.justify_center, a.rounded_full, t.atoms.bg_contrast_50, {width: 36, height: 36}]}>
                <RemindMeIcon size="md" fill={t.atoms.text_contrast_medium.color} />
              </View>
              <View style={[a.flex_1, a.gap_2xs]}>
                <Text testID="reminder-when" numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
                  {when}
                </Text>
                <View style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_xs]}>
                  {r.data.repeat !== 'none' && (
                    <Pills.Tag>
                      {r.data.repeat === 'daily' ? <Trans>Every day</Trans> : r.data.repeat === 'weekly' ? <Trans>Every week</Trans> : <Trans>Every month</Trans>}
                    </Pills.Tag>
                  )}
                  {group ? (
                    <Text emoji numberOfLines={1} style={[a.text_sm, t.atoms.text_contrast_medium]}>
                      {group}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Button
                testID="reminder-edit"
                label={l`Edit reminder`}
                size="small"
                color="secondary"
                variant="ghost"
                shape="round"
                onPress={() => requestRemind({kind: 'remindMe', personId, groupId: r.data.groupId, editId: r.id})}>
                <ButtonIcon icon={PencilIcon} />
              </Button>
              <Button testID="reminder-cancel" label={l`Cancel reminder`} size="small" color="secondary" variant="ghost" shape="round" onPress={() => void cancel(r.id)}>
                <ButtonIcon icon={XIcon} />
              </Button>
            </View>
          )
        })}
      </View>
    </View>
  )
}

