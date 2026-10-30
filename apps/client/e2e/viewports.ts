/** The two sizes every spec is shot and checked at (ARCHITECTURE 26): a phone at 390 px and a desktop at 1440 px. */
export const PHONE = {width: 390, height: 844}
export const DESKTOP = {width: 1440, height: 900}
/** A laptop, between the two: the width the sidebar shows without the right column. */
export const LAPTOP = {width: 1280, height: 800}

/** `for (const [name, size] of SIZES) test.describe(...)`: both sizes, labelled by width. */
export const SIZES = [
  ['390', PHONE],
  ['1440', DESKTOP],
] as const
