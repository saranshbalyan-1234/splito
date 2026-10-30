/* Lucide glyphs (ISC) for disputes and holds (F-1210). */
import {Ban, CircleAlert, CircleCheck, CirclePause, CircleX, Gavel, Play, TriangleAlert, Undo2} from 'lucide-react-native'

import {createIcon} from '#/components/icons/lucide'

/** A disputed record: a triangle, so the mark never relies on colour. */
export const DisputedIcon = createIcon(TriangleAlert)
/** A record on hold: pause. */
export const HoldIcon = createIcon(CirclePause)
export const AcceptedIcon = createIcon(CircleCheck)
export const RejectedIcon = createIcon(CircleX)
export const WithdrawnIcon = createIcon(Undo2)
export const GoneIcon = createIcon(Ban)
/** Release a hold. */
export const ReleaseIcon = createIcon(Play)
export const ReopenIcon = createIcon(Undo2)
export const RaiseIcon = createIcon(CircleAlert)
export const GavelIcon = createIcon(Gavel)
