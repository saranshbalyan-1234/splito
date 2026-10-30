import {useState} from 'react'
import {View} from 'react-native'
import {KeyboardAvoidingView} from 'react-native-keyboard-controller'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Contact} from '@splito/domain'

import {getAuthClient} from '#/lib/auth'
import {useIsOffline} from '#/lib/auth/online'
import {logOut} from '#/data/account'
import {sessionApi, type SessionAccount} from '#/state/session'
import {atoms as a} from '#/alf'
import {LoggedOutLayout} from '#/components/LoggedOutLayout'
import {Button, ButtonText} from '#/components/Button'
import {CodeForm} from './CodeForm'
import {OtherContactForm} from './OtherContactForm'

/**
 * The blocking "Add your phone number" / "Add your email" step (owner 139): an account missing one of the two (made with
 * Google or Apple, or an older one) cannot reach Home or setup until it adds and verifies it. The only other action is
 * Log out. Offline it says it needs a connection. No database is open while this shows.
 */
export function AddMissingContact({account, kind}: {account: SessionAccount; kind: 'email' | 'phone'}) {
  const {t: l} = useLingui()
  const isOffline = useIsOffline()
  const [contact, setContact] = useState<Contact>()
  const title = kind === 'phone' ? l`Add your phone number` : l`Add your email`

  return (
    <KeyboardAvoidingView testID="add-missing" behavior="padding" style={a.flex_1} automaticOffset>
      <LoggedOutLayout leadin="" title={title} description={l`Every Splito account has a verified email and phone number.`} scrollable>
        {contact ? (
          <CodeForm
            contact={contact}
            purpose="add-contact"
            title={kind === 'phone' ? l`Confirm your phone number` : l`Confirm your email`}
            onBack={() => setContact(undefined)}
            onVerified={async token => {
              sessionApi.signIn(await (await getAuthClient()).addContact(account, contact, token))
            }}
          />
        ) : (
          <OtherContactForm
            kind={kind}
            title={title}
            description={kind === 'phone' ? l`Add a phone number to keep using Splito. We’ll send a code to confirm it.` : l`Add an email to keep using Splito. We’ll send a code to confirm it.`}
            isDisabled={isOffline}
            disabledNote={l`This step needs a connection. Connect and try again.`}
            onContact={setContact}
          />
        )}
        <View style={[a.px_xl, a.pt_lg, a.align_start]}>
          <Button testID="add-missing-logout" label={l`Log out`} size="small" variant="ghost" color="secondary" onPress={() => void logOut(account.id)}>
            <ButtonText>
              <Trans>Log out</Trans>
            </ButtonText>
          </Button>
        </View>
      </LoggedOutLayout>
    </KeyboardAvoidingView>
  )
}
