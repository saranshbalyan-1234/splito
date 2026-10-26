import {Pressable, View} from 'react-native'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Logo} from '#/components/brand/Logo'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

/** Tab page frame. Phones show the logo (inactive on People); `title` is omitted on People by design. */
export function TabScreen({testID, title, isHome = false, children}: {testID: string; title?: string; isHome?: boolean; children: React.ReactNode}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const navigation = useNavigation<NavigationProp>()
  return (
    <Layout.Screen testID={testID}>
      {!gtMobile && (
        <View style={[a.flex_row, a.align_center, a.justify_between, a.px_lg, a.py_md, a.border_b, t.atoms.border_contrast_low]}>
          <Pressable testID="logo" accessibilityRole="link" accessibilityLabel="Splito home" aria-disabled={isHome} disabled={isHome} onPress={() => navigation.navigate('People')}>
            <Logo size={24} />
          </Pressable>
        </View>
      )}
      <Layout.Content contentContainerStyle={[a.flex_1]}>
        {title && <Text role="heading" style={[a.text_3xl, a.font_bold, a.px_xl, a.pt_xl, t.atoms.text]}>{title}</Text>}
        {children}
      </Layout.Content>
    </Layout.Screen>
  )
}
