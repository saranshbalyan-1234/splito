import {View} from 'react-native'
import {type Group} from '@splito/sync'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {Person_Stroke2_Corner2_Rounded as PersonIcon} from '#/components/icons/Person'

/**
 * The avatar a form is about to create: initials once a name is typed, a
 * neutral glyph before that (an empty blue disc reads as broken). A group
 * ("list") previews as the GroupAvatar tile it will become, with its kind.
 */
export function AvatarPreview({
  name,
  type,
  kind = 'other',
  size = 64,
}: {
  name: string
  type: 'user' | 'list'
  kind?: Group['kind']
  size?: number
}) {
  const t = useTheme()
  if (name.trim()) {
    return type === 'list' ? (
      <GroupAvatar kind={kind} name={name} size={size} />
    ) : (
      <UserAvatar size={size} name={name} type={type} />
    )
  }
  const Glyph = type === 'user' ? PersonIcon : GroupIcon
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        t.atoms.bg_contrast_50,
        {
          width: size,
          height: size,
          borderRadius: type === 'user' ? size / 2 : 8,
        },
      ]}>
      <Glyph size="xl" fill={t.atoms.text_contrast_medium.color} />
    </View>
  )
}
