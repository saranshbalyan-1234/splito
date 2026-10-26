import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {TabScreen} from '#/screens/TabScreen'

const SECTIONS = ['Appearance', 'Motion', 'Defaults', 'Categories', 'Regional', 'Lists', 'Notifications']

export function ProfileScreen() {
  const t = useTheme()
  return (
    <TabScreen testID="screen-profile" title="Profile">
      <View style={[a.px_xl, a.pt_lg, a.gap_xs]}>
        <Text style={[a.text_sm, a.font_bold, a.pb_xs, t.atoms.text_contrast_medium]}>SETTINGS</Text>
        {SECTIONS.map(s => (
          <View key={s} style={[a.py_md, a.px_md, a.rounded_md, t.atoms.bg_contrast_25]}>
            <Text style={[a.text_md, t.atoms.text]}>{s}</Text>
          </View>
        ))}
      </View>
    </TabScreen>
  )
}
