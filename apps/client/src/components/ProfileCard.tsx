// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/ProfileCard.tsx
import {
  type StyleProp,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'

import {atoms as a, useTheme, type ViewStyleProp} from '#/alf'
import {Text} from '#/components/Typography'

/*
 * Bluesky's card is built around an AT Protocol profile view (moderation,
 * follow button, badges, rich-text bio). Splito people are a local name, so
 * the card takes the name directly and the follow/label/bio parts are removed.
 */
type Profile = {name: string}

export function Outer({
  children,
}: {
  children: React.ReactNode | React.ReactNode[]
}) {
  return <View style={[a.w_full, a.flex_1, a.gap_xs]}>{children}</View>
}

export function Header({
  children,
}: {
  children: React.ReactNode | React.ReactNode[]
}) {
  return <View style={[a.flex_row, a.align_center, a.gap_sm]}>{children}</View>
}

export function AvatarPlaceholder({size = 40}: {size?: number}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.rounded_full,
        t.atoms.bg_contrast_50,
        {
          width: size,
          height: size,
        },
      ]}
    />
  )
}

/** Name over a secondary line; Bluesky's second line is the @handle. */
export function NameAndHandle({
  profile,
  handle,
}: {
  profile: Profile
  handle?: React.ReactNode
}) {
  return (
    <View style={[a.flex_1]}>
      <Name profile={profile} />
      {handle}
    </View>
  )
}

export function Name({
  profile,
  style,
  textStyle,
}: {
  profile: Profile
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}) {
  const name = profile.name
  return (
    <View style={[a.flex_row, a.align_center, a.max_w_full, style]}>
      <Text
        emoji
        style={[
          a.text_md,
          a.font_semi_bold,
          a.leading_snug,
          a.self_start,
          a.flex_shrink,
          textStyle,
        ]}
        numberOfLines={1}>
        {name}
      </Text>
    </View>
  )
}

export function Handle({
  text,
  textStyle,
}: {
  text: string
  textStyle?: StyleProp<TextStyle>
}) {
  const t = useTheme()

  return (
    <Text
      emoji
      style={[a.leading_snug, t.atoms.text_contrast_medium, textStyle]}
      numberOfLines={1}>
      {text}
    </Text>
  )
}

export function NameAndHandlePlaceholder() {
  const t = useTheme()

  return (
    <View style={[a.flex_1, a.gap_xs]}>
      <View
        style={[
          a.rounded_xs,
          t.atoms.bg_contrast_50,
          {
            width: '60%',
            height: 14,
          },
        ]}
      />

      <View
        style={[
          a.rounded_xs,
          t.atoms.bg_contrast_50,
          {
            width: '40%',
            height: 10,
          },
        ]}
      />
    </View>
  )
}

export function NamePlaceholder({style}: ViewStyleProp) {
  const t = useTheme()

  return (
    <View
      style={[
        a.rounded_xs,
        t.atoms.bg_contrast_50,
        {
          width: '60%',
          height: 14,
        },
        style,
      ]}
    />
  )
}
