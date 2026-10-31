import {type ActivityEvent} from '@splito/sync'

/**
 * Who an Activity row's avatar is (owner 178): who made the change (owner rule 6), except a friend request shows the
 * friend, and a dispute that was raised shows who raised it. Undefined for an invitee who is not a person yet.
 */
export function avatarPersonId(
  event: ActivityEvent,
  requests: ReadonlyMap<string, {data: {personId?: string | null}}>,
): string | undefined {
  if (event.entityType === 'friendRequest' && (event.kind === 'friendRequest.received' || event.kind === 'friendRequest.accepted'))
    return (requests.get(event.entityId)?.data ?? event.data).personId ?? undefined
  if (event.entityType === 'dispute' && !(event.kind === 'dispute.accepted' || event.kind === 'dispute.rejected' || event.kind === 'dispute.released'))
    return event.data.raisedBy
  return event.actor
}
