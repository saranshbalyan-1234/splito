/**
 * Money direction colours for the colour-blind safe palette (F-1801):
 * Okabe-Ito blue for money coming to you and vermillion/orange for money
 * you pay, told apart under protanopia, deuteranopia and tritanopia. Light
 * values hold 4.5:1 on white; dark values hold it on Bluesky's dim and dark
 * backgrounds. The default palette uses the theme's positive/negative.
 */
export const COLORBLIND_MONEY = {
  light: {incoming: '#0072B2', outgoing: '#B94A00'},
  dark: {incoming: '#56B4E9', outgoing: '#E69F00'},
} as const
