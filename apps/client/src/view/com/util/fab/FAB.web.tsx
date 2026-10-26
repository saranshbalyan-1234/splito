// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/com/util/fab/FAB.web.tsx
import {FABInner, type FABProps} from './FABInner'

export const FAB = (props: FABProps) => {
  /* Owner rule 17: the FAB shows on every screen without Back, desktop included. */
  return <FABInner {...props} />
}
