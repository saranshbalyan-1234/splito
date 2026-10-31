// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/index.tsx
import {useEffect} from 'react'
import {View} from 'react-native'
import {SystemBars} from 'react-native-edge-to-edge'
import * as SystemUI from 'expo-system-ui'
import {BottomSheetOutlet, BottomSheetProvider} from '@bsky.app/bottom-sheet'

import {useDialogFullyExpandedCountContext} from '#/state/dialogs'
import {SearchAskProvider} from '#/features/searchAsk/SearchAskProvider'
import {FeedbackProvider} from '#/features/feedback/FeedbackProvider'
import {RoutesContainer, TabsNavigator} from '#/navigation/Navigation'
import {atoms as a, useTheme} from '#/alf'
import {DemoBusy} from '#/components/DemoBusy'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {IS_ANDROID, IS_IOS, IS_LIQUID_GLASS} from '#/env'

/* The navigator's layout, so it can read the navigation state: a search result can navigate. */
function searchLayout({children}: {children: React.ReactNode}) {
  return <SearchAskProvider>{children}</SearchAskProvider>
}

/*
 * Bluesky's native shell also mounts its drawer, the composer, global dialogs, push-notification and OTA hooks and
 * account status screens. Splito has no side drawer (owner 217: a phone has the bottom bar) and none of the others yet,
 * so the navigator and portal outlets remain; the system bars are mounted in Shell below, as upstream. Upstream's
 * native App.tsx holds BottomSheetProvider; Splito's App.tsx also serves web, so the native shell holds it: without it
 * every Dialog sheet fails to render.
 */
function ShellInner() {
  return (
    <FeedbackProvider>
      <View style={[a.h_full]}>
        <TabsNavigator layout={searchLayout} />
      </View>
      <PortalOutlet />
      <BottomSheetOutlet />
      <DemoBusy />
    </FeedbackProvider>
  )
}

export function Shell() {
  const t = useTheme()
  const fullyExpandedCount = useDialogFullyExpandedCountContext()

  /* Upstream's setSystemUITheme (src/alf/util/systemUI.ts): the root view shows behind the keyboard and sheets on Android. */
  useEffect(() => {
    if (!IS_ANDROID) return
    SystemUI.setBackgroundColorAsync(t.atoms.bg.backgroundColor).catch(() => {
      /* Rejects with 'The current activity is no longer available' - no big deal. */
    })
  }, [t])

  return (
    <View testID="mobileShellView" style={[a.h_full, t.atoms.bg]}>
      <SystemBars
        hidden={{statusBar: false, navigationBar: false}}
        style={{
          statusBar:
            t.name !== 'light' ||
            (IS_IOS && !IS_LIQUID_GLASS && fullyExpandedCount > 0)
              ? 'light'
              : 'dark',
          navigationBar: t.name !== 'light' ? 'light' : 'dark',
        }}
      />
      <BottomSheetProvider>
        <RoutesContainer>
          <ShellInner />
        </RoutesContainer>
      </BottomSheetProvider>
    </View>
  )
}
