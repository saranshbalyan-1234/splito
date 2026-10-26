// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/Drawer.tsx
import {type JSX} from 'react'
import {ScrollView, TouchableOpacity, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useNavigationState} from '@react-navigation/native'

import {getCurrentRoute} from '#/lib/routes/helpers'
import {type NavigationProp} from '#/lib/routes/types'
import {useSetDrawerOpen} from '#/state/shell'
import {useMe, usePref} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, tokens, useTheme, web} from '#/alf'
import {useActivityBadge} from '#/components/activity/useActivityFeed'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {Divider} from '#/components/Divider'
import * as Toggle from '#/components/forms/Toggle'
import {
  Bell_Filled_Corner0_Rounded as BellFilledIcon,
  Bell_Stroke2_Corner0_Rounded as BellIcon,
} from '#/components/icons/Bell'
import {
  ChartPie_Filled_Corner0_Rounded as ChartPieFilledIcon,
  ChartPie_Stroke2_Corner0_Rounded as ChartPieIcon,
} from '#/components/icons/ChartPie'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  Group3_Filled_Corner0_Rounded as GroupFilledIcon,
  Group3_Stroke2_Corner0_Rounded as GroupIcon,
} from '#/components/icons/Group'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilledIcon,
  HomeOpen_Stoke2_Corner0_Rounded as HomeIcon,
} from '#/components/icons/HomeOpen'
import {Moon_Stroke2_Corner0_Rounded as MoonIcon} from '#/components/icons/Moon'
import {
  SettingsGear2_Filled_Corner0_Rounded as SettingsFilledIcon,
  SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon,
} from '#/components/icons/Settings'
import {
  UserCircle_Filled_Corner0_Rounded as UserCircleFilledIcon,
  UserCircle_Stroke2_Corner0_Rounded as UserCircleIcon,
} from '#/components/icons/UserCircle'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'

const iconWidth = 26

type DrawerRoute =
  'People' | 'Groups' | 'Analytics' | 'Profile' | 'Settings' | 'Notifications'

/** Pushed pages keep their section highlighted, as Bluesky's tabs do. */
const SECTION_OF: Record<string, DrawerRoute> = {
  Person: 'People',
  AddFriend: 'People',
  Group: 'Groups',
  CreateGroup: 'Groups',
  Settle: 'Groups',
  SettingsSection: 'Settings',
}

/*
 * Bluesky's profile card shows the handle and follower counts; Splito shows
 * where the data lives instead (local until sign-in and sync exist).
 */
function DrawerProfileCard({onPressProfile}: {onPressProfile: () => void}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const me = useMe()

  return (
    <TouchableOpacity
      testID="drawer-profile-card"
      accessibilityRole="link"
      accessibilityLabel={l`Profile`}
      accessibilityHint={l`Navigates to your profile`}
      onPress={onPressProfile}
      style={[a.gap_sm, a.pr_lg]}>
      <UserAvatar size={52} name={me?.data.name} type="user" />
      <View style={[a.gap_2xs]}>
        <Text
          emoji
          style={[a.font_bold, a.text_xl, a.mt_2xs, a.leading_tight]}
          numberOfLines={1}>
          {me?.data.name ?? ''}
        </Text>
        <Text
          style={[t.atoms.text_contrast_medium, a.text_md, a.leading_tight]}
          numberOfLines={1}>
          <Trans>Saved on this device</Trans>
        </Text>
      </View>
    </TouchableOpacity>
  )
}

/**
 * Bluesky's drawer, opened from the account avatar at the left of the top
 * bar (owner directive): every destination (Notifications last, as it also
 * has the header bell), the theme switch, Help and About.
 */
