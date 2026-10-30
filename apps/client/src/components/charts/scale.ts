import {useState} from 'react'
import {type LayoutChangeEvent} from 'react-native'

/* Bigint-to-geometry maths lives in @splito/domain; charts import it from here. */
export {fraction, fractionBetween, percentOf} from '@splito/domain'

/** The width a chart gets from its parent, 0 until the first layout. */
export function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0)
  return [
    width,
    e => {
      const w = Math.round(e.nativeEvent.layout.width)
      // A hidden tab measures 0: keep the last real width, so showing it again re-renders nothing (owner 166).
      if (w > 0 && w !== width) setWidth(w)
    },
  ]
}
