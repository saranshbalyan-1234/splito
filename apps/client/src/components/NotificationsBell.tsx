// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/bottom-bar/BottomBar.tsx (Btn notification badge)
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import {useActivityBadge} from '#/components/activity/useActivityFeed'
import {Button, ButtonIcon} from '#/components/Button'
import {Bell_Stroke2_Corner0_Rounded as BellIcon} from '#/components/icons/Bell'
import {BUTTON_VISUAL_ALIGNMENT_OFFSET} from '#/components/Layout/const'
import {Slot} from '#/components/Layout/Header'
import {Text} from '#/components/Typography'

const HEADER_BUTTON_HITSLOP = {top: 30, bottom: 10, left: 10, right: 30}

/**
 * The bell at the far right of every top-level header (owner directive:
 * notifications live in the header). It pushes Notifications and carries
 * Bluesky's unread badge, counting only changes by other people.
 */
export function NotificationsBell() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const count = useActivityBadge()
  const unread = count
    ? plural(Number.parseInt(count, 10) || 0, {
        one: '# unread item',
        other: '# unread items',
      })
    : ''

  return (
    <Slot>
      <Button
        testID="header-notifications"
        label={unread ? l`Notifications, ${unread}` : l`Notifications`}
        size="small"
        variant="ghost"
        color="secondary"
        shape="round"
        hitSlop={HEADER_BUTTON_HITSLOP}
        onPress={() => navigation.navigate('Notifications')}
        style={[{marginRight: -BUTTON_VISUAL_ALIGNMENT_OFFSET}]}>
        <ButtonIcon icon={BellIcon} size="lg" />
        {count ? (
          <View
            testID="header-notifications-badge"
            pointerEvents="none"
            style={[
              a.absolute,
              a.rounded_full,
              {
                top: -4,
                right: -6,
                paddingHorizontal: 5,
                paddingVertical: 1,
                minWidth: 18,
                backgroundColor: t.palette.primary_500,
                borderWidth: 2,
                borderColor: t.atoms.bg.backgroundColor,
              },
            ]}>
            <Text
              style={[
                a.text_center,
                a.font_semi_bold,
                {
                  fontSize: 11,
                  lineHeight: 13,
                  color: t.palette.white,
                  fontVariant: ['tabular-nums'],
                },
              ]}>
              {count}
            </Text>
          </View>
        ) : null}
      </Button>
    </Slot>
  )
}