export function DrawerContent() {
  const t = useTheme()
  const {t: l} = useLingui()
  const insets = useSafeAreaInsets()
  const setDrawerOpen = useSetDrawerOpen()
  const navigation = useNavigation<NavigationProp>()
  const routeName = useNavigationState(state => getCurrentRoute(state).name)
  const current = SECTION_OF[routeName] ?? routeName
  const activityBadge = useActivityBadge()
  const helpControl = useDialogControl()

  const go = (route: DrawerRoute) => {
    setDrawerOpen(false)
    // Every drawer route takes no params.
    navigation.navigate(route as 'Profile')
  }

  const items: Array<{
    route: DrawerRoute
    label: string
    icon: React.ComponentType<SVGIconProps>
    activeIcon: React.ComponentType<SVGIconProps>
    count?: string
  }> = [
    {route: 'People', label: l`People`, icon: HomeIcon, activeIcon: HomeFilledIcon},
    {route: 'Groups', label: l`Groups`, icon: GroupIcon, activeIcon: GroupFilledIcon},
    {
      route: 'Analytics',
      label: l`Analytics`,
      icon: ChartPieIcon,
      activeIcon: ChartPieFilledIcon,
    },
    {
      route: 'Profile',
      label: l`Profile`,
      icon: UserCircleIcon,
      activeIcon: UserCircleFilledIcon,
    },
    {
      route: 'Settings',
      label: l`Settings`,
      icon: SettingsIcon,
      activeIcon: SettingsFilledIcon,
    },
    {
      route: 'Notifications',
      label: l`Notifications`,
      icon: BellIcon,
      activeIcon: BellFilledIcon,
      count: activityBadge,
    },
  ]

  return (
    <View
      testID="drawer"
      role="dialog"
      aria-modal
      accessibilityLabel={l`Menu`}
      style={[a.flex_1, a.border_r, t.atoms.bg, t.atoms.border_contrast_low]}>
      <ScrollView
        style={[a.flex_1]}
        contentContainerStyle={[
          {
            paddingTop: Math.max(
              insets.top + a.pt_xl.paddingTop,
              a.pt_xl.paddingTop,
            ),
          },
        ]}>
        <View style={[a.px_xl]}>
          <DrawerProfileCard onPressProfile={() => go('Profile')} />
          <Divider style={[a.mt_xl, a.mb_sm]} />
        </View>

        {items.map(item => {
          const isActive = current === item.route
          const Icon = isActive ? item.activeIcon : item.icon
          return (
            <MenuItem
              key={item.route}
              testID={`drawer-${item.route.toLowerCase()}`}
              icon={<Icon style={[t.atoms.text]} width={iconWidth} />}
              label={item.label}
              accessibilityHint={
                item.count
                  ? plural(Number.parseInt(item.count, 10) || 0, {
                      one: '# unread item',
                      other: '# unread items',
                    })
                  : undefined
              }
              count={item.count}
              bold={isActive}
              onPress={() => go(item.route)}
            />
          )
        })}

        <View style={[a.px_xl]}>
          <Divider style={[a.my_sm]} />
        </View>
        <ThemeToggle />
      </ScrollView>

      <DrawerFooter
        onPressAbout={() => {
          setDrawerOpen(false)
          navigation.navigate('SettingsSection', {section: 'about'})
        }}
        onPressHelp={() => helpControl.open()}
      />
      <Prompt.Basic
        control={helpControl}
        title={l`How Splito works`}
        description={l`Add an expense with the Add expense button and choose who paid and who shares it. Balances update straight away; open a friend or group to settle up. Everything is saved on this device – sign-in and sync are coming.`}
        confirmButtonCta={l`Got it`}
        showCancel={false}
        onConfirm={() => {}}
      />
    </View>
  )
}

/* The theme shortcut: on is dark, off is light. It sets the `theme` preference. */
function ThemeToggle() {
  const t = useTheme()
  const {t: l} = useLingui()
  const [, setTheme] = usePref('theme')
  const isDark = t.scheme === 'dark'

  return (
    <Toggle.Item
      type="checkbox"
      testID="drawer-theme"
      name="theme"
      label={l`Dark theme`}
      value={isDark}
      onChange={on => void setTheme(on ? 'dark' : 'light')}
      style={[a.w_full]}>
      {({hovered, pressed}) => (
        <View
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.py_md,
            a.px_xl,
            (hovered || pressed) && t.atoms.bg_contrast_25,
          ]}>
          <MoonIcon style={[t.atoms.text]} width={iconWidth} />
          <Text
            style={[a.flex_1, a.text_2xl, web(a.leading_snug)]}
            numberOfLines={1}>
            <Trans>Dark theme</Trans>
          </Text>
          <Toggle.Switch />
        </View>
      )}
    </Toggle.Item>
  )
}

function DrawerFooter({
  onPressAbout,
  onPressHelp,
}: {
  onPressAbout: () => void
  onPressHelp: () => void
}) {
  const {t: l} = useLingui()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        a.flex_row,
        a.gap_sm,
        a.flex_wrap,
        a.pl_xl,
        a.pt_md,
        {
          paddingBottom: Math.max(
            insets.bottom + tokens.space.xs,
            tokens.space.xl,
          ),
        },
      ]}>
      <Button
        testID="drawer-about"
        label={l`About Splito`}
        size="small"
        variant="solid"
        color="secondary"
        onPress={onPressAbout}>
        <ButtonIcon icon={InfoIcon} position="left" />
        <ButtonText>
          <Trans>About</Trans>
        </ButtonText>
      </Button>
      <Button
        testID="drawer-help"
        label={l`Get help`}
        size="small"
        variant="outline"
        color="secondary"
        onPress={onPressHelp}
        style={{backgroundColor: 'transparent'}}>
        <ButtonText>
          <Trans>Help</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function MenuItem({
  testID,
  icon,
  label,
  count,
  bold,
  accessibilityHint,
  onPress,
}: {
  testID: string
  icon: JSX.Element
  label: string
  count?: string
  bold?: boolean
  accessibilityHint?: string
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Button
      testID={testID}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityHint={accessibilityHint}
      label={label}>
      {({hovered, pressed}) => (
        <View
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.py_md,
            a.px_xl,
            (hovered || pressed) && t.atoms.bg_contrast_25,
          ]}>
          <View style={[a.relative]}>
            {icon}
            {count ? (
              <View
                style={[
                  a.absolute,
                  a.inset_0,
                  a.align_end,
                  {top: -4, right: a.gap_sm.gap * -1},
                ]}>
                <View
                  style={[
                    a.rounded_full,
                    {
                      right: count.length === 1 ? 6 : 0,
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                      backgroundColor: t.palette.primary_500,
                    },
                  ]}>
                  <Text
                    style={[
                      a.text_xs,
                      a.leading_tight,
                      a.font_semi_bold,
                      {
                        fontVariant: ['tabular-nums'],
                        color: t.palette.white,
                      },
                    ]}
                    numberOfLines={1}>
                    {count}
                  </Text>
                </View>
              </View>
            ) : undefined}
          </View>
          <Text
            style={[
              a.flex_shrink,
              a.text_2xl,
              bold && a.font_bold,
              web(a.leading_snug),
            ]}
            numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Button>
  )
}
