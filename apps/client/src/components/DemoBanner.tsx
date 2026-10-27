import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useDemoMode} from '#/state/demo'
import {atoms as a} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {ButtonText} from '#/components/Button'
import * as Toast from '#/components/Toast'

/**
 * "Demo mode · Switch back" (ARCHITECTURE 26.1): shown above every header while
 * the app is on the separate demo database, so nobody mistakes the sample data
 * for their own. The button turns demo mode off and returns Home, where the
 * real data is (a page of the demo data would not exist there). Dev and e2e
 * builds only: loaded on demand (the `demoStaticImport` rule).
 */
export default function DemoBanner() {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {busy, setDemo} = useDemoMode()

  const switchBack = () =>
    setDemo(false).then(
      () => navigation.navigate('People'),
      () => Toast.show(l`Couldn’t switch back. Try again.`, {type: 'error'}),
    )

  return (
    <View testID="demo-banner" style={[a.px_md, a.pt_sm, a.pb_xs]}>
      <Admonition.Outer type="tip">
        <Admonition.Row style={a.align_center}>
          <Admonition.Icon />
          <Admonition.Content style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
            <Admonition.Text>
              <Trans>Demo mode ·</Trans>
            </Admonition.Text>
            <Admonition.Button testID="demo-banner-switch-back" label={l`Switch back`} color="secondary" disabled={busy} onPress={switchBack}>
              <ButtonText>
                <Trans>Switch back</Trans>
              </ButtonText>
            </Admonition.Button>
          </Admonition.Content>
        </Admonition.Row>
      </Admonition.Outer>
    </View>
  )
}
