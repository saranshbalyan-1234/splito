// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/UserAvatar.tsx
import {memo, useMemo} from 'react'
import {
  type StyleProp,
  Text as RNText,
  View,
  type ViewStyle,
} from 'react-native'

import {atoms as a, useTheme} from '#/alf'

export type UserAvatarType = 'user' | 'algo' | 'list' | 'labeler'

interface BaseUserAvatarProps {
  type?: UserAvatarType
  shape?: 'circle' | 'square'
  size: number
  /** Splito has no avatar images yet; the fallback shows the name's initials. */
  name?: string
}

interface UserAvatarProps extends BaseUserAvatarProps {
  type: UserAvatarType
  noBorder?: boolean
  style?: StyleProp<ViewStyle>
}

/** Up to two initials, from the first and last words of a display name. */
export function getInitials(name: string | undefined) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = Array.from(words[0])[0] ?? ''
  const last = words.length > 1 ? (Array.from(words.at(-1)!)[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/**
 * Eight avatar hues, none of them the money green or red, each holding white
 * initials at AA large-text contrast. A name always gets the same hue, so rows can
 * be told apart at a glance while primary blue stays for actions.
 */
export const AVATAR_COLORS = [
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#C026D3',
  '#DB2777',
  '#C2410C',
  '#0E7490',
  '#475569',
] as const

/** The avatar hue for a name (FNV-1a hash, stable across sessions). */
export function avatarColor(name: string | undefined) {
  let h = 0x811c9dc5
  for (const ch of (name ?? '').trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  return AVATAR_COLORS[(h >>> 0) % AVATAR_COLORS.length]!
}

/*
 * Bluesky draws a person silhouette (users) or Font Awesome Pro glyphs
 * (feeds, lists) here. Those glyphs are not ours to ship, so Splito shows the
 * name's initials on a circle or rounded square in the name's hue.
 */
let DefaultAvatar = ({
  type,
  shape: overrideShape,
  size,
  name,
}: {
  type: UserAvatarType
  shape?: 'square' | 'circle'
  size: number
  name?: string
}): React.ReactNode => {
  const t = useTheme()
  const finalShape = overrideShape ?? (type === 'user' ? 'circle' : 'square')

  const aviStyle = useMemo(() => {
    if (finalShape === 'square') {
      return {borderRadius: size > 32 ? 8 : 3, overflow: 'hidden'} as const
    }
    return {borderRadius: Math.floor(size / 2)}
  }, [finalShape, size])

  return (
    <View
      testID="userAvatarFallback"
      style={[
        a.align_center,
        a.justify_center,
        {width: size, height: size, backgroundColor: avatarColor(name)},
        aviStyle,
      ]}>
      <RNText
        style={[
          a.font_semi_bold,
          a.text_center,
          {
            color: t.palette.white,
            fontSize: Math.round(size * 0.4),
            includeFontPadding: false,
          },
        ]}
        allowFontScaling={false}
        numberOfLines={1}>
        {getInitials(name)}
      </RNText>
    </View>
  )
}
DefaultAvatar = memo(DefaultAvatar)
export {DefaultAvatar}

let UserAvatar = ({
  type = 'user',
  shape: overrideShape,
  size,
  name,
  style,
  noBorder: _noBorder,
}: UserAvatarProps): React.ReactNode => {
  const finalShape = overrideShape ?? (type === 'user' ? 'circle' : 'square')

  const containerStyle = useMemo(() => {
    return [
      {
        width: size,
        height: size,
      },
      style,
    ]
  }, [size, style])

  return (
    <View style={containerStyle}>
      {/* Bluesky's inset border frames photos; on a flat initials disc it reads as a stray ring. */}
      <DefaultAvatar type={type} shape={finalShape} size={size} name={name} />
    </View>
  )
}
UserAvatar = memo(UserAvatar)
export {UserAvatar}
