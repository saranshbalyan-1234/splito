// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Layout/Header/index.tsx (MenuButton)
import {Keyboard, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useSetDrawerOpen} from '#/state/shell'
import {useMe} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, tokens, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Slot} from '#/components/Layout/Header'

const HEADER_BUTTON_HITSLOP = {top: 30, bottom: 10, left: 30, right: 30}
const AVATAR_SIZE = 32

/**
 * The account avatar in Bluesky's drawer-button spot at the left of each
 * top-level header (owner directive). It opens the drawer on every platform
 * and width.
 */
export function HeaderAvatar() {
  const {t: l} = useLingui()
  const t = useTheme()
  const me = useMe()
  const setDrawerOpen = useSetDrawerOpen()

  return (
    <Slot>
      <Button
        testID="header-avatar"
        label={l`Open drawer menu`}
        hitSlop={HEADER_BUTTON_HITSLOP}
        onPress={() => {
          Keyboard.dismiss()
          setDrawerOpen(true)
        }}
        /*
         * A halo around the avatar on hover, as Bluesky's ghost header
         * buttons highlight. It overhangs the gutter so the avatar itself
         * lines up with the page's left edge, like Bluesky's menu button.
         */
        style={[
          a.rounded_full,
          a.self_start,
          {marginVertical: -tokens.space.xs, marginLeft: -tokens.space.xs},
        ]}>
        {({hovered, focused, pressed}) => (
          <View
            style={[
              a.rounded_full,
              a.p_xs,
              a.transition_color,
              (hovered || focused || pressed) && t.atoms.bg_contrast_25,
            ]}>
            <UserAvatar name={me?.data.name} size={AVATAR_SIZE} type="user" />
          </View>
        )}
      </Button>
    </Slot>
  )
}
