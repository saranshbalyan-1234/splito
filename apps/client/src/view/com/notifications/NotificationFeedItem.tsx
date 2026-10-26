// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/notifications/NotificationFeedItem.tsx
import {memo} from 'react'
import {StyleSheet, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, platform, useTheme} from '#/alf'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as RestoreIcon} from '#/components/icons/ArrowRotate'
import {CirclePlus_Stroke2_Corner0_Rounded as AddedIcon} from '#/components/icons/CirclePlus'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {Pencil_Stroke2_Corner0_Rounded as EditedIcon} from '#/components/icons/Pencil'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {Text} from '#/components/Typography'

const MAX_AUTHORS = 5

/** One change from the local store's history, shaped for the Activity feed. */
export type ActivityItem = {
  key: string
  type:
    | 'expense-added'
    | 'expense-edited'
    | 'expense-deleted'
    | 'expense-restored'
    | 'group-created'
    | 'person-added'
  /** Who made the change. */
  actorName: string
  /** Expense title, group name or person name. */
  subject: string
  /** Pre-formatted amount (via `formatAmount`), expenses only. */
  amount?: string
  /** People involved: expense participants, group members, the added person. */
  authors: Array<{id: string; name: string}>
  /** Epoch ms of the change. */
  at: number
}

/*
 * Bluesky's notification row layout (icon column, avatars, text and time).
 * Splito rows don't open anything yet, so the Link wrapper, hover overlay,
 * expandable author list, follow/DM buttons and post/feed embeds are removed.
 */
let NotificationFeedItem = ({
  item,
  hideTopBorder,
}: {
  item: ActivityItem
  hideTopBorder?: boolean
}): React.ReactNode => {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const timestamp = new Date(item.at).toISOString()
  const niceTimestamp = i18n.date(new Date(item.at), {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const actor = (
    <Text style={[a.text_md, a.font_semi_bold]}>{item.actorName}</Text>
  )
  const subject = (
    <Text style={[a.text_md, a.font_semi_bold]}>{item.subject}</Text>
  )
  const amount = item.amount ? ` (${item.amount})` : ''

  let a11yLabel = ''
  let notificationContent: React.ReactElement
  let icon: React.ReactElement

  if (item.type === 'expense-added') {
    a11yLabel = l`${item.actorName} added ${item.subject}${amount}`
    notificationContent = (
      <Trans>
        {actor} added {subject}
        {amount}
      </Trans>
    )
    icon = <AddedIcon size="xl" style={{color: t.palette.primary_500}} />
  } else if (item.type === 'expense-edited') {
    a11yLabel = l`${item.actorName} edited ${item.subject}${amount}`
    notificationContent = (
      <Trans>
        {actor} edited {subject}
        {amount}
      </Trans>
    )
    icon = <EditedIcon size="xl" style={{color: t.palette.contrast_500}} />
  } else if (item.type === 'expense-deleted') {
    a11yLabel = l`${item.actorName} deleted ${item.subject}${amount}`
    notificationContent = (
      <Trans>
        {actor} deleted {subject}
        {amount}
      </Trans>
    )
    icon = <TrashIcon size="xl" style={{color: t.palette.negative_500}} />
  } else if (item.type === 'expense-restored') {
    a11yLabel = l`${item.actorName} restored ${item.subject}${amount}`
    notificationContent = (
      <Trans>
        {actor} restored {subject}
        {amount}
      </Trans>
    )
    icon = <RestoreIcon size="xl" style={{color: t.palette.positive_500}} />
  } else if (item.type === 'group-created') {
    a11yLabel = l`${item.actorName} created the group ${item.subject}`
    notificationContent = (
      <Trans>
        {actor} created the group {subject}
      </Trans>
    )
    icon = <GroupIcon size="xl" style={{color: t.palette.primary_500}} />
  } else if (item.type === 'person-added') {
    a11yLabel = l`${item.actorName} added ${item.subject}`
    notificationContent = (
      <Trans>
        {actor} added {subject}
      </Trans>
    )
    icon = <PersonPlusIcon size="xl" style={{color: t.palette.primary_500}} />
  } else {
    return null
  }
  a11yLabel += ` · ${niceTimestamp}`

  return (
    <View
      accessible={true}
      accessibilityLabel={a11yLabel}
      testID={`activityItem-${item.key}`}
      style={[
        a.flex_row,
        a.align_start,
        {padding: 10},
        a.pr_lg,
        t.atoms.border_contrast_low,
        !hideTopBorder && a.border_t,
        // Clip horizontal overflow (in case of long handles) but let the timestamp overflow the bottom of the cell.
        platform({
          web: {overflowX: 'clip', overflowY: 'visible'},
          native: {overflow: 'hidden'},
        }),
      ]}>
      <View style={[styles.layoutIcon, a.pr_sm]}>{icon}</View>
      <View style={[a.flex_1]}>
        <CondensedAuthorsList authors={item.authors} />
        <Text
          style={[
            a.flex_row,
            a.flex_wrap,
            {paddingTop: 6},
            a.self_start,
            a.text_md,
          ]}
          accessibilityHint=""
          accessibilityLabel={a11yLabel}>
          {notificationContent}
          <TimeElapsed timestamp={timestamp}>
            {({timeElapsed}) => (
              <>
                {/* make sure there's whitespace around the middot -sfn */}
                <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                  {' '}
                  &middot;{' '}
                </Text>
                <Text
                  style={[a.text_md, t.atoms.text_contrast_medium]}
                  title={niceTimestamp}>
                  {timeElapsed}
                </Text>
              </>
            )}
          </TimeElapsed>
        </Text>
      </View>
    </View>
  )
}
NotificationFeedItem = memo(NotificationFeedItem)
export {NotificationFeedItem}

function CondensedAuthorsList({
  authors,
}: {
  authors: ActivityItem['authors']
}) {
  const t = useTheme()

  if (authors.length === 0) {
    return null
  }
  if (authors.length === 1) {
    return (
      <View style={[a.flex_row, a.align_center]}>
        <UserAvatar size={35} name={authors[0].name} type="user" />
      </View>
    )
  }
  return (
    <View style={[a.flex_row, a.align_center]}>
      {authors.slice(0, MAX_AUTHORS).map(author => (
        <View key={author.id} style={{marginRight: 5}}>
          <UserAvatar size={35} name={author.name} type="user" />
        </View>
      ))}
      {authors.length > MAX_AUTHORS ? (
        <Text
          style={[
            a.font_semi_bold,
            {paddingLeft: 6},
            t.atoms.text_contrast_medium,
          ]}>
          +{authors.length - MAX_AUTHORS}
        </Text>
      ) : undefined}
    </View>
  )
}

const styles = StyleSheet.create({
  layoutIcon: {
    width: 60,
    alignItems: 'flex-end',
    paddingTop: 2,
  },
})
