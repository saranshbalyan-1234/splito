import {type LinkingOptions} from '@react-navigation/native'

import {type RootStackParams} from '#/lib/routes/types'

export const linking: LinkingOptions<RootStackParams> = {
  prefixes: ['splito://', 'https://splito.app'],
  config: {
    screens: {
      Tabs: {
        screens: {
          People: '',
          Groups: 'groups',
          Activity: 'activity',
          Profile: 'profile',
        },
      },
      Person: 'people/:personId',
      Group: 'groups/:groupId',
      AddExpense: 'expense/new',
      Settings: 'settings',
    },
  },
}
