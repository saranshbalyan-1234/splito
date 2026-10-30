import {useEffect, useState} from 'react'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {logOut, useUnsyncedCount} from '#/data/account'
import {useSession} from '#/state/session'
import * as Prompt from '#/components/Prompt'

let openPrompt: (() => void) | null = null

/** Opens "Log out?" from anywhere (Settings, the drawer footer): the one `LogOutHost` shows it, above the drawer. */
export const requestLogOut = () => openPrompt?.()

/**
 * "Log out?" (ARCHITECTURE 26.15, owner 186): log out erases everything the account left on the device, so the prompt says
 * so, and first warns with the count of changes the server has not acknowledged (they are lost). Mounted once by the app
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

  return (
    <Prompt.Outer control={control} testID="logout-prompt">
      <Prompt.Content>
        <Prompt.TitleText>{l`Log out?`}</Prompt.TitleText>
        <Prompt.DescriptionText>
          {unsynced ? `${plural(unsynced, {one: '# change hasn’t synced yet and will be lost.', other: '# changes haven’t synced yet and will be lost.'})} ` : ''}
          {l`This removes all your Splito data from this device.`}
        </Prompt.DescriptionText>
      </Prompt.Content>
      <Prompt.Actions>
        {/* Off until the count is known, so the warning is never missing when it matters. */}
        <Prompt.Action testID="logout-confirm" color="negative" disabled={unsynced === undefined} cta={l`Log out`} onPress={() => id && void logOut(id)} />
        <Prompt.Cancel />
      </Prompt.Actions>
    </Prompt.Outer>
  )
}
