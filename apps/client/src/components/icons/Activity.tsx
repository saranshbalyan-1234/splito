/* Lucide "activity" (ISC); export names mirror Bluesky's so adapted components import them unchanged. */
import {Activity} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

export const Activity_Stroke2_Corner0_Rounded = createIcon(Activity)
/** The pulse is a single line with nothing to fill, so the current page's glyph is drawn heavier. */
export const Activity_Filled_Corner0_Rounded = createIcon(Activity, {
  strokeWidth: 3,
})
