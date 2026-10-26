// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/LeftNav.tsx (NavItem unread count)
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import {Bell_Stroke2_Corner0_Rounded as BellIcon} from '#/components/icons/Bell'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {useUnreadCount} from '#/features/notifications'

/**
 * The notifications bell at the far right of every top-level header (owner
 * directive), with Bluesky's unread badge. It counts unread changes from
 * others and pushes Notifications.
 */
export function HeaderBell() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const count = useUnreadCount()
  // Bluesky caps its badge the same way (`30+`).
  const countLabel = count > 30 ? '30+' : String(count)

  return (
    <Layout.Header.ActionButton
      testID="header-notifications"
      label={
        count > 0
          ? l`Notifications, ${plural(count, {
              one: '# unread item',
              other: '# unread items',
            })}`
          : l`Notifications`
      }
      icon={BellIcon}
      edge
      onPress={() => navigation.navigate('Notifications')}>
      {count > 0 ? (
        <View
          pointerEvents="none"
          style={[
            a.absolute,
            {top: 0, left: countLabel.length === 1 ? 17 : 14},
          ]}>
          <Text
            testID="header-notifications-badge"
            numberOfLines={1}
            style={[
              a.text_xs,
              a.font_semi_bold,
              a.rounded_full,
              a.text_center,
              a.leading_tight,
              {
                backgroundColor: t.palette.primary_500,
                color: t.palette.white,
                lineHeight: a.text_sm.fontSize,
                paddingHorizontal: 4,
                paddingVertical: 1,
                minWidth: 16,
                fontVariant: ['tabular-nums'],
              },
            ]}>
            {countLabel}
          </Text>
        </View>
      ) : null}
    </Layout.Header.ActionButton>
  )
}
