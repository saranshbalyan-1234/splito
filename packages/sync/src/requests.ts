import {type Entity} from './types'

/*
 * What every kind of request shares (friend requests and group requests): who it came from, where it stands and when
 * it was sent. Pure and import-free of the mutation modules, so both can use it without a cycle. Re-exported by `friends`.
 */

/** Unanswered requests lapse after 30 days; declining is silent, so the sender sees this too. */
export const REQUEST_LIFETIME_MS = 30 * 86_400_000

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type RequestState = RequestStatus | 'expired'

export interface Asked {
  direction: 'outgoing' | 'incoming'
  status: RequestStatus
  /** Epoch ms of the last send (a resend restarts the 30 days). */
  sentAt: number
}

/** Derived, never stored: a pending request past its 30 days reads as expired. */
export function requestState(r: Asked, now: number): RequestState {
  return r.status === 'pending' && now > r.sentAt + REQUEST_LIFETIME_MS ? 'expired' : r.status
}

export const pendingIn = (direction: Asked['direction']) => <R extends Asked>(rs: Entity<R>[], now: number) =>
  rs.filter(r => !r.deleted && r.data.direction === direction && requestState(r.data, now) === 'pending').sort((x, y) => y.data.sentAt - x.data.sentAt)
