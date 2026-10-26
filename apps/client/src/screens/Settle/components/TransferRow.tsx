import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, type Transfer} from '@splito/domain'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {ArrowRight_Stroke2_Corner0_Rounded as ArrowRightIcon} from '#/components/icons/Arrow'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'

/**
 * One payment of a settle-up plan: who pays whom and how much, with the
 * button that records it once it has happened outside Splito.
 */
export function TransferRow({
  transfer,
  currency,
  me,
  names,
  locale,
  onRecordPress,
}: {
  transfer: Transfer
  currency: string
  me: string
  names: Map<string, string>
  locale: string
  onRecordPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const listAnimations = useListAnimations()
  const {from, to, amount} = transfer
  const name = (id: string) => names.get(id) ?? l`Someone`
  const sentence =
    from === me
      ? l`You pay ${name(to)}`
      : to === me
        ? l`${name(from)} pays you`
        : l`${name(from)} pays ${name(to)}`

  return (
    <Animated.View
      {...listAnimations}
      testID={`transfer-${name(from)}-${name(to)}`}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_lg,
        a.py_md,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_2xs]}>
        <UserAvatar size={36} name={name(from)} type="user" />
        <ArrowRightIcon size="xs" fill={t.atoms.text_contrast_low.color} />
        <UserAvatar size={36} name={name(to)} type="user" />
      </View>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          emoji
          testID="transfer-sentence"
          numberOfLines={2}
          style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
          {sentence}
        </Text>
        <Text
          testID="transfer-amount"
          style={[
            a.text_lg,
            a.font_bold,
            a.leading_tight,
            {fontVariant: ['tabular-nums']},
          ]}>
          {formatAmount(amount, currency, locale)}
        </Text>
      </View>
      <Button
        testID="transfer-record"
        label={l`Record this payment`}
        size="small"
        color="secondary"
        onPress={onRecordPress}>
        <ButtonText>
          {gtMobile ? (
            <Trans>Record this payment</Trans>
          ) : (
            <Trans>Record</Trans>
          )}
        </ButtonText>
      </Button>
    </Animated.View>
  )
}
