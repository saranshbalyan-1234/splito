import {memo, useState} from 'react'
import {type StyleProp, type TextStyle, type ViewStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useMyPersonId} from '#/state/me'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a} from '#/alf'
import * as ProfileCard from '#/components/ProfileCard'

/** The target Back-to-Bluesky's profile link gives a thumb: 44 px (ARCHITECTURE 18). */
const TARGET = 44
/** One line of the name's text, for sizing the target of a name on its own. */
const NAME_LINE = 20

/** Where a person opens: me -> Profile, anyone else (removed or unknown too) -> their page (owner 178, 206). */
export function personHref(id: string, isMe: boolean) {
  return isMe ? '/profile' : `/people/${id}`
}

/**
 * The one way a person's avatar or name is drawn and pressed (owner 178, F-261): Bluesky's profile link, a
 * `UserAvatar` and/or the name as a link, underlined on hover or focus on web, a 44 px target that does not move
 * the layout (padding with an equal negative margin), keyboard focusable. Me opens Profile, anyone else
 * `/people/:id`, where a removed person is read-only and an unknown one reads "Not on this device yet".
 *
 * Cheap on purpose (owners 152, 166): it subscribes to nothing. The caller passes the id and the names it already
 * holds; "is this me" is one context read of the signed-in actor.
 *
 * - `nested`: inside a row that opens something else (an expense row). It is its own press target and carries no
 *   `href`, because an anchor cannot sit inside another anchor.
 * - `isInsideLink`: inside a row that already opens this very person (a People row): the content only, so there is
 *   still one target.
 */
export const PersonLink = memo(function PersonLink({
  id,
  name,
  avatarName,
  show = 'both',
  size = 36,
  nested = false,
  isInsideLink = false,
  testID,
  style,
  textStyle,
}: {
  id: string
  /** What is read out and shown as the name ("You" for me). */
  name: string
  /** The name the avatar draws its initials and hue from (your own name for "You"); defaults to `name`. */
  avatarName?: string
  show?: 'both' | 'avatar' | 'name'
  /** The avatar's size. */
  size?: number
  nested?: boolean
  isInsideLink?: boolean
  testID?: string
  /** Layout of the link itself in its row (`a.flex_1`, `a.flex_shrink`...). */
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}) {
  const {t: l} = useLingui()
  const actor = useMyPersonId()
  const [isActive, setIsActive] = useState(false)
  const isMe = id === actor
  const hasAvatar = show !== 'name'
  const hasName = show !== 'avatar'

  const content = (
    <>
      {hasAvatar ? <UserAvatar size={size} name={avatarName ?? name} type="user" /> : null}
      {hasName ? (
        <ProfileCard.Name
          profile={{name}}
          style={a.flex_shrink}
          textStyle={[textStyle, isActive && {textDecorationLine: 'underline'}]}
        />
      ) : null}
    </>
  )
  if (isInsideLink) return content

  /* Grow to a 44 px target without moving anything around: the padding is taken back by the margin. */
  const height = hasAvatar ? size : NAME_LINE
  const padY = Math.max(0, Math.ceil((TARGET - height) / 2))
  const padX = show === 'avatar' ? Math.max(0, Math.ceil((TARGET - size) / 2)) : 0
  const label = isMe ? l`Open your profile` : l`Open ${name}`

  return (
    <Link
      testID={testID}
      href={personHref(id, isMe)}
      asAnchor={!nested}
      anchorNoUnderline
      accessibilityLabel={label}
      accessibilityHint=""
      onPointerEnter={() => setIsActive(true)}
      onPointerLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        {minWidth: 0, paddingVertical: padY, marginVertical: -padY, paddingHorizontal: padX, marginHorizontal: -padX},
        style,
      ]}>
      {content}
    </Link>
  )
})
