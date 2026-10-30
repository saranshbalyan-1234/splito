import {useEffect} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {retryLogOut, useLogoutPhase} from '#/data/account'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

/**
 * What shows while a log out erases the account's data (owner 186): the logged-out flow comes only when the erase is done.
 * A failure is said here with Retry; nothing is left half-erased because the session ends only after the last step. After a
 * restart in the middle of a log out the same screen resumes it.
 */
export function LoggingOut({accountId}: {accountId: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const phase = useLogoutPhase()

  /* A log out that was started before this launch is finished here (a running one is left alone). */
  useEffect(() => {
    retryLogOut(accountId)
  }, [accountId])

  return (
    <View testID="logging-out" style={[a.flex_1, a.align_center, a.justify_center, a.gap_lg, a.px_xl]}>
      {phase === 'failed' ? (
        <>
          <View testID="logout-failed" role="alert" style={[a.w_full, {maxWidth: 420}]}>
            <Admonition type="error">{l`Your data could not be removed from this device yet. Close other Splito tabs and try again.`}</Admonition>
          </View>
          <Button testID="logout-retry" label={l`Try again`} size="large" color="primary" onPress={() => retryLogOut(accountId)}>
            <ButtonText>
              <Trans>Try again</Trans>
            </ButtonText>
          </Button>
        </>
      ) : (
        <>
          <Loader size="xl" />
          <Text style={[a.text_lg, t.atoms.text_contrast_medium]}>
            <Trans>Logging out…</Trans>
          </Text>
        </>
      )}
    </View>
  )
}
