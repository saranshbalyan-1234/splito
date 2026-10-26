/* Lucide "settings" (ISC); export names mirror Bluesky's so adapted components import them unchanged. */
import {Settings} from 'lucide-react-native'
import {Circle, Path} from 'react-native-svg'

import {createFilledIcon, createIcon} from '#/components/icons/lucide'

const GEAR =
  'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915'

export const SettingsGear2_Stroke2_Corner0_Rounded = createIcon(Settings)

/** Solid gear with its hub cut out. */
export const SettingsGear2_Filled_Corner0_Rounded = createFilledIcon(
  'Settings',
  c => ({
    body: (
      <Path
        d={GEAR}
        fill={c}
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    ),
    holes: <Circle cx="12" cy="12" r="3" fill="#000" />,
  }),
)
