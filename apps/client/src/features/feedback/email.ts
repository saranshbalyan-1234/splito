import {Linking} from 'react-native'
import {type Feedback, feedbackMailto} from '@splito/sync'

import {FEEDBACK_EMAIL, IS_WEB} from '#/env'

/**
 * Opens a prefilled email draft to the support address. Resolves false when
 * the device has no mail app. Opening a draft is not sending: the feedback
 * keeps its "Saved on this device" status.
 */
export async function openFeedbackEmail(f: Feedback): Promise<boolean> {
  const url = feedbackMailto(f, FEEDBACK_EMAIL)
  try {
    if (IS_WEB) {
      /* Linking.openURL would open a blank tab for a mailto link. */
      window.location.href = url
      return true
    }
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}
