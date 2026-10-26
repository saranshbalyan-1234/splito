// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Layout/Header/index.tsx (MenuButton)
import {Keyboard} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useSetDrawerOpen} from '#/state/shell'
import {useMe} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a} from '#/alf'
import {Button} from '#/components/Button'
import {HEADER_SLOT_SIZE} from '#/components/Layout/const'
import * as Layout from '#/components/Layout'

const AVATAR_SIZE = 32
const HITSLOP = {top: 30, bottom: 10, left: 30, right: 30}

/**
 * The account avatar in Bluesky's hamburger spot, at the left of every
 * top-level header (owner directive). Like Bluesky's menu button, it opens
 * the drawer.
 */
export function HeaderAvatar() {
  const {t: l} = useLingui()
  const me = useMe()
  const setDrawerOpen = useSetDrawerOpen()

  const openDrawer = () => {
    Keyboard.dismiss()
    setDrawerOpen(true)
  }

  return (
    <Layout.Header.Slot>
      <Button
        testID="header-avatar"
        label={l`Open menu`}
        onPress={openDrawer}
        hitSlop={HITSLOP}
        style={[
          a.rounded_full,
          {width: HEADER_SLOT_SIZE, height: HEADER_SLOT_SIZE},
        ]}>
        {({hovered, pressed, focused}) => (
          <UserAvatar
            name={me?.data.name}
            size={AVATAR_SIZE}
            type="user"
            style={(hovered || pressed || focused) && {opacity: 0.85}}
          />
        )}
      </Button>
    </Layout.Header.Slot>
  )
}
