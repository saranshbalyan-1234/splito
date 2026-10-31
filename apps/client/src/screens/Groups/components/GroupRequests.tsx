import {memo} from 'react'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {
  approveJoinRequest,
  cancelGroupRequest,
  declineGroupRequest,
  type Entity,
  type Group,
  type GroupRequest,
  joinGroup,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {directory} from '#/data/friends'
import {useEntity, useMutationCtx, useStore} from '#/data/hooks'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Toast from '#/components/Toast'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {ago} from '#/components/people/ago'
import {RequestAction, RequestRow} from '#/components/people/RequestRow'
import {useRowAction} from '#/components/people/useRowAction'

/** The group's name now, else the one the request carried (a group renamed since stays right in its rows). */
function useGroupName(request: Entity<GroupRequest>) {
  return useEntity<Group>('group', request.data.groupId)?.data.name ?? request.data.groupName
}

/**
 * The actions of a group request, in its row on the Groups tab and in place in Activity (owners 195, 197), the same
 * buttons as the friend rows: Join / Decline on "X added you to G", Approve / Decline on a join request for a group I
 * run, Cancel on what I sent. Declining is silent to the other side.
 */
export const GroupRequestActions = memo(function GroupRequestActions({request}: {request: Entity<GroupRequest>}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const act = useRowAction()
  const {kind, direction, name: who} = request.data
  const group = useGroupName(request)

  if (direction === 'outgoing')
    return (
      <RequestAction
        testID="group-request-cancel"
        label={kind === 'invite' ? l`Cancel the invite to ${who} for ${group}` : l`Cancel your request to join ${group}`}
        text={l({message: 'Cancel', context: 'button'})}
        icon={XIcon}
        onPress={() =>
          void act('GroupRequest.cancel', async () => {
            await cancelGroupRequest(store, ctx, request.id)
            haptics.confirm()
            Toast.show(kind === 'invite' ? l`Invite to ${who} cancelled` : l`Request to join ${group} cancelled`)
          })
        }
      />
    )

  const isJoin = kind === 'join'
  return (
    <>
      <RequestAction
        testID={isJoin ? 'join-request-approve' : 'group-request-join'}
        label={isJoin ? l`Approve ${who} joining ${group}` : l`Join ${group}`}
        text={isJoin ? l({message: 'Approve', context: 'button'}) : l({message: 'Join', context: 'button'})}
        icon={CheckIcon}
        color="primary"
        onPress={() =>
          void act('GroupRequest.accept', async () => {
            if (isJoin) {
              await approveJoinRequest(store, ctx, request.id)
              await directory.accept(request.id)
              haptics.success()
              Toast.show(l`${who} joined ${group}`, {type: 'success'})
              return
            }
            const {group: joined} = await joinGroup(store, ctx, request.id)
            await directory.accept(request.id)
            haptics.success()
            Toast.show(l`You joined ${group}`, {type: 'success'})
            navigation.navigate('Group', {groupId: joined.id})
          })
        }
      />
      <RequestAction
        testID={isJoin ? 'join-request-decline' : 'group-request-decline'}
        label={isJoin ? l`Decline ${who} joining ${group}` : l`Decline joining ${group}`}
        text={l({message: 'Decline', context: 'button'})}
        icon={XIcon}
        onPress={() =>
          void act('GroupRequest.decline', async () => {
            await declineGroupRequest(store, ctx, request.id)
            haptics.confirm()
            // Silent to them (26.18): their side just waits until it expires.
            Toast.show(l`Declined. ${who} isn’t told.`)
          })
        }
      />
    </>
  )
})

/** One group request on one line (26.18): who, what it means, and its actions. */
export function GroupRequestRow({request}: {request: Entity<GroupRequest>}) {
  const now = useTickEveryMinute()
  const {kind, direction, name: who, sentAt} = request.data
  const group = useGroupName(request)
  const when = ago(now - sentAt)
  const row =
    kind === 'invite' && direction === 'incoming'
      ? {testID: `group-invite-${group}`, name: who, detail: <Trans>Added you to {group} · {when}</Trans>}
      : kind === 'join' && direction === 'incoming'
        ? {testID: `join-request-${who}`, name: who, detail: <Trans>Wants to join {group} · {when}</Trans>}
        : kind === 'invite'
          ? {testID: `group-invite-sent-${who}`, name: who, detail: <Trans>Invited to {group} · waiting · {when}</Trans>}
          : {testID: `group-join-sent-${group}`, name: group, detail: <Trans>Waiting for an admin to approve · {when}</Trans>}
  return (
    <RequestRow {...row} sync={request}>
      <GroupRequestActions request={request} />
    </RequestRow>
  )
}
