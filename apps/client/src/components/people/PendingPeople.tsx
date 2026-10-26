import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {requestName, usePendingRequests} from '#/data/friends'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Clock_Stroke2_Corner0_Rounded as ClockIcon} from '#/components/icons/Invite'
import {Text} from '#/components/Typography'

/**
 * People you asked who haven't accepted yet, at the end of a picker: shown so
 * nobody wonders where they went, greyed and not selectable (26.18: nobody is
 * added to an expense or group without their consent). Renders nothing when
 * there are none. Mount it inside the open sheet only (section 4).
 */
export function PendingPeople({
  rowStyle,
  avatarSize = 36,
}: {
  rowStyle?: React.ComponentProps<typeof View>['style']
  avatarSize?: number
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {outgoing} = usePendingRequests()
  if (outgoing.length === 0) return null
  return (
    <View testID="pending-people">
      {outgoing.map(r => {
        const name = requestName(r.data)
        return (
          <View
            key={r.id}
            testID={`pending-${name}`}
            accessible
            accessibilityRole="text"
            accessibilityState={{disabled: true}}
            accessibilityLabel={l`${name}, waiting for them to accept. Not selectable yet.`}
            style={[a.flex_row, a.align_center, a.gap_md, a.py_sm, rowStyle]}>
            <View style={{opacity: 0.45}}>
              <UserAvatar size={avatarSize} name={name} type="user" />
            </View>
            <View style={[a.flex_1, a.gap_2xs, {minWidth: 0}]}>
              <Text
                numberOfLines={1}
                style={[a.text_md, a.font_medium, t.atoms.text_contrast_low]}>
                {name}
              </Text>
              <Text numberOfLines={1} style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Waiting for {name} to accept</Trans>
              </Text>
            </View>
            <ClockIcon size="md" fill={t.atoms.text_contrast_low.color} />
          </View>
        )
      })}
    </View>
  )
}
