import {PREFS, type PrefGroup, type PrefKey} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'

import {Bell_Stroke2_Corner0_Rounded as BellIcon} from '#/components/icons/Bell'
import {BulletList_Stroke2_Corner0_Rounded as ListIcon} from '#/components/icons/BulletList'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import {PaintRoller_Stroke2_Corner2_Rounded as PaintRollerIcon} from '#/components/icons/PaintRoller'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as SlidersIcon} from '#/components/icons/SettingsSlider'
import {Shapes_Stroke2_Corner0_Rounded as ShapesIcon} from '#/components/icons/Shapes'
import {SparklesIcon} from '#/components/settings/icons'

/** Settings pages, one per preferences-registry group, in the order the Settings list shows them. */
export const SETTINGS_SECTIONS = [
  'appearance',
  'motion',
  'defaults',
  'categories',
  'regional',
  'lists',
  'notifications',
] as const satisfies readonly PrefGroup[]

export function isSettingsSection(id: string): id is PrefGroup {
  return (SETTINGS_SECTIONS as readonly string[]).includes(id)
}

/** The registry's preferences in one group, in registry order. */
export function prefsIn(group: PrefGroup): PrefKey[] {
  return (Object.keys(PREFS) as PrefKey[]).filter(
    key => PREFS[key].group === group,
  )
}

/** Title and icon of each Settings page. */
export function useSectionInfo(): Record<
  PrefGroup,
  {title: string; icon: React.ComponentType<SVGIconProps>}
> {
  const {t: l} = useLingui()
  return {
    appearance: {title: l`Appearance`, icon: PaintRollerIcon},
    motion: {title: l`Motion and haptics`, icon: SparklesIcon},
    defaults: {title: l`Tabs and defaults`, icon: SlidersIcon},
    categories: {title: l`Categories`, icon: ShapesIcon},
    regional: {title: l`Language and region`, icon: EarthIcon},
    /* What the People list shows and in what order; "Lists" alone said nothing. */
    lists: {title: l`Sorting and filters`, icon: ListIcon},
    notifications: {title: l`Notifications`, icon: BellIcon},
  }
}
