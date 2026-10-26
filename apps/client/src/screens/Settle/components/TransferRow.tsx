import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, type Transfer} from '@splito/domain'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {ArrowRight_Stroke2_Corner0_Rounded as ArrowRightIcon} from '#/components/icons/Arrow'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'

/**
 * One payment of a settle-up plan: who pays whom and how much, with the
 * button that records it once it has happened outside Splito. When I am one
 * side, only the other person's face shows and the amount takes the money
 * colour (green coming to me, red going out).
 */
export function TransferRow({
  transfer,
  currency,
  me,
  meName,
  names,
  locale,
  onRecordPress,
}: {
  transfer: Transfer
  currency: string
  me: string
  /** My own name, for my avatar ("You" is only the label). */
  meName: string
  names: Map<string, string>
  locale: string
  onRecordPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const listAnimations = useListAnimations()
  const {from, to, amount} = transfer
  const name = (id: string) => names.get(id) ?? l`Someone`
  const avatarName = (id: string) => (id === me ? meName : name(id))
  const isIncoming = to === me
  const isOutgoing = from === me
  const sentence = isOutgoing
    ? l`You pay ${name(to)}`
    : isIncoming
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
      {isIncoming || isOutgoing ? (
        <UserAvatar
          size={42}
          name={avatarName(isIncoming ? from : to)}
          type="user"
        />
      ) : (
        <View style={[a.flex_row, a.align_center, a.gap_2xs]}>
          <UserAvatar size={32} name={avatarName(from)} type="user" />
          <ArrowRightIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
          <UserAvatar size={32} name={avatarName(to)} type="user" />
        </View>
      )}
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
            a.text_md,
            a.font_semi_bold,
            a.leading_snug,
            {
              color: isIncoming
                ? t.palette.positive_600
                : isOutgoing
                  ? t.palette.negative_500
                  : t.atoms.text.color,
              fontVariant: ['tabular-nums'],
            },
          ]}>
          {formatAmount(amount, currency, locale)}
        </Text>
      </View>
      <Button
        testID="transfer-record"
        label={l`Record this payment`}
        size="small"
        color="primary_subtle"
        onPress={onRecordPress}>
        <ButtonText>
          <Trans>Record</Trans>
        </ButtonText>
      </Button>
    </Animated.View>
  )
}
