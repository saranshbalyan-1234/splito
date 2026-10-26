// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/custom-animations/GestureActionView.web.tsx
import {type GestureActions} from './GestureActionView.shared'

/*
 * Swipe gestures only exist on native; children render as-is on web.
 */
export function GestureActionView({
  children,
}: {
  children: React.ReactNode
  actions: GestureActions
}) {
  return children
}
