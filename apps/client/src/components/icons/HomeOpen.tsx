/* Lucide "house" (ISC); export names mirror Bluesky's so adapted components import them unchanged. */
import {House} from 'lucide-react-native'
import {Path} from 'react-native-svg'

import {createFilledIcon, createIcon} from '#/components/icons/lucide'

const HOUSE =
  'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'

export const HomeOpen_Stoke2_Corner0_Rounded = createIcon(House)

/** Solid house with the door cut out and open at the bottom, as Bluesky's. */
export const HomeOpen_Filled_Corner0_Rounded = createFilledIcon('House', c => ({
  body: (
    <Path
      d={HOUSE}
      fill={c}
      stroke={c}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  ),
  holes: <Path d="M10 23v-9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9z" fill="#000" />,
}))
