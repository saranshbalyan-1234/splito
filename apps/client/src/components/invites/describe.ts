import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {type InviteLink, inviteLinkState, usesLeft} from '@splito/sync'

const HOUR = 3_600_000

/** "22 of 25 uses left · Expires in 30 days", or why the link no longer works. */
export function useDescribeLink() {
  const {t: l} = useLingui()
  return (link: InviteLink, now: number) => {
    const state = inviteLinkState(link, now)
    if (state === 'revoked') return l`Revoked`
    if (state === 'expired') return l`Expired`
    if (state === 'used-up') return l`All uses taken`
    const left = usesLeft(link)
    const uses =
      left === null
        ? l`Unlimited uses`
        : link.maxUses === 1
          ? l`Works once`
          : l`${left} of ${link.maxUses} uses left`
    if (link.expiresAt === null) return `${uses} · ${l`Never expires`}`
    const ms = link.expiresAt - now
    const expiry =
      ms < HOUR
        ? l`Expires within the hour`
        : ms < 23.5 * HOUR
          ? plural(Math.round(ms / HOUR), {one: 'Expires in # hour', other: 'Expires in # hours'})
          : plural(Math.round(ms / (24 * HOUR)), {one: 'Expires in # day', other: 'Expires in # days'})
    return `${uses} · ${expiry}`
  }
}
