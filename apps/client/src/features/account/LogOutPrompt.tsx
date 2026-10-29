import {useEffect, useState} from 'react'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {logOut, useUnsyncedCount} from '#/data/account'
import {useSession} from '#/state/session'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'

let openPrompt: (() => void) | null = null

/** Opens "Log out?" from anywhere (Settings, the drawer footer): the one `LogOutHost` shows it, above the drawer. */
export const requestLogOut = () => openPrompt?.()

/**
 * "Log out?" (ARCHITECTURE 26.15): keeps or erases this device's data. Log out never silently deletes: Keep is the first
 * button and leaves the account's database, ready for the next sign-in; Erase deletes it, and stays off until the count
 * of changes that have not synced is known, so the warning is never missing when it matters. Mounted once by the app
 * (a prompt inside the drawer would sit under its scrim), and its dialog and its count only on the first request, so
 * launch pays for neither.
 */
export function LogOutHost() {
  const control = Prompt.usePromptControl()
  const [isRequested, setRequested] = useState(false)
  const [opens, setOpens] = useState(0)
  useEffect(() => {
    openPrompt = () => {
      setRequested(true)
      setOpens(n => n + 1)
    }
    return () => {
      openPrompt = null
    }
  }, [])
  /* After the dialog has mounted (children's effects run first), on every request. */
  useEffect(() => {
    if (opens > 0) control.open()
  }, [opens, control])
  return isRequested ? <LogOutPrompt control={control} /> : null
}

function LogOutPrompt({control}: {control: Prompt.PromptControlProps}) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const unsynced = useUnsyncedCount()
  const id = currentAccount?.id
  const warning =
    unsynced === undefined
      ? l`Everything is saved on this device first.`
      : unsynced > 0
        ? plural(unsynced, {one: '# change hasn’t synced yet. Erasing this device’s data loses it.', other: '# changes haven’t synced yet. Erasing this device’s data loses them.'})
        : l`Everything is saved on this device.`

  const run = (erase: boolean) => {
    if (!id) return
    logOut(id, erase).catch(e => {
      logger.error(e, {where: 'logOut.erase'})
      Toast.show(l`Logged out, but this device’s data could not be erased. Close other Splito tabs and try again.`, {type: 'error'})
    })
  }

  return (
    <Prompt.Outer control={control} testID="logout-prompt">
      <Prompt.Content>
        <Prompt.TitleText>{l`Log out?`}</Prompt.TitleText>
        <Prompt.DescriptionText>{warning}</Prompt.DescriptionText>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action testID="logout-keep" cta={l`Keep this device’s data`} onPress={() => run(false)} />
        <Prompt.Action testID="logout-erase" color="negative" disabled={unsynced === undefined} cta={l`Erase this device’s data`} onPress={() => run(true)} />
        <Prompt.Cancel />
      </Prompt.Actions>
    </Prompt.Outer>
  )
}
