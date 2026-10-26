// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/fab/FAB.tsx
import {useBreakpoints} from '#/alf'
import {IS_NATIVE} from '#/env'
import {FABInner, type FABProps} from './FABInner'

export function FAB(props: FABProps) {
  const {gtMobile} = useBreakpoints()
  if (IS_NATIVE && gtMobile) return null
  return <FABInner {...props} />
}
