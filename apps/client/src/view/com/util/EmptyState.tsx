// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/EmptyState.tsx
import {isValidElement} from 'react'
import {type StyleProp, type TextStyle, type ViewStyle} from 'react-native'
import {View} from 'react-native'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {
  Button,
  ButtonIcon,
  type ButtonProps,
  ButtonText,
} from '#/components/Button'
import {EditBig_Stroke1_Corner0_Rounded as EditIcon} from '#/components/icons/EditBig'
import {Text} from '#/components/Typography'
import {Illustration} from '#/motion/Illustration'
import {type IllustrationName} from '#/motion/illustrations'

export type EmptyStateButtonProps = Omit<ButtonProps, 'children' | 'label'> & {
  label: string
  text: string
  icon?: React.ComponentProps<typeof ButtonIcon>['icon']
}

export function EmptyState({
  testID,
  illustration,
  icon,
  iconSize = '3xl',
  iconColor,
  message,
  style,
  textStyle,
  button,
}: {
  testID?: string
  /**
   * Splito: an animated illustration in place of the icon (main pages' empty
   * states). Static under reduce motion.
   */
  illustration?: IllustrationName
  icon?: React.ComponentType<any> | React.ReactElement | null
  iconSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  iconColor?: string
  message: string
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  button?: EmptyStateButtonProps
}) {
  const t = useTheme()
  const {gtMobile, gtTablet} = useBreakpoints()

  const placeholderIcon = (
    <EditIcon size="2xl" fill={t.atoms.text_contrast_medium.color} />
  )

  const renderIcon = () => {
    if (icon === null) {
      return null
    }

    if (!icon) {
      return placeholderIcon
    }

    if (isValidElement(icon)) {
      return icon
    }

    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon && 'render' in icon)
    ) {
      const IconComponent = icon
      return (
        <IconComponent
          size={iconSize}
          style={{color: iconColor ?? t.atoms.text_contrast_low.color}}
        />
      )
    }

    return placeholderIcon
  }

  return (
    <View testID={testID} style={[a.w_full, style]}>
      {illustration ? (
        <View style={[a.self_center, a.mt_3xl, gtTablet && {marginTop: 50}]}>
          <Illustration
            name={illustration}
            size={gtMobile ? 200 : 168}
            testID={testID && `${testID}-illustration`}
          />
        </View>
      ) : (
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.justify_center,
            a.self_center,
            a.rounded_full,
            a.mt_5xl,
            {height: 64, width: 64},
            isValidElement(icon)
              ? a.bg_transparent
              : [gtTablet && {marginTop: 50}],
          ]}>
          {renderIcon()}
        </View>
      )}
      <Text
        style={[
          t.atoms.text_contrast_high,
          {maxWidth: gtMobile ? '40%' : '60%'},
          a.pt_xs,
          a.font_medium,
          a.text_md,
          a.leading_snug,
          a.text_center,
          a.self_center,
          !button && a.mb_5xl,
          textStyle,
        ]}>
        {message}
      </Text>
      {button && (
        <View style={[a.flex_shrink, a.mt_md, a.self_center, a.mb_5xl]}>
          <Button {...button}>
            {button.icon && <ButtonIcon icon={button.icon} />}
            <ButtonText>{button.text}</ButtonText>
          </Button>
        </View>
      )}
    </View>
  )
}
