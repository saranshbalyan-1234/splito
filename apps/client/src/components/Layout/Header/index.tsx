// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Layout/Header/index.tsx
import {createContext, useCallback, useContext} from 'react'
import {type GestureResponderEvent, View} from 'react-native'
import Animated from 'react-native-reanimated'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {backFallback, goBack} from '#/navigation/goBack'
import {useDemoMode} from '#/state/demo'
import {useShellHeaderLayout} from '#/state/shell/shell-layout'
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
import {type Props as SVGIconProps} from '#/components/icons/common'
import {ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeft} from '#/components/icons/Arrow'
import {
  BUTTON_VISUAL_ALIGNMENT_OFFSET,
  HEADER_HEIGHT,
  HEADER_SLOT_SIZE,
} from '#/components/Layout/const'
import {useHeaderHideTransform} from '#/components/Layout/MainScrollProvider'
import {Text} from '#/components/Typography'

const HEADER_BUTTON_HITSLOP = {top: 30, bottom: 10, left: 30, right: 30}

/**
 * Pins a header (and anything that travels with it, such as a tab bar) to
 * the top of the screen. On phones it slides away as the screen scrolls down
 * and returns on scroll up, Bluesky's minimal-shell header.
 */
export function Sticky({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const {height, onLayout} = useShellHeaderLayout()
  const hideTransform = useHeaderHideTransform(height)

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        a.w_full,
        a.z_10,
        web([a.sticky, {top: 0}]),
        t.atoms.bg,
        !gtMobile && hideTransform,
      ]}>
      {children}
    </Animated.View>
  )
}

/**
 * Splito's header rule set (owner directive): the left slot holds the
 * avatar on top-level pages or Back on pushed ones, the title is centred on
 * every platform, and the right holds at most one action (plus an overflow
 * menu). Empty slots keep their width so the title stays centred.
 */
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

  const row = (
    <View
      ref={headerRef}
      style={[
        a.w_full,
        !noBottomBorder && a.border_b,
        a.flex_row,
        a.align_center,
        a.gap_sm,
        isWithinLeftPanel ? a.px_lg : gutters,
        platform({
          native: [a.pb_xs, {minHeight: HEADER_HEIGHT.native}],
          web: [a.py_xs, {minHeight: HEADER_HEIGHT.web}],
        }),
        t.atoms.border_contrast_low,
        /* Full width beside the sidebar: no centred column (owner directive). */
      ]}>
      {children}
    </View>
  )

  return sticky ? <Sticky>{row}</Sticky> : row
}

const AlignmentContext = createContext<'center' | 'left'>('center')
AlignmentContext.displayName = 'AlignmentContext'

export function Content({
  children,
  align = 'center',
}: {
  children?: React.ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <View
      style={[
        a.flex_1,
        a.justify_center,
        align === 'center' && a.align_center,
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
      // Opened directly (deep link, refresh): Back goes to this page's parent.
      const state = navigation.getState()
      goBack(navigation, backFallback(state?.routes[state.index] ?? {name: 'Home'}))
    },
    [onPress, navigation],
  )

  return (
    <Slot>
      <Button
        testID="header-back"
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

/**
 * Bluesky's header icon button (the feeds / settings links in its headers),
 * for a page's one action. `edge` pulls the glyph onto the gutter, as
 * upstream does for the rightmost button.
 */
export function ActionButton({
  testID,
  label,
  icon,
  onPress,
  edge = false,
  disabled = false,
  hint,
  children,
  ref,
}: {
  testID: string
  label: string
  icon: React.ComponentType<SVGIconProps>
  onPress: () => void
  /** The button's node, for code that points at it (the guided tour). Absent: upstream behaviour. */
  ref?: React.Ref<React.ComponentRef<typeof View>>
  edge?: boolean
  disabled?: boolean
  /** Read after the label, e.g. why the action is disabled. */
  hint?: string
  /** Drawn over the glyph, e.g. an unread badge. */
  children?: React.ReactElement | null
}) {
  return (
    <Slot>
      <Button
        ref={ref}
        testID={testID}
        label={label}
        size="small"
        variant="ghost"
        color="secondary"
        shape="round"
        onPress={onPress}
        disabled={disabled}
        accessibilityHint={hint}
        hitSlop={HEADER_BUTTON_HITSLOP}
        style={[
          edge && {marginLeft: BUTTON_VISUAL_ALIGNMENT_OFFSET},
          a.overflow_visible,
        ]}>
        <ButtonIcon icon={icon} size="lg" />
        {children}
      </Button>
    </Slot>
  )
}

export function TitleText({
  children,
  style,
  testID,
}: {children: React.ReactNode; testID?: string} & TextStyleProp) {
  const {gtMobile} = useBreakpoints()
  const {isWithinLeftPanel} = useIsWithinSplitView()
  const align = useContext(AlignmentContext)
  const {_} = useLingui()
  /* Demo mode shows in every header title (owner 134), once, here. */
  const {demo} = useDemoMode()
  return (
    <Text
      testID={testID}
      style={[
        isWithinLeftPanel
          ? [a.text_xl, a.font_bold]
          : [a.text_lg, a.font_semi_bold],
        a.leading_tight,
        align === 'center' && a.text_center,
        gtMobile && a.text_xl,
        style,
      ]}
      numberOfLines={2}
      emoji
      maxFontSizeMultiplier={2}>
      {children}
      {demo ? ` - ${_(msg`Demo`)}` : null}
    </Text>
  )
}

export function SubtitleText({
  children,
  testID,
}: {
  children: React.ReactNode
  testID?: string
}) {
  const t = useTheme()
  const align = useContext(AlignmentContext)
  return (
    <Text
      testID={testID}
      style={[
        a.text_sm,
        a.leading_snug,
        align === 'center' && a.text_center,
        t.atoms.text_contrast_medium,
      ]}
      numberOfLines={1}>
      {children}
    </Text>
  )
}
