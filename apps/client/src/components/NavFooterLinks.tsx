// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/RightNav.tsx (footer links) and src/components/Link.tsx (InlineLinkText)
import {Fragment, useState} from 'react'
import {type GestureResponderEvent, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useTheme, web, type ViewStyleProp} from '#/alf'
import {Text} from '#/components/Typography'

type Section = 'help' | 'privacy' | 'about'

/**
 * Bluesky's footer links ("Feedback · Privacy · Terms · Help"), shared by the
 * desktop sidebar and the phone drawer (ARCHITECTURE 26.3, 26.5, 26.7):
 * Help · Privacy · About, each opening its Settings page.
 */
export function NavFooterLinks({
  onBeforeNavigate,
  style,
}: {
  /** The drawer closes before the page opens. */
  onBeforeNavigate?: () => void
} & ViewStyleProp) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  /*
   * TODO(F-226): Feedback leads the row once its sheet ships; until then it
   * is left out rather than opening nothing.
   */
  const links: {section: Section; label: string}[] = [
    {section: 'help', label: l`Help`},
    {section: 'privacy', label: l`Privacy`},
    {section: 'about', label: l`About`},
  ]

  return (
    <View testID="nav-footer-links" style={style}>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_low]}>
        {links.map(({section, label}, i) => (
          <Fragment key={section}>
            {i > 0 && (
              <Text style={[a.text_sm, t.atoms.text_contrast_low]}>
                {' ∙ '}
              </Text>
            )}
            <FooterLink
              testID={`nav-footer-${section}`}
              label={label}
              href={`/settings/${section}`}
              onPress={() => {
                onBeforeNavigate?.()
                navigation.navigate('SettingsSection', {section})
              }}
            />
          </Fragment>
        ))}
      </Text>
    </View>
  )
}

/* Bluesky's InlineLinkText: medium contrast, underlined on hover and focus. */
function FooterLink({
  testID,
  label,
  href,
  onPress,
}: {
  testID: string
  label: string
  href: string
  onPress: () => void
}) {
  const t = useTheme()
  const [isActive, setIsActive] = useState(false)
  return (
    <Text
      testID={testID}
      role="link"
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint=""
      href={href}
      onPress={(e: GestureResponderEvent) => {
        e.preventDefault?.()
        onPress()
      }}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      {...web({
        onMouseEnter: () => setIsActive(true),
        onMouseLeave: () => setIsActive(false),
      })}
      style={[
        a.text_sm,
        a.leading_snug,
        t.atoms.text_contrast_medium,
        isActive && web({textDecorationLine: 'underline', outline: 0}),
      ]}>
      {label}
    </Text>
  )
}
