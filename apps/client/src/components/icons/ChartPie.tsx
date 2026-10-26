/* Lucide "chart-pie" (ISC). */
import {ChartPie} from 'lucide-react-native'
import {Path} from 'react-native-svg'

import {createFilledIcon, createIcon} from '#/components/icons/lucide'

const SLICE =
  'M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z'

export const ChartPie_Stroke2_Corner0_Rounded = createIcon(ChartPie)

/** Solid pie (three quarters) with the slice drawn separately, a hairline gap between them. */
export const ChartPie_Filled_Corner0_Rounded = createFilledIcon(
  'ChartPie',
  c => ({
    body: (
      <Path
        d="M12 12V2A10 10 0 1 0 22 12Z"
        fill={c}
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    ),
    holes: (
      <Path d={SLICE} fill="#000" stroke="#000" strokeWidth={5} strokeLinejoin="round" />
    ),
    over: (
      <Path
        d={SLICE}
        fill={c}
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    ),
  }),
)
