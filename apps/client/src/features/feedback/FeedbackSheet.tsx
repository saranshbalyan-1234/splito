import {useState} from 'react'
import {Image, View} from 'react-native'
import {
  type Entity,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MIN_LENGTH,
  FEEDBACK_TYPES,
  type Feedback,
  type FeedbackAttachment,
  type FeedbackType,
  isValidEmail,
  saveFeedback,
} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {navigationRef} from '#/navigation/DevTour'
import {useSession} from '#/state/session'
import {useMutationCtx, usePref, useStore} from '#/data/hooks'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {CircleCheck_Stroke2_Corner0_Rounded as CircleCheckIcon} from '#/components/icons/CircleCheck'
import {ImagePlus_Stroke2_Corner0_Rounded as ImagePlusIcon} from '#/components/icons/Feedback'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {collectAppInfo} from './appInfo'
import {openFeedbackEmail} from './email'
import {TYPE_ICONS, useFeedbackLabels} from './labels'
import {pickAttachment} from './pickAttachment'

/**
 * Send feedback (26.15): type chips, a message, an optional picture and the
 * app info that goes with it, shown exactly. Without a backend, saving keeps
 * the feedback on this device and the sheet then offers an email draft;
 * nothing here says "sent".
 */
export function FeedbackSheet({
  control,
  screen,
}: {
  control: Dialog.DialogControlProps
  /** The route the sheet was opened from. */
  screen: string
}) {
  return (
    <FormSheet.Outer control={control} testID="feedback-sheet" fullHeight>
      <Inner screen={screen} />
    </FormSheet.Outer>
  )
}

