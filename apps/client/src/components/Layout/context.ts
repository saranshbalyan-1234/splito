// Adapted from bluesky-social/social-app@4e4ad9c (MIT) — src/components/Layout/context.ts
import {createContext} from 'react'

export const ScrollbarOffsetContext = createContext({
  isWithinOffsetView: false,
})
ScrollbarOffsetContext.displayName = 'ScrollbarOffsetContext'
