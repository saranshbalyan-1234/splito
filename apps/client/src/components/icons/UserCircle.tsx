/* Lucide "circle-user" (ISC); export names mirror Bluesky's so adapted components import them unchanged. */
import {CircleUser} from 'lucide-react-native'
import {Circle, Path} from 'react-native-svg'

import {createFilledIcon, createIcon} from '#/components/icons/lucide'

export const UserCircle_Stroke2_Corner0_Rounded = createIcon(CircleUser)

/** Solid disc with the person cut out, framed by the outline ring. */
export const UserCircle_Filled_Corner0_Rounded = createFilledIcon(
  'CircleUser',
  c => ({
    body: <Circle cx="12" cy="12" r="10" fill={c} />,
    holes: (
      <>
        <Circle cx="12" cy="10" r="3.5" fill="#000" />
        <Path
          d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"
          fill="#000"
          stroke="#000"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    over: <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={2} />,
  }),
)
