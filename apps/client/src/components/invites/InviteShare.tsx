// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/components/InviteLinkDialog.tsx (Step.MANAGE: copy field, stacked share buttons) and src/components/StarterPack/QrCodeDialog.tsx
import {View} from 'react-native'
import {type Contact} from '@splito/domain'
import {formatContact} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {canSendSms, openComposeLink, shareUrl} from '#/lib/sharing'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {StackedButton} from '#/components/Button'
import {CopyTextButton} from '#/components/invites/CopyTextButton'
import {
  ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon,
  Envelope_Stroke2_Corner0_Rounded as MailIcon,
  Message_Stroke2_Corner0_Rounded as SmsIcon,
} from '#/components/icons/Invite'
import {InviteQrCode} from '#/components/invites/InviteQrCode'
import {Text} from '#/components/Typography'

/**
 * A ready invite link: the QR code (scan in person), the link with Copy, and
 * Share; with `to`, a direct "Send by SMS" / "Send by email" too. Pure
 * display: the caller made the link.
 */
export function InviteShare({
  url,
  message,
  subject,
  to,
  details,
}: {
  url: string
  /** The words that go with the link in a message. */
  message: string
  subject: string
  /** A personal invite: who it is for. */
  to?: Contact | null
  /** A line under the QR code, e.g. limits. */
  details?: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const body = `${message} ${url}`
  const channel = to?.kind === 'email' ? 'email' : to && canSendSms() ? 'sms' : null

  return (
    <View style={[a.gap_lg]}>
      <View
        style={[
          a.align_center,
          a.gap_md,
          a.py_lg,
          a.rounded_md,
          t.atoms.bg_contrast_25,
        ]}>
        <InviteQrCode link={url} />
        {details ? (
          <Text
            style={[
              a.text_sm,
              a.text_center,
              a.px_lg,
              t.atoms.text_contrast_medium,
            ]}>
            {details}
          </Text>
        ) : null}
      </View>
      <CopyTextButton
        testID="invite-copy"
        label={l`Copy invite link`}
        value={url}>
        <Text
          testID="invite-url"
          numberOfLines={1}
          style={[a.flex_1, a.mr_xs, a.text_md, t.atoms.text]}>
          {url}
        </Text>
      </CopyTextButton>
      <View style={[a.flex_row, a.gap_sm, !gtMobile && a.w_full]}>
        {channel && to ? (
          <StackedButton
            testID={`invite-${channel}`}
            label={
              channel === 'sms'
                ? l`Send by SMS to ${formatContact(to)}`
                : l`Send by email to ${formatContact(to)}`
            }
            icon={channel === 'sms' ? SmsIcon : MailIcon}
            color="primary"
            style={[a.flex_1, a.rounded_full]}
            onPress={() =>
              void openComposeLink({channel, to: to.value, subject, body})
            }>
            {channel === 'sms' ? <Trans>Send SMS</Trans> : <Trans>Send email</Trans>}
          </StackedButton>
        ) : null}
        <StackedButton
          testID="invite-share"
          label={l`Share invite link`}
          icon={ShareIcon}
          color="primary_subtle"
          style={[a.flex_1, a.rounded_full]}
          onPress={() => void shareUrl(url, message)}>
          <Trans>Share</Trans>
        </StackedButton>
      </View>
    </View>
  )
}
