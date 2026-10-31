// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/EmptyState.tsx
import {type StyleProp, type TextStyle, type ViewStyle, View} from 'react-native'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {
  Button,
  ButtonIcon,
  type ButtonProps,
  ButtonText,
} from '#/components/Button'
import {Text} from '#/components/Typography'
import {Illustration} from '#/motion/Illustration'
import {type IllustrationName} from '#/motion/illustrations'

export type EmptyStateButtonProps = Omit<ButtonProps, 'children' | 'label'> & {
  label: string
  text: string
  icon?: React.ComponentProps<typeof ButtonIcon>['icon']
}

/**
 * The one empty state (owners 146, 172): original animated art about the
 * screen, an optional title, one short message, at most a primary and a
 * lesser button, the same size and spacing everywhere. `illustration` is
 * required, so an empty state without art does not compile (and
 * `emptyStateArt.test.ts` reads every call site).
 */
export function EmptyState({
  testID,
  illustration,
  title,
  message,
  style,
  textStyle,
  button,
  secondaryButton,
  children,
}: {
  testID?: string
  /** Splito: a headline above the message (title, body, primary action). */
  title?: string
  /** Splito: a second, lesser action beside `button`. */
  secondaryButton?: EmptyStateButtonProps
  /**
   * Splito: original animated art about this screen, light and dark, played
   * once and resting, static under reduce motion. Required.
   */
  illustration: IllustrationName
  message: string
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  button?: EmptyStateButtonProps
  /** Splito: extra content under the message (Ask's suggested questions). */
  children?: React.ReactNode
}) {
  const t = useTheme()
  const {gtMobile, gtTablet} = useBreakpoints()
  const hasActions = !!button || !!children

  return (
    <View testID={testID} style={[a.w_full, style]}>
      <View style={[a.self_center, a.mt_3xl, gtTablet && {marginTop: 50}]}>
        <Illustration
          name={illustration}
          size={gtMobile ? 200 : 168}
          testID={testID && `${testID}-illustration`}
        />
      </View>
      {title && (
        <Text
          role="heading"
          style={[
            a.pt_lg,
            a.px_lg,
            a.text_xl,
            a.font_bold,
            a.leading_snug,
            a.text_center,
            a.self_center,
          ]}>
          {title}
        </Text>
      )}
      <Text
        style={[
          title ? t.atoms.text_contrast_medium : t.atoms.text_contrast_high,
          /* Splito: a fixed measure (not a % of the screen) so lines break evenly on every width. */
          {maxWidth: title ? 340 : gtMobile ? '40%' : '60%'},
          title ? [a.pt_sm, a.px_lg] : a.pt_xs,
          title ? a.font_normal : a.font_medium,
          a.text_md,
          a.leading_snug,
          a.text_center,
          a.self_center,
          !hasActions && a.mb_5xl,
          textStyle,
        ]}>
        {message}
      </Text>
      {button && (
        <View
          style={[
            a.flex_row,
            a.flex_wrap,
            a.justify_center,
            a.gap_sm,
            a.px_lg,
            title ? a.mt_xl : a.mt_md,
            a.self_center,
            !children && a.mb_5xl,
          ]}>
          <Button {...button}>
            {button.icon && <ButtonIcon icon={button.icon} />}
            <ButtonText>{button.text}</ButtonText>
          </Button>
          {secondaryButton && (
            <Button {...secondaryButton}>
              {secondaryButton.icon && (
                <ButtonIcon icon={secondaryButton.icon} />
              )}
              <ButtonText>{secondaryButton.text}</ButtonText>
            </Button>
          )}
        </View>
      )}
      {children && (
        <View style={[a.px_lg, a.pt_lg, a.pb_lg, a.self_center]}>
          {children}
        </View>
      )}
    </View>
  )
}
