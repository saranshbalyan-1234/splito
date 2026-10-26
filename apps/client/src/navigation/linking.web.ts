import {type LinkingOptions} from '@react-navigation/native'

import {type FlatNavigatorParams} from '#/lib/routes/types'

/** Web uses one flat stack (see `FlatNavigator`), so every path maps to a top-level route. */
export const linking: LinkingOptions<FlatNavigatorParams> = {
  prefixes: ['https://splito.app'],
  config: {
    screens: {
      People: '',
      Groups: 'groups',
      Activity: 'activity',
      Profile: 'profile',
      AddExpense: 'expense/new',
    },
  },
}
