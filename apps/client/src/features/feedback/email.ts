import {type Feedback, feedbackMailto} from '@splito/sync'

import {FEEDBACK_EMAIL, IS_WEB} from '#/env'
import {openExternal} from '#/lib/openExternal'

/**
 * Opens a prefilled email draft to the support address. Resolves false when
 * the device has no mail app. Opening a draft is not sending: the feedback
 * keeps its "Saved on this device" status.
 */
export async function openFeedbackEmail(f: Feedback): Promise<boolean> {
  const url = feedbackMailto(f, FEEDBACK_EMAIL)
  try {
    /* On the web, Linking.openURL would open a blank tab for a mailto link. */
    await openExternal(url, IS_WEB ? 'location' : 'linking')
    return true
  } catch {
    return false
  }
}
