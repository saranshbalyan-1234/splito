import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {FAB} from '#/view/com/util/fab/FAB'
import {useFabInset} from '#/view/com/util/fab/FABInner'
import {useTheme} from '#/alf'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'

/**
 * Bluesky's compose FAB, opening Add expense. `RouteFAB` renders it from the
 * route allow-list (owner 190); `FAB` itself hides it at tablet and desktop
 * widths, where the sidebar's pill is the compose action.
 */
export function AddExpenseFAB({
  personId,
  groupId,
}: {
  personId?: string
  groupId?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  return (
    <FAB
      testID="fab-add"
      onPress={() => navigation.navigate('AddExpense', {personId, groupId})}
      icon={<PlusIcon size="lg" fill={t.palette.white} />}
      accessibilityRole="button"
      accessibilityLabel={l({message: 'Add expense', context: 'action'})}
      accessibilityHint=""
    />
  )
}

/**
 * A list's footer spacer on phones: the FAB's height plus a margin above
 * the bottom bar, so the FAB never covers the last row once scrolled to
 * the end (owner rule 9 polish). Renders nothing on wider screens.
 */
export function AddExpenseFABInset() {
  const height = useFabInset()
  return height > 0 ? <View testID="fab-inset" style={{height}} /> : null
}
