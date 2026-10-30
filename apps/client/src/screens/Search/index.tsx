import {useEffect} from 'react'
import {StackActions, useNavigation, useRoute} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import * as Layout from '#/components/Layout'
import {useSearchAsk} from '#/components/SearchAsk/context'
import {IS_WEB} from '#/env'

/**
 * Search is not a page (ARCHITECTURE 26.3): the old `/search?q=` link opens
 * the Search & Ask drawer with the query typed in, over Home, or over the
 * page it was pushed from.
 */
export function SearchScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute()
  const {open} = useSearchAsk()
  const query = (route.params as {q?: string} | undefined)?.q

  // A redirect, not a navigation write on mount: this route has no page to show.
  useEffect(() => {
    if (navigation.canGoBack()) navigation.goBack()
    else
      navigation.dispatch(
        IS_WEB
          ? StackActions.replace('Home')
          : StackActions.replace('Tabs', {screen: 'Home'}),
      )
    open({query})
  }, [navigation, open, query])

  return <Layout.Screen testID="screen-search-redirect" />
}
