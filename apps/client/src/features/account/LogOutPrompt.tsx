import {useEffect} from 'react'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {logOut, useUnsyncedCount} from '#/data/account'
import {useSession} from '#/state/session'
import * as Prompt from '#/components/Prompt'

let openPrompt: (() => void) | null = null

/** Opens "Log out?" from anywhere (Settings, the drawer footer): the one `LogOutHost` shows it, above the drawer. */
export const requestLogOut = () => openPrompt?.()

/**
 * "Log out?" (ARCHITECTURE 26.15): warns when changes have not reached a server (all of them, until sync exists), then
 * keeps or erases this device's data. Log out never silently deletes: Keep is the first button and leaves the account's
 * database, ready for the next sign-in; Erase deletes it after a second look at the wording. Mounted once by the app
 * (a prompt inside the drawer would sit under its scrim).
 */
export function LogOutHost() {
  const {t: l} = useLingui()
  const control = Prompt.usePromptControl()
  useEffect(() => {
    openPrompt = () => control.open()
    return () => {
      openPrompt = null
    }
  }, [control])
  const {currentAccount} = useSession()
  const unsynced = useUnsyncedCount() ?? 0
  const id = currentAccount?.id
  const warning =
    unsynced > 0
      ? plural(unsynced, {one: '# change hasn’t synced yet. Erasing this device’s data loses it.', other: '# changes haven’t synced yet. Erasing this device’s data loses them.'})
      : l`Everything is saved on this device.`

  return (
    <Prompt.Outer control={control} testID="logout-prompt">
      <Prompt.Content>
        <Prompt.TitleText>{l`Log out?`}</Prompt.TitleText>
        <Prompt.DescriptionText>{warning}</Prompt.DescriptionText>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action testID="logout-keep" cta={l`Keep this device’s data`} onPress={() => id && void logOut(id, false)} />
        <Prompt.Action testID="logout-erase" color="negative" cta={l`Erase this device’s data`} onPress={() => id && void logOut(id, true)} />
        <Prompt.Cancel />
      </Prompt.Actions>
    </Prompt.Outer>
  )
}
