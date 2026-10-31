/* Lucide glyphs (ISC); export names mirror Bluesky's so adapted components import them unchanged. */
import {Trash} from 'lucide-react-native'
import {__iconData} from 'lucide-react-native/icons/trash'

import {createAnimatedIcon} from '#/components/anim/AnimatedIcon'
import {createIcon} from '#/components/icons/lucide'

export const Trash_Stroke2_Corner0_Rounded = createIcon(Trash)

/** The lid lifts while the enclosing Button is hovered, pressed or focused (or `active`). */
export const TrashLid_Stroke2_Corner0_Rounded = createAnimatedIcon(__iconData, {
  variant: 'lid',
  moving: [3, 4],
})
