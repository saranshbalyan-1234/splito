import {registerRootComponent} from 'expo'

import App from '#/App'
import {startPwa} from '#/lib/pwa'

/* Before React: the browser fires its install event once, early. */
startPwa()
registerRootComponent(App)
