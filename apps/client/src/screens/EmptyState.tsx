import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import {Text} from '#/components/Typography'

/** Shared empty state; the Lottie illustration replaces the static mark in the motion task. */
export function EmptyState({title, body, children}: {title: string; body: string; children?: React.ReactNode}) {
  const t = useTheme()
  return (
    <View style={[a.flex_1, a.align_center, a.justify_center, a.gap_md, a.px_2xl, a.py_5xl]}>
      <View style={[a.rounded_full, a.p_2xl, {backgroundColor: t.palette.primary_25}]}>
        <LogoMark size={72} />
      </View>
      <Text style={[a.text_2xl, a.font_bold, a.text_center, t.atoms.text]}>{title}</Text>
      <Text style={[a.text_md, a.text_center, a.leading_snug, t.atoms.text_contrast_medium, {maxWidth: 360}]}>{body}</Text>
      <View style={[a.flex_row, a.gap_sm, a.pt_md]}>{children}</View>
    </View>
  )
}
