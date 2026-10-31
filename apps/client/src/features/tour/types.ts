import {type Rect} from '#/lib/tour/registry'

/** What the backdrop draws: the screen, and the rounded cut-out that stays sharp. */
export type Backdrop = {
  screen: {width: number; height: number}
  spot: {rect: Rect; radius: number}
}
