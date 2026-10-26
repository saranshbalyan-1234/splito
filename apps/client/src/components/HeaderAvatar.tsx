// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/LeftNav.tsx (ProfileCard account menu)
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {HITSLOP_10} from '#/lib/constants'
import {type NavigationProp} from '#/lib/routes/types'
import {useMe, usePref} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, tokens, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {ChartPie_Stroke2_Corner0_Rounded as ChartPieIcon} from '#/components/icons/ChartPie'
import {Moon_Stroke2_Corner0_Rounded as MoonIcon} from '#/components/icons/Moon'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon} from '#/components/icons/Settings'
import {Sun_Stroke2_Corner0_Rounded as SunIcon} from '#/components/icons/Sun'
import {UserCircle_Stroke2_Corner0_Rounded as UserCircleIcon} from '#/components/icons/UserCircle'
import {HEADER_SLOT_SIZE} from '#/components/Layout/const'
import * as Menu from '#/components/Menu'

const AVATAR_SIZE = 32

/**
 * The account avatar in the last right-hand slot of each top-level header
 * (owner: "move profile icon to top right"; it replaces Bluesky's sidebar
 * account card and the Profile tab). It opens Bluesky's account menu - a
 * dropdown on web, a bottom sheet on native - with Profile, Settings,
 * Analytics and a theme shortcut that sets the `theme` preference.
 */
export function HeaderAvatar() {
  const {t: l} = useLingui()
  const t = useTheme()
  const me = useMe()
  const navigation = useNavigation<NavigationProp>()
  const [, setTheme] = usePref('theme')
  const isDark = t.scheme === 'dark'

  return (
    <Menu.Root>
      <Menu.Trigger label={l`Account menu`}>
        {({props, state, control}) => {
          const isActive =
            state.hovered || state.focused || state.pressed || control.isOpen
          return (
            <Button
              testID="header-avatar"
              label={props.accessibilityLabel}
              {...props}
              hitSlop={HITSLOP_10}
              /*
               * A halo around the avatar on hover, as Bluesky's ghost header
               * buttons highlight. It overhangs the gutter so the avatar
               * itself stays on it, and the left margin trims the button to
               * one header slot, so the empty slots on the left keep the
               * title centred.
               */
              style={[
                a.rounded_full,
                a.p_xs,
                {
                  marginVertical: -tokens.space.xs,
                  marginRight: -tokens.space.xs,
                  marginLeft: HEADER_SLOT_SIZE - AVATAR_SIZE - tokens.space.xs,
                },
                a.transition_color,
                isActive && t.atoms.bg_contrast_25,
              ]}>
              <UserAvatar name={me?.data.name} size={AVATAR_SIZE} type="user" />
            </Button>
          )
        }}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          <Menu.Item
            testID="header-menu-profile"
            label={l`Profile`}
            onPress={() => navigation.navigate('Profile')}>
            <Menu.ItemIcon icon={UserCircleIcon} />
            <Menu.ItemText>
              <Trans>Profile</Trans>
            </Menu.ItemText>
          </Menu.Item>
          <Menu.Item
            testID="header-menu-settings"
            label={l`Settings`}
            onPress={() => navigation.navigate('Settings')}>
            <Menu.ItemIcon icon={SettingsIcon} />
            <Menu.ItemText>
              <Trans>Settings</Trans>
            </Menu.ItemText>
          </Menu.Item>
          <Menu.Item
            testID="header-menu-analytics"
            label={l`Analytics`}
            onPress={() => navigation.navigate('Analytics')}>
            <Menu.ItemIcon icon={ChartPieIcon} />
            <Menu.ItemText>
              <Trans>Analytics</Trans>
            </Menu.ItemText>
          </Menu.Item>
        </Menu.Group>
        <Menu.Divider />
        <Menu.Group>
          <Menu.Item
            testID="header-menu-theme"
            label={isDark ? l`Light theme` : l`Dark theme`}
            onPress={() => void setTheme(isDark ? 'light' : 'dark')}>
            <Menu.ItemIcon icon={isDark ? SunIcon : MoonIcon} />
            <Menu.ItemText>
              {isDark ? <Trans>Light theme</Trans> : <Trans>Dark theme</Trans>}
            </Menu.ItemText>
          </Menu.Item>
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}
