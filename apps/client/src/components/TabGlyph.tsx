import {StyleSheet} from 'react-native'
import {msg} from '@lingui/core/macro'
import {type TabId} from '@splito/sync'

import {styles} from '#/view/shell/bottom-bar/BottomBarStyles'
import {useTheme} from '#/alf'
import {
  Activity_Filled_Corner0_Rounded as ActivityFilled,
  Activity_Stroke2_Corner0_Rounded as Activity,
} from '#/components/icons/Activity'
import {
  ChartPie_Filled_Corner0_Rounded as ChartPieFilled,
  ChartPie_Stroke2_Corner0_Rounded as ChartPie,
} from '#/components/icons/ChartPie'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  Group3_Filled_Corner0_Rounded as GroupFilled,
  Group3_Stroke2_Corner0_Rounded as Group,
} from '#/components/icons/Group'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilled,
  HomeOpen_Stoke2_Corner0_Rounded as Home,
} from '#/components/icons/HomeOpen'

/** Each tab's accessibility label (bottom bars have no visible labels). */
export const TAB_LABELS = {
  people: msg`People`,
  groups: msg`Groups`,
  analytics: msg`Analytics`,
  activity: msg`Activity`,
} satisfies Record<TabId, unknown>

/* Glyphs per tab, nudged as upstream nudges its bottom-bar glyphs. */
const GLYPHS: Record<
  TabId,
  {
    icon: React.ComponentType<SVGIconProps>
    filled: React.ComponentType<SVGIconProps>
    widthAdjust: number
    style?: object
  }
> = {
  people: {icon: Home, filled: HomeFilled, widthAdjust: 1, style: styles.homeIcon},
  groups: {icon: Group, filled: GroupFilled, widthAdjust: 1},
  analytics: {icon: ChartPie, filled: ChartPieFilled, widthAdjust: 0},
  activity: {icon: Activity, filled: ActivityFilled, widthAdjust: 0},
}

/** A bottom-bar tab's glyph, filled when active. */
export function TabGlyph({
  tab,
  isActive,
  size,
}: {
  tab: TabId
  isActive: boolean
  size: number
}) {
  const t = useTheme()
  const glyph = GLYPHS[tab]
  const Icon = isActive ? glyph.filled : glyph.icon
  return (
    <Icon
      aria-hidden={true}
      width={size + glyph.widthAdjust}
      style={StyleSheet.flatten([styles.ctrlIcon, t.atoms.text, glyph.style])}
    />
  )
}
