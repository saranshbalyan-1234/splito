/* Lucide "activity" (ISC), the pulse line. A line has nothing to fill, so the active glyph is drawn heavier, as Bluesky's filled glyphs read heavier. */
import {Activity} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

export const Activity_Stroke2_Corner0_Rounded = createIcon(Activity)
export const Activity_Filled_Corner0_Rounded = createIcon(Activity, {
  strokeWidth: 2.75,
})
