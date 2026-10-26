// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/UserAvatar.tsx
import {memo, useMemo} from 'react'
import {type StyleProp, Text as RNText, View, type ViewStyle} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'

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

/*
 * Bluesky draws a person silhouette (users) or Font Awesome Pro glyphs
 * (feeds, lists) here. Those glyphs are not ours to ship, so Splito shows the
 * name's initials on the same primary-coloured circle or rounded square.
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
        {width: size, height: size, backgroundColor: t.palette.primary_500},
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
  noBorder,
}: UserAvatarProps): React.ReactNode => {
  const finalShape = overrideShape ?? (type === 'user' ? 'circle' : 'square')

  const aviStyle = useMemo(() => {
    let borderRadius
    if (finalShape === 'square') {
      borderRadius = size > 32 ? 8 : 3
    } else {
      borderRadius = Math.floor(size / 2)
    }

    return {
      width: size,
      height: size,
      borderRadius,
    }
  }, [finalShape, size])

  const borderStyle = useMemo(() => {
    return [{borderRadius: aviStyle.borderRadius}]
  }, [aviStyle.borderRadius])

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
      <DefaultAvatar type={type} shape={finalShape} size={size} name={name} />
      {!noBorder && <MediaInsetBorder style={borderStyle} />}
    </View>
  )
}
UserAvatar = memo(UserAvatar)
export {UserAvatar}
