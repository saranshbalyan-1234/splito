import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type Group,
  nextOccurrence,
  type Person,
  type ReminderRepeat,
  scheduleReminder,
  updateReminder,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {canFireWhenClosed, openSystemSettings} from '#/lib/notifications'
import {useNotificationPermission} from '#/lib/notifications/usePermission'
import {type PermissionState} from '#/lib/notifications/types'
import {type RemindRequest} from '#/lib/remind/bus'
import {dateInput, parseWhen, quickPicks, timeInput} from '#/lib/remind/when'
import {logger} from '#/logger'
import {useEntities, useMutationCtx, usePref, useStore} from '#/data/hooks'
import {useSelfReminders} from '#/data/remind'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {DateField} from '#/components/forms/DateField'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import * as FormSheet from '#/components/FormSheet'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_NATIVE} from '#/env'
import {TimeField} from './TimeField'

type RemindMe = Extract<RemindRequest, {kind: 'remindMe'}>

/**
 * "Remind me" (F-1119): a notification for myself about a friend or a group. Nothing is sent to anyone.
 * The notification permission is asked only here, when saving, behind Splito's own primer (F-216).
 */
export function RemindMeSheet({control, request}: {control: Dialog.DialogControlProps; request: RemindMe}) {
  return (
    <FormSheet.Outer control={control} testID="remind-me-sheet">
      <Form request={request} />
    </FormSheet.Outer>
  )
}

