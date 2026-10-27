import {type FeedbackStatus, type FeedbackType} from '@splito/sync'
import {useLingui} from '@lingui/react/macro'

import {
  Bug_Stroke2_Corner0_Rounded as BugIcon,
  Ellipsis_Stroke2_Corner0_Rounded as OtherIcon,
  Lightbulb_Stroke2_Corner0_Rounded as IdeaIcon,
  QuestionBubble_Stroke2_Corner0_Rounded as QuestionIcon,
} from '#/components/icons/Feedback'
import {type Props as SVGIconProps} from '#/components/icons/common'

export const TYPE_ICONS: Record<
  FeedbackType,
  React.ComponentType<SVGIconProps>
> = {
  bug: BugIcon,
  idea: IdeaIcon,
  question: QuestionIcon,
  other: OtherIcon,
}

/** Words for the four types and the three statuses, in the UI language. */
export function useFeedbackLabels() {
  const {t: l} = useLingui()
  const types: Record<FeedbackType, string> = {
    bug: l`Bug`,
    idea: l`Idea`,
    question: l`Question`,
    other: l`Other`,
  }
  /* "Saved on this device" until the server acknowledges it; never "Sent" before. */
  const statuses: Record<FeedbackStatus, string> = {
    saved: l`Saved on this device`,
    queued: l`Waiting to send`,
    sent: l`Sent`,
  }
  return {types, statuses}
}
