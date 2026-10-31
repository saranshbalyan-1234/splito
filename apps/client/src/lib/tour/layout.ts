import {type Rect} from './registry'

/** Air between a control and its cut-out edge. */
export const SPOT_PAD = 6
/** Gap between the cut-out and the caption card. */
export const CARD_GAP = 12
/** Side gutter of the screen. */
export const GUTTER = 16
const MAX_CARD_WIDTH = 340

export type Placement = 'below' | 'above' | 'right' | 'left'

/** The cut-out: the control grown by `SPOT_PAD`, with the corner radius that suits its shape. */
export function spotlightOf(target: Rect, shape: 'round' | 'rect') {
  const rect: Rect = {x: target.x - SPOT_PAD, y: target.y - SPOT_PAD, width: target.width + SPOT_PAD * 2, height: target.height + SPOT_PAD * 2}
  return {rect, radius: shape === 'round' ? Math.min(rect.width, rect.height) / 2 : Math.min(14, Math.min(rect.width, rect.height) / 2)}
}

/** The card's width: as wide as it likes up to 340, never wider than the screen less both gutters (320 px phones). */
export function cardWidth(screenWidth: number): number {
  return Math.max(0, Math.min(MAX_CARD_WIDTH, screenWidth - GUTTER * 2))
}

/**
 * Where the caption card goes: beside the cut-out, on the side with room, kept inside the screen. Vertical placements
 * are tried first (below for things near the top, above for the bottom bar and the FAB); a control in the left
 * sidebar prefers the right side, so the card sits beside it as the owner drew it. Falls back to the roomiest side.
 */
export function placeCard(spot: Rect, screen: {width: number; height: number}, card: {width: number; height: number}): {placement: Placement; x: number; y: number} {
  const fits: Record<Placement, boolean> = {
    below: spot.y + spot.height + CARD_GAP + card.height + GUTTER <= screen.height,
    above: spot.y - CARD_GAP - card.height - GUTTER >= 0,
    right: spot.x + spot.width + CARD_GAP + card.width + GUTTER <= screen.width,
    left: spot.x - CARD_GAP - card.width - GUTTER >= 0,
  }
  const isSidebarControl = spot.x + spot.width < screen.width / 4 && screen.width >= 800
  const inLowerHalf = spot.y + spot.height / 2 > screen.height / 2
  const order: Placement[] = isSidebarControl
    ? ['right', 'below', 'above', 'left']
    : inLowerHalf
      ? ['above', 'below', 'left', 'right']
      : ['below', 'above', 'left', 'right']
  const placement = order.find(p => fits[p]) ?? roomiest(spot, screen)
  const clampX = (x: number) => Math.max(GUTTER, Math.min(x, screen.width - card.width - GUTTER))
  const clampY = (y: number) => Math.max(GUTTER, Math.min(y, screen.height - card.height - GUTTER))
  const centreX = spot.x + spot.width / 2 - card.width / 2
  const centreY = spot.y + spot.height / 2 - card.height / 2
  switch (placement) {
    case 'below':
      return {placement, x: clampX(centreX), y: clampY(spot.y + spot.height + CARD_GAP)}
    case 'above':
      return {placement, x: clampX(centreX), y: clampY(spot.y - CARD_GAP - card.height)}
    case 'right':
      return {placement, x: clampX(spot.x + spot.width + CARD_GAP), y: clampY(centreY)}
    case 'left':
      return {placement, x: clampX(spot.x - CARD_GAP - card.width), y: clampY(centreY)}
  }
}

function roomiest(spot: Rect, screen: {width: number; height: number}): Placement {
  const room: Record<Placement, number> = {
    below: screen.height - (spot.y + spot.height),
    above: spot.y,
    right: screen.width - (spot.x + spot.width),
    left: spot.x,
  }
  return (Object.keys(room) as Placement[]).reduce((best, p) => (room[p] > room[best] ? p : best), 'below')
}

/**
 * An SVG path (fill-rule evenodd) covering the whole screen except a rounded rectangle: the dim with a hole where the
 * control stays sharp. One definition for the native dim, the web dim and the web blur's mask.
 */
export function holePath(screen: {width: number; height: number}, spot: {rect: Rect; radius: number}): string {
  const {x, y, width: w, height: h} = spot.rect
  const r = spot.radius
  const n = (v: number) => Math.round(v * 100) / 100
  return [
    `M0 0H${n(screen.width)}V${n(screen.height)}H0Z`,
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}`,
    `V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`,
  ].join('')
}
