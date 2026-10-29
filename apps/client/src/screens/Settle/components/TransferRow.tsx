import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useRoute} from '@react-navigation/native'
import {formatAmount, repaymentFlow, type Transfer, ZERO} from '@splito/domain'

import {type AllNavigatorParams} from '#/lib/routes/types'
import {RemindMenuItems} from '#/features/remind/RemindMenuItems'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import * as Menu from '#/components/Menu'
import {ArrowRight_Stroke2_Corner0_Rounded as ArrowRightIcon} from '#/components/icons/Arrow'
import {Text} from '#/components/Typography'
import {moneyGlyph, useMoneyStyle} from '#/components/MoneyDirection'
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
  const {groupId} = useRoute<RouteProp<AllNavigatorParams, 'Settle'>>().params
  const name = (id: string) => names.get(id) ?? l`Someone`
  const avatarName = (id: string) => (id === me ? meName : name(id))
  const isIncoming = to === me
  const isOutgoing = from === me
  const money = useMoneyStyle()
  /* The transfer from my side: positive comes to me, negative I pay, zero is between others. */
  const mine = repaymentFlow(transfer, me)
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
            {fontVariant: ['tabular-nums']},
            money.style(mine),
          ]}>
          {mine === ZERO
            ? formatAmount(amount, currency, locale)
            : `${moneyGlyph(mine)}\u00a0${formatAmount(amount, currency, locale)}`}
        </Text>
      </View>
      {(isIncoming || isOutgoing) && (
        /* The row's overflow (Bluesky's pattern): Remind them when they pay me, Remind me either way (F-1118, F-1119). */
        <Menu.Root>
          <Menu.Trigger label={l`More options for ${sentence}`}>
            {({props}) => (
              <Button
                {...props}
                testID="transfer-more"
                label={props.accessibilityLabel}
                size="small"
                color="secondary"
                variant="ghost"
                shape="round"
                style={{marginRight: -4}}>
                <ButtonIcon icon={DotsIcon} />
              </Button>
            )}
          </Menu.Trigger>
          <Menu.Outer>
            <RemindMenuItems
              personId={isIncoming ? from : to}
              groupId={groupId}
              owed={isIncoming ? {[currency]: amount} : {}}
              isOpen
            />
          </Menu.Outer>
        </Menu.Root>
      )}
      <Button
        testID="transfer-record"
        label={l`Record this payment`}
        size="small"
        color="primary"
        onPress={onRecordPress}>
        <ButtonText>
          <Trans>Record</Trans>
        </ButtonText>
      </Button>
    </Animated.View>
  )
}
