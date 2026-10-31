import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * Google and Apple sign-in are not built (they need the auth API, F-2102), so the Continue screen does not offer
 * them as buttons that do nothing (F-275, ARCHITECTURE § 0 rule 6): one small muted line says they come with sync.
 * The buttons (owner 138) return with F-2102.
 */
export function SocialComing() {
  const t = useTheme()
  return (
    <Text testID="auth-social-coming" style={[a.text_xs, a.text_center, a.leading_snug, t.atoms.text_contrast_medium]}>
      <Trans>Google and Apple sign-in come with sync.</Trans>
    </Text>
  )
}
