import {memo, useState} from 'react'
import {Image, View} from 'react-native'
import {deleteFeedback, type Entity, type Feedback, sortFeedback} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useTickEveryMinute} from '#/state/shell'
import {useEntities, useMutationCtx, useStore} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {
  Envelope_Stroke2_Corner0_Rounded as MailIcon,
  Message_Stroke2_Corner0_Rounded as MessageIcon,
} from '#/components/icons/Invite'
import {TrashLid_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {openFeedbackEmail} from './email'
import {TYPE_ICONS, useFeedbackLabels} from './labels'
import {useOpenFeedback} from './FeedbackProvider'

/**
 * "Your feedback": every item you saved, newest first, with where it is.
 * Few rows by nature (a person sends a handful), so a plain column rather
 * than a virtualised list.
 */
export function FeedbackList() {
  const {t: l} = useLingui()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const openFeedback = useOpenFeedback()
  const rows = useEntities<Feedback>('feedback')
  const deletePrompt = Prompt.usePromptControl()
  const [toDelete, setToDelete] = useState<string | null>(null)

  const items = rows ? sortFeedback(rows) : []

  if (rows && items.length === 0) {
    return (
      <EmptyState
        testID="feedback-empty"
        illustration="empty-feedback"
        title={l`No feedback yet`}
        message={l`Tell us what to fix or build next. What you send is kept here, with where it is.`}
        button={{
          testID: 'feedback-empty-send',
          label: l`Send feedback`,
          text: l`Send feedback`,
          onPress: openFeedback,
        }}
      />
    )
  }

  return (
    <View testID="feedback-list" style={[a.px_lg, a.pt_sm, a.pb_xl, a.gap_md]}>
      <Button
        testID="feedback-send"
        label={l`Send feedback`}
        size="small"
        color="primary"
        style={[a.self_start]}
        onPress={openFeedback}>
        <ButtonIcon icon={MessageIcon} />
        <ButtonText>
          <Trans>Send feedback</Trans>
        </ButtonText>
      </Button>
      {items.map(item => (
        <FeedbackRow
          key={item.id}
          item={item}
          onDelete={id => {
            setToDelete(id)
            deletePrompt.open()
          }}
        />
      ))}
      <Prompt.Basic
        control={deletePrompt}
        title={l`Delete this feedback?`}
        description={l`It is removed from Your feedback. If you already emailed it, that email isn't affected.`}
        confirmButtonCta={l`Delete`}
        confirmButtonColor="negative"
        onConfirm={() => {
          const id = toDelete
          if (!id) return
          void deleteFeedback(store, ctx, id)
            .then(() => {
              haptics.success()
              Toast.show(l`Feedback deleted`)
            })
            .catch(e => logger.error(e, {where: 'feedback.delete'}))
        }}
      />
    </View>
  )
}

const FeedbackRow = memo(function FeedbackRow({
  item,
  onDelete,
}: {
  item: Entity<Feedback>
  onDelete: (id: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const ago = useGetTimeAgo()
  const tick = useTickEveryMinute()
  const {types, statuses} = useFeedbackLabels()
  const f = item.data
  const Icon = TYPE_ICONS[f.type]

  const sendByEmail = async () => {
    const didOpen = await openFeedbackEmail(f)
    Toast.show(
      didOpen
        ? l`Email draft opened. Press send in your mail app.`
        : l`No email app found. Your feedback is saved on this device.`,
      {type: didOpen ? 'default' : 'warning'},
    )
  }

  return (
    <View
      testID={`feedback-${item.id}`}
      style={[
        a.p_lg,
        a.gap_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        t.atoms.bg,
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <View
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_full,
            t.atoms.bg_contrast_50,
            {width: 36, height: 36},
          ]}>
          <Icon size="md" fill={t.atoms.text.color} />
        </View>
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
            {types[f.type]}
          </Text>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {ago(f.createdAt, tick)}
          </Text>
        </View>
      </View>
      <Text selectable style={[a.text_md, a.leading_snug]} numberOfLines={6}>
        {f.message}
      </Text>
      {f.attachment ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={l`The picture you attached`}
          source={{uri: f.attachment.uri}}
          style={[
            a.rounded_sm,
            a.border,
            t.atoms.border_contrast_low,
            t.atoms.bg_contrast_25,
            {width: 96, height: 96},
          ]}
          resizeMode="cover"
        />
      ) : null}
      <View style={[a.flex_row, a.align_center, a.gap_xs]}>
        <CloudIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
        <Text
          testID={`feedback-status-${item.id}`}
          style={[a.flex_1, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {statuses[f.status]}
        </Text>
      </View>
      <View style={[a.flex_row, a.gap_sm]}>
        {f.status === 'saved' && (
          <Button
            testID={`feedback-email-${item.id}`}
            label={l`Send by email`}
            size="small"
            color="secondary"
            onPress={() => void sendByEmail()}>
            <ButtonIcon icon={MailIcon} />
            <ButtonText>
              <Trans>Send by email</Trans>
            </ButtonText>
          </Button>
        )}
        <Button
          testID={`feedback-delete-${item.id}`}
          label={l`Delete`}
          size="small"
          color="negative_subtle"
          onPress={() => onDelete(item.id)}>
          <ButtonIcon icon={TrashIcon} />
          <ButtonText>
            <Trans>Delete</Trans>
          </ButtonText>
        </Button>
      </View>
    </View>
  )
})
