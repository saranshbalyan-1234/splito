// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/RightNav.tsx (fixed right column, width, borders)
import {ScrollView, View} from 'react-native'

import {usePref} from '#/data/hooks'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {RecentGroups} from './LeftNav'
import {RecentTransactions} from './RecentTransactions'

/** Bluesky's right column width. */
export const RIGHT_NAV_WIDTH = 320

/** Width the content must leave for the right column (0 when hidden). */
export function useRightNavWidth() {
  const {gtTablet} = useBreakpoints()
  return gtTablet ? RIGHT_NAV_WIDTH : 0
}

/** Desktop right column (>= 1300px, Bluesky's breakpoint): recent transactions and recent groups. */
export function DesktopRightNav() {
  const t = useTheme()
  const width = useRightNavWidth()
  const [isLanguageShown = true] = usePref('rightColumn.languageDropdown')
  if (!width) return null
  return (
    <View
      testID="right-nav"
      style={[
        a.border_l,
        t.atoms.border_contrast_low,
        t.atoms.bg,
        web({position: 'fixed', top: 0, right: 0, bottom: 0}),
        {width},
      ]}>
      <ScrollView contentContainerStyle={[a.px_md, a.pb_2xl]}>
        <RecentTransactions />
        <RecentGroups />
      </ScrollView>
      {/* Bluesky's footer row: the language dropdown, pinned under the scrolling content (F-1816). */}
      {isLanguageShown && (
        <View style={[a.px_md, a.py_sm]}>
          <AppLanguageDropdown />
        </View>
      )}
    </View>
  )
}
