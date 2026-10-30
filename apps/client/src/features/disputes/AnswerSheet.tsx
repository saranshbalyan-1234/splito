import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Dispute} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useDisputeActions} from '#/state/disputes'
import {useEntity} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as TextField from '#/components/forms/TextField'
import {useDisputeWords} from '#/components/disputes/words'
import {useDisplayName, useErrorText} from '#/components/split/shared'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

/**
 * The note that goes with a rejection (the reason is required) or a reopening (a new note, once; then an admin may)
 * (F-1210, 26.20). Shows what the dispute said, so the answer is written with it in view.
 */
export function AnswerSheet({control, request, onClosed}: {control: Dialog.DialogControlProps; request: {kind: 'reject' | 'reopen'; disputeId: string}; /** After it has closed (the host lets it go). */ onClosed?: () => void}) {
  return (
    <FormSheet.Outer control={control} testID="dispute-answer-sheet" onClose={onClosed}>
      <Form request={request} />
    </FormSheet.Outer>
  )
}

function Form({request}: {request: {kind: 'reject' | 'reopen'; disputeId: string}}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const haptics = useHaptics()
  const words = useDisputeWords()
  const name = useDisplayName()
  const errorText = useErrorText()
  const actions = useDisputeActions()
  const dispute = useEntity<Dispute>('dispute', request.disputeId)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const isReject = request.kind === 'reject'
  const d = dispute?.data
  const resolution = d?.resolution ?? ''

  const save = async () => {
    if (!note.trim()) return
    setIsSaving(true)
    try {
      if (isReject) await actions.reject(request.disputeId, note)
      else await actions.reopen(request.disputeId, note)
      haptics.success()
      control.close(() => Toast.show(isReject ? l`Rejected. Nothing on the record changed.` : l`Reopened`, {type: 'success'}))
    } catch (e) {
      logger.warn('could not answer the dispute', {safeMessage: String(e)})
      haptics.error()
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
      setIsSaving(false)
    }
  }

  return (
    <FormSheet.Inner
      title={isReject ? l`Reject dispute` : l`Reopen dispute`}
      isDirty={note !== ''}
      footer={{saveLabel: isReject ? l`Reject` : l`Reopen`, canSave: note.trim() !== '' && !!d, isSaving, onSave: () => void save()}}>
      {d && (
        <View style={[a.gap_lg]}>
          <View style={[a.p_md, a.rounded_md, a.gap_2xs, t.atoms.bg_contrast_25]}>
            <Text style={[a.text_md, a.font_semi_bold]}>{`${name(d.raisedBy)} · ${words.reason(d.reason)}`}</Text>
            {d.note ? (
              <Text emoji style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                {d.note}
              </Text>
            ) : null}
            {!isReject && d.resolution ? (
              <Text emoji style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                <Trans>They said: {resolution}</Trans>
              </Text>
            ) : null}
          </View>
          <View style={[a.gap_xs]}>
            <TextField.LabelText>{isReject ? <Trans>Why not?</Trans> : <Trans>What has changed?</Trans>}</TextField.LabelText>
            <TextField.Root>
              <Dialog.Input
                testID="dispute-answer-note"
                label={isReject ? l`Why not?` : l`What has changed?`}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={1000}
                placeholder={isReject ? l`The receipt says…` : l`Here is the receipt…`}
              />
            </TextField.Root>
          </View>
        </View>
      )}
    </FormSheet.Inner>
  )
}
