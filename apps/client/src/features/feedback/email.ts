import {type Feedback, feedbackMailto} from '@splito/sync'

import {FEEDBACK_EMAIL} from '#/env'
import {openExternal} from '#/lib/openExternal'

/**
 * Opens a prefilled email draft to the support address. Resolves false when
 * the device has no mail app. Opening a draft is not sending: the feedback
 * keeps its "Saved on this device" status.
 */
export async function openFeedbackEmail(f: Feedback): Promise<boolean> {
  const url = feedbackMailto(f, FEEDBACK_EMAIL)
  try {
    await openExternal(url)
    return true
  } catch {
    return false
  }
}
