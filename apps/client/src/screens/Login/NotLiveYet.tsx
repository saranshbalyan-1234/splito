import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import * as Admonition from '#/components/Admonition'

/**
 * The honest answer where the real thing does not exist yet (BACKLOG F-2101..F-2105, ARCHITECTURE 26.15): no code
 * is sent, no account or session is made, and the screen says so. Production shows it on every submit; dev and
 * e2e builds only for Google and Apple, whose real sign-in arrives with the auth API.
 */
export function NotLiveYet({testID = 'auth-not-live', isSocial = false}: {testID?: string; isSocial?: boolean}) {
  return (
    <View testID={testID} role="alert">
      <Admonition.Outer type="info">
        <Admonition.Row>
          <Admonition.Icon />
          <Admonition.Content>
            <Admonition.Text>
              {isSocial ? (
                <Trans>Sign-in with Google and Apple arrives with sync. Your data stays safe on this device.</Trans>
              ) : (
                <Trans>Sign-in arrives with sync. Your data stays safe on this device.</Trans>
              )}
            </Admonition.Text>
          </Admonition.Content>
        </Admonition.Row>
      </Admonition.Outer>
    </View>
  )
}
