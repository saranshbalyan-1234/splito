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
import {
  Activity_Filled_Corner0_Rounded as ActivityFilled,
  Activity_Stroke2_Corner0_Rounded as Activity,
} from '#/components/icons/Activity'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  GroupsTab_Filled_Corner0_Rounded as GroupFilled,
  GroupsTab_Stroke2_Corner0_Rounded as Group,
} from '#/components/icons/GroupsTab'
import {
  Users_Filled_Corner0_Rounded as UsersFilled,
  Users_Stroke2_Corner0_Rounded as Users,
} from '#/components/icons/Users'
import {
  SettingsGear2_Filled_Corner0_Rounded as SettingsFilled,
  SettingsGear2_Stroke2_Corner0_Rounded as Settings,
} from '#/components/icons/Settings'

/**
 * Each shared nav item's label (ARCHITECTURE 26.3): the sidebar and drawer
 * show it, the bottom bar reads it out (it has no visible labels).
 */
export const NAV_LABELS = {
  people: msg`People`,
  groups: msg`Groups`,
  analytics: msg`Analytics`,
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
  people: {icon: Users, filled: UsersFilled, widthAdjust: 1},
  groups: {icon: Group, filled: GroupFilled, widthAdjust: 1},
  analytics: {icon: ChartPie, filled: ChartPieFilled, widthAdjust: 0},
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
