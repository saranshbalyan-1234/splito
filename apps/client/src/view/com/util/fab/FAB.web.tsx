// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/fab/FAB.web.tsx
import {View} from 'react-native'

import {useBreakpoints} from '#/alf'
import {FABInner, type FABProps} from './FABInner'

export const FAB = (props: FABProps) => {
  /* Desktop/tablet use the sidebar's Add expense pill; the FAB is for phone widths (owner). */
  const {gtMobile} = useBreakpoints()
  if (gtMobile) return <View />
  return <FABInner {...props} />
}
