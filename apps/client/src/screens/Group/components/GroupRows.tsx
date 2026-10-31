import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, magnitude, ZERO} from '@splito/domain'

import {RemindMenuItems} from '#/features/remind/RemindMenuItems'
import {Link} from '#/view/com/util/Link'
import {PersonLink, personHref} from '#/components/PersonLink'
import {atoms as a, useTheme} from '#/alf'
import {DisputedLine} from '#/components/disputes/DisputedLine'
import {Button, ButtonIcon} from '#/components/Button'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {Handshake_Stroke2_Corner0_Rounded as HandshakeIcon} from '#/components/icons/Money'
import {LogOutIcon as ExitIcon} from '#/screens/Group/components/groupIcons'
import * as Menu from '#/components/Menu'
import {currencyName} from '#/locale/currencyName'
import * as Pills from '#/components/Pills'
import {Text} from '#/components/Typography'
import {moneyGlyph, useMoneyStyle} from '#/components/MoneyDirection'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'

const tabular = {fontVariant: ['tabular-nums' as const]}

/** A currency heading above a group's member balances. */
export function CurrencyHeader({currency, disputed, disputedHref}: {currency: string; disputedHref?: string; /** What the disputed or held records in this group move, in this currency (F-1210). */ disputed?: bigint}) {
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
      {disputed ? (
        <View style={[a.flex_1, a.align_end]}>
          <DisputedLine testID="group-balances-disputed" href={disputedHref} amounts={[{currency, amount: disputed}]} />
        </View>
      ) : null}
    </View>
  )
}

/**
 * One member's net in the group for one currency, in the same words as
 * every other balance: "is owed" / "owes" ("you are owed" / "you owe" for
 * me), coloured by direction.
 */
export function MemberBalanceRow({
  personId,
  name,
  avatarName = name,
  isMe,
  net,
  currency,
  locale,
}: {
  personId: string
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
      <PersonLink id={personId} name={name} avatarName={avatarName} size={42} style={a.flex_1} />
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
  personId,
  avatarName,
  direction,
  amount,
  currency,
  locale,
  testID,
  remind,
  onCallItEven,
}: {
  /** "Arjun owes you", "You owe Riya", "Sam owes Priya". */
  sentence: string
  /** Whose face the row shows (who pays). */
  personId: string
  avatarName: string
  /** My side of the payment, for its colour; `null` when I am not in it. */
  direction: 'toMe' | 'fromMe' | null
  amount: bigint
  currency: string
  locale: string
  testID?: string
  /** Adds Remind (when they owe me) and Remind me to the row's menu: the other person in this payment and the group (F-1118). */
  remind?: {personId: string; groupId: string}
  /** Adds the row's "..." menu with "Call it even" (F-1113). */
  onCallItEven?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const money = useMoneyStyle()
  /* Same colours as the balances above: comes to me, leaves me; others' payments stay neutral. */
  const color =
    direction === 'toMe'
      ? money.incoming
      : direction === 'fromMe'
        ? money.outgoing
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
      <PersonLink id={personId} name={avatarName} show="avatar" size={42} />
      <Text
        emoji
        numberOfLines={1}
        style={[a.flex_1, a.text_md, a.font_semi_bold]}>
        {sentence}
      </Text>
      <Text style={[a.text_md, a.font_semi_bold, tabular, {color}]}>
        {formatAmount(amount, currency, locale)}
      </Text>
      {(onCallItEven || remind) && (
        /* Bluesky's row overflow: a sibling of the row's content, never nested in a Pressable. */
        <Menu.Root>
          <Menu.Trigger label={l`More options for ${sentence}`}>
            {({props}) => (
              <Button
                {...props}
                testID={testID ? `${testID}-more` : undefined}
                label={props.accessibilityLabel}
                size="small"
                color="secondary"
                variant="ghost"
                shape="round"
                style={{marginRight: -8}}>
                <ButtonIcon icon={DotsIcon} />
              </Button>
            )}
          </Menu.Trigger>
          <Menu.Outer>
            {onCallItEven && (
              <Menu.Item
                testID="owe-call-even"
                label={l`Call it even`}
                onPress={onCallItEven}>
                <Menu.ItemText>
                  <Trans>Call it even</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={HandshakeIcon} position="right" />
              </Menu.Item>
            )}
            {remind && (
              <RemindMenuItems
                personId={remind.personId}
                groupId={remind.groupId}
                owed={direction === 'toMe' ? {[currency]: amount} : {}}
                isOpen
              />
            )}
          </Menu.Outer>
        </Menu.Root>
      )}
    </View>
  )
}

/**
 * A member row; friends open their page. An active member has a "..." menu: "Leave group" on my own row,
 * "Remove from group" on a friend's (F-615, F-613), as Bluesky's group member menu. The menu is a sibling
 * of the row's link, never nested inside it.
 */
export function MemberRow({
  personId,
  name,
  avatarName = name,
  isMe,
  hasLeft,
  isAdmin = false,
  onExitPressed,
}: {
  personId: string
  name: string
  /** The name the avatar draws from ("You" reads the account's own name). */
  avatarName?: string
  isMe: boolean
  hasLeft: boolean
  isAdmin?: boolean
  /** Opens the leave / remove sheet; the row has no menu without it, or once the member has left. */
  onExitPressed?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  const hasMenu = !!onExitPressed && !hasLeft
  const content = (
    <Animated.View style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
      {/* The whole row opens this person (Me opens Profile), so the avatar and name are the same target. */}
      <PersonLink id={personId} name={name} avatarName={avatarName} show="avatar" size={42} isInsideLink />
      <PersonLink id={personId} name={name} show="name" style={a.flex_1} isInsideLink />
      {isAdmin && !hasLeft && (
        <Pills.Tag>
          <Trans>Admin</Trans>
        </Pills.Tag>
      )}
      {hasLeft && (
        <Pills.Tag>
          <Trans>Left the group</Trans>
        </Pills.Tag>
      )}
      {!isMe && !hasMenu && (
        <ChevronIcon size="sm" fill={t.atoms.text_contrast_low.color} />
      )}
    </Animated.View>
  )
  const rowStyle = [a.px_lg, a.py_md]

  return (
    <Animated.View {...listAnimations}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.border_t,
          t.atoms.border_contrast_low,
        ]}>
        <View style={[a.flex_1]}>
          <Link
            testID={`member-${name}`}
            href={personHref(personId, isMe)}
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
        </View>
        {hasMenu && (
          <Menu.Root>
            <Menu.Trigger label={l`More options for ${name}`}>
              {({props}) => (
                <Button
                  {...props}
                  testID={`member-${name}-more`}
                  label={props.accessibilityLabel}
                  size="small"
                  color="secondary"
                  variant="ghost"
                  shape="round"
                  style={{marginRight: 8}}>
                  <ButtonIcon icon={DotsIcon} />
                </Button>
              )}
            </Menu.Trigger>
            <Menu.Outer>
              <Menu.Item
                testID={`member-${name}-exit`}
                label={isMe ? l`Leave group` : l`Remove ${name} from group`}
                destructive
                onPress={onExitPressed}>
                <Menu.ItemText>
                  {isMe ? <Trans>Leave group</Trans> : <Trans>Remove from group</Trans>}
                </Menu.ItemText>
                <Menu.ItemIcon icon={ExitIcon} position="right" />
              </Menu.Item>
            </Menu.Outer>
          </Menu.Root>
        )}
      </View>
    </Animated.View>
  )
}
