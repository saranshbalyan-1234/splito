import {View} from 'react-native'
import {type Group} from '@splito/sync'
import {Heart, House, Plane, Users} from 'lucide-react-native'

import {initials, nameHash} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme, utils} from '#/alf'
import {createIcon} from '#/components/icons/lucide'
import {Text} from '#/components/Typography'

/** Below this size the tile shows the kind glyph only; initials would not read. */
const INITIALS_MIN_SIZE = 32

/*
 * A group's tile: the group's initials on a soft tint of a hue picked from
 * its name, so two trips read apart at a glance (as avatars do for people),
 * with its kind's glyph (Lucide, ISC) as a small corner badge - Bluesky's
 * avatar-plus-badge shape from the notification rows. Small tiles (chips,
 * the right column) show the glyph alone. Dark themes take the lighter tone
 * of each hue; none is the money green or red.
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
  return HUES[nameHash(name) % HUES.length]!
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
  const tint = utils.alpha(color, t.scheme === 'light' ? 0.12 : 0.2)
  const radius = Math.round(size * 0.24)
  if (size < INITIALS_MIN_SIZE) {
    return (
      <View
        style={[
          a.align_center,
          a.justify_center,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: tint,
          },
        ]}>
        <Icon width={Math.round(size * 0.5)} fill={color} />
      </View>
    )
  }
  const badge = Math.min(Math.round(size * 0.42), 20)
  return (
    <View style={{width: size, height: size}}>
      <View
        style={[
          a.flex_1,
          a.align_center,
          a.justify_center,
          {borderRadius: radius, backgroundColor: tint},
        ]}>
        <Text
          emoji
          style={[
            a.font_bold,
            {color, fontSize: Math.round(size * 0.36), letterSpacing: 0.3},
          ]}>
          {initials(name, 'group')}
        </Text>
      </View>
      <View
        style={[
          a.absolute,
          a.align_center,
          a.justify_center,
          a.rounded_full,
          t.atoms.bg,
          {
            width: badge + 4,
            height: badge + 4,
            right: -4,
            bottom: -4,
          },
        ]}>
        <View
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_full,
            {width: badge, height: badge, backgroundColor: color},
          ]}>
          <Icon width={Math.round(badge * 0.6)} fill={t.palette.white} />
        </View>
      </View>
    </View>
  )
}
