import 'react-native-gesture-handler' // must be first

/* Dev builds only: Metro drops this require (and the library) from production and e2e bundles. */
if (__DEV__) require('#/lib/whyDidYouRender')

import {registerRootComponent} from 'expo'
import * as SplashScreen from 'expo-splash-screen'

import App from '#/App'

/* The native splash stays until the JS launch screen (components/LaunchScreen) has drawn the same picture. */
void SplashScreen.preventAutoHideAsync()
registerRootComponent(App)
