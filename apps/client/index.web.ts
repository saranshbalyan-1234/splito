import {registerRootComponent} from 'expo'

import App from '#/App'
import {startPwa} from '#/lib/pwa'

/* Dev builds only: Metro drops this require (and the library) from production and e2e bundles. */
if (__DEV__) require('#/lib/whyDidYouRender')

/* Before React: the browser fires its install event once, early. */
startPwa()
registerRootComponent(App)
