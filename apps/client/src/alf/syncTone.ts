import {createContext} from 'react'

/**
 * True inside a row, card or page whose record has not reached the server yet
 * (ARCHITECTURE 9.8, owner 111): `Text` then draws its default colour as
 * `text_contrast_medium`. Explicit colours (money direction, errors) are kept.
 * A bare context, so Typography needs nothing but React.
 */
export const SyncToneContext = createContext(false)
