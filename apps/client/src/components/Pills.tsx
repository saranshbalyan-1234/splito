// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Pills.tsx
import {useMemo} from 'react'
import {View} from 'react-native'

import {atoms as a, useTheme, type ViewStyleProp} from '#/alf'
import {Text} from '#/components/Typography'

/*
 * Bluesky's moderation-label pills (`Label`, `LabelBase`, "Reposts hidden")
 * are removed. `Tag` is Bluesky's static "Follows you" pill with its text
 * passed in; Splito uses it for the groups behind a balance.
 */

export type CommonProps = {
  size?: 'sm' | 'lg'
}

export function Row({
  children,
  style,
  size = 'sm',
}: {children: React.ReactNode | React.ReactNode[]} & CommonProps &
  ViewStyleProp) {
  const styles = useMemo(() => {
    switch (size) {
      case 'lg':
        return [{gap: 5}]
      case 'sm':
      default:
        return [{gap: 3}]
    }
  }, [size])
  return (
    <View style={[a.flex_row, a.flex_wrap, a.gap_xs, styles, style]}>
      {children}
    </View>
  )
}

export function Tag({
  size = 'sm',
  children,
}: CommonProps & {children: React.ReactNode}) {
  const t = useTheme()

  const variantStyles = useMemo(() => {
    switch (size) {
      case 'sm':
      case 'lg':
      default:
        return [
          {
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 4,
          },
        ]
    }
  }, [size])

  return (
    <View style={[variantStyles, a.justify_center, t.atoms.bg_contrast_50]}>
      <Text style={[a.text_xs, a.leading_tight]}>{children}</Text>
    </View>
  )
}
