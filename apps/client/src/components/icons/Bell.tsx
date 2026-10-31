/* Lucide "bell" (ISC): the Activity tab (owner 217) and the Settings > Notifications row; headers have no bell. */
import {Bell} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

export const Bell_Stroke2_Corner0_Rounded = createIcon(Bell)
/** A solid bell for the selected Activity tab: unlike the pulse line it replaced, it plainly changes when selected. */
export const Bell_Filled_Corner0_Rounded = createIcon(Bell, {filled: true})
