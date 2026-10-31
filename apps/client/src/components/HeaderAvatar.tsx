// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/Layout/Header/index.tsx (MenuButton)
import {Keyboard, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'

import {useMe} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a} from '#/alf'
import {Button} from '#/components/Button'
import * as Toast from '#/components/Toast'
import {SyncStatusDot, useSyncLabel} from '#/components/SyncStatusDot'
import {HEADER_SLOT_SIZE} from '#/components/Layout/const'
import * as Layout from '#/components/Layout'
import {usePushedTab} from '#/components/TabScreen'

const AVATAR_SIZE = 32
const HITSLOP = {top: 30, bottom: 10, left: 30, right: 30}

/**
 * The account avatar in Bluesky's hamburger spot, at the left of every
 * top-level header (owner directive). At every width it opens Profile (owners 201, 206); there is no side drawer
 * (owner 217).
 */
export function HeaderAvatar() {
  /* A main screen opened from a link is a pushed page: Back in this spot (owner 179, § 26.3). */
  return usePushedTab() ? <Layout.Header.BackButton /> : <AccountAvatar />
}

function AccountAvatar() {
  const {t: l} = useLingui()
  const me = useMe()
  const navigation = useNavigation<NavigationProp>()
  const {state, label: syncLabel} = useSyncLabel()

  const openProfile = () => {
    Keyboard.dismiss()
    navigation.navigate('Profile')
  }

  return (
    <Layout.Header.Slot>
      <Button
        testID="header-avatar"
        label={`${l`Open profile`}. ${syncLabel}`}
        onPress={openProfile}
        /* Native has no hover: a long press says the sync state (web shows it as a tooltip). */
        onLongPress={() => Toast.show(syncLabel, {type: 'info'})}
        hitSlop={HITSLOP}
        style={[
          a.rounded_full,
          {width: HEADER_SLOT_SIZE, height: HEADER_SLOT_SIZE},
        ]}>
        {({hovered, pressed, focused}) => (
          <View>
            <UserAvatar
              name={me?.data.name}
              size={AVATAR_SIZE}
              type="user"
              style={(hovered || pressed || focused) && {opacity: 0.85}}
            />
            <SyncStatusDot
              avatarSize={AVATAR_SIZE}
              state={state}
              label={syncLabel}
            />
          </View>
        )}
      </Button>
    </Layout.Header.Slot>
  )
}
