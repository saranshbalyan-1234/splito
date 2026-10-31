import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type TabId} from '@splito/sync'

import {useBreakpoints} from '#/alf'
import {Sparkles_Stroke2_Corner0_Rounded as SparklesIcon} from '#/components/icons/Sparkles'
import * as Layout from '#/components/Layout'
import {IS_WEB} from '#/env'
import {useIsStartTab} from '#/state/startTab'
import {useSearchAsk} from './context'
import {SHORTCUT_HINT} from './useSearchAskHotkey'

/**
 * The Search & Ask button (ARCHITECTURE 26.3, decisions 74, 218): Lucide's Sparkles, the widely recognised AI mark,
 * in the header of the start tab only (the tab the app opens on, People by default), to the left of the page's
 * action. Every other tab draws nothing here; Cmd/Ctrl+K and "/" still open the drawer from anywhere on web.
 * Web shows the label as a tooltip, with the Cmd/Ctrl+K hint on desktop.
 */
export function SearchAskButton({tab, edge = false}: {tab: TabId; edge?: boolean}) {
  const isStart = useIsStartTab(tab)
  return isStart ? <SearchAskAction edge={edge} /> : null
}

/**
 * The left-hand slot that balances the button, so the title stays centred: there only while the button is (the start
 * tab), or the title sat half a button off centre on every other tab.
 */
export function SearchAskSpacer({tab}: {tab: TabId}) {
  return useIsStartTab(tab) ? <Layout.Header.Slot /> : null
}

function SearchAskAction({edge}: {edge: boolean}) {
  const {t: l} = useLingui()
  const {open} = useSearchAsk()
  const {gtMobile} = useBreakpoints()
  const ref = useRef<React.ComponentRef<typeof View>>(null)
  const label = l`Search or ask Splito`
  const tooltip =
    gtMobile && SHORTCUT_HINT ? `${label} (${SHORTCUT_HINT})` : label

  /* react-native-web drops `title`, so the tooltip is set on the element. */
  useEffect(() => {
    if (IS_WEB && ref.current) {
      ;(ref.current as unknown as HTMLElement).title = tooltip
    }
  }, [tooltip])

  return (
    <View ref={ref}>
      <Layout.Header.ActionButton
        testID="header-search-ask"
        label={label}
        icon={SparklesIcon}
        edge={edge}
        onPress={() => open()}
      />
    </View>
  )
}
