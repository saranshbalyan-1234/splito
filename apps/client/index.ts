import 'react-native-gesture-handler' // must be first

/* Dev builds only: Metro drops this require (and the library) from production and e2e bundles. */
if (__DEV__) require('#/lib/whyDidYouRender')

import {registerRootComponent} from 'expo'

import App from '#/App'

registerRootComponent(App)
