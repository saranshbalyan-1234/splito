/* Lucide glyphs (ISC); export names mirror Bluesky's so adapted components import them unchanged. */
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
} from 'lucide-react-native'

import {__iconData} from 'lucide-react-native/icons/chevron-down'

import {createAnimatedIcon} from '#/components/anim/AnimatedIcon'
import {createIcon} from '#/components/icons/lucide'

export const ChevronRight_Stroke2_Corner0_Rounded = createIcon(ChevronRight)
export const ChevronLeft_Stroke2_Corner0_Rounded = createIcon(ChevronLeft)
export const ChevronBottom_Stroke2_Corner0_Rounded = createIcon(ChevronDown)
export const ChevronTop_Stroke2_Corner0_Rounded = createIcon(ChevronUp)
export const ChevronTopBottom_Stroke2_Corner0_Rounded = createIcon(ChevronsUpDown)

/** A down chevron that turns up while `active` (a section that expands). */
export const ChevronExpand_Stroke2_Corner0_Rounded = createAnimatedIcon(__iconData, {
  variant: 'rotate',
  turn: 180,
})
