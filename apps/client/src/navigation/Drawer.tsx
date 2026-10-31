// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/Drawer.tsx
import {type JSX, memo} from 'react'
import {ScrollView, TouchableOpacity, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useLingui as useLinguiCore} from '@lingui/react'
import {useLingui} from '@lingui/react/macro'
import {
  StackActions,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native'
import {type NavItemId} from '@splito/sync'

import {NAV_ITEM_ROUTE, splitNavigationItems} from '#/lib/routes/navigationItems'
import {useTabs} from '#/lib/routes/tabs'
import {getCurrentRoute} from '#/lib/routes/helpers'
import {startPage} from '#/lib/routes/startTab'
import {type NavigationProp} from '#/lib/routes/types'
import {useSetDrawerOpen} from '#/state/shell'
import {useMe} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, tokens, useTheme, web} from '#/alf'
import {
  describeUnread,
  useActivityBadge,
} from '#/components/activity/useActivityFeed'
import {Button} from '#/components/Button'
import {Deferred} from '#/components/Deferred'
import {Divider} from '#/components/Divider'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {NavFooterLinks} from '#/components/NavFooterLinks'
import {SyncStatusDot, useSyncLabel} from '#/components/SyncStatusDot'
import {MorphIcon} from '#/components/anim/AnimatedIcon'
import {badgeTick, GLYPHS, NAV_LABELS} from '#/components/TabGlyph'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const iconWidth = 26
/** A menu row's height, for the stand-in while the drawer slides. */
const MENU_ITEM_HEIGHT = 52

/*
 * Bluesky's account card, cut to the avatar and the person's real name
 * (owner: no "Me", no "Saved on this device"). Until a real name is set the
 * name's place asks for one, as Profile does. Tapping it opens Profile.
 */
let DrawerProfileCard = ({
  onPressProfile,
  onPressSync,
}: {
  onPressProfile: () => void
  onPressSync: () => void
}): React.ReactNode => {
  const {t: l} = useLingui()
  const t = useTheme()
  const me = useMe()
  const {state, label: syncLabel} = useSyncLabel()
  const name = me?.data.name ?? ''
  /* "Me" is the name Splito starts with (Profile asks for a real one the same way). */
  const hasDefaultName = name.trim() === '' || name === 'Me'

  return (
    <TouchableOpacity
      testID="drawer-profile"
      accessibilityLabel={`${hasDefaultName ? l`Profile` : name}. ${syncLabel}`}
      accessibilityHint={l`Opens your profile`}
      onPress={onPressProfile}
      style={[a.gap_sm, a.pr_lg]}>
      <View style={[a.self_start]}>
        <UserAvatar size={52} name={me ? name : undefined} type="user" />
        <SyncStatusDot
          avatarSize={52}
          state={state}
          label={syncLabel}
          onPress={onPressSync}
        />
      </View>
      <Text
        emoji
        style={[
          a.font_bold,
          a.text_xl,
          a.mt_2xs,
          a.leading_tight,
          a.flex_shrink,
          hasDefaultName && t.atoms.text_contrast_medium,
        ]}
        numberOfLines={1}>
        {me === undefined ? '' : hasDefaultName ? l`Add your name` : name}
      </Text>
    </TouchableOpacity>
  )
}
DrawerProfileCard = memo(DrawerProfileCard)

/**
 * Bluesky's drawer, opened from the header avatar on phone and rail. Its rows
 * are the one shared list the desktop sidebar renders (ARCHITECTURE 26.3,
 * 26.7), every item in the Settings > Navigation order (on first, then off):
 * People, Groups, Analytics, Activity (with Bluesky's unread
 * count), Settings by default; then the shared footer links and Sign in.
 */
function DrawerContentInner(): React.ReactNode {
  const t = useTheme()
  const {_} = useLinguiCore()
  const insets = useSafeAreaInsets()
  const setDrawerOpen = useSetDrawerOpen()
  const navigation = useNavigation<NavigationProp>()
  const currentRouteName = useNavigationState(state =>
    state ? getCurrentRoute(state).name : startPage(),
  )
  const unreadCount = useActivityBadge()
  /* Same order as the sidebar and bottom bar: what is on, then the rest (26.3). */
  const {on, off} = splitNavigationItems(useTabs())

  const onPressItem = (id: NavItemId) => {
    setDrawerOpen(false)
    const route = NAV_ITEM_ROUTE[id]
    /*
     * A tab goes back to its page if it's already in the stack, as
     * Bluesky's drawer pops to the tab root. Native nests the tabs in `Tabs`.
     */
    navigation.dispatch(
      IS_WEB
        ? StackActions.popTo(route)
        : StackActions.popTo('Tabs', {screen: route}),
    )
  }

  const isAt = (id: NavItemId) =>
    id === 'settings'
      ? currentRouteName === 'Settings' ||
        currentRouteName === 'SettingsSection'
      : currentRouteName === NAV_ITEM_ROUTE[id]

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
          <DrawerProfileCard
            onPressProfile={() => {
              setDrawerOpen(false)
              navigation.navigate('Profile')
            }}
            onPressSync={() => {
              setDrawerOpen(false)
              navigation.navigate('Settings')
            }}
          />
          <Divider style={[a.mt_xl, a.mb_sm]} />
        </View>

        {/* The panel slides first; the menu mounts when it stopped (OpenedContext, owner 168). A stand-in keeps the footer where it will be. */}
        <Deferred fallback={<View style={{height: MENU_ITEM_HEIGHT * (on.length + off.length)}} />}>
        {[...on, ...off].map(id => (
          <MenuItem
            key={id}
            testID={`drawer-${id}`}
            icons={[GLYPHS[id].icon, GLYPHS[id].filled]}
            label={_(NAV_LABELS[id])}
            accessibilityHint={
              id === 'activity' ? describeUnread(unreadCount) : undefined
            }
            count={id === 'activity' ? unreadCount : undefined}
            isActive={isAt(id)}
            onPress={() => onPressItem(id)}
          />
        ))}
        </Deferred>
      </ScrollView>

      <DrawerFooter onBeforeNavigate={() => setDrawerOpen(false)} />
    </View>
  )
}
const DrawerContent = memo(DrawerContentInner)
export {DrawerContent}

/* The shared footer links (the sidebar shows the same); Log out is on Profile (owner 202). */
let DrawerFooter = ({onBeforeNavigate}: {onBeforeNavigate: () => void}): React.ReactNode => {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        a.gap_md,
        a.px_xl,
        a.pt_md,
        a.border_t,
        t.atoms.border_contrast_low,
        {
          paddingBottom: Math.max(
            insets.bottom + tokens.space.xs,
            tokens.space.xl,
          ),
        },
      ]}>
      <NavFooterLinks onBeforeNavigate={onBeforeNavigate} />
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
            <MorphIcon outline={Icon} filled={ActiveIcon} isActive={isActive} playKey={badgeTick(count)} style={[t.atoms.text]} width={iconWidth} />
            {count ? (
              /* Bluesky's drawer badge, verbatim: pinned to the glyph's top right corner. */
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
