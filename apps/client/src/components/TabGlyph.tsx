import {StyleSheet} from 'react-native'
import {msg} from '@lingui/core/macro'
import {type NavItemId} from '@splito/sync'

import {styles} from '#/view/shell/bottom-bar/BottomBarStyles'
import {useTheme} from '#/alf'
import {
  ChartPie_Filled_Corner0_Rounded as ChartPieFilled,
  ChartPie_Stroke2_Corner0_Rounded as ChartPie,
} from '#/components/icons/ChartPie'
import {
  Activity_Filled_Corner0_Rounded as ActivityFilled,
  Activity_Stroke2_Corner0_Rounded as Activity,
} from '#/components/icons/Activity'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  Group3_Filled_Corner0_Rounded as GroupFilled,
  Group3_Stroke2_Corner0_Rounded as Group,
} from '#/components/icons/Group'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilled,
  HomeOpen_Stoke2_Corner0_Rounded as Home,
} from '#/components/icons/HomeOpen'
import {
  SettingsGear2_Filled_Corner0_Rounded as SettingsFilled,
  SettingsGear2_Stroke2_Corner0_Rounded as Settings,
} from '#/components/icons/Settings'
import {
  Sparkles_Filled_Corner0_Rounded as SparklesFilled,
  Sparkles_Stroke2_Corner0_Rounded as Sparkles,
} from '#/components/icons/Sparkles'

/**
 * Each shared nav item's label (ARCHITECTURE 26.3): the sidebar and drawer
 * show it, the bottom bar reads it out (it has no visible labels).
 */
export const NAV_LABELS = {
  people: msg`Home`,
  groups: msg`Groups`,
  analytics: msg`Analytics`,
  ask: msg`Ask Splito`,
  activity: msg`Activity`,
  settings: msg`Settings`,
} satisfies Record<NavItemId, unknown>

/* Glyphs per item, nudged as upstream nudges its bottom-bar glyphs. */
export const GLYPHS: Record<
  NavItemId,
  {
    icon: React.ComponentType<SVGIconProps>
    filled: React.ComponentType<SVGIconProps>
    widthAdjust: number
    style?: object
  }
> = {
  people: {
    icon: Home,
    filled: HomeFilled,
    widthAdjust: 1,
    style: styles.homeIcon,
  },
  groups: {icon: Group, filled: GroupFilled, widthAdjust: 1},
  analytics: {icon: ChartPie, filled: ChartPieFilled, widthAdjust: 0},
  ask: {icon: Sparkles, filled: SparklesFilled, widthAdjust: 0},
  activity: {icon: Activity, filled: ActivityFilled, widthAdjust: 0},
  settings: {icon: Settings, filled: SettingsFilled, widthAdjust: 0},
}

/** A bottom-bar tab's glyph, filled when active. */
export function TabGlyph({
  tab,
  isActive,
  size,
}: {
  tab: NavItemId
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
