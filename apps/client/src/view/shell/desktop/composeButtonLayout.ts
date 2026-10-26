// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/composeButtonLayout.ts
import {atoms as a} from '#/alf'

const COMPACT_BUTTON_SIZE = 48

export function getComposeButtonLayout({
  minimal,
  isNative,
}: {
  minimal: boolean
  isNative: boolean
}) {
  return {
    container: minimal ? [!isNative && a.px_sm, a.pt_lg] : [a.w_full, a.pt_lg],
    button: [
      a.rounded_full,
      // Splito: the pill spans the nav column (owner rule 13).
      !minimal && a.w_full,
      minimal && {width: COMPACT_BUTTON_SIZE, height: COMPACT_BUTTON_SIZE},
      minimal && isNative && {paddingHorizontal: 0, paddingVertical: 0},
    ],
  }
}
