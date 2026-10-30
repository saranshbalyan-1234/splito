import {useEffect, useState} from 'react'
import {useLingui} from '@lingui/react/macro'

import {hasLegacyData, isLegacyAnswered, markLegacyAnswered, useMoveLegacyData} from '#/data/account'
import {useDemoMode} from '#/state/demo'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {logger} from '#/logger'

let openOffer: (() => void) | null = null

/** Settings > Data "Move this device's older data": asks the same question again (the host below shows it). */
export const requestLegacyOffer = () => openOffer?.()

/**
 * Data from before accounts (F-250, F-2104): the one-database-per-device ledger is offered after sign-in, "Move this device's
 * data into your account". Never merged silently: it needs a tap. The offer is answered by Move, by Not now (or any dismissal),
 * or by there being no old database at all; until then it comes again at the next launch, so an accidental close never
 * loses the chance. Afterwards Settings > Data keeps a row while an old database exists. Renders only the prompt, and only
 * when there is something to offer.
 */
export function LegacyDataOffer() {
  const {demo} = useDemoMode()
  const [opens, setOpens] = useState(0)

  useEffect(() => {
    openOffer = () => setOpens(n => n + 1)
    return () => {
      openOffer = null
    }
  }, [])

  useEffect(() => {
    if (demo || isLegacyAnswered()) return
    let isCurrent = true
    void hasLegacyData()
      .then(has => {
        if (!isCurrent) return
        if (has) setOpens(n => n + 1)
        else markLegacyAnswered()
      })
      .catch(e => logger.error(e, {where: 'LegacyDataOffer'}))
    return () => {
      isCurrent = false
    }
  }, [demo])

  /* The dialog exists only once there is something to offer (or it was asked for). */
  return opens > 0 ? <OfferPrompt opens={opens} /> : null
}

function OfferPrompt({opens}: {opens: number}) {
  const {t: l} = useLingui()
  const move = useMoveLegacyData()
  const prompt = Prompt.usePromptControl()
  useEffect(() => {
    prompt.open()
  }, [prompt, opens])

  return (
    <Prompt.Outer control={prompt} testID="legacy-offer" onClose={markLegacyAnswered}>
      <Prompt.Content>
        <Prompt.TitleText>{l`Move this device’s data into your account?`}</Prompt.TitleText>
        <Prompt.DescriptionText>{l`You added people, groups and expenses on this device before accounts. Move them into this account? Nothing moves unless you say so.`}</Prompt.DescriptionText>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action
          testID="legacy-move"
          cta={l`Move this device’s data into your account`}
          onPress={() =>
            void move().then(
              () => Toast.show(l`Moved into your account`),
              e => {
                logger.error(e, {where: 'LegacyDataOffer.move'})
                Toast.show(l`Couldn’t move your data. It is still on this device.`, {type: 'error'})
              },
            )
          }
        />
        <Prompt.Cancel cta={l`Not now`} />
      </Prompt.Actions>
    </Prompt.Outer>
  )
}
