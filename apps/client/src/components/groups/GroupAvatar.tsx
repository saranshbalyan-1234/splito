import {View} from 'react-native'
import {type Group} from '@splito/sync'
import {Heart, House, Plane, Users} from 'lucide-react-native'

import {atoms as a, useTheme, utils} from '#/alf'
import {createIcon} from '#/components/icons/lucide'

/*
 * A group's tile: its kind's glyph (Lucide, ISC) on a soft tint of a hue
 * picked from the group's name, so two trips read apart at a glance (as
 * avatars do for people). Dark themes take the lighter tone of each hue;
 * none is the money green or red.
 */
const KINDS = {
  home: createIcon(House),
  trip: createIcon(Plane),
  couple: createIcon(Heart),
  other: createIcon(Users),
} satisfies Record<Group['kind'], unknown>

const HUES = [
  {light: '#0369A1', dark: '#38BDF8'},
  {light: '#C2410C', dark: '#FB923C'},
  {light: '#6D28D9', dark: '#A78BFA'},
  {light: '#BE185D', dark: '#F472B6'},
  {light: '#0E7490', dark: '#22D3EE'},
  {light: '#A16207', dark: '#FACC15'},
  {light: '#4338CA', dark: '#818CF8'},
] as const

function hueFor(name: string) {
  let h = 0x811c9dc5
  for (const ch of name.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  return HUES[(h >>> 0) % HUES.length]!
}

/** The rounded-square tile for a group, sized like Bluesky's list avatar. */
export function GroupAvatar({
  kind,
  name,
  size = 42,
}: {
  kind: Group['kind']
  /** The group's name; it picks the tile's hue. */
  name: string
  size?: number
}) {
  const t = useTheme()
  const Icon = KINDS[kind] ?? KINDS.other
  const {light, dark} = hueFor(name)
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
