import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native'
import {type Entity, type Expense} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {useMutationCtx} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import * as FormSheet from '#/components/FormSheet'
import {ComposerSkeleton} from '#/components/split/ComposerSkeleton'
import {ExpenseComposer} from '#/components/split/ExpenseComposer'
import {formFromExpense} from '#/components/split/form'
import {useExpense} from '#/components/split/useExpense'
import {Text} from '#/components/Typography'

/** Edit an expense in the same composer as Add expense, prefilled. */
export function EditExpenseScreen() {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {params} = useRoute<RouteProp<AllNavigatorParams, 'EditExpense'>>()
  const {expense} = useExpense(params.expenseId)

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('Expense', {expenseId: params.expenseId})
  }

  if (expense === undefined) {
    return (
      <ComposerSkeleton
        testID="screen-edit-expense"
        title={l`Edit expense`}
        onClose={close}
      />
    )
  }
  if (expense === null || expense.deleted) {
    return <Missing onClose={close} />
  }
  return <EditForm expense={expense} onClose={close} />
}

function EditForm({
  expense,
  onClose,
}: {
  expense: Entity<Expense>
  onClose: () => void
}) {
  const {actor} = useMutationCtx()
  const [initial] = useState(() => formFromExpense(expense.data, actor))
  return (
    <ExpenseComposer
      testID="screen-edit-expense"
      initialForm={initial}
      expenseId={expense.id}
      tz={expense.data.tz}
      onClose={onClose}
    />
  )
}

function Missing({onClose}: {onClose: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <FormSheet.Screen
      testID="screen-edit-expense"
      title={l`Edit expense`}
      isDirty={false}
      onClose={onClose}>
      <View style={[a.px_xl, a.py_4xl, a.gap_xs, a.align_center]}>
        <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
          <Trans>This expense can’t be edited</Trans>
        </Text>
        <Text
          style={[
            a.text_md,
            a.text_center,
            a.leading_snug,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>It was deleted, or the link is wrong.</Trans>
        </Text>
      </View>
    </FormSheet.Screen>
  )
}
