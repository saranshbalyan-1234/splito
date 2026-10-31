import {StyleSheet} from 'react-native'
import {msg} from '@lingui/core/macro'
import {type NavItemId} from '@splito/sync'

import {styles} from '#/view/shell/bottom-bar/BottomBarStyles'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {
  ChartPie_Filled_Corner0_Rounded as ChartPieFilled,
  ChartPie_Stroke2_Corner0_Rounded as ChartPie,
} from '#/components/icons/ChartPie'
import {MorphIcon} from '#/components/anim/AnimatedIcon'
import {
  ActivityTick_Filled_Corner0_Rounded as ActivityFilled,
  ActivityTick_Stroke2_Corner0_Rounded as Activity,
} from '#/components/icons/Activity'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  GroupsTab_Filled_Corner0_Rounded as GroupFilled,
  GroupsTab_Stroke2_Corner0_Rounded as Group,
} from '#/components/icons/GroupsTab'
import {
  ContactRound_Filled_Corner0_Rounded as UsersFilled,
  ContactRound_Stroke2_Corner0_Rounded as Users,
} from '#/components/icons/ContactRound'
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
  home: msg`Home`,
  people: msg`People`,
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
  home: {
    icon: Home,
    filled: HomeFilled,
    widthAdjust: 1,
    style: styles.homeIcon,
  },
  people: {icon: Users, filled: UsersFilled, widthAdjust: 1},
  groups: {icon: Group, filled: GroupFilled, widthAdjust: 1},
  analytics: {icon: ChartPie, filled: ChartPieFilled, widthAdjust: 0},
  ask: {icon: Sparkles, filled: SparklesFilled, widthAdjust: 0},
  activity: {icon: Activity, filled: ActivityFilled, widthAdjust: 0},
  settings: {icon: Settings, filled: SettingsFilled, widthAdjust: 0},
}

/** The bottom bar's visible label under a glyph, shown while the bar holds 5 items or fewer (ARCHITECTURE 26.3). */
export function TabLabel({label, isActive}: {label: string; isActive: boolean}) {
  const t = useTheme()
  return (
    <Text
      testID="tab-label"
      numberOfLines={1}
      maxFontSizeMultiplier={1.2}
      style={[
        a.text_center,
        {fontSize: 10, lineHeight: 12, marginTop: 1},
        isActive ? [a.font_semi_bold, t.atoms.text] : t.atoms.text_contrast_medium,
      ]}>
      {label}
    </Text>
  )
}

/** The bar shows labels up to this many items; beyond it they hide and the icons stay (decision 84). */
export const MAX_LABELLED_TABS = 5

/** Activity's unread badge ('', '3', '30+') as a number that goes up when an item lands: the pulse ticks on it. */
export function badgeTick(badge?: string) {
  return badge === undefined ? undefined : Number.parseInt(badge, 10) || 0
}

/** A bottom-bar tab's glyph, morphing to its filled form when active. */
export function TabGlyph({
  tab,
  isActive,
  size,
  badge,
}: {
  tab: NavItemId
  isActive: boolean
  size: number
  /** Activity's unread badge; a rise ticks the pulse. */
  badge?: string
}) {
  const t = useTheme()
  const glyph = GLYPHS[tab]
  return (
    <MorphIcon
      outline={glyph.icon}
      filled={glyph.filled}
      isActive={isActive}
      playKey={badgeTick(badge)}
      aria-hidden={true}
      width={size + glyph.widthAdjust}
      style={StyleSheet.flatten([styles.ctrlIcon, t.atoms.text, glyph.style])}
    />
  )
}
