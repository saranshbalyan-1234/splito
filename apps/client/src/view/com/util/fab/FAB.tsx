// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/fab/FAB.tsx
import {useBreakpoints} from '#/alf'
import {FABInner, type FABProps} from './FABInner'

export function FAB(props: FABProps) {
  const {gtMobile} = useBreakpoints()
  /* Rail and desktop have no FAB (§ 26.6): the sidebar pill adds expenses there, and Person and Group keep their body button. */
  if (gtMobile) return null
  return <FABInner {...props} />
}
