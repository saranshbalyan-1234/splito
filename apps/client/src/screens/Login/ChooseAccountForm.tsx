// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Login/ChooseAccountForm.tsx, src/components/AccountList.tsx
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {type SessionAccount, useSession} from '#/state/session'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {Person_Stroke2_Corner0_Rounded as PersonIcon} from '#/components/icons/Auth'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {FormContainer} from './FormContainer'

/**
 * Several remembered accounts on this device. Splito has no sessions to
 * resume, so picking one goes to the form with its email or phone filled in.
 * `accounts` stays empty until the auth backend exists, so the form is
 * unreachable before then.
 */
export const ChooseAccountForm = ({
  onSelectAccount,
  onPressBack,
}: {
  onSelectAccount: (account?: SessionAccount) => void
  onPressBack: () => void
}) => {
  const t = useTheme()
  const {t: l} = useLingui()
  const {accounts} = useSession()

  return (
    <FormContainer
      testID="chooseAccountForm"
      titleText={<Trans>Select account</Trans>}
      style={web([a.py_2xl])}>
      <View>
        {IS_WEB && (
          <TextField.LabelText>
            <Trans>Sign in as…</Trans>
          </TextField.LabelText>
        )}
        <View
          style={[
            a.rounded_md,
            a.overflow_hidden,
            a.border,
            t.atoms.border_contrast_low,
          ]}>
          {accounts.map(account => (
            <Button
              key={account.id}
              testID={`chooseAccount-${account.id}`}
              label={l`Sign in as ${account.name}`}
              onPress={() => onSelectAccount(account)}
              style={[a.border_b, t.atoms.border_contrast_low]}>
              <View
                style={[
                  a.flex_1,
                  a.flex_row,
                  a.align_center,
                  a.gap_md,
                  a.p_md,
                ]}>
                <UserAvatar size={40} name={account.name} type="user" />
                <View style={[a.flex_1]}>
                  <Text
                    numberOfLines={1}
                    style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
                    {account.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      a.text_sm,
                      a.leading_snug,
                      t.atoms.text_contrast_medium,
                    ]}>
                    {account.contact}
                  </Text>
                </View>
              </View>
            </Button>
          ))}
          <Button
            testID="chooseAccountOther"
            label={l`Other account`}
            onPress={() => onSelectAccount()}>
            <View
              style={[a.flex_1, a.flex_row, a.align_center, a.gap_md, a.p_md]}>
              <ButtonIcon icon={PersonIcon} />
              <Text style={[a.text_md, a.font_semi_bold]}>
                <Trans>Other account</Trans>
              </Text>
            </View>
          </Button>
        </View>
      </View>
      {IS_WEB && (
        <View style={[a.flex_row]}>
          <Button
            label={l`Back`}
            color="secondary"
            size="large"
            onPress={onPressBack}>
            <ButtonText>{l`Back`}</ButtonText>
          </Button>
          <View style={[a.flex_1]} />
        </View>
      )}
    </FormContainer>
  )
}
