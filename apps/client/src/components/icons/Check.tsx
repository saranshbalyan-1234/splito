import {Check, CheckCheck} from 'lucide-react-native'
import {__iconData} from 'lucide-react-native/icons/check'

import {createAnimatedIcon} from '#/components/anim/AnimatedIcon'
import {createIcon} from '#/components/icons/lucide'

export const CheckThick_Stroke2_Corner0_Rounded = createIcon(Check)
export const Check_Stroke2_Corner0_Rounded = createIcon(Check)

/** The tick draws in on mount and again on press: Accept, Save, Settle. */
export const CheckDrawn_Stroke2_Corner0_Rounded = createAnimatedIcon(__iconData, {
  variant: 'draw',
  length: 24,
})

/** Lucide "check-check": two ticks, for marking everything read. */
export const CheckDouble_Stroke2_Corner0_Rounded = createIcon(CheckCheck)
