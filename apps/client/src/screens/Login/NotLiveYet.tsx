import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import * as Admonition from '#/components/Admonition'

/**
 * The honest end of every submit until the auth backend exists (BACKLOG
 * F-2101..F-2105, ARCHITECTURE 26.15): no code is sent, no account or
 * session is created, and the screen says so.
 */
export function NotLiveYet() {
  return (
    <View testID="auth-not-live" role="alert">
      <Admonition.Outer type="info">
        <Admonition.Row>
          <Admonition.Icon />
          <Admonition.Content>
            <Admonition.Text>
              <Trans>
                Sign-in arrives with sync. Your data stays safe on this device.
              </Trans>
            </Admonition.Text>
          </Admonition.Content>
        </Admonition.Row>
      </Admonition.Outer>
    </View>
  )
}
