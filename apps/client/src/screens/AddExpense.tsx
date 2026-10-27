import {useState} from 'react'
import {useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native'
import {type Entity, type Group, type Person} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {useEntities, useMe, usePref} from '#/data/hooks'
import {ComposerSkeleton} from '#/components/split/ComposerSkeleton'
import {readDraft} from '#/components/split/drafts'
import {ExpenseComposer} from '#/components/split/ExpenseComposer'
import {emptyForm, type ExpenseForm, pruneForm} from '#/components/split/form'
import {todayIn} from '#/locale/dates'
import {useTimeZone} from '#/locale/useDates'

/**
 * Add expense, opened from the sidebar pill or the FAB exactly the way
 * Bluesky opens its composer: a modal route on native, a centred dialog
 * over the current page on web. Opened from a group or a person, it starts
 * with them (and the group's currency).
 */
export function AddExpenseScreen() {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {params} = useRoute<RouteProp<AllNavigatorParams, 'AddExpense'>>()
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const [currency] = usePref('defaultCurrency')
  const [mode] = usePref('defaultSplitMode')
  const [adjustModes] = usePref('itemizeAdjustmentModes')
  const [isRoundingCash] = usePref('split.roundCash')
  const [roundTo] = usePref('split.roundTo')
  const tz = useTimeZone()

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('People')
  }

  if (
    !me ||
    !people ||
    !groups ||
    !currency ||
    !mode ||
    !adjustModes ||
    isRoundingCash === undefined ||
    roundTo === undefined
  ) {
    return (
      <ComposerSkeleton
        testID="screen-add-expense"
        title={l({message: 'Add expense', context: 'action'})}
        onClose={close}
      />
    )
  }

  return (
    <AddExpenseForm
      me={me.id}
      people={people}
      groups={groups}
      currency={currency}
      mode={mode}
      adjustModes={adjustModes}
      roundTo={isRoundingCash ? roundTo : 0}
      tz={tz}
      personId={params?.personId}
      groupId={params?.groupId}
      onClose={close}
    />
  )
}

function AddExpenseForm({
  me,
  people,
  groups,
  currency,
  mode,
  adjustModes,
  roundTo,
  tz,
  personId,
  groupId,
  onClose,
}: {
  me: string
  people: Entity<Person>[]
  groups: Entity<Group>[]
  currency: string
  mode: ExpenseForm['mode']
  adjustModes: ExpenseForm['adjustModes']
  /** Cash rounding new splits start with (the `split.roundCash` / `split.roundTo` preferences); 0 is off. */
  roundTo: number
  tz: string
  personId?: string
  groupId?: string
  onClose: () => void
}) {
  const context = {personId, groupId}
  const [fresh] = useState(() => {
    const group = groups.find(g => g.id === groupId)
    if (group) {
      const members = group.data.members
        .filter(m => m.leftAt === null)
        .map(m => m.personId)
      return emptyForm({
        me,
        currency: group.data.currency,
        date: todayIn(tz),
        people: members,
        groupId: group.id,
        mode,
        adjustModes,
        roundTo,
      })
    }
    const person = people.find(p => p.id === personId)
    return emptyForm({
      me,
      currency,
      date: todayIn(tz),
      people: person ? [person.id] : [],
      groupId: null,
      mode,
      adjustModes,
      roundTo,
    })
  })
  const [draft] = useState(() => {
    const d = readDraft(context)
    if (!d) return undefined
    // People removed since the draft was written drop out of every field of it.
    const alive = new Set(people.map(p => p.id))
    const isGroupAlive = !d.groupId || groups.some(g => g.id === d.groupId)
    return isGroupAlive ? pruneForm(d, alive) : undefined
  })

  return (
    <ExpenseComposer
      testID="screen-add-expense"
      initialForm={draft ?? fresh}
      freshForm={fresh}
      tz={tz}
      draftContext={context}
      isDraftRestored={!!draft}
      onClose={onClose}
    />
  )
}
