import {memo, useState} from 'react'
import {type StyleProp, type TextStyle, View, type ViewStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {IS_WEB} from '#/env'
import {personPath} from '#/lib/links/make'
import {useMyPersonId} from '#/state/me'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a} from '#/alf'
import * as ProfileCard from '#/components/ProfileCard'

/** The smallest touch target (ARCHITECTURE 18). */
const TARGET = 44
/** One line of the name's text, for sizing the target of a name on its own. */
const NAME_LINE = 20

/** Where a person opens: me -> Profile, anyone else (removed or unknown too) -> their page (owner 178, 206). */
export function personHref(id: string, isMe: boolean) {
  return personPath(id, isMe)
}

/*
 * A link is activated by Enter; react-native-web's Pressable does not take Space for a role=link. A person's avatar
 * is also a thing people press with Space, so it does the same click (one shared function, no closure per link).
 */
const clickOnSpace = (e: {key: string; preventDefault(): void; currentTarget: {click(): void}}) => {
  if (e.key !== ' ') return
  e.preventDefault()
  e.currentTarget.click()
}
const SPACE_PROPS = IS_WEB ? ({onKeyDown: clickOnSpace} as object) : null

type Props = {
  id: string
  /** What is read out and shown as the name ("You" for me). */
  name: string
  /** The name the avatar draws its initials and hue from (your own name for "You"); defaults to `name`. */
  avatarName?: string
  show?: 'both' | 'avatar' | 'name'
  /** The avatar's size. */
  size?: number
  /**
   * Inside a row that already opens this very person (a People row): the content only, so there is still one
   * target. A link inside a row that opens something else (an expense row) needs no flag: it is its own anchor.
   */
  isInsideLink?: boolean
  testID?: string
  /** Layout of the link itself in its row (`a.flex_1`, `a.flex_shrink`...). */
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  /** A line under the name, inside the same link (a share's detail), so a row still has one tab stop. */
  below?: React.ReactNode
}

/**
 * The one way a person's avatar or name is drawn and pressed (owner 178, F-261): Bluesky's profile link, a
 * `UserAvatar` and/or the name as a link, underlined on hover or focus on web, a 44 px target that does not move
 * the layout (padding with an equal negative margin), keyboard focusable (an anchor with an `href`, so Enter,
 * Space and Cmd-click work). Me opens Profile, anyone else `/people/:id`, where a removed person is read-only and
 * an unknown one reads "Not on this device yet".
 *
 * Cheap on purpose (owners 152, 166): it subscribes to nothing. The caller passes the id and the names it already
 * holds; "is this me" is one context read of the signed-in actor. An avatar-only link (most of them) holds no state
 * and no hover handlers; only a link that shows the name tracks hover and focus for its underline.
 */
export const PersonLink = memo(function PersonLink(props: Props) {
  if (props.isInsideLink) return <Content {...props} isActive={false} />
  return props.show === 'avatar' ? <Target {...props} /> : <NamedTarget {...props} />
})

function Content({
  name,
  avatarName,
  show = 'both',
  size = 36,
  textStyle,
  below,
  isActive,
}: Props & {isActive: boolean}) {
  const nameNode =
    show === 'avatar' ? null : (
      <ProfileCard.Name
        profile={{name}}
        style={a.flex_shrink}
        textStyle={[textStyle, isActive && {textDecorationLine: 'underline'}]}
      />
    )
  return (
    <>
      {show === 'name' ? null : <UserAvatar size={size} name={avatarName ?? name} type="user" />}
      {below && nameNode ? (
        <View style={[a.flex_shrink, {minWidth: 0}]}>
          {nameNode}
          {below}
        </View>
      ) : (
        nameNode
      )}
    </>
  )
}

/** Hover and focus underline the name: state lives here, in links that show one, not in every avatar. */
function NamedTarget(props: Props) {
  const [isActive, setIsActive] = useState(false)
  return (
    <Target
      {...props}
      isActive={isActive}
      onActiveChange={setIsActive}
    />
  )
}

function Target({
  id,
  isActive = false,
  onActiveChange,
  testID,
  style,
  ...rest
}: Props & {isActive?: boolean; onActiveChange?: (isActive: boolean) => void}) {
  const {t: l} = useLingui()
  const actor = useMyPersonId()
  const isMe = id === actor
  const {name, show = 'both', size = 36} = rest
  /* Grow to a 44 px target without moving anything around: the padding is taken back by the margin. */
  const height = show === 'name' ? NAME_LINE : size
  const padY = Math.max(0, Math.ceil((TARGET - height) / 2))
  const padX = show === 'avatar' ? Math.max(0, Math.ceil((TARGET - size) / 2)) : 0
  const label = isMe ? l`Open your profile` : l`Open ${name}`

  return (
    <Link
      testID={testID}
      href={personHref(id, isMe)}
      asAnchor
      anchorNoUnderline
      accessibilityLabel={label}
      accessibilityHint=""
      {...SPACE_PROPS}
      {...(onActiveChange
        ? {
            onPointerEnter: () => onActiveChange(true),
            onPointerLeave: () => onActiveChange(false),
            onFocus: () => onActiveChange(true),
            onBlur: () => onActiveChange(false),
          }
        : null)}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        {minWidth: 0, paddingVertical: padY, marginVertical: -padY, paddingHorizontal: padX, marginHorizontal: -padX},
        style,
      ]}>
      <Content {...rest} id={id} isActive={isActive} />
    </Link>
  )
}
