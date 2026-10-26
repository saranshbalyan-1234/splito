// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/fab/FAB.web.tsx
import {View} from 'react-native'

import {useBreakpoints} from '#/alf'
import {FABInner, type FABProps} from './FABInner'

export const FAB = (props: FABProps) => {
  const {gtMobile} = useBreakpoints()

  if (!gtMobile) {
    return <FABInner {...props} />
  }

  return <View />
}
