import {useEffect, useLayoutEffect, useState} from 'react'
import {Linking, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {BottomSheetOutlet, BottomSheetProvider} from '@bsky.app/bottom-sheet'

import {activateLanguage} from '#/locale/i18n'
import {holdSignedOutLink} from '#/lib/links/intent'
import {device} from '#/storage'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {Login} from '#/screens/Login'
import {SLIDE_COUNT, slideFrom, Welcome} from '#/screens/Welcome'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {IS_WEB} from '#/env'
import {DevBanner} from './DevBanner'

/**
 * What a signed-out device (or one blocked on a missing contact) shows instead of the app (ARCHITECTURE 26.15): the same
 * theme and language, the sheets and dialogs the forms use, and nothing of the ledger. No store is open under it.
 */
export function LoggedOutShell({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <BottomSheetProvider>
      <View testID="logged-out" style={[a.util_screen_outer, a.flex_1, t.atoms.bg, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
        <DevBanner />
        {children}
      </View>
      <BottomSheetOutlet />
      <PortalOutlet />
    </BottomSheetProvider>
  )
}

type Screen = {kind: 'welcome'; slide: number; previous: number} | {kind: 'continue'}

/** Web: `/welcome/3` names a slide. */
function welcomeSlideFromAddress() {
  const m = IS_WEB ? window.location.pathname.match(/^\/welcome(?:\/(\d+))?\/?$/) : null
  return m ? slideFrom(m[1]) : null
}

function initialView(): Screen {
  const fromUrl = welcomeSlideFromAddress()
  if (fromUrl !== null) return {kind: 'welcome', slide: fromUrl, previous: fromUrl}
  return device.get(['tourSeen']) ? {kind: 'continue'} : {kind: 'welcome', slide: 0, previous: 0}
}

/**
 * Signed out: the intro slides the first time (and at `/welcome/N`), then the Continue screen, for every address. A
 * link to something inside the app is held here (`holdSignedOutLink`) and opened after sign-in; the address bar shows
 * the slide on web.
 */
export function LoggedOutApp() {
  const [view, setView] = useState<Screen>(initialView)
  const {gtMobile} = useBreakpoints()
  const t = useTheme()

  useLayoutEffect(() => {
    const chosen = device.get(['language'])
    if (chosen) activateLanguage(chosen)
  }, [])

  /* A deep link opened signed out is kept for after sign-in. */
  useEffect(() => {
    if (IS_WEB) {
      if (welcomeSlideFromAddress() === null) holdSignedOutLink(window.location.pathname + window.location.search)
      return
    }
    void Linking.getInitialURL().then(url => url && holdSignedOutLink(url))
    const sub = Linking.addEventListener('url', ({url}) => holdSignedOutLink(url))
    return () => sub.remove()
  }, [])

  /* The first visit to any other address shows slide 1 at its own: /welcome/1 (the link itself was held above). */
  useEffect(() => {
    if (IS_WEB && view.kind === 'welcome' && welcomeSlideFromAddress() === null) window.history.replaceState({}, '', `/welcome/${view.slide + 1}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Web: the address follows the slide, and Back/Forward move between slides. */
  useEffect(() => {
    if (!IS_WEB) return
    const onPop = () => {
      const slide = welcomeSlideFromAddress()
      setView(v => (slide === null ? {kind: 'continue'} : {kind: 'welcome', slide, previous: v.kind === 'welcome' ? v.slide : slide}))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const showSlide = (slide: number) => {
    if (IS_WEB) window.history.pushState({}, '', `/welcome/${slide + 1}`)
    setView(v => ({kind: 'welcome', slide, previous: v.kind === 'welcome' ? v.slide : slide}))
  }

  const finishIntro = () => {
    device.set(['tourSeen'], true)
    if (IS_WEB) window.history.replaceState({}, '', '/')
    setView({kind: 'continue'})
  }

  return (
    <LoggedOutShell>
      {view.kind === 'welcome' ? (
        <View testID="welcome-ground" style={[a.flex_1, gtMobile && {backgroundColor: t.palette.contrast_100}]}>
          <Welcome slide={Math.min(view.slide, SLIDE_COUNT - 1)} previous={view.previous} onSlide={showSlide} onDone={finishIntro} isLanguageFromDevice />
        </View>
      ) : (
        <Login />
      )}
    </LoggedOutShell>
  )
}
