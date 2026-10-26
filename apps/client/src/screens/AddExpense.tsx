/* STUB-OWNER: expense - the form body is a placeholder until the expense stream replaces it. The presentation (Composer.Outer + TopBar) is the shell's and stays. */
import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import * as Composer from '#/components/Composer'
import {Text} from '#/components/Typography'

/**
 * Add expense, opened from the sidebar pill or the FAB exactly the way
 * Bluesky opens its composer: a modal route on native, a centred dialog
 * over the current page on web.
 */
export function AddExpenseScreen() {
  const t = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const close = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      navigation.navigate('People')
    }
  }

  return (
    <Composer.Outer testID="screen-add-expense" onDismiss={close}>
      <Composer.TopBar onCancel={close} onSave={() => {}} canSave={false} />
      <View style={[a.px_xl, a.pt_md, a.pb_2xl, a.gap_xs]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          <Trans>Add expense</Trans>
        </Text>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>This screen is being built</Trans>
        </Text>
      </View>
    </Composer.Outer>
  )
}
