import {type FeedbackAttachment} from '@splito/sync'

/** The picture is stored inside the feedback record, so it stays small: about 2 MB of data URI. */
export const ATTACHMENT_MAX_URI_LENGTH = 2_800_000

/** The longest side of a stored picture, in pixels. */
export const ATTACHMENT_MAX_SIDE = 1280

/** null: the person cancelled the picker. */
export type PickResult =
  | {ok: true; attachment: FeedbackAttachment}
  | {ok: false; reason: 'notImage' | 'tooLarge' | 'failed'}
  | null
