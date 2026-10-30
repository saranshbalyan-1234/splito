import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type DisputeEvent, type DisputeEventKind} from '@splito/sync'

import {useTimeZone} from '#/locale/useDates'
import {atoms as a, useTheme} from '#/alf'
import {AcceptedIcon, DisputedIcon, GoneIcon, HoldIcon, RejectedIcon, ReleaseIcon, ReopenIcon, WithdrawnIcon} from './icons'
import {useDisputeWords} from './words'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {useDisplayName} from '#/components/split/shared'
import {Text} from '#/components/Typography'

const ICONS: Record<DisputeEventKind, React.ComponentType<SVGIconProps>> = {
  raised: DisputedIcon,
  held: HoldIcon,
  accepted: AcceptedIcon,
  rejected: RejectedIcon,
  withdrawn: WithdrawnIcon,
  reopened: ReopenIcon,
  released: ReleaseIcon,
  gone: GoneIcon,
}

/** True for a thread line that is a dispute event (the thread also holds history lines). */
export const isDisputeLine = (line: {key: string; at: number}): line is DisputeEvent => 'disputeId' in line

/**
 * A system line in the record's thread (F-1210, 26.20): "Bob disputed this · Wrong amount", "Ann rejected Bob's
 * dispute", drawn like the history lines (centred, quiet, a small glyph), with the note under it. The discussion
 * itself happens in the comments around it.
 */
export function DisputeLine({event}: {event: DisputeEvent}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const tz = useTimeZone()
  const name = useDisplayName()
  const words = useDisputeWords()
  const d = event.data
  const raiser = name(d.raisedBy)
  const actor = name(event.actor)
  const reason = d.kind === 'hold' ? '' : words.reason(d.reason)
  const title = {
    raised: l`${raiser} disputed this · ${reason}`,
    held: l`${raiser} put this on hold`,
    accepted: l`${actor} accepted ${raiser}’s dispute`,
    rejected: l`${actor} rejected ${raiser}’s dispute`,
    withdrawn: l`${raiser} withdrew the dispute`,
    reopened: l`${raiser} reopened the dispute`,
    released: l`${actor} released the hold`,
    gone: l`Deleted, so the dispute was closed`,
  }[event.kind]
  /* The words under the line: what the raiser said, or what the answer said. */
  const detail = event.kind === 'rejected' || event.kind === 'accepted' ? d.resolution : event.kind === 'raised' || event.kind === 'held' || event.kind === 'reopened' ? d.note : ''
  const Icon = ICONS[event.kind]
  return (
    <View testID={`dispute-line-${event.kind}`} style={[a.align_center, a.gap_2xs, a.px_xl, a.pt_md]}>
      <View style={[a.flex_row, a.align_center, a.justify_center, a.gap_xs, a.flex_wrap]}>
        <Icon size="xs" fill={event.kind === 'raised' || event.kind === 'held' || event.kind === 'reopened' ? t.palette.yellow : t.atoms.text_contrast_medium.color} />
        <Text style={[a.text_sm, a.font_medium, a.leading_snug, a.text_center, t.atoms.text_contrast_high]}>
          {title}
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {' · '}
            {i18n.date(new Date(event.at), {timeStyle: 'short', timeZone: tz})}
          </Text>
        </Text>
      </View>
      {detail ? (
        <Text emoji style={[a.text_xs, a.leading_snug, a.text_center, t.atoms.text_contrast_medium]}>
          {detail}
        </Text>
      ) : null}
    </View>
  )
}
