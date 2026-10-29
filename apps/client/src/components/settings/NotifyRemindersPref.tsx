import {Trans, useLingui} from '@lingui/react/macro'
import {AlarmClock} from 'lucide-react-native'

import {canFireWhenClosed, openSystemSettings} from '#/lib/notifications'
import {useNotificationPermission} from '#/lib/notifications/usePermission'
import {Button, ButtonText} from '#/components/Button'
import {createIcon} from '#/components/icons/lucide'
import {SwitchPref} from '#/components/settings/controls'
import {usePrefControl} from '#/components/settings/PrefSection'
import {IS_NATIVE} from '#/env'

const AlarmClockIcon = createIcon(AlarmClock)

/**
 * The switch for reminders you set with Remind me (F-1907, F-1119), with the honest part beside it: where
 * the notifications can fire (only while Splito is open, on the web) and what the permission is now. The
 * OS prompt is never shown from here; Splito asks when you set your first reminder.
 */
export function NotifyRemindersPref() {
  const {t: l} = useLingui()
  const permission = useNotificationPermission()
  return (
    <>
      <SwitchPref
        pref={usePrefControl('notify.reminders')}
        icon={AlarmClockIcon}
        title={l`Reminders I set`}
        label={l`When a reminder from Remind me is due`}
        description={
          canFireWhenClosed
            ? l`These are scheduled on this device and arrive even offline.`
            : l`On the web, only while Splito is open.`
        }
      />
      {permission.state === 'denied' && IS_NATIVE ? (
        <Button testID="notify-open-settings" label={l`Open Settings`} size="small" color="secondary" onPress={() => void openSystemSettings()}>
          <ButtonText>
            <Trans>Notifications are blocked. Open Settings</Trans>
          </ButtonText>
        </Button>
      ) : null}
    </>
  )
}
