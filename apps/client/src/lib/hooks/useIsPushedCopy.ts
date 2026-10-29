import {useRoute} from '@react-navigation/native'

import {isPushedCopy} from '#/lib/routes/helpers'

/** Whether this main screen was opened from a link as a pushed page with Back (owner 179), not as its own tab. */
export function useIsPushedCopy(): boolean {
  return isPushedCopy(useRoute().params)
}
