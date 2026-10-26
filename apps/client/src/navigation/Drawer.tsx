// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/Drawer.tsx
import {type JSX, memo} from 'react'
import {ScrollView, TouchableOpacity, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {plural} from '@lingui/core/macro'
import {Plural, Trans, useLingui} from '@lingui/react/macro'
import {
  StackActions,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native'
import {type Group, type Person} from '@splito/sync'

import {getCurrentRoute} from '#/lib/routes/helpers'
import {type NavigationProp, type TabParams} from '#/lib/routes/types'
import {useSetDrawerOpen} from '#/state/shell'
import {useEntities, useMe, usePref} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, tokens, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import * as Toggle from '#/components/forms/Toggle'
import {
  Activity_Filled_Corner0_Rounded as ActivityFilledIcon,
  Activity_Stroke2_Corner0_Rounded as ActivityIcon,
} from '#/components/icons/Activity'
import {
  ChartPie_Filled_Corner0_Rounded as ChartPieFilledIcon,
  ChartPie_Stroke2_Corner0_Rounded as ChartPieIcon,
} from '#/components/icons/ChartPie'
import {CircleQuestion_Stroke2_Corner2_Rounded as CircleQuestionIcon} from '#/components/icons/CircleQuestion'
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
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {useUnreadCount} from '#/features/notifications'

const iconWidth = 26

/*
 * Bluesky's account card: avatar, name, then the handle and follower
 * counts. Splito has no handle or followers, so the second line says where
 * the data lives and the third counts friends and groups.
 */
let DrawerProfileCard = ({
  onPressProfile,
}: {
  onPressProfile: () => void
}): React.ReactNode => {
  const {t: l} = useLingui()
  const t = useTheme()
  const me = useMe()
  const friends = useEntities<Person>('person')?.filter(p => !p.data.isMe)
  const groups = useEntities<Group>('group')?.filter(g => !g.data.archived)
  const friendCount = friends?.length ?? 0
  const groupCount = groups?.length ?? 0

  return (
    <TouchableOpacity
      testID="drawer-profile"
      accessibilityLabel={l`Profile`}
      accessibilityHint={l`Opens your profile`}
      onPress={onPressProfile}
      style={[a.gap_sm, a.pr_lg]}>
      <UserAvatar size={52} name={me?.data.name} type="user" />
      <View style={[a.gap_2xs]}>
        <Text
          emoji
          style={[
            a.font_bold,
            a.text_xl,
            a.mt_2xs,
            a.leading_tight,
            a.flex_shrink,
          ]}
          numberOfLines={1}>
          {me?.data.name ?? ''}
        </Text>
        <Text
          style={[t.atoms.text_contrast_medium, a.text_md, a.leading_tight]}
          numberOfLines={1}>
          <Trans>Saved on this device</Trans>
        </Text>
      </View>
      <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
        <Trans>
          <Text style={[a.text_md, a.font_semi_bold]}>{friendCount}</Text>{' '}
          <Plural value={friendCount} one="friend" other="friends" />
        </Trans>{' '}
        &middot;{' '}
        <Trans>
          <Text style={[a.text_md, a.font_semi_bold]}>{groupCount}</Text>{' '}
          <Plural value={groupCount} one="group" other="groups" />
        </Trans>
      </Text>
    </TouchableOpacity>
  )
}
DrawerProfileCard = memo(DrawerProfileCard)

type PushedRoute = 'Profile' | 'Settings'

/**
 * Bluesky's drawer, opened from the header avatar on every top-level page
 * (owner directive). Its rows: the four tabs (Activity with Bluesky's unread
 * count), then Profile and Settings, then a dark-theme switch; Help and
 * About sit in the footer where Bluesky has Feedback and Help.
 */
function DrawerContentInner(): React.ReactNode {
  const t = useTheme()
  const {t: l} = useLingui()
  const insets = useSafeAreaInsets()
  const setDrawerOpen = useSetDrawerOpen()
  const navigation = useNavigation<NavigationProp>()
  const currentRouteName = useNavigationState(state =>
    state ? getCurrentRoute(state).name : 'People',
  )
  const [, setTheme] = usePref('theme')
  const isDark = t.scheme === 'dark'
  const unreadCount = useUnreadCount()

  /*
   * A tab goes back to its page if it's already in the stack, as Bluesky's
   * drawer pops to the tab root. Native nests the tabs in `Tabs`.
   */
  const onPressTab = (tab: keyof TabParams) => {
    setDrawerOpen(false)
    navigation.dispatch(
      IS_WEB
        ? StackActions.popTo(tab)
        : StackActions.popTo('Tabs', {screen: tab}),
    )
  }

  const onPressScreen = (screen: PushedRoute) => {
    setDrawerOpen(false)
    navigation.navigate(screen)
  }

  const onPressSection = (section: 'help' | 'about') => {
    setDrawerOpen(false)
    navigation.navigate('SettingsSection', {section})
  }

  const isAt = (name: string) => currentRouteName === name

  return (
    <View
      testID="drawer"
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
          <DrawerProfileCard onPressProfile={() => onPressScreen('Profile')} />
          <Divider style={[a.mt_xl, a.mb_sm]} />
        </View>

        <MenuItem
          testID="drawer-people"
          icons={[HomeIcon, HomeFilledIcon]}
          label={l`People`}
          isActive={isAt('People')}
          onPress={() => onPressTab('People')}
        />
        <MenuItem
          testID="drawer-groups"
          icons={[GroupIcon, GroupFilledIcon]}
          label={l`Groups`}
          isActive={isAt('Groups')}
          onPress={() => onPressTab('Groups')}
        />
        <MenuItem
          testID="drawer-analytics"
          icons={[ChartPieIcon, ChartPieFilledIcon]}
          label={l`Analytics`}
          isActive={isAt('Analytics')}
          onPress={() => onPressTab('Analytics')}
        />
        <MenuItem
          testID="drawer-activity"
          icons={[ActivityIcon, ActivityFilledIcon]}
          label={l`Activity`}
          accessibilityHint={
            unreadCount
              ? plural(unreadCount, {
                  one: '# unread item',
                  other: '# unread items',
                })
              : ''
          }
          count={unreadCount}
          isActive={isAt('Activity')}
          onPress={() => onPressTab('Activity')}
        />
        <MenuItem
          testID="drawer-profile-item"
          icons={[UserCircleIcon, UserCircleFilledIcon]}
          label={l`Profile`}
          isActive={isAt('Profile')}
          onPress={() => onPressScreen('Profile')}
        />
        <MenuItem
          testID="drawer-settings"
          icons={[SettingsIcon, SettingsFilledIcon]}
          label={l`Settings`}
          isActive={isAt('Settings') || isAt('SettingsSection')}
          onPress={() => onPressScreen('Settings')}
        />

        <View style={[a.px_xl]}>
          <Divider style={[a.mb_sm, a.mt_sm]} />
        </View>

        <Toggle.Item
          testID="drawer-theme"
          name="dark-theme"
          label={l`Dark theme`}
          value={isDark}
          onChange={dark => void setTheme(dark ? 'dark' : 'light')}
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
      </ScrollView>

      <DrawerFooter
        onPressHelp={() => onPressSection('help')}
        onPressAbout={() => onPressSection('about')}
      />
    </View>
  )
}
const DrawerContent = memo(DrawerContentInner)
export {DrawerContent}

let DrawerFooter = ({
  onPressHelp,
  onPressAbout,
}: {
  onPressHelp: () => void
  onPressAbout: () => void
}): React.ReactNode => {
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
        testID="drawer-help"
        label={l`Get help`}
        size="small"
        variant="solid"
        color="secondary"
        onPress={onPressHelp}>
        <ButtonIcon icon={CircleQuestionIcon} position="left" />
        <ButtonText>
          <Trans>Help</Trans>
        </ButtonText>
      </Button>
      <Button
        testID="drawer-about"
        label={l`About Splito`}
        size="small"
        variant="outline"
        color="secondary"
        onPress={onPressAbout}
        style={{
          backgroundColor: 'transparent',
        }}>
        <ButtonText>
          <Trans>About</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
DrawerFooter = memo(DrawerFooter)

function MenuItem({
  testID,
  icons: [Icon, ActiveIcon],
  label,
  accessibilityHint,
  count,
  isActive,
  onPress,
}: {
  testID: string
  /** Outline glyph, then the filled one for the current page. */
  icons: [React.ComponentType<SVGIconProps>, React.ComponentType<SVGIconProps>]
  label: string
  accessibilityHint?: string
  /** Bluesky's unread badge over the glyph ('' or absent hides it). */
  count?: string
  isActive: boolean
  onPress: () => void
}): JSX.Element {
  const t = useTheme()
  const Glyph = isActive ? ActiveIcon : Icon
  return (
    <Button
      testID={testID}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{selected: isActive}}
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
            <Glyph style={[t.atoms.text]} width={iconWidth} />
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
              isActive && a.font_bold,
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
