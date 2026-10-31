import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {seeRequestsPath} from '#/lib/links/make'
import {SectionLink} from '#/components/SectionLink'
import {SectionHeader} from '#/components/SectionHeader'

/** Rows the section shows at most (owner 153, 175, 197); "See all" opens Activity (Friends and invites) for the rest. */
const MAX_ROWS = 5

/**
 * The top section of People and of Groups (26.3, owner 197): the requests waiting for your answer, then the invites you
 * sent, one line per row (26.18). At most 5 rows in all, requests first; more than that adds "See all" into Activity.
 * Hidden when there are none. The caller builds the rows; this is the one layout both tabs share.
 */
export function RequestsBlock({
  testIDPrefix,
  incomingTitle,
  outgoingTitle,
  incoming,
  outgoing,
}: {
  /** 'people' or 'groups': testIDs `<prefix>-requests`, `-title`, `-all`, `<prefix>-invites-title`. */
  testIDPrefix: string
  incomingTitle: string
  /** Heading of the requests I sent ('Invites sent' on People, 'Sent' on Groups). */
  outgoingTitle: string
  incoming: React.ReactNode[]
  outgoing: React.ReactNode[]
}) {
  const {t: l} = useLingui()
  if (incoming.length === 0 && outgoing.length === 0) return null
  const shownIncoming = incoming.slice(0, MAX_ROWS)
  const shownOutgoing = outgoing.slice(0, MAX_ROWS - shownIncoming.length)
  const hasMore = shownIncoming.length + shownOutgoing.length < incoming.length + outgoing.length
  const seeAll = (
    <SectionLink testID={`${testIDPrefix}-requests-all`} href={seeRequestsPath()} label={l`See all requests and invites`}>
      <Trans>See all</Trans>
    </SectionLink>
  )
  return (
    <View testID={`${testIDPrefix}-requests`}>
      {shownIncoming.length > 0 ? (
        <>
          <SectionHeader
            title={incomingTitle}
            testID={`${testIDPrefix}-requests-title`}
            href={seeRequestsPath()}
            hrefLabel={l`See all requests and invites`}
            count={incoming.length}
            action={hasMore && shownOutgoing.length === 0 ? seeAll : undefined}
          />
          {shownIncoming}
        </>
      ) : null}
      {shownOutgoing.length > 0 ? (
        <>
          <SectionHeader
            title={outgoingTitle}
            testID={`${testIDPrefix}-invites-title`}
            href={seeRequestsPath()}
            hrefLabel={l`See all requests and invites`}
            count={outgoing.length}
            action={hasMore ? seeAll : undefined}
          />
          {shownOutgoing}
        </>
      ) : null}
    </View>
  )
}
