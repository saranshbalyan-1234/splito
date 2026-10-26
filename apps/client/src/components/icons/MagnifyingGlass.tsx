/* Lucide glyphs (ISC); export names mirror Bluesky's so adapted components import them unchanged. */
import {Search} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

export const MagnifyingGlass_Stroke2_Corner0_Rounded = createIcon(Search)

/** The lit nav glyph: Lucide has no solid lens, so the stroke thickens, as Bluesky's does. */
export const MagnifyingGlass_Filled_Stroke2_Corner0_Rounded = createIcon(
  Search,
  {
    strokeWidth: 3,
  },
)
