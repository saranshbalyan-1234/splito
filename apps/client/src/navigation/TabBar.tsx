import {Pressable, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {type BottomTabBarProps} from '@react-navigation/bottom-tabs'

import {useHaptics} from '#/lib/haptics'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Logo} from '#/components/brand/Logo'
import {ActivityIcon, GroupsIcon, PeopleIcon, PlusIcon, ProfileIcon} from '#/components/icons/Nav'
import {Text} from '#/components/Typography'

const ICONS = {People: PeopleIcon, Groups: GroupsIcon, Activity: ActivityIcon, Profile: ProfileIcon} as const
type TabName = keyof typeof ICONS

/** Phones: bottom bar with a raised central +. Tablet/desktop: left sidebar with + at the bottom. */
export function TabBar({state, navigation}: BottomTabBarProps) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const insets = useSafeAreaInsets()
  const haptics = useHaptics()
  const routes = state.routes.map((r, i) => ({name: r.name as TabName, key: r.key, isActive: i === state.index}))
  const isHome = state.routes[state.index]?.name === 'People'

  function go(name: TabName, isActive: boolean) {
    haptics.tap()
    if (!isActive) navigation.navigate(name)
  }
  function addExpense() {
    haptics.confirm()
    navigation.getParent()?.navigate('AddExpense')
  }

  if (gtMobile) {
    return (
      <View style={[a.h_full, a.px_lg, a.py_xl, a.gap_xs, a.border_r, t.atoms.border_contrast_low, t.atoms.bg, {width: 240}]}>
        <Pressable
          testID="logo"
          accessibilityRole="link"
          accessibilityLabel="Splito home"
          aria-disabled={isHome}
          disabled={isHome}
          onPress={() => go('People', false)}
          style={[a.px_sm, a.pb_xl, web({cursor: isHome ? 'default' : 'pointer'})]}>
          <Logo />
        </Pressable>
        {routes.map(r => {
          const Icon = ICONS[r.name]
          return (
            <Pressable
              key={r.key}
              testID={`tab-${r.name.toLowerCase()}`}
              accessibilityRole="tab"
              accessibilityState={{selected: r.isActive}}
              onPress={() => go(r.name, r.isActive)}
              style={state => [
                a.flex_row,
                a.align_center,
                a.gap_md,
                a.px_md,
                a.py_sm,
                a.rounded_md,
                (r.isActive || (state as {hovered?: boolean}).hovered) && t.atoms.bg_contrast_25,
              ]}>
              <Icon size="lg" fill={r.isActive ? t.palette.primary_500 : t.atoms.text_contrast_medium.color} />
              <Text style={[a.text_md, r.isActive ? [a.font_bold, t.atoms.text] : t.atoms.text_contrast_medium]}>{r.name}</Text>
            </Pressable>
          )
        })}
        <View style={a.flex_1} />
        <Pressable
          testID="sidebar-add"
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          onPress={addExpense}
          style={[a.flex_row, a.align_center, a.justify_center, a.gap_sm, a.py_md, a.rounded_full, {backgroundColor: t.palette.primary_500}]}>
          <PlusIcon size="md" fill="#fff" />
          <Text style={[a.text_md, a.font_bold, {color: '#fff'}]}>Add expense</Text>
        </Pressable>
      </View>
    )
  }

  const left = routes.slice(0, 2)
  const right = routes.slice(2)
  const item = (r: (typeof routes)[number]) => {
    const Icon = ICONS[r.name]
    return (
      <Pressable
        key={r.key}
        testID={`tab-${r.name.toLowerCase()}`}
        accessibilityRole="tab"
        accessibilityLabel={r.name}
        accessibilityState={{selected: r.isActive}}
        onPress={() => go(r.name, r.isActive)}
        style={[a.flex_1, a.align_center, a.gap_2xs, a.pt_sm]}>
        <Icon size="lg" fill={r.isActive ? t.palette.primary_500 : t.atoms.text_contrast_low.color} />
        <Text style={[a.text_2xs, r.isActive ? [a.font_bold, {color: t.palette.primary_500}] : t.atoms.text_contrast_low]}>{r.name}</Text>
      </Pressable>
    )
  }
  return (
    <View style={[a.flex_row, a.border_t, t.atoms.border_contrast_low, t.atoms.bg, {paddingBottom: Math.max(insets.bottom, 8)}]}>
      {left.map(item)}
      <View style={[a.flex_1, a.align_center]}>
        <Pressable
          testID="tab-add"
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          onPress={addExpense}
          style={[a.align_center, a.justify_center, a.rounded_full, a.shadow_md, {width: 56, height: 56, marginTop: -18, backgroundColor: t.palette.primary_500}]}>
          <PlusIcon size="xl" fill="#fff" />
        </Pressable>
      </View>
      {right.map(item)}
    </View>
  )
}