function Form({request}: {request: RemindMe}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const self = useSelfReminders()
  const [isOn = true] = usePref('notify.reminders')
  const [zonePref = 'device'] = usePref('timezone')
  const permission = useNotificationPermission()
  const existing = request.editId ? self?.find(r => r.id === request.editId) : undefined

  // The first time to show: the reminder's own when editing, else tomorrow at 9:00.
  const [initial] = useState(() => existing?.data.dueAt ?? quickPicks(Date.now())[0]!.at)
  const [date, setDate] = useState(dateInput(initial))
  const [time, setTime] = useState(timeInput(initial))
  const [repeat, setRepeat] = useState<ReminderRepeat>(existing?.data.repeat ?? 'none')
  const [step, setStep] = useState<'form' | 'primer'>('form')
  const [isSaving, setIsSaving] = useState(false)

  const person = people?.find(p => p.id === request.personId)
  const group = request.groupId ? groups?.find(g => g.id === request.groupId) : undefined
  const subject = person?.data.name ?? group?.data.name ?? l`this balance`
  const at = parseWhen(date, time)
  const next = at === null ? null : nextOccurrence(at, repeat, Date.now())
  // A once-only reminder needs a time ahead; a repeating one simply starts at its next time.
  const error = at === null ? 'invalid' : next === null ? 'past' : null
  const picks = quickPicks(Date.now())
  const isDirty = date !== dateInput(initial) || time !== timeInput(initial) || repeat !== (existing?.data.repeat ?? 'none')
  const when = (ms: number) => i18n.date(new Date(ms), {dateStyle: 'full', timeStyle: 'short'})
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const firesAt = next === null ? '' : when(next)

  const pick = (ms: number) => {
    setDate(dateInput(ms))
    setTime(timeInput(ms))
  }

  /* `granted` is the answer the primer just got: `permission.state` is still the pre-prompt value in this closure. */
  const save = async (granted?: PermissionState) => {
    if (at === null || next === null) return
    setIsSaving(true)
    try {
      if (existing) await updateReminder(store, ctx, existing.id, {dueAt: at, repeat})
      else await scheduleReminder(store, ctx, {personId: request.personId, groupId: request.groupId, dueAt: at, repeat})
    } catch (e) {
      logger.warn('could not save the reminder', {safeMessage: String(e)})
      Toast.show(l`Couldn’t save this reminder. Please try again.`, {type: 'error'})
      setIsSaving(false)
      return
    }
    haptics.success()
    const state = granted ?? permission.state
    control.close(() =>
      Toast.show(
        !isOn
          ? l`Reminder saved. Reminders are off in Settings, so it won’t alert you.`
          : state === 'granted'
            ? canFireWhenClosed
              ? l`Reminder set for ${firesAt}`
              : l`Reminder set for ${firesAt}. It alerts you while Splito is open.`
            : l`Reminder saved. Notifications are off, so it won’t alert you until you allow them.`,
        {type: state === 'granted' && isOn ? 'success' : 'warning'},
      ),
    )
  }

  const onSavePressed = () => {
    // The OS prompt comes only now, after a plain-words primer, and only while it can still be answered.
    if (permission.state === 'undetermined' && isOn) setStep('primer')
    else void save()
  }

  if (step === 'primer') {
    return (
      <FormSheet.Inner
        title={l`Allow notifications?`}
        footer={{
          saveLabel: l`Allow`,
          cancelLabel: l`Not now`,
          isSaving,
          onSave: () => void permission.ask().then(answer => save(answer)),
          onCancel: () => void save(),
        }}>
        <View testID="remind-primer" style={[a.gap_md]}>
          <FormSheet.Description>
            <Trans>
              Splito needs your permission to show this reminder. It’s used only for reminders you set; the alert is
              scheduled on this device, not sent from a server.
            </Trans>
          </FormSheet.Description>
          <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>If you choose Not now, the reminder is still saved, but it can’t alert you until you allow notifications.</Trans>
          </Text>
        </View>
      </FormSheet.Inner>
    )
  }

  return (
    <FormSheet.Inner
      title={existing ? l`Edit reminder` : l`Remind me`}
      isDirty={isDirty}
      footer={{
        saveLabel: existing ? l`Save` : l`Set reminder`,
        canSave: error === null && !!(person || group),
        isSaving,
        onSave: onSavePressed,
      }}>
      <View style={[a.gap_lg]} testID="remind-me-body">
        <FormSheet.Description>
          <Trans>A notification for you about {subject}. Nothing is sent to anyone.</Trans>
        </FormSheet.Description>

        <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
          {(
            [
              ['tomorrow', l`Tomorrow`],
              ['in3days', l`In 3 days`],
              ['nextWeek', l`Next Monday`],
              ['nextMonth', l`Next month`],
            ] as const
          ).map(([id, label]) => {
            const ms = picks.find(p => p.id === id)!.at
            const isSelected = dateInput(ms) === date && timeInput(ms) === time
            return (
              <Button
                key={id}
                testID={`remind-pick-${id}`}
                label={label}
                size="small"
                color={isSelected ? 'primary' : 'secondary'}
                onPress={() => pick(ms)}>
                <ButtonText>{label}</ButtonText>
              </Button>
            )
          })}
        </View>

        <View style={[a.flex_row, a.gap_md]}>
          <View style={[a.flex_1]}>
            <TextField.LabelText>
              <Trans>Date</Trans>
            </TextField.LabelText>
            <DateField testID="remind-date" label={l`Date`} value={date} onChangeDate={setDate} isInvalid={at === null} />
          </View>
          <View style={[a.flex_1]}>
            <TextField.LabelText>
              <Trans>Time</Trans>
            </TextField.LabelText>
            <TimeField testID="remind-time" label={l`Time`} value={time} onChange={setTime} isInvalid={at === null} />
          </View>
        </View>

        <View style={[a.gap_xs]}>
          <TextField.LabelText>
            <Trans>Repeat</Trans>
          </TextField.LabelText>
          <SegmentedControl.Root type="radio" label={l`Repeat`} value={repeat} onChange={v => setRepeat(v as ReminderRepeat)}>
            {(
              [
                ['none', l`Once`],
                ['daily', l`Daily`],
                ['weekly', l`Weekly`],
                ['monthly', l`Monthly`],
              ] as const
            ).map(([value, label]) => (
              <SegmentedControl.Item key={value} testID={`remind-repeat-${value}`} label={label} value={value}>
                <SegmentedControl.ItemText>{label}</SegmentedControl.ItemText>
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        </View>

        {zonePref !== 'device' ? (
          <Text testID="remind-zone" style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Times are in this device’s time zone ({deviceZone}).</Trans>
          </Text>
        ) : null}

        {error === 'invalid' ? (
          <Text testID="remind-error" style={[a.text_sm, {color: t.palette.negative_500}]}>
            <Trans>Enter a real date (YYYY-MM-DD) and time (HH:MM).</Trans>
          </Text>
        ) : error === 'past' ? (
          <Text testID="remind-error" style={[a.text_sm, {color: t.palette.negative_500}]}>
            <Trans>Pick a time that hasn’t passed yet.</Trans>
          </Text>
        ) : next !== null ? (
          <Text testID="remind-next" style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            <Trans>Reminds you {firesAt}</Trans>
          </Text>
        ) : null}

        {!isOn ? (
          <Admonition type="warning">
            <Trans>Reminders are turned off in Settings, Notifications. This one is saved but won’t alert you.</Trans>
          </Admonition>
        ) : permission.state === 'denied' ? (
          <Admonition type="warning">
            {IS_NATIVE ? (
              <Trans>Notifications are blocked for Splito. The reminder is saved but can’t alert you until you allow them in your phone’s Settings.</Trans>
            ) : (
              <Trans>Notifications are blocked for this site. The reminder is saved but can’t alert you until you allow them in your browser’s site settings.</Trans>
            )}
          </Admonition>
        ) : permission.state === 'unsupported' ? (
          <Admonition type="info">
            <Trans>This browser can’t show notifications. You’ll see this reminder inside Splito when you open it.</Trans>
          </Admonition>
        ) : !canFireWhenClosed ? (
          <Admonition type="info">
            <Trans>On the web, Splito can only remind you while it’s open. If it’s closed, you’ll see the reminder the next time you open it.</Trans>
          </Admonition>
        ) : null}
        {permission.state === 'denied' && IS_NATIVE && (
          <View style={[a.flex_row]}>
            <Button testID="remind-open-settings" label={l`Open Settings`} size="small" color="secondary" onPress={() => void openSystemSettings()}>
              <ButtonText>
                <Trans>Open Settings</Trans>
              </ButtonText>
            </Button>
          </View>
        )}
      </View>
    </FormSheet.Inner>
  )
}
