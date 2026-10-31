// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/index.web.tsx
import {View} from 'react-native'

import {SearchAskProvider} from '#/features/searchAsk/SearchAskProvider'
import {FeedbackProvider} from '#/features/feedback/FeedbackProvider'
import {FlatNavigator, RoutesContainer} from '#/navigation/Navigation'
import {atoms as a, useTheme} from '#/alf'
import {DemoBusy} from '#/components/DemoBusy'
import {Outlet as PortalOutlet} from '#/components/Portal'

/* The navigator's layout, so it can read the navigation state: a search result can navigate. */
function searchLayout({children}: {children: React.ReactNode}) {
  return <SearchAskProvider>{children}</SearchAskProvider>
}

/*
 * Bluesky's web shell also mounts its phone drawer, the composer, global dialogs (sign-in, report, muted words ...),
 * age-assurance and account status screens. Splito has no side drawer (owner 217: a phone has the bottom bar, wider
 * screens the sidebar) and none of the others, so the navigator and the portal outlet remain.
 */
function ShellInner() {
  return (
    <FeedbackProvider>
      <FlatNavigator layout={searchLayout} />
      <PortalOutlet />
      <DemoBusy />
    </FeedbackProvider>
  )
}

export function Shell() {
  const t = useTheme()
  return (
    <View style={[a.util_screen_outer, t.atoms.bg]}>
      <RoutesContainer>
        <ShellInner />
      </RoutesContainer>
    </View>
  )
}
