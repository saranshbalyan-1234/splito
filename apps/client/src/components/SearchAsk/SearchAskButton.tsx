import {useEffect, useRef} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useBreakpoints} from '#/alf'
import {Sparkles_Stroke2_Corner0_Rounded as SparklesIcon} from '#/components/icons/Sparkles'
import * as Layout from '#/components/Layout'
import {IS_WEB} from '#/env'
import {useSearchAsk} from './context'
import {SHORTCUT_HINT} from './useSearchAskHotkey'

/**
 * The Search & Ask button (ARCHITECTURE 26.3, decision 74): Lucide's
 * Sparkles, the widely recognised AI mark, in every top-level header to the
 * left of the page's action. It opens the one drawer for search and AI.
 * Web shows the label as a tooltip, with the Cmd/Ctrl+K hint on desktop.
 */
export function SearchAskButton() {
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
        onPress={() => open()}
      />
    </View>
  )
}
