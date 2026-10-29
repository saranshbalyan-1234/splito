// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/JoinRequests.tsx (request rows: avatar, name, Accept / Reject buttons)
import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'

const TIP_MS = 1500

/**
 * One request or sent invite (26.18 decision 76): avatar, name and status
 * line, the actions side by side on the right, all on one horizontal line.
 * The name and status truncate; the actions never wrap.
 */
export function RequestRow({
  testID,
  name,
  detail,
  children,
}: {
  testID: string
  name: string
  detail: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTheme()
  const listAnimations = useListAnimations()
  return (
    <Animated.View
      {...listAnimations}
      testID={testID}
      style={[a.flex_row, a.align_center, a.gap_md, a.px_lg, a.py_sm]}>
      <UserAvatar size={40} name={name} type="user" />
      <View style={[a.flex_1, a.gap_2xs, {minWidth: 0}]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Text
            emoji
            numberOfLines={1}
            style={[a.flex_shrink, a.text_md, a.font_semi_bold, {minWidth: 0}]}>
            {name}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {detail}
        </Text>
      </View>
      <View
        testID={`${testID}-actions`}
        style={[a.flex_row, a.align_center, a.gap_xs, a.flex_shrink_0]}>
        {children}
      </View>
    </Animated.View>
  )
}

/**
 * A row action: icon-only and round on phones, with a tooltip on long-press
 * or hover; icon and full text on rail and desktop.
 */
export function RequestAction({
  testID,
  label,
  text,
  icon,
  color = 'secondary',
  disabled,
  onPress,
}: {
  testID: string
  /** The accessibility label, e.g. "Accept Riya's friend request". */
  label: string
  /** The short visible text, e.g. "Accept". */
  text: string
  icon: React.ComponentType<SVGIconProps>
  color?: 'primary' | 'secondary'
  disabled?: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const [isTipShown, setIsTipShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const showTip = (ms?: number) => {
    clearTimeout(timer.current)
    setIsTipShown(true)
    if (ms) timer.current = setTimeout(() => setIsTipShown(false), ms)
  }
  const hideTip = () => {
    clearTimeout(timer.current)
    setIsTipShown(false)
  }

  return (
    <View>
      <Button
        testID={testID}
        label={label}
        size="small"
        color={color}
        shape={gtMobile ? 'default' : 'round'}
        disabled={disabled}
        onPress={onPress}
        onLongPress={gtMobile ? undefined : () => showTip(TIP_MS)}
        onHoverIn={gtMobile ? undefined : () => showTip()}
        onHoverOut={gtMobile ? undefined : hideTip}>
        <ButtonIcon icon={icon} />
        {gtMobile ? <ButtonText>{text}</ButtonText> : null}
      </Button>
      {isTipShown && !gtMobile ? (
        <View
          pointerEvents="none"
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            a.absolute,
            a.align_center,
            a.z_10,
            {bottom: '100%', left: -48, right: -48, marginBottom: 6},
          ]}>
          <View
            testID={`${testID}-tooltip`}
            style={[
              a.px_sm,
              a.py_xs,
              a.rounded_sm,
              {backgroundColor: t.palette.contrast_900},
            ]}>
            <Text
              numberOfLines={1}
              style={[
                a.text_xs,
                a.font_semi_bold,
                {color: t.palette.contrast_0},
              ]}>
              {text}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
