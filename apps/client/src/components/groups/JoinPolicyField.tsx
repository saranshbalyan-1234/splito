import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type JoinPolicy} from '@splito/sync'

import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import * as TextField from '#/components/forms/TextField'
import {Text} from '#/components/Typography'

/** The plain-words name of each rule: also what the group page shows under Members. */
export function useJoinPolicyText() {
  const {t: l} = useLingui()
  return {
    title: (p: JoinPolicy) => ({link: l`Anyone with the link`, approve: l`Link, I approve each join`, invite: l`Invite only`})[p],
    rule: (p: JoinPolicy) =>
      ({
        link: l`Anyone with the link can join`,
        approve: l`Joining by link needs an admin’s approval`,
        invite: l`Invite only: people join when a member adds them`,
      })[p],
    hint: (p: JoinPolicy) =>
      ({
        link: l`The group link and QR work, and whoever opens it joins at once.`,
        approve: l`Opening the link sends a request that an admin approves or declines.`,
        invite: l`No link. People join only when a member adds them and they accept.`,
      })[p],
  }
}

/**
 * "Who can join" (owner 196): the group's one join rule, three options in plain words. The same field in New group,
 * Edit group and the Add members sheet. Only admins change it (`isDisabled` for everyone else, with the reason).
 */
export function JoinPolicyField({
  value,
  onChange,
  isDisabled = false,
  testIDPrefix = 'join-policy',
}: {
  value: JoinPolicy
  onChange: (next: JoinPolicy) => void
  isDisabled?: boolean
  testIDPrefix?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const text = useJoinPolicyText()
  return (
    <View testID={testIDPrefix}>
      <TextField.LabelText>
        <Trans>Who can join</Trans>
      </TextField.LabelText>
      <Toggle.Group
        label={l`Who can join`}
        type="radio"
        disabled={isDisabled}
        values={[value]}
        onChange={([next]) => next && next !== value && onChange(next as JoinPolicy)}>
        <View style={[a.gap_md, a.pt_xs]}>
          {(['link', 'approve', 'invite'] as const).map(policy => (
            <Toggle.Item key={policy} testID={`${testIDPrefix}-${policy}`} name={policy} label={text.title(policy)} style={[a.align_start]}>
              <Toggle.Radio />
              <View style={[a.flex_1, a.gap_2xs]}>
                <Toggle.LabelText>{text.title(policy)}</Toggle.LabelText>
                <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>{text.hint(policy)}</Text>
              </View>
            </Toggle.Item>
          ))}
        </View>
      </Toggle.Group>
      {isDisabled ? (
        <Text style={[a.pt_sm, a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Only admins can change this.</Trans>
        </Text>
      ) : null}
    </View>
  )
}
