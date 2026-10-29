import {useEffect} from 'react'
import {useLingui} from '@lingui/react/macro'

import {hasLegacyData, markLegacyAnswered, useMoveLegacyData} from '#/data/account'
import {useDemoMode} from '#/state/demo'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {logger} from '#/logger'

/**
 * Data from before accounts (F-250, F-2104): the one-database-per-device ledger is offered once after sign-in, "Move
 * this device's data into your account". Never merged silently: it needs a tap, and "Not now" leaves the old database
 * untouched on the device. ponytail: one offer; a Settings > Data row to ask again is the upgrade. Renders only the prompt.
 */
export function LegacyDataOffer() {
  const {t: l} = useLingui()
  const move = useMoveLegacyData()
  const {demo} = useDemoMode()
  const prompt = Prompt.usePromptControl()

  useEffect(() => {
    if (demo) return
    let isCurrent = true
    void hasLegacyData()
      .then(has => {
        if (!isCurrent) return
        /* Offered once: a database that is not there will never be, and one that is gets the question now. */
        markLegacyAnswered()
        if (has) prompt.open()
      })
      .catch(e => logger.error(e, {where: 'LegacyDataOffer'}))
    return () => {
      isCurrent = false
    }
  }, [demo, prompt])

  return (
    <Prompt.Outer control={prompt} testID="legacy-offer">
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
