// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Divider.tsx
import {View} from 'react-native'

import {atoms as a, useTheme, type ViewStyleProp} from '#/alf'

export function Divider({style}: ViewStyleProp) {
  const t = useTheme()

  return (
    <View style={[a.w_full, a.border_t, t.atoms.border_contrast_low, style]} />
  )
}
