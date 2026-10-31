import {useLingui} from '@lingui/react/macro'

import {usePendingGroupRequests} from '#/data/hooks'
import {RequestsBlock} from '#/components/people/RequestsBlock'
import {GroupRequestRow} from './GroupRequests'

/**
 * At the top of Groups (26.3, owner 197; F-269): group requests to me (Join / Decline), join requests for groups I run
 * (Approve / Decline), then the group invites and join requests I sent (Cancel). The layout is People's
 * (`RequestsBlock`): one line per row, 5 at most, "See all" into Activity. Hidden when nothing is pending.
 */
export function GroupRequestsSection() {
  const {t: l} = useLingui()
  const {toMe, toApprove, sent} = usePendingGroupRequests()
  return (
    <RequestsBlock
      testIDPrefix="groups"
      incomingTitle={l`Group requests`}
      outgoingTitle={l`Sent`}
      incoming={[...toMe, ...toApprove].map(r => (
        <GroupRequestRow key={r.id} request={r} />
      ))}
      outgoing={sent.map(r => (
        <GroupRequestRow key={r.id} request={r} />
      ))}
    />
  )
}
