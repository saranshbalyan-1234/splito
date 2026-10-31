import {type Feedback} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {useEntities} from '#/data/hooks'
import {useOpenFeedback} from '#/features/feedback/FeedbackProvider'
import {replayTour} from '#/lib/tour/replay'
import {useDemoMode} from '#/state/demo'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {CircleQuestion_Stroke2_Corner2_Rounded as HelpIcon} from '#/components/icons/CircleQuestion'
import {Inbox_Stroke2_Corner0_Rounded as InboxIcon} from '#/components/icons/Feedback'
import {Route_Stroke2_Corner0_Rounded as RouteIcon} from '#/components/icons/Route'
import {Message_Stroke2_Corner0_Rounded as MessageIcon, Shield_Stroke2_Corner0_Rounded as ShieldIcon} from '#/components/icons/Invite'
import {Text} from '#/components/Typography'
import {APP_VERSION} from '#/env'

/**
 * `/settings/support` (owner 204): every help item in one place, with the app version at the bottom. The sidebar and
 * drawer footer links still open Feedback, Help, Privacy and About directly.
 */
export function SupportSettings() {
  const {t: l} = useLingui()
  const t = useTheme()
  const openFeedback = useOpenFeedback()
  const {demo} = useDemoMode()
  const feedbackCount = useEntities<Feedback>('feedback')?.length ?? 0
  return (
    <>
      <SettingsList.PressableItem testID="settings-send-feedback" label={l`Send feedback`} onPress={openFeedback}>
        <SettingsList.ItemIcon icon={MessageIcon} />
        <SettingsList.ItemText>
          <Trans>Send feedback</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      <SettingsList.LinkItem testID="settings-your-feedback" to="/settings/feedback" label={l`Your feedback`}>
        <SettingsList.ItemIcon icon={InboxIcon} />
        <SettingsList.ItemText>
          <Trans>Your feedback</Trans>
        </SettingsList.ItemText>
        {feedbackCount > 0 ? <SettingsList.BadgeText>{feedbackCount}</SettingsList.BadgeText> : null}
      </SettingsList.LinkItem>
      <SettingsList.LinkItem testID="settings-help" to="/settings/help" label={l`Help`}>
        <SettingsList.ItemIcon icon={HelpIcon} />
        <SettingsList.ItemText>
          <Trans>Help</Trans>
        </SettingsList.ItemText>
      </SettingsList.LinkItem>
      {/* The guided tour over the real app (F-253); never in demo mode, whose data is sample data. */}
      {!demo && (
        <SettingsList.PressableItem testID="settings-take-tour" label={l`Take the tour`} onPress={replayTour}>
          <SettingsList.ItemIcon icon={RouteIcon} />
          <SettingsList.ItemText>
            <Trans>Take the tour</Trans>
          </SettingsList.ItemText>
        </SettingsList.PressableItem>
      )}
      <SettingsList.LinkItem testID="settings-support-privacy" to="/settings/privacy" label={l`Privacy`}>
        <SettingsList.ItemIcon icon={ShieldIcon} />
        <SettingsList.ItemText>
          <Trans>Privacy</Trans>
        </SettingsList.ItemText>
      </SettingsList.LinkItem>
      <SettingsList.LinkItem testID="settings-about" to="/settings/about" label={l`About`}>
        <SettingsList.ItemIcon icon={InfoIcon} />
        <SettingsList.ItemText>
          <Trans>About</Trans>
        </SettingsList.ItemText>
      </SettingsList.LinkItem>
      <Text
        testID="support-version"
        style={[a.px_xl, a.pt_lg, a.pb_xl, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>Splito version {APP_VERSION}</Trans>
      </Text>
    </>
  )
}
