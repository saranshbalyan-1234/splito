import {PREFS, type PrefGroup, type PrefKey} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'

import {Bell_Stroke2_Corner0_Rounded as BellIcon} from '#/components/icons/Bell'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import {PaintRoller_Stroke2_Corner2_Rounded as PaintRollerIcon} from '#/components/icons/PaintRoller'
import {Shapes_Stroke2_Corner0_Rounded as ShapesIcon} from '#/components/icons/Shapes'
import {Shield_Stroke2_Corner0_Rounded as ShieldIcon} from '#/components/icons/Invite'
import {DefaultsIcon, TabsIcon} from '#/components/settings/icons'

/**
 * Settings pages, one per preferences-registry group that has a page, in the order the Settings list shows
 * them (F-251: seven). The `motion` and `lists` pages are gone; their old links redirect (SettingsSection).
 */
export const SETTINGS_SECTIONS = [
  'appearance',
  'navigation',
  'defaults',
  'categories',
  'regional',
  'notifications',
  'privacy',
] as const satisfies readonly PrefGroup[]
export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]

export function isSettingsSection(id: string): id is SettingsSectionId {
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
  SettingsSectionId,
  {title: string; icon: React.ComponentType<SVGIconProps>}
> {
  const {t: l} = useLingui()
  return {
    appearance: {title: l`Appearance`, icon: PaintRollerIcon},
    /* The phone bottom bar and where Splito opens (26.3). */
    navigation: {title: l`Navigation`, icon: TabsIcon},
    defaults: {title: l`Defaults`, icon: DefaultsIcon},
    categories: {title: l`Categories`, icon: ShapesIcon},
    regional: {title: l`Language and region`, icon: EarthIcon},
    notifications: {title: l`Notifications`, icon: BellIcon},
    privacy: {title: l`Privacy`, icon: ShieldIcon},
  }
}
