// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Layout/Header/index.tsx
import {createContext, useCallback, useContext} from 'react'
import {type GestureResponderEvent, Keyboard, View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useSetDrawerOpen} from '#/state/shell'
import {useIsWithinSplitView} from '#/lib/splitView'
import {
  atoms as a,
  platform,
  type TextStyleProp,
  useBreakpoints,
  useGutters,
  useTheme,
  web,
} from '#/alf'
import {Button, ButtonIcon, type ButtonProps} from '#/components/Button'
import {ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeft} from '#/components/icons/Arrow'
import {Menu_Stroke2_Corner0_Rounded as Menu} from '#/components/icons/Menu'
import {
  BUTTON_VISUAL_ALIGNMENT_OFFSET,
  HEADER_SLOT_SIZE,
} from '#/components/Layout/const'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'

const HEADER_BUTTON_HITSLOP = {top: 30, bottom: 10, left: 30, right: 30}

export function Outer({
  children,
  noBottomBorder,
  headerRef,
  sticky = true,
}: {
  children: React.ReactNode
  noBottomBorder?: boolean
  headerRef?: React.RefObject<React.ComponentRef<typeof View> | null>
  sticky?: boolean
}) {
  const t = useTheme()
  const gutters = useGutters([0, 'base'])
  const {isWithinLeftPanel} = useIsWithinSplitView()

  return (
    <View
      ref={headerRef}
      style={[
        a.w_full,
        !noBottomBorder && a.border_b,
        a.flex_row,
        a.align_center,
        a.gap_sm,
        sticky && web([a.sticky, {top: 0}, a.z_10, t.atoms.bg]),
        isWithinLeftPanel ? a.px_lg : gutters,
        platform({
          native: [a.pb_xs, {minHeight: 48}],
          web: [a.py_xs, {minHeight: 52}],
        }),
        t.atoms.border_contrast_low,
        /* Full width beside the sidebar: no centred column (owner directive). */
      ]}>
      {children}
    </View>
  )
}

const AlignmentContext = createContext<'platform' | 'left'>('platform')
AlignmentContext.displayName = 'AlignmentContext'

export function Content({
  children,
  align = 'platform',
}: {
  children?: React.ReactNode
  align?: 'platform' | 'left'
}) {
  return (
    <View
      style={[
        a.flex_1,
        a.justify_center,
        align === 'platform' && a.align_center,
        {minHeight: HEADER_SLOT_SIZE},
      ]}>
      <AlignmentContext.Provider value={align}>
        {children}
      </AlignmentContext.Provider>
    </View>
  )
}

export function Slot({children}: {children?: React.ReactNode}) {
  return <View style={[a.z_50, {width: HEADER_SLOT_SIZE}]}>{children}</View>
}

export function BackButton({onPress, style, ...props}: Partial<ButtonProps>) {
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp>()

  const onPressBack = useCallback(
    (evt: GestureResponderEvent) => {
      onPress?.(evt)
      if (evt.defaultPrevented) return
      if (navigation.canGoBack()) {
        navigation.goBack()
      } else {
        navigation.navigate('People')
      }
    },
    [onPress, navigation],
  )

  return (
    <Slot>
      <Button
        label={_(msg`Go back`)}
        size="small"
        variant="ghost"
        color="secondary"
        shape="round"
        onPress={onPressBack}
        hitSlop={HEADER_BUTTON_HITSLOP}
        style={[
          {marginLeft: -BUTTON_VISUAL_ALIGNMENT_OFFSET},
          a.bg_transparent,
          style,
        ]}
        {...props}>
        <ButtonIcon icon={ArrowLeft} size="lg" />
      </Button>
    </Slot>
  )
}

export function MenuButton() {
  const {_} = useLingui()
  const ax = useAnalytics()
  const setDrawerOpen = useSetDrawerOpen()
  const {gtMobile} = useBreakpoints()

  const onPress = useCallback(() => {
    ax.metric('nav:click', {item: 'menu', surface: 'topBar'})
    Keyboard.dismiss()
    setDrawerOpen(true)
  }, [setDrawerOpen, ax])

  return gtMobile ? null : (
    <Slot>
      <Button
        label={_(msg`Open drawer menu`)}
        size="small"
        variant="ghost"
        color="secondary"
        shape="square"
        onPress={onPress}
        hitSlop={HEADER_BUTTON_HITSLOP}
        style={[
          {marginLeft: -BUTTON_VISUAL_ALIGNMENT_OFFSET},
          a.bg_transparent,
        ]}>
        <ButtonIcon icon={Menu} size="lg" />
      </Button>
    </Slot>
  )
}

/**
 * One icon action in a header slot (owner header rule: at most one basic
 * action on the right, so the centred title stays centred). Styled as
 * Bluesky's header buttons; `label` is its accessible name.
 */
export function IconButton({
  icon,
  label,
  testID,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof ButtonIcon>['icon']
  label: string
  testID?: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Slot>
      <Button
        testID={testID}
        label={label}
        size="small"
        variant="ghost"
        color="secondary"
        shape="round"
        disabled={disabled}
        onPress={onPress}
        hitSlop={HEADER_BUTTON_HITSLOP}
        style={[{marginRight: -BUTTON_VISUAL_ALIGNMENT_OFFSET}]}>
        <ButtonIcon icon={icon} size="lg" />
      </Button>
    </Slot>
  )
}

export function TitleText({
  children,
  style,
}: {children: React.ReactNode} & TextStyleProp) {
  const {gtMobile} = useBreakpoints()
  const {isWithinLeftPanel} = useIsWithinSplitView()
  const align = useContext(AlignmentContext)
  return (
    <Text
      style={[
        isWithinLeftPanel
          ? [a.text_xl, a.font_bold]
          : [a.text_lg, a.font_semi_bold],
        a.leading_tight,
        align === 'platform' && a.text_center,
        gtMobile && a.text_xl,
        style,
      ]}
      numberOfLines={2}
      emoji
      maxFontSizeMultiplier={2}>
      {children}
    </Text>
  )
}

export function SubtitleText({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const align = useContext(AlignmentContext)
  return (
    <Text
      style={[
        a.text_sm,
        a.leading_snug,
        align === 'platform' && a.text_center,
        t.atoms.text_contrast_medium,
      ]}
      numberOfLines={1}>
      {children}
    </Text>
  )
}
