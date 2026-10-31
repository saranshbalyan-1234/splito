/* Lucide "contact-round" (ISC): the People tab, a person on a contact card. The Groups tab is `GroupsTab` (several people). */
import {ContactRound} from 'lucide-react-native'
import {Circle, Path, Rect} from 'react-native-svg'

import {createFilledIcon, createIcon} from '#/components/icons/lucide'

export const ContactRound_Stroke2_Corner0_Rounded = createIcon(ContactRound)

/**
 * A solid card with the person cut out (owner 216). Filling Lucide's outline painted the head and shoulders over and
 * left a plain square that read as a calendar; the cut-outs keep the person, as Bluesky's filled icons do.
 */
export const ContactRound_Filled_Corner0_Rounded = createFilledIcon('ContactRound', c => ({
  body: (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" fill={c} stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M16 2v2M8 2v2" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  holes: (
    <>
      <Circle cx="12" cy="10.5" r="3.25" fill="#000" />
      <Path d="M17 21a5 5 0 0 0-10 0z" fill="#000" />
    </>
  ),
}))
