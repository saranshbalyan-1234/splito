import {lazy, Suspense, useEffect, useLayoutEffect, useState} from 'react'
import {Linking, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {BottomSheetOutlet, BottomSheetProvider} from '@bsky.app/bottom-sheet'

import {activateLanguage} from '#/locale/i18n'
import {takeInitialUrlOnce} from '#/lib/links/incoming'
import {holdSignedOutLink} from '#/lib/links/intent'
import {type PublicPage as Page, publicPageFor, publicPath} from '#/lib/links/public'
import {device} from '#/storage'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {ToastOutlet} from '#/components/Toast'
import {Login} from '#/screens/Login'
import {SLIDE_COUNT, slideFrom, Welcome} from '#/screens/Welcome'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {IS_WEB} from '#/env'
import {PublicPage} from './PublicPage'

/* A lazy chunk behind the folded dev check: a production bundle holds none of the dev banner. */
const DevBanner = __DEV__ || process.env.EXPO_PUBLIC_ENV === 'e2e' || process.env.EXPO_PUBLIC_ENV === 'preview' ? lazy(() => import('./DevBanner').then(m => ({default: m.DevBanner}))) : null

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
        {DevBanner && (
          <Suspense fallback={null}>
            <DevBanner />
          </Suspense>
        )}
        {children}
      </View>
      <BottomSheetOutlet />
      <PortalOutlet />
      <ToastOutlet />
    </BottomSheetProvider>
  )
}

type Screen = {kind: 'welcome'; slide: number; previous: number} | {kind: 'page'; page: Page} | {kind: 'continue'}

/** Web: `/welcome/3` names a slide. */
function welcomeSlideFromAddress() {
  const m = IS_WEB ? window.location.pathname.match(/^\/welcome(?:\/(\d+))?\/?$/) : null
  return m ? slideFrom(m[1]) : null
}

/** Web: the public page the address names (`/settings/help`, `/join/<token>`), if any. */
const publicPageFromAddress = () => (IS_WEB ? publicPageFor(window.location.pathname) : null)

function initialView(): Screen {
  const fromUrl = welcomeSlideFromAddress()
  if (fromUrl !== null) return {kind: 'welcome', slide: fromUrl, previous: fromUrl}
  const page = publicPageFromAddress()
  if (page) return {kind: 'page', page}
  return device.get(['tourSeen']) ? {kind: 'continue'} : {kind: 'welcome', slide: 0, previous: 0}
}

/**
 * Signed out: the intro slides the first time (and at `/welcome/N`), then the Continue screen, for every address except
 * the public ones (Help, Privacy, About, `/join/<token>`). A link to something inside the app is held here
 * (`holdSignedOutLink`) and opened after sign-in; the address bar shows the slide or page on web.
 */
export function LoggedOutApp() {
  const [view, setView] = useState<Screen>(initialView)
  const {gtMobile} = useBreakpoints()
  const t = useTheme()

  useLayoutEffect(() => {
    const chosen = device.get(['deviceLanguage'])
    if (chosen) activateLanguage(chosen)
  }, [])

  /* A deep link opened signed out is kept for after sign-in. */
  useEffect(() => {
    if (IS_WEB) {
      if (welcomeSlideFromAddress() === null) holdSignedOutLink(window.location.pathname + window.location.search)
      return
    }
    /* The launch URL is read once per process, and only `url` events after it: a log out and in never replays a handled link. */
    let isCurrent = true
    void takeInitialUrlOnce().then(url => isCurrent && url && holdSignedOutLink(url))
    const sub = Linking.addEventListener('url', ({url}) => holdSignedOutLink(url))
    return () => {
      isCurrent = false
      sub.remove()
    }
  }, [])

  /* The first visit to any other address shows slide 1 at its own: /welcome/1 (the link itself was held above). */
  useEffect(() => {
    if (IS_WEB && view.kind === 'welcome' && welcomeSlideFromAddress() === null) window.history.replaceState({}, '', `/welcome/${view.slide + 1}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Web: the address follows the slide or page, and Back/Forward move between them. */
  useEffect(() => {
    if (!IS_WEB) return
    const onPop = () => {
      const slide = welcomeSlideFromAddress()
      const page = publicPageFromAddress()
      setView(v => (slide !== null ? {kind: 'welcome', slide, previous: v.kind === 'welcome' ? v.slide : slide} : page ? {kind: 'page', page} : {kind: 'continue'}))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const showSlide = (slide: number) => {
    if (IS_WEB) window.history.pushState({}, '', `/welcome/${slide + 1}`)
    setView(v => ({kind: 'welcome', slide, previous: v.kind === 'welcome' ? v.slide : slide}))
  }

  const showContinue = () => {
    if (IS_WEB) window.history.replaceState({}, '', '/')
    setView({kind: 'continue'})
  }

  const finishIntro = () => {
    device.set(['tourSeen'], true)
    showContinue()
  }

  const showPage = (page: Exclude<Page, 'join'>) => {
    if (IS_WEB) window.history.pushState({}, '', publicPath(page))
    setView({kind: 'page', page})
  }

  return (
    <LoggedOutShell>
      {view.kind === 'welcome' ? (
        <View testID="welcome-ground" style={[a.flex_1, gtMobile && {backgroundColor: t.palette.contrast_100}]}>
          <Welcome slide={Math.min(view.slide, SLIDE_COUNT - 1)} previous={view.previous} onSlide={showSlide} onDone={finishIntro} isLanguageFromDevice />
        </View>
      ) : view.kind === 'page' ? (
        <PublicPage page={view.page} onBack={showContinue} onContinue={showContinue} />
      ) : (
        <Login onPublicPage={showPage} />
      )}
    </LoggedOutShell>
  )
}
