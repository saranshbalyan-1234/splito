import {useRoute} from '@react-navigation/native'

import {isPushedTabRoute} from '#/lib/routes/helpers'

/** Whether this main screen is a pushed copy (opened from a link, owner 179): it shows Back, not the avatar, and no FAB. */
export function useIsPushedTab(): boolean {
  return isPushedTabRoute(useRoute())
}