function Inner({screen}: {screen: string}) {
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const {currentAccount} = useSession()
  const [includeInfo = true, setIncludeInfo] = usePref('feedback.includeAppInfo')
  const [type, setType] = useState<FeedbackType>('idea')
  const [message, setMessage] = useState('')
  const [attachment, setAttachment] = useState<FeedbackAttachment | null>(null)
  const [initialEmail] = useState(currentAccount?.email ?? '')
  const [email, setEmail] = useState(initialEmail)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState<Entity<Feedback> | null>(null)
  const {types} = useFeedbackLabels()

  const trimmed = message.trim()
  const isMessageValid = trimmed.length >= FEEDBACK_MIN_LENGTH
  const isEmailValid = !email.trim() || isValidEmail(email.trim())
  const info = collectAppInfo(screen, i18n.locale)

  const pick = async () => {
    haptics.tap()
    const res = await pickAttachment()
    if (!res) return
    if (res.ok) {
      setAttachment(res.attachment)
      return
    }
    Toast.show(
      res.reason === 'notImage'
        ? l`Only pictures can be attached`
        : res.reason === 'tooLarge'
          ? l`That picture is too large. Try a smaller one.`
          : l`Couldn't read that picture`,
      {type: 'warning'},
    )
  }

  const save = async () => {
    if (!isMessageValid || !isEmailValid || isSaving) return
    setIsSaving(true)
    try {
      const entity = await saveFeedback(store, ctx, {
        type,
        message: trimmed,
        attachment,
        appInfo: includeInfo ? info : null,
        replyEmail: email.trim() || null,
      })
      haptics.success()
      setSaved(entity)
    } catch (e) {
      logger.error(e, {where: 'feedback.save'})
      Toast.show(l`Couldn't save your feedback. Please try again.`, {
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const sendByEmail = async (entity: Entity<Feedback>) => {
    const didOpen = await openFeedbackEmail(entity.data)
    Toast.show(
      didOpen
        ? l`Email draft opened. Press send in your mail app.`
        : l`No email app found. Your feedback is saved on this device.`,
      {type: didOpen ? 'default' : 'warning'},
    )
  }

  if (saved) {
    return (
      <FormSheet.Inner
        title={l`Send feedback`}
        footer={{
          saveLabel: l`Send by email`,
          onSave: () => void sendByEmail(saved),
          cancelLabel: l`Done`,
          onCancel: () => control.close(),
        }}>
        <Saved
          onSeeAll={() =>
            control.close(() => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('SettingsSection', {
                  section: 'feedback',
                })
              }
            })
          }
        />
      </FormSheet.Inner>
    )
  }

  return (
    <FormSheet.Inner
      title={l`Send feedback`}
      isDirty={!!trimmed || !!attachment || email !== initialEmail}
      footer={{
        saveLabel: l`Save feedback`,
        canSave: isMessageValid && isEmailValid,
        isSaving,
        onSave: () => void save(),
      }}>
      <View style={[a.gap_xl]}>
        <FormSheet.Description>
          <Trans>
            Tell us what to fix or build next. Splito can't send this on its
            own yet: it's saved on this device first, and you can send it by
            email.
          </Trans>
        </FormSheet.Description>

        <View>
          <TextField.LabelText>
            <Trans>What is it about?</Trans>
          </TextField.LabelText>
          <View
            role="radiogroup"
            accessibilityLabel={l`Type of feedback`}
            style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
            {FEEDBACK_TYPES.map(kind => {
              const isSelected = kind === type
              const Icon = TYPE_ICONS[kind]
              return (
                <Button
                  key={kind}
                  testID={`feedback-type-${kind}`}
                  label={types[kind]}
                  role="radio"
                  accessibilityState={{checked: isSelected}}
                  aria-checked={isSelected}
                  size="small"
                  color={isSelected ? 'primary' : 'secondary'}
                  onPress={() => {
                    haptics.selection()
                    setType(kind)
                  }}>
                  <ButtonIcon icon={isSelected ? CheckIcon : Icon} />
                  <ButtonText>{types[kind]}</ButtonText>
                </Button>
              )
            })}
          </View>
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Your message</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              testID="feedback-message"
              label={l`Your message`}
              placeholder={
                type === 'bug'
                  ? l`What happened, and what did you expect?`
                  : type === 'idea'
                    ? l`What would make Splito better for you?`
                    : type === 'question'
                      ? l`What would you like to know?`
                      : l`Tell us anything`
              }
              value={message}
              onChangeText={setMessage}
              maxLength={FEEDBACK_MAX_LENGTH}
              multiline
              numberOfLines={5}
              autoFocus
            />
          </TextField.Root>
          <MessageHint length={trimmed.length} isValid={isMessageValid} />
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Screenshot or photo (optional)</Trans>
          </TextField.LabelText>
          {attachment ? (
            <AttachmentPreview
              attachment={attachment}
              onRemove={() => setAttachment(null)}
            />
          ) : (
            <Button
              testID="feedback-attach"
              label={l`Add a screenshot or photo`}
              size="small"
              color="secondary"
              style={[a.self_start]}
              onPress={() => void pick()}>
              <ButtonIcon icon={ImagePlusIcon} />
              <ButtonText>
                <Trans>Add a screenshot or photo</Trans>
              </ButtonText>
            </Button>
          )}
        </View>

        <View style={[a.gap_sm]}>
          <Toggle.Item
            testID="feedback-include-info"
            name="includeAppInfo"
            label={l`Include app info`}
            value={includeInfo}
            onChange={v => void setIncludeInfo(v)}
            style={[a.w_full]}>
            <View style={[a.flex_1, a.pr_md]}>
              <Toggle.LabelText style={[a.text_md, a.font_semi_bold]}>
                <Trans>Include app info</Trans>
              </Toggle.LabelText>
            </View>
            <Toggle.Switch />
          </Toggle.Item>
          <AppInfoPreview isIncluded={includeInfo} info={info} />
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Reply email (optional)</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={!isEmailValid}>
            <TextField.Input
              testID="feedback-email"
              label={l`Reply email`}
              placeholder={l`you@example.com`}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="done"
            />
          </TextField.Root>
          <Hint isError={!isEmailValid} testID="feedback-email-hint">
            {isEmailValid ? (
              <Trans>Only used to answer you.</Trans>
            ) : (
              <Trans>That doesn't look like an email address.</Trans>
            )}
          </Hint>
        </View>
      </View>
    </FormSheet.Inner>
  )
}

function Hint({
  children,
  isError = false,
  testID,
}: {
  children: React.ReactNode
  isError?: boolean
  testID?: string
}) {
  const t = useTheme()
  return (
    <Text
      testID={testID}
      accessibilityRole={isError ? 'alert' : undefined}
      style={[
        a.pt_xs,
        a.text_sm,
        a.leading_snug,
        isError ? {color: t.palette.negative_500} : t.atoms.text_contrast_medium,
      ]}>
      {children}
    </Text>
  )
}

/** Says why Save is off until the message is long enough, then counts characters. */
function MessageHint({length, isValid}: {length: number; isValid: boolean}) {
  return (
    <Hint testID="feedback-message-hint">
      {isValid ? (
        <Trans>
          {length} / {FEEDBACK_MAX_LENGTH}
        </Trans>
      ) : (
        <Trans>Write at least {FEEDBACK_MIN_LENGTH} characters.</Trans>
      )}
    </Hint>
  )
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: FeedbackAttachment
  onRemove: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View
      testID="feedback-attachment"
      style={[a.flex_row, a.align_center, a.gap_md]}>
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={l`The picture you attached`}
        source={{uri: attachment.uri}}
        style={[
          a.rounded_sm,
          a.border,
          t.atoms.border_contrast_low,
          t.atoms.bg_contrast_25,
          {width: 72, height: 72},
        ]}
        resizeMode="cover"
      />
      <Text style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
        {attachment.width} × {attachment.height}
      </Text>
      <Button
        testID="feedback-attachment-remove"
        label={l`Remove picture`}
        size="small"
        color="secondary"
        onPress={onRemove}>
        <ButtonIcon icon={XIcon} />
        <ButtonText>
          <Trans>Remove</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

/** Shows exactly what "Include app info" attaches, so nothing rides along unseen. */
function AppInfoPreview({
  isIncluded,
  info,
}: {
  isIncluded: boolean
  info: ReturnType<typeof collectAppInfo>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  if (!isIncluded) {
    return (
      <Hint testID="feedback-info-off">
        <Trans>Nothing about your device or this screen is attached.</Trans>
      </Hint>
    )
  }
  const rows: [string, string][] = [
    [l`Version`, info.version],
    [l`Platform`, info.platform],
    [l`System`, info.os],
    [l`Language`, info.language],
    [l`Screen`, info.screen || '-'],
  ]
  return (
    <View
      testID="feedback-info-preview"
      style={[
        a.rounded_sm,
        a.border,
        a.p_md,
        a.gap_xs,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
      ]}>
      <Text style={[a.text_sm, a.font_semi_bold]}>
        <Trans>This is attached</Trans>
      </Text>
      {rows.map(([name, value]) => (
        <View key={name} style={[a.flex_row, a.gap_md]}>
          <Text
            style={[a.text_sm, {width: 80}, t.atoms.text_contrast_medium]}
            numberOfLines={1}>
            {name}
          </Text>
          <Text style={[a.flex_1, a.text_sm]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      ))}
      <Text style={[a.pt_xs, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>Never amounts, names, notes or receipts.</Trans>
      </Text>
    </View>
  )
}

/** The step after Save: honest about where the feedback is. */
function Saved({onSeeAll}: {onSeeAll: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View testID="feedback-saved" style={[a.align_center, a.gap_md, a.py_xl]}>
      <CircleCheckIcon size="2xl" fill={t.palette.primary_500} />
      <Text style={[a.text_xl, a.font_bold, a.text_center]}>
        <Trans>Saved on this device</Trans>
      </Text>
      <Text
        style={[
          a.text_md,
          a.leading_snug,
          a.text_center,
          t.atoms.text_contrast_medium,
        ]}>
        <Trans>
          It hasn't been sent anywhere yet. Send it by email now, or find it
          later in Your feedback.
        </Trans>
      </Text>
      <Button
        testID="feedback-see-all"
        label={l`Open Your feedback`}
        size="small"
        color="secondary"
        onPress={onSeeAll}>
        <ButtonText>
          <Trans>Open Your feedback</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
