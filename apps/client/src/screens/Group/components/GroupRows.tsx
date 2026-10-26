import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'

import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {currencyName} from '#/components/people/ledger'
import * as Pills from '#/components/Pills'
import {Text} from '#/components/Typography'
import {moneyGlyph, useMoneyStyle} from '#/components/MoneyDirection'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'

const tabular = {fontVariant: ['tabular-nums' as const]}

/** A currency heading above a group's member balances. */
export function CurrencyHeader({currency}: {currency: string}) {
  const t = useTheme()
  const {i18n} = useLingui()
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_lg,
        a.pt_lg,
        a.pb_sm,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
        {currencyName(currency, i18n.locale)}
      </Text>
      <View
        style={[
          a.rounded_xs,
          a.px_xs,
          {paddingVertical: 1},
          t.atoms.bg_contrast_50,
        ]}>
        <Text
          style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          {currency}
        </Text>
      </View>
    </View>
  )
}

/**
 * One member's net in the group for one currency, in the same words as
 * every other balance: "is owed" / "owes" ("you are owed" / "you owe" for
 * me), coloured by direction.
 */
export function MemberBalanceRow({
  name,
  avatarName = name,
  isMe,
  net,
  currency,
  locale,
}: {
  name: string
  /** The name the avatar draws from ("You" reads the account's own name). */
  avatarName?: string
  isMe: boolean
  net: bigint
  currency: string
  locale: string
}) {
  const t = useTheme()
  const money = useMoneyStyle()
  const figure = `${moneyGlyph(net)}\u00a0${formatAmount(magnitude(net), currency, locale)}`
  const figureStyle = [a.text_md, a.font_semi_bold, tabular, money.style(net)]

  return (
    <View
      testID={`group-net-${currency}-${name}`}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_lg,
        a.py_md,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <UserAvatar size={42} name={avatarName} type="user" />
      <Text
        emoji
        numberOfLines={1}
        style={[a.flex_1, a.text_md, a.font_semi_bold]}>
        {name}
      </Text>
      <Text
        testID={`group-net-${currency}-${name}-text`}
        numberOfLines={1}
        style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {net === ZERO ? (
          <Trans>settled up</Trans>
        ) : net > ZERO ? (
          isMe ? (
            <Trans>
              you are owed <Text style={figureStyle}>{figure}</Text>
            </Trans>
          ) : (
            <Trans>
              is owed <Text style={figureStyle}>{figure}</Text>
            </Trans>
          )
        ) : isMe ? (
          <Trans>
            you owe <Text style={figureStyle}>{figure}</Text>
          </Trans>
        ) : (
          <Trans>
            owes <Text style={figureStyle}>{figure}</Text>
          </Trans>
        )}
      </Text>
    </View>
  )
}

/** One payment of the group's direct settle-up plan: who owes whom, and how much. */
export function OweRow({
  sentence,
  avatarName,
  direction,
  amount,
  currency,
  locale,
  testID,
}: {
  /** "Arjun owes you", "You owe Riya", "Sam owes Priya". */
  sentence: string
  avatarName: string
  /** My side of the payment, for its colour; `null` when I am not in it. */
  direction: 'toMe' | 'fromMe' | null
  amount: bigint
  currency: string
  locale: string
  testID?: string
}) {
  const t = useTheme()
  /* Same colours as the balances above: green comes to me, red leaves me; others' payments stay neutral. */
  const color =
    direction === 'toMe'
      ? t.palette.positive_600
      : direction === 'fromMe'
        ? t.palette.negative_500
        : t.atoms.text.color
  return (
    <View
      testID={testID}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_lg,
        a.py_md,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <UserAvatar size={42} name={avatarName} type="user" />
      <Text
        emoji
        numberOfLines={1}
        style={[a.flex_1, a.text_md, a.font_semi_bold]}>
        {sentence}
      </Text>
      <Text style={[a.text_md, a.font_semi_bold, tabular, {color}]}>
        {formatAmount(amount, currency, locale)}
      </Text>
    </View>
  )
}

/** A member row; friends open their page. */
export function MemberRow({
  personId,
  name,
  avatarName = name,
  isMe,
  hasLeft,
}: {
  personId: string
  name: string
  /** The name the avatar draws from ("You" reads the account's own name). */
  avatarName?: string
  isMe: boolean
  hasLeft: boolean
}) {
  const t = useTheme()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  const content = (
    <Animated.View style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
      <UserAvatar size={42} name={avatarName} type="user" />
      <Text
        emoji
        numberOfLines={1}
        style={[a.flex_1, a.text_md, a.font_semi_bold]}>
        {name}
      </Text>
      {hasLeft && (
        <Pills.Tag>
          <Trans>Left the group</Trans>
        </Pills.Tag>
      )}
      {!isMe && (
        <ChevronIcon size="sm" fill={t.atoms.text_contrast_low.color} />
      )}
    </Animated.View>
  )
  const rowStyle = [a.px_lg, a.py_md, a.border_t, t.atoms.border_contrast_low]

  return (
    <Animated.View {...listAnimations}>
      {isMe ? (
        <View testID={`member-${name}`} style={rowStyle}>
          {content}
        </View>
      ) : (
        <Link
          testID={`member-${name}`}
          href={`/people/${personId}`}
          asAnchor
          anchorNoUnderline
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          accessibilityLabel={name}
          accessibilityHint=""
          hoverStyle={t.atoms.bg_contrast_25}
          style={[rowStyle, a.transition_color]}>
          {content}
        </Link>
      )}
    </Animated.View>
  )
}
