import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

/** Placeholder route so + navigates; the real form lands in M1 Task 10. */
export function AddExpenseScreen() {
  const t = useTheme()
  return (
    <Layout.Screen testID="screen-add-expense">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>Add expense</Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <View style={[a.p_xl]}>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>Expense form is being built (M1 Task 10).</Text>
      </View>
    </Layout.Screen>
  )
}
