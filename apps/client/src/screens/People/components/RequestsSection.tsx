// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/JoinRequests.tsx (request rows: avatar, name, Accept / Reject buttons)
import {useRef} from 'react'
import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {plural, t} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  type Entity,
  type FriendRequest,
  resendFriendRequest,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {directory, requestName, usePendingRequests} from '#/data/friends'
import {useMutationCtx, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {useListAnimations} from '#/motion/listAnimations'
import {SectionHeader} from './SectionHeader'

const DAY = 86_400_000

/**
 * The top of People (26.18): "Requests" waiting for your answer (Accept /
 * Decline) and "Invites sent" waiting for theirs (Resend / Cancel). Each
 * section shows only when it has rows; both read one shared request source.
 */
export function RequestsSection() {
  const {t: l} = useLingui()
  const {incoming, outgoing} = usePendingRequests()
  if (incoming.length === 0 && outgoing.length === 0) return null
  return (
    <View testID="people-requests">
      {incoming.length > 0 ? (
        <>
          <SectionHeader
            title={l`Requests`}
            testID="people-requests-title"
            count={incoming.length}
          />
          {incoming.map(r => (
            <IncomingRow key={r.id} request={r} />
          ))}
        </>
      ) : null}
      {outgoing.length > 0 ? (
        <>
          <SectionHeader
            title={l`Invites sent`}
            testID="people-invites-title"
            count={outgoing.length}
          />
          {outgoing.map(r => (
            <OutgoingRow key={r.id} request={r} />
          ))}
        </>
      ) : null}
    </View>
  )
}

/** One write at a time per row, from the first tap. */
function useRowAction() {
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const busy = useRef(false)
  return async (where: string, fn: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    try {
      await fn()
    } catch (e) {
      haptics.error()
      logger.error(e, {where})
      Toast.show(l`That didn’t work. Please try again.`, {type: 'error'})
    } finally {
      busy.current = false
    }
  }
}

function Row({
  testID,
  name,
  detail,
  isCompact = false,
  children,
}: {
  testID: string
  name: string
  detail: React.ReactNode
  /** Invites sent: one line, muted avatar, the actions at the end. */
  isCompact?: boolean
  children: React.ReactNode
}) {
  const t = useTheme()
  const listAnimations = useListAnimations()
  return (
    <Animated.View
      {...listAnimations}
      testID={testID}
      style={[
        a.flex_row,
        isCompact ? a.align_center : a.align_start,
        a.gap_md,
        a.px_lg,
        isCompact ? a.py_sm : a.py_md,
      ]}>
      <View style={[isCompact && {opacity: 0.55}]}>
        <UserAvatar size={isCompact ? 36 : 42} name={name} type="user" />
      </View>
      <View style={[a.flex_1, a.gap_2xs, {minWidth: 0}]}>
        <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
          {name}
        </Text>
        <Text
          numberOfLines={isCompact ? 1 : 2}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {detail}
        </Text>
        {isCompact ? null : (
          <View style={[a.flex_row, a.align_center, a.gap_sm, a.mt_sm]}>
            {children}
          </View>
        )}
      </View>
      {isCompact ? (
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>{children}</View>
      ) : null}
    </Animated.View>
  )
}

function IncomingRow({request}: {request: Entity<FriendRequest>}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const act = useRowAction()
  const now = useTickEveryMinute()
  const name = requestName(request.data)

  return (
    <Row
      testID={`request-${name}`}
      name={name}
      detail={
        <Trans>Wants to split expenses with you · {ago(now - request.data.sentAt)}</Trans>
      }>
      <Button
        testID="request-accept"
        label={l`Accept ${name}’s friend request`}
        size="small"
        color="primary"
        onPress={() =>
          void act('People.accept', async () => {
            const {person} = await acceptFriendRequest(store, ctx, request.id)
            await directory.accept(request.id)
            haptics.success()
            Toast.show(l`You and ${person.data.name} are friends now`, {
              type: 'success',
            })
            navigation.navigate('Person', {personId: person.id})
          })
        }>
        <ButtonText>
          <Trans context="button">Accept</Trans>
        </ButtonText>
      </Button>
      <Button
        testID="request-decline"
        label={l`Decline ${name}’s friend request`}
        size="small"
        color="secondary"
        onPress={() =>
          void act('People.decline', async () => {
            await declineFriendRequest(store, ctx, request.id)
            haptics.confirm()
            // Silent to them (26.18): their side just waits until it expires.
            Toast.show(l`Request declined. ${name} isn’t told.`)
          })
        }>
        <ButtonText>
          <Trans context="button">Decline</Trans>
        </ButtonText>
      </Button>
    </Row>
  )
}

function OutgoingRow({request}: {request: Entity<FriendRequest>}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const act = useRowAction()
  const now = useTickEveryMinute()
  const r = request.data
  const name = requestName(r)
  const sent = ago(now - r.sentAt)
  const detail =
    r.reach === 'invited' ? (
      <Trans>Invited, not on Splito yet · {sent}</Trans>
    ) : r.reach === 'unchecked' ? (
      <Trans>We’ll send it when you’re online</Trans>
    ) : (
      <Trans>Waiting for them to accept · {sent}</Trans>
    )

  return (
    <Row testID={`invite-sent-${name}`} name={name} detail={detail} isCompact>
      <Button
        testID="invite-sent-resend"
        label={l`Resend to ${name}`}
        size="small"
        color="secondary"
        onPress={() =>
          void act('People.resend', async () => {
            if (r.reach === 'invited' && r.inviteCode) {
              // Their personal link: share it again from its sheet.
              navigation.navigate('ShareInvite', {code: r.inviteCode})
              return
            }
            await resendFriendRequest(store, ctx, request.id)
            const delivery = await directory.sendRequest(request.id)
            haptics.success()
            Toast.show(
              delivery === 'sent'
                ? l`Request sent to ${name} again`
                : l`Saved. We’ll send it when you’re online.`,
            )
          })
        }>
        <ButtonText>
          <Trans context="button">Resend</Trans>
        </ButtonText>
      </Button>
      <Button
        testID="invite-sent-cancel"
        label={l`Cancel the request to ${name}`}
        size="small"
        color="secondary"
        variant="ghost"
        shape="round"
        onPress={() =>
          void act('People.cancel', async () => {
            await cancelFriendRequest(store, ctx, request.id)
            haptics.confirm()
            Toast.show(l`Request to ${name} cancelled`)
          })
        }>
        <ButtonIcon icon={XIcon} />
      </Button>
    </Row>
  )
}

/** "today", "yesterday", "3 days ago": requests move in days. */
function ago(ms: number) {
  const days = Math.floor(ms / DAY)
  if (days <= 0) return t`sent today`
  return plural(days, {one: 'sent yesterday', other: 'sent # days ago'})
}
