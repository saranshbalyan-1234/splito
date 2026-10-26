import {View} from 'react-native'
import {type Group} from '@splito/sync'
import {Heart, House, Plane, Users} from 'lucide-react-native'

import {atoms as a, useTheme, utils} from '#/alf'
import {createIcon} from '#/components/icons/lucide'

/*
 * A group's tile: its kind's glyph (Lucide, ISC) on a soft tint of the
 * kind's colour, the way categories show, so a home and a trip read apart at
 * a glance. Dark themes take the lighter tone of each hue.
 */
const KINDS = {
  home: {icon: createIcon(House), light: '#C2410C', dark: '#FB923C'},
  trip: {icon: createIcon(Plane), light: '#0369A1', dark: '#38BDF8'},
  couple: {icon: createIcon(Heart), light: '#BE185D', dark: '#F472B6'},
  other: {icon: createIcon(Users), light: '#6D28D9', dark: '#A78BFA'},
} satisfies Record<Group['kind'], unknown>

/** The rounded-square tile for a group, sized like Bluesky's list avatar. */
export function GroupAvatar({
  kind,
  size = 42,
}: {
  kind: Group['kind']
  size?: number
}) {
  const t = useTheme()
  const {icon: Icon, light, dark} = KINDS[kind] ?? KINDS.other
  const color = t.scheme === 'light' ? light : dark
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          backgroundColor: utils.alpha(
            color,
            t.scheme === 'light' ? 0.12 : 0.2,
          ),
        },
      ]}>
      <Icon width={Math.round(size * 0.5)} fill={color} />
    </View>
  )
}
