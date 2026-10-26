// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/FeedCard.tsx
import {View} from 'react-native'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/*
 * Bluesky's feed/list card layout, used for Splito groups. The feed-specific
 * parts (save/pin buttons, likes, live-event badge, rich-text description,
 * prefetching links) are removed; the byline is passed in as text.
 */

export function Outer({children}: {children: React.ReactNode}) {
  return <View style={[a.w_full, a.gap_sm]}>{children}</View>
}

export function Header({children}: {children: React.ReactNode}) {
  return <View style={[a.flex_row, a.align_center, a.gap_sm]}>{children}</View>
}

export type AvatarProps = {name: string | undefined; size?: number}

export function Avatar({name, size = 40}: AvatarProps) {
  return <UserAvatar type="algo" size={size} name={name} />
}

export function AvatarPlaceholder({size = 40}: {size?: number}) {
  const t = useTheme()
  return (
    <View
      style={[
        t.atoms.bg_contrast_25,
        {
          width: size,
          height: size,
          borderRadius: 8,
        },
      ]}
    />
  )
}

export function TitleAndByline({
  title,
  byline,
}: {
  title: string
  byline?: string
}) {
  const t = useTheme()

  return (
    <View style={[a.flex_1]}>
      <Text
        emoji
        style={[a.text_md, a.font_semi_bold, a.leading_snug]}
        numberOfLines={1}>
        {title}
      </Text>
      {byline && (
        <Text
          style={[a.leading_snug, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {byline}
        </Text>
      )}
    </View>
  )
}

export function TitleAndBylinePlaceholder({creator}: {creator?: boolean}) {
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

      {creator && (
        <View
          style={[
            a.rounded_xs,
            t.atoms.bg_contrast_25,
            {
              width: '40%',
              height: 10,
            },
          ]}
        />
      )}
    </View>
  )
}
