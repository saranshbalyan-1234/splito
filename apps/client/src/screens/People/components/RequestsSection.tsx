// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/JoinRequests.tsx (request rows: avatar, name, Accept / Reject buttons)
import {useRef} from 'react'
import {View} from 'react-native'
import {plural, t} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  type Entity,
  type FriendRequest,
  requestName,
  resendFriendRequest,
} from '@splito/sync'

import {seeRequestsPath} from '#/lib/links/make'
import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {directory} from '#/data/friends'
import {useMutationCtx, usePendingRequests, useStore} from '#/data/hooks'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {PaperPlane_Stroke2_Corner0_Rounded as ResendIcon} from '#/components/icons/Invite'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Toast from '#/components/Toast'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {RequestAction, RequestRow} from '#/components/people/RequestRow'
import {SectionLink} from '#/components/SectionLink'
import {SectionHeader} from './SectionHeader'

const DAY = 86_400_000

/** Rows the section shows at most (owner 153, 175); "See all" opens Friends and invites for the rest. */
const MAX_ROWS = 5

/**
 * On Home under the Overview and at the top of People (26.3, owners 153, 175): "Requests" waiting for your
 * answer (Accept / Decline), then "Invites sent" (Resend / Cancel), each row on one line as on Friends and invites
 * (F-621). At most 5 rows in all, requests first; more than that adds "See all" to Friends and invites. Hidden
 * when nothing is pending.
 */
export function RequestsSection() {
  const {t: l} = useLingui()
  const {incoming, outgoing} = usePendingRequests()
  if (incoming.length === 0 && outgoing.length === 0) return null
  const shownIncoming = incoming.slice(0, MAX_ROWS)
  const shownOutgoing = outgoing.slice(0, MAX_ROWS - shownIncoming.length)
  const hasMore = shownIncoming.length + shownOutgoing.length < incoming.length + outgoing.length
  const seeAll = (
    <SectionLink testID="people-requests-all" href={seeRequestsPath()} label={l`See all requests and invites`}>
      <Trans>See all</Trans>
    </SectionLink>
  )
  return (
    <View testID="people-requests">
      {shownIncoming.length > 0 ? (
        <>
          <SectionHeader
            title={l`Requests`}
            testID="people-requests-title"
            href={seeRequestsPath()}
            hrefLabel={l`See all requests and invites`}
            count={incoming.length}
            action={hasMore && shownOutgoing.length === 0 ? seeAll : undefined}
          />
          {shownIncoming.map(r => (
            <IncomingRow key={r.id} request={r} />
          ))}
        </>
      ) : null}
      {shownOutgoing.length > 0 ? (
        <>
          <SectionHeader
            title={l`Invites sent`}
            testID="people-invites-title"
            href={seeRequestsPath()}
            hrefLabel={l`See all requests and invites`}
            count={outgoing.length}
            action={hasMore ? seeAll : undefined}
          />
          {shownOutgoing.map(r => (
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

export function IncomingRow({request}: {request: Entity<FriendRequest>}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const act = useRowAction()
  const now = useTickEveryMinute()
  const name = requestName(request.data)

  return (
    <RequestRow
      testID={`request-${name}`}
      name={name}
      sync={request}
      detail={
        <Trans>Wants to be friends · {ago(now - request.data.sentAt)}</Trans>
      }>
      <RequestAction
        testID="request-accept"
        label={l`Accept ${name}’s friend request`}
        text={l({message: 'Accept', context: 'button'})}
        icon={CheckIcon}
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
        }
      />
      <RequestAction
        testID="request-decline"
        label={l`Decline ${name}’s friend request`}
        text={l({message: 'Decline', context: 'button'})}
        icon={XIcon}
        onPress={() =>
          void act('People.decline', async () => {
            await declineFriendRequest(store, ctx, request.id)
            haptics.confirm()
            // Silent to them (26.18): their side just waits until it expires.
            Toast.show(l`Request declined. ${name} isn’t told.`)
          })
        }
      />
    </RequestRow>
  )
}

export function OutgoingRow({request}: {request: Entity<FriendRequest>}) {
  const now = useTickEveryMinute()
  const r = request.data
  const sent = ago(now - r.sentAt)
  const detail =
    r.reach === 'invited' ? (
      <Trans>Invited, not on Splito yet</Trans>
    ) : r.reach === 'unchecked' ? (
      <Trans>We’ll send it when you’re online</Trans>
    ) : (
      <Trans>Waiting to accept · {sent}</Trans>
    )

  return (
    <RequestRow
      testID={`invite-sent-${requestName(r)}`}
      name={requestName(r)}
      sync={request}
      detail={detail}>
      <OutgoingActions request={request} />
    </RequestRow>
  )
}

/** Resend and Cancel for an invite sent: the row's buttons on Home and People, and in place on Activity (owner 195). */
export function OutgoingActions({request}: {request: Entity<FriendRequest>}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const act = useRowAction()
  const r = request.data
  const name = requestName(r)

  return (
    <>
      <RequestAction
        testID="invite-sent-resend"
        label={l`Resend to ${name}`}
        text={l({message: 'Resend', context: 'button'})}
        icon={ResendIcon}
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
        }
      />
      <RequestAction
        testID="invite-sent-cancel"
        label={l`Cancel the request to ${name}`}
        text={l({message: 'Cancel', context: 'button'})}
        icon={XIcon}
        onPress={() =>
          void act('People.cancel', async () => {
            await cancelFriendRequest(store, ctx, request.id)
            haptics.confirm()
            Toast.show(l`Request to ${name} cancelled`)
          })
        }
      />
    </>
  )
}

/** "today", "yesterday", "3 days ago": requests move in days. */
function ago(ms: number) {
  // Rounded: the minute tick lags the clock, so floor would read 2 days as "yesterday".
  const days = Math.round(ms / DAY)
  if (days <= 0) return t`today`
  return plural(days, {one: 'yesterday', other: '# days ago'})
}
